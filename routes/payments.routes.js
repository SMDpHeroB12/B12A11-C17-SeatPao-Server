const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

module.exports = (bookingsCollection, ticketsCollection, paymentCollection) => {
  // initialize stripe with secret from env
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

  // Create Checkout Session for a booking
  router.post("/create-checkout-session", async (req, res) => {
    try {
      const { bookingId } = req.body;
      if (!bookingId)
        return res.status(400).send({ error: "bookingId required" });

      // fetch booking
      const { ObjectId } = require("mongodb");
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(bookingId),
      });
      if (!booking) return res.status(404).send({ error: "Booking not found" });

      if (booking.paid)
        return res.status(400).send({ error: "Booking already paid" });
      if (booking.status !== "accepted")
        return res
          .status(400)
          .send({ error: "Booking not accepted by vendor yet" });

      // Check departure time (if stored in booking or fetch ticket)
      let ticket = null;
      if (booking.ticketId) {
        ticket = await ticketsCollection.findOne({
          _id: new ObjectId(booking.ticketId),
        });
      }

      // If ticket has departure date/time, ensure it's not past
      if (ticket) {
        const dep =
          ticket.date && ticket.time
            ? new Date(`${ticket.date}T${ticket.time}`)
            : ticket.departure
            ? new Date(ticket.departure)
            : null;
        if (dep && dep.getTime() <= Date.now()) {
          return res
            .status(400)
            .send({ error: "Departure already passed. Payment not allowed." });
        }
      }

      // Create Checkout Session

      const amount = Math.round((booking.total || 0) * 100);

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: process.env.STRIPE_CURRENCY || "usd",
              product_data: {
                name: booking.ticketTitle || "Ticket Booking",
                metadata: {
                  bookingId: bookingId,
                  userEmail: booking.userEmail || "",
                },
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${CLIENT_URL}/payment/cancel`,
        metadata: {
          bookingId: bookingId,
          userEmail: booking.userEmail || "",
        },
      });

      res.send({ url: session.url });
    } catch (err) {
      console.error("create-checkout-session error:", err);
      res.status(500).send({ error: "Server error creating session" });
    }
  });

  // Confirm payment after checkout redirect (client provides session_id)
  router.post("/confirm", async (req, res) => {
    try {
      const { session_id } = req.body;
      if (!session_id)
        return res.status(400).send({ error: "session_id required" });

      // retrieve session from stripe
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["payment_intent"],
      });

      if (!session) return res.status(404).send({ error: "Session not found" });

      // Only proceed if payment is paid
      // session.payment_status can be 'paid'
      if (session.payment_status !== "paid") {
        return res.status(400).send({ error: "Payment not completed" });
      }

      // get metadata (bookingId)
      const bookingId = session.metadata?.bookingId;
      const userEmail =
        session.metadata?.userEmail || session.customer_details?.email || "";

      // insert payment record
      const paymentDoc = {
        bookingId: bookingId || null,
        transactionId: session.payment_intent || session.id,
        amount: (session.amount_total || session.amount_subtotal || 0) / 100,
        currency: session.currency || process.env.STRIPE_CURRENCY || "usd",
        ticketTitle:
          session.display_items?.[0]?.custom?.name ||
          session.line_items?.[0]?.description ||
          session.payment_intent?.description ||
          "",
        userEmail,
        createdAt: new Date(),
        raw: session,
      };

      // Save payment
      const insertResult = await paymentCollection.insertOne(paymentDoc);

      // Update booking: set paid true, status paid, transactionId
      const { ObjectId } = require("mongodb");
      if (bookingId) {
        await bookingsCollection.updateOne(
          { _id: new ObjectId(bookingId) },
          {
            $set: {
              paid: true,
              status: "paid",
              transactionId: session.payment_intent || session.id,
            },
          }
        );
      }

      res.send({ success: true });
    } catch (err) {
      console.error("Payment confirm error:", err);
      res.status(500).send({ error: "Server error confirming payment" });
    }
  });

  // Get payments for a user (query param ?email=)
  router.get("/", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "email required" });

      const result = await paymentCollection
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("Get payments error:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // Admin: get all payments
  router.get("/all", async (req, res) => {
    try {
      const result = await paymentCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("Get all payments error:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  return router;
};

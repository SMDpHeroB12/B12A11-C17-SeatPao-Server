const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ObjectId } = require("mongodb");
const Stripe = require("stripe");

const app = express();
const port = process.env.PORT || 5000;

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: ["http://localhost:5173", "https://seatpao-b12a11c17.web.app"],
    credentials: true,
  })
);
app.use(express.json());

// ================= STRIPE =================
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ================= MONGO DB =================
const client = new MongoClient(process.env.MONGO_URI);

async function run() {
  try {
    // await client.connect();

    const db = client.db("seatpaoDB");

    const tickets = db.collection("tickets");
    const users = db.collection("users");
    const bookings = db.collection("bookings");
    const payments = db.collection("payments");

    /* =====================================================
      USERS
  ===================================================== */

    //  CREATE USER

    app.post("/users", async (req, res) => {
      const user = req.body;

      if (!user.email) {
        return res.status(400).send({ error: "Email required" });
      }

      const exists = await users.findOne({ email: user.email });
      if (exists) {
        return res.send({ message: "User already exists" });
      }

      const userDoc = {
        email: user.email,
        displayName: user.displayName || "",
        photoURL: user.photoURL || "",
        role: "user", // default
        fraud: false,
        createdAt: new Date(),
      };

      const result = await users.insertOne(userDoc);
      res.send(result);
    });

    //===========================================================

    app.get("/users/:email", async (req, res) => {
      const user = await users.findOne({ email: req.params.email });
      res.send(user || {});
    });

    /* =====================================================
    ADMIN - MANAGE USERS
===================================================== */

    // GET ALL USERS
    app.get("/admin/users", async (req, res) => {
      const result = await users.find({}).toArray();
      res.send(result);
    });

    // MAKE ADMIN
    app.patch("/admin/users/make-admin/:id", async (req, res) => {
      const result = await users.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role: "admin" } }
      );
      res.send(result);
    });
    // MAKE VENDOR
    app.patch("/admin/users/make-vendor/:id", async (req, res) => {
      const result = await users.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role: "vendor", fraud: false } }
      );
      res.send(result);
    });

    // MARK FRAUD
    app.patch("/admin/users/fraud/:id", async (req, res) => {
      const user = await users.findOne({ _id: new ObjectId(req.params.id) });

      if (!user || user.role !== "vendor") {
        return res.status(400).send({ error: "Not a vendor" });
      }

      // Mark vendor as fraud
      await users.updateOne({ _id: user._id }, { $set: { fraud: true } });

      // Hide all tickets of this vendor
      await tickets.updateMany(
        { vendorEmail: user.email },
        { $set: { hidden: true } }
      );

      res.send({ success: true });
    });

    // DELETE USER
    app.delete("/admin/users/:id", async (req, res) => {
      const result = await users.deleteOne({
        _id: new ObjectId(req.params.id),
      });

      res.send(result);
    });

    /* =====================================================
     ADMIN - MANAGE TICKETS
  ===================================================== */

    // GET ALL TICKETS (pending + approved + rejected)
    app.get("/admin/tickets", async (req, res) => {
      const result = await tickets.find({}).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    // APPROVE TICKET
    app.patch("/admin/tickets/approve/:id", async (req, res) => {
      const result = await tickets.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "approved" } }
      );
      res.send(result);
    });

    // REJECT TICKET
    app.patch("/admin/tickets/reject/:id", async (req, res) => {
      const result = await tickets.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "rejected" } }
      );
      res.send(result);
    });

    // ADMIN - ADVERTISE / UN-ADVERTISE TICKET
    app.patch("/admin/tickets/advertise/:id", async (req, res) => {
      const { advertised } = req.body;

      const result = await tickets.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { advertised } }
      );

      res.send(result);
    });

    /* =====================================================
    ADMIN DASHBOARD OVERVIEW
===================================================== */
    app.get("/dashboard/admin", async (req, res) => {
      try {
        const totalUsers = await users.countDocuments();
        const totalTickets = await tickets.countDocuments();
        const totalBookings = await bookings.countDocuments();

        // Sum of revenue from payments
        const revenueResult = await payments
          .aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$amount" },
              },
            },
          ])
          .toArray();

        const totalRevenue = revenueResult[0]?.totalRevenue || 0;

        res.send({
          users: totalUsers,
          tickets: totalTickets,
          bookings: totalBookings,
          revenue: totalRevenue,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to load admin dashboard stats" });
      }
    });

    /* =====================================================
      TICKETS (PUBLIC)
  ===================================================== */
    app.get("/tickets", async (req, res) => {
      const result = await tickets
        .find({ status: "approved", hidden: false })
        .toArray();
      res.send(result);
    });

    app.get("/tickets/:id", async (req, res) => {
      const ticket = await tickets.findOne({
        _id: new ObjectId(req.params.id),
        status: "approved",
        hidden: false,
      });
      res.send(ticket || {});
    });

    /* =====================================================
      TICKETS (VENDOR ADD - FRAUD CHECKED)
  ===================================================== */
    app.post("/tickets", async (req, res) => {
      try {
        const ticket = req.body;

        // FRAUD CHECK (ADDED AS REQUESTED)
        const vendor = await users.findOne({ email: ticket.vendorEmail });

        if (vendor?.fraud) {
          return res.status(403).send({ error: "Vendor is marked as fraud" });
        }

        const ticketDoc = {
          ...ticket,
          status: "pending",
          hidden: false,
          createdAt: new Date(),
        };

        const result = await tickets.insertOne(ticketDoc);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to add ticket" });
      }
    });

    /* =====================================================
    UPDATE TICKET (VENDOR)
===================================================== */
    app.patch("/tickets/:id", async (req, res) => {
      try {
        const ticketId = req.params.id;
        const updatedData = req.body;

        const ticket = await tickets.findOne({
          _id: new ObjectId(ticketId),
        });

        if (!ticket) {
          return res.status(404).send({ error: "Ticket not found" });
        }

        // ❌ Rejected ticket cannot be updated
        if (ticket.status === "rejected") {
          return res
            .status(403)
            .send({ error: "Rejected ticket cannot be updated" });
        }

        // Prevent changing verification status
        delete updatedData.status;
        delete updatedData.vendorEmail;
        delete updatedData.createdAt;

        await tickets.updateOne(
          { _id: ticket._id },
          {
            $set: {
              ...updatedData,
              updatedAt: new Date(),
            },
          }
        );

        res.send({ success: true });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to update ticket" });
      }
    });

    /* =====================================================
    DELETE TICKET (VENDOR)
===================================================== */
    app.delete("/tickets/:id", async (req, res) => {
      try {
        const ticketId = req.params.id;

        const ticket = await tickets.findOne({
          _id: new ObjectId(ticketId),
        });

        if (!ticket) {
          return res.status(404).send({ error: "Ticket not found" });
        }

        // ❌ Rejected ticket cannot be deleted
        if (ticket.status === "rejected") {
          return res
            .status(403)
            .send({ error: "Rejected ticket cannot be deleted" });
        }

        await tickets.deleteOne({ _id: ticket._id });

        res.send({ success: true });
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to delete ticket" });
      }
    });

    /* =====================================================
      BOOKINGS (USER + VENDOR + ADMIN)
  ===================================================== */

    // CREATE BOOKING
    app.post("/bookings", async (req, res) => {
      try {
        const { ticketId, quantity, userEmail } = req.body;

        if (!ticketId || !quantity || !userEmail) {
          return res.status(400).send({ error: "Invalid booking data" });
        }

        const ticket = await tickets.findOne({
          _id: new ObjectId(ticketId),
          status: "approved",
          hidden: false,
        });

        if (!ticket) {
          return res.status(404).send({ error: "Ticket not found" });
        }

        if (ticket.seats < quantity) {
          return res.status(400).send({ error: "Not enough seats available" });
        }

        const bookingDoc = {
          ticketId: ticket._id,
          ticketTitle: ticket.title,
          ticketImage: ticket.image,
          from: ticket.from,
          to: ticket.to,
          departureDate: ticket.date,
          departureTime: ticket.time,

          vendorEmail: ticket.vendorEmail,
          userEmail,

          quantity,
          unitPrice: ticket.price,
          totalPrice: ticket.price * quantity,

          status: "pending",
          paid: false,
          transactionId: null,

          createdAt: new Date(),
        };

        const result = await bookings.insertOne(bookingDoc);

        res.send({
          success: true,
          bookingId: result.insertedId,
        });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Booking failed" });
      }
    });

    // GET BOOKINGS
    app.get("/bookings", async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ error: "email required" });
      }

      // ADMIN / VENDOR
      if (email === "all") {
        const allBookings = await bookings
          .find({})
          .sort({ createdAt: -1 })
          .toArray();

        return res.send(allBookings);
      }

      // USER
      const userBookings = await bookings
        .find({ userEmail: email })
        .sort({ createdAt: -1 })
        .toArray();

      res.send(userBookings);
    });

    /* =====================================================
      VENDOR ACTIONS
  ===================================================== */

    app.patch("/bookings/accept/:id", async (req, res) => {
      const booking = await bookings.findOne({
        _id: new ObjectId(req.params.id),
      });

      if (!booking) {
        return res.status(404).send({ error: "Booking not found" });
      }

      await bookings.updateOne(
        { _id: booking._id },
        { $set: { status: "accepted" } }
      );

      res.send({ success: true });
    });

    app.patch("/bookings/reject/:id", async (req, res) => {
      await bookings.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { status: "rejected" } }
      );
      res.send({ success: true });
    });

    /* =====================================================
      PAYMENTS (STRIPE)
  ===================================================== */

    app.post("/payments/create-checkout-session", async (req, res) => {
      const { bookingId } = req.body;

      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
        status: "accepted",
        paid: false,
      });

      if (!booking) {
        return res.status(400).send({ error: "Invalid booking" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "bdt",
              product_data: { name: booking.ticketTitle },
              unit_amount: booking.totalPrice,
            },
            quantity: 1,
          },
        ],
        metadata: { bookingId },
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      });

      res.send({ url: session.url });
    });

    // CONFIRM PAYMENT
    app.post("/payments/confirm", async (req, res) => {
      const { session_id } = req.body;

      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return res.status(400).send({ error: "Payment not completed" });
      }

      const bookingId = session.metadata.bookingId;
      const booking = await bookings.findOne({
        _id: new ObjectId(bookingId),
      });

      await tickets.updateOne(
        { _id: booking.ticketId },
        { $inc: { seats: -booking.quantity } }
      );

      await bookings.updateOne(
        { _id: booking._id },
        {
          $set: {
            paid: true,
            status: "paid",
            transactionId: session.payment_intent,
          },
        }
      );

      // FIXED PAYMENT INSERT
      await payments.insertOne({
        bookingId: booking._id,
        userEmail: booking.userEmail,
        vendorEmail: booking.vendorEmail,
        ticketTitle: booking.ticketTitle,
        ticketImage: booking.ticketImage,
        amount: booking.totalPrice,
        transactionId: session.payment_intent,
        paymentDate: new Date(),
      });

      res.send({ success: true });
    });

    /* =====================================================
      PAYMENTS LIST (USER + VENDOR)
  ===================================================== */

    app.get("/payments", async (req, res) => {
      const email = req.query.email;
      const vendor = req.query.vendor;

      if (email) {
        const result = await payments
          .find({ userEmail: email })
          .sort({ paymentDate: -1 })
          .toArray();
        return res.send(result);
      }

      if (vendor) {
        const result = await payments
          .find({ vendorEmail: vendor })
          .sort({ paymentDate: -1 })
          .toArray();
        return res.send(result);
      }

      res.send([]);
    });

    /* =====================================================
    VENDOR DASHBOARD OVERVIEW
===================================================== */
    app.get("/vendor/stats", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ error: "Vendor email required" });
        }

        // Total tickets added by vendor
        const totalTickets = await tickets.countDocuments({
          vendorEmail: email,
        });

        // Total bookings on vendor tickets
        const totalBookings = await bookings.countDocuments({
          vendorEmail: email,
        });

        // Total revenue earned by vendor
        const revenueResult = await payments
          .aggregate([
            {
              $match: { vendorEmail: email },
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$amount" },
              },
            },
          ])
          .toArray();

        const totalRevenue = revenueResult[0]?.totalRevenue || 0;

        // Recent tickets (latest 6)
        const recentTickets = await tickets
          .find({ vendorEmail: email })
          .sort({ createdAt: -1 })
          .limit(6)
          .project({
            title: 1,
            price: 1,
            transportType: 1,
            from: 1,
            to: 1,
          })
          .toArray();

        res.send({
          stats: {
            tickets: totalTickets,
            bookings: totalBookings,
            revenue: totalRevenue,
          },
          recent: recentTickets.map((t) => ({
            _id: t._id,
            route: `${t.from} → ${t.to}`,
            price: t.price,
            type: t.transportType,
          })),
        });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "Failed to load vendor dashboard stats" });
      }
    });

    /* ===================================================== */

    app.get("/", (req, res) => {
      res.send("SeatPao + MongoDB Running (Clean)");
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

run();

app.listen(port, () => {
  console.log("Server running on port", port);
});

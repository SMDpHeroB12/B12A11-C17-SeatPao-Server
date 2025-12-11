const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

module.exports = (bookingsCollection) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  //create checkout sessions
  router.post("/create-checkout-session", async (req, res) => {
    try {
      const { bookingId } = req.body;
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(bookingId),
      });

      if (!booking) return res.send({ error: "Booking not found" });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "bdt",
              product_data: { name: booking.ticketTitle },
              unit_amount: booking.total * 100,
            },
            quantity: 1,
          },
        ],
        success_url: `http://localhost:5173/payment-success/${bookingId}`,
        cancel_url: `http://localhost:5173/payment-cancel/${bookingId}`,
      });

      res.send({ url: session.url });
    } catch (err) {
      console.log(err);
      res.send({ error: "Payment session failed" });
    }
  });

  // Create Payment Intent
  router.post("/create-payment-intent", async (req, res) => {
    try {
      const { bookingId, amount } = req.body;

      if (!bookingId || !amount) {
        return res.status(400).send({ error: "Missing bookingId or amount" });
      }

      // Create Stripe Payment Intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(amount * 100), // convert BDT to cents
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    } catch (err) {
      console.error("Stripe Error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  return router;
};

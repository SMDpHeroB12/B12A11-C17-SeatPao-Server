const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

module.exports = (bookingsCollection) => {
  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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

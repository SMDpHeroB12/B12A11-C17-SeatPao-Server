const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

module.exports = (
  usersCollection,
  ticketsCollection,
  bookingsCollection,
  paymentCollection
) => {
  // 1. GET ALL USERS (Manage Users)
  router.get("/users", async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

  // 2. UPDATE USER ROLE
  router.patch("/role/:email", async (req, res) => {
    const email = req.params.email;
    const { role } = req.body;

    const result = await usersCollection.updateOne(
      { email },
      { $set: { role } }
    );

    res.send(result);
  });

  // 3. MARK VENDOR AS FRAUD
  router.patch("/mark-fraud/:email", async (req, res) => {
    const email = req.params.email;

    await usersCollection.updateOne({ email }, { $set: { fraudulent: true } });

    // Hide vendor tickets
    await ticketsCollection.updateMany(
      { vendorEmail: email },
      { $set: { hidden: true } }
    );

    res.send({ success: true });
  });

  // 4. ADMIN GET ALL TICKETS
  router.get("/tickets", async (req, res) => {
    const result = await ticketsCollection.find().toArray();
    res.send(result);
  });

  // 5. ADVERTISE TICKETS – GET APPROVED TICKETS
  router.get("/advertise-list", async (req, res) => {
    try {
      const tickets = await ticketsCollection
        .find({ status: "approved" })
        .toArray();

      res.send(tickets);
    } catch (err) {
      res.status(500).send({ error: "Failed to load advertise list" });
    }
  });

  // 6. TOGGLE ADVERTISE
  router.patch("/advertise/:id", async (req, res) => {
    try {
      const id = req.params.id;

      const ticket = await ticketsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!ticket) return res.status(404).send({ error: "Ticket not found" });

      const current = ticket.advertised === true;

      // Count existing advertised tickets
      const count = await ticketsCollection.countDocuments({
        advertised: true,
      });

      if (!current && count >= 6) {
        return res.status(400).send({
          error: "Maximum 6 advertised tickets allowed",
        });
      }

      const result = await ticketsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { advertised: !current } }
      );

      res.send({ success: true });
    } catch (err) {
      res.status(500).send({ error: "Failed to toggle advertise" });
    }
  });

  // 7. ADMIN DASHBOARD STATS
  router.get("/stats", async (req, res) => {
    try {
      const users = await usersCollection.countDocuments();
      const tickets = await ticketsCollection.countDocuments();
      const bookings = await bookingsCollection.countDocuments();

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

      res.send({
        users,
        tickets,
        bookings,
        revenue,
      });
    } catch (err) {
      res.send({ error: "Failed to load stats" });
    }
  });

  return router;
};

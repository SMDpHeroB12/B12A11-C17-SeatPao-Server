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
  // ================================
  router.get("/users", async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

  // 2. UPDATE USER ROLE (admin/vendor/user)
  // ======================================
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
  // ================================
  router.patch("/mark-fraud/:email", async (req, res) => {
    const email = req.params.email;

    // Step 1 → Update usersCollection
    await usersCollection.updateOne({ email }, { $set: { fraudulent: true } });

    // Step 2 → Hide all tickets of this vendor
    await ticketsCollection.updateMany(
      { vendorEmail: email },
      { $set: { hidden: true } }
    );

    res.send({ success: true });
  });

  // 4. ADMIN GET ALL TICKETS
  // ================================
  router.get("/tickets", async (req, res) => {
    const result = await ticketsCollection.find().toArray();
    res.send(result);
  });

  // 5. ADMIN DASHBOARD STATS
  // ================================
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
      console.log(err);
      res.send({ error: "Failed to load stats" });
    }
  });

  return router;
};

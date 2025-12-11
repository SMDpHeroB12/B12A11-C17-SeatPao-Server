const express = require("express");
const router = express.Router();

// Will receive usersCollection AND ticketsCollection from index.js
module.exports = (usersCollection, ticketsCollection) => {
  //  Save new user (after registration)
  router.post("/", async (req, res) => {
    const user = req.body;

    // Check if already exists
    const exists = await usersCollection.findOne({ email: user.email });
    if (exists) {
      return res.send({ message: "User already exists", insertedId: null });
    }

    const result = await usersCollection.insertOne(user);
    res.send(result);
  });

  // Get all users
  router.get("/", async (req, res) => {
    const result = await usersCollection.find().toArray();
    res.send(result);
  });

  //  Get single user by email
  router.get("/:email", async (req, res) => {
    const email = req.params.email;
    const result = await usersCollection.findOne({ email });
    res.send(result || {});
  });

  // Update user role (user → vendor/admin)
  router.patch("/role/:email", async (req, res) => {
    const email = req.params.email;
    const { role } = req.body;

    const result = await usersCollection.updateOne(
      { email },
      { $set: { role } }
    );

    res.send(result);
  });

  // Delete a user (Admin only later)
  router.delete("/:email", async (req, res) => {
    const email = req.params.email;
    const result = await usersCollection.deleteOne({ email });
    res.send(result);
  });

  // Mark vendor as FRAUD

  router.patch("/fraud/:email", async (req, res) => {
    try {
      const email = req.params.email;

      // 1. Change user role → fraud
      const userUpdate = await usersCollection.updateOne(
        { email },
        { $set: { role: "fraud" } }
      );

      // 2. Hide all vendor tickets
      const ticketUpdate = await ticketsCollection.updateMany(
        { vendorEmail: email },
        { $set: { hidden: true } }
      );

      res.send({
        success: true,
        userUpdate,
        ticketUpdate,
      });
    } catch (err) {
      res.status(500).send({ error: err.message });
    }
  });

  return router;
};

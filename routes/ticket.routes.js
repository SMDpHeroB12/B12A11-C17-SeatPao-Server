const express = require("express");
const router = express.Router();

module.exports = (ticketsCollection, usersCollection) => {
  // 1. GET all visible tickets (public)

  router.get("/", async (req, res) => {
    const result = await ticketsCollection
      .find({ hidden: { $ne: true } })
      .toArray();
    res.send(result);
  });

  // 2. GET single ticket by ID

  router.get("/:id", async (req, res) => {
    const id = req.params.id;
    const { ObjectId } = require("mongodb");

    const result = await ticketsCollection.findOne({
      _id: new ObjectId(id),
      hidden: { $ne: true },
    });

    res.send(result || {});
  });

  // 3. Vendor → Add Ticket

  router.post("/", async (req, res) => {
    const ticket = req.body;
    ticket.hidden = false; // Default visible

    const result = await ticketsCollection.insertOne(ticket);
    res.send(result);
  });

  // 4. Vendor → My Tickets

  router.get("/vendor/my-tickets", async (req, res) => {
    const email = req.query.email;

    const result = await ticketsCollection
      .find({ vendorEmail: email })
      .toArray();

    res.send(result);
  });

  // 5. Admin → Manage Tickets (show ALL tickets)

  router.get("/admin/all", async (req, res) => {
    const result = await ticketsCollection.find().toArray();
    res.send(result);
  });

  // 6. Delete Ticket (Admin or Vendor)

  router.delete("/:id", async (req, res) => {
    const id = req.params.id;
    const { ObjectId } = require("mongodb");

    const result = await ticketsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  });

  return router;
};

const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

module.exports = (ticketsCollection, usersCollection) => {
  // PUBLIC → Latest Tickets (limit 6)
  router.get("/latest", async (req, res) => {
    try {
      const result = await ticketsCollection
        .find({ status: "approved", hidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    } catch (err) {
      console.error("Error in /latest:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // PUBLIC → Advertised Tickets (Home page)
  router.get("/advertised", async (req, res) => {
    try {
      const result = await ticketsCollection
        .find({
          advertised: true,
          status: "approved",
          hidden: { $ne: true },
        })
        .toArray();

      res.send(result);
    } catch (err) {
      console.error("Error in /advertised:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // PUBLIC → Get only APPROVED tickets (default)
  router.get("/", async (req, res) => {
    try {
      const result = await ticketsCollection
        .find({ status: "approved", hidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("Public tickets fetch error:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  router.get("/all", async (req, res) => {
    try {
      const result = await ticketsCollection
        .find({ status: "approved", hidden: { $ne: true } })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("Public tickets fetch error (/all):", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // PUBLIC → Get single approved ticket
  router.get("/:id", async (req, res) => {
    try {
      const id = req.params.id;

      const result = await ticketsCollection.findOne({
        _id: new ObjectId(id),
        status: "approved",
        hidden: { $ne: true },
      });

      res.send(result || {});
    } catch (err) {
      console.error("Single ticket fetch error:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // VENDOR → Add ticket
  router.post("/", async (req, res) => {
    const ticket = req.body;

    ticket.status = "pending";
    ticket.hidden = false;
    ticket.createdAt = new Date();

    const result = await ticketsCollection.insertOne(ticket);
    res.send(result);
  });

  // VENDOR → My Tickets
  router.get("/vendor/my-tickets", async (req, res) => {
    const email = req.query.email;
    const result = await ticketsCollection
      .find({ vendorEmail: email })
      .toArray();
    res.send(result);
  });

  // ADMIN → Get ALL tickets
  router.get("/admin/all", async (req, res) => {
    const result = await ticketsCollection.find().toArray();
    res.send(result);
  });

  // ADMIN → Approve Ticket
  router.patch("/approve/:id", async (req, res) => {
    const id = req.params.id;

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "approved", hidden: false } }
    );

    res.send(result);
  });

  // ADMIN → Reject Ticket
  router.patch("/reject/:id", async (req, res) => {
    const id = req.params.id;

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "rejected", hidden: true } }
    );

    res.send(result);
  });

  return router;
};

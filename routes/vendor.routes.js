const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

module.exports = (ticketsCollection, bookingsCollection) => {
  // Vendor: my tickets
  router.get("/my-tickets", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "email required" });
      const result = await ticketsCollection
        .find({ vendorEmail: email })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("vendor/my-tickets:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // Vendor: requested bookings (pending)
  router.get("/requests", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "email required" });

      const result = await bookingsCollection
        .find({ vendorEmail: email, status: "pending" })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("vendor/requests:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // Vendor stats for dashboard
  router.get("/stats", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "email required" });

      const tickets = await ticketsCollection.countDocuments({
        vendorEmail: email,
      });
      const bookings = await bookingsCollection.countDocuments({
        vendorEmail: email,
        status: "accepted",
      });
      const soldAgg = await bookingsCollection
        .aggregate([
          { $match: { vendorEmail: email, paid: true, status: "accepted" } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$total" },
              totalSold: { $sum: "$quantity" },
            },
          },
        ])
        .toArray();

      const recent = await ticketsCollection
        .find({ vendorEmail: email })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

      res.send({
        stats: {
          tickets,
          bookings,
          revenue: soldAgg[0]?.totalRevenue || 0,
          ticketsSold: soldAgg[0]?.totalSold || 0,
        },
        recent,
      });
    } catch (err) {
      console.error("vendor/stats:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // Vendor accept booking
  router.patch("/requests/accept/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "accepted" } }
      );
      res.send(result);
    } catch (err) {
      console.error("vendor accept:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  // Vendor reject booking
  router.patch("/requests/reject/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!booking) return res.status(404).send({ error: "Booking not found" });

      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: "rejected" } }
      );

      // restore seats
      try {
        await ticketsCollection.updateOne(
          { _id: new ObjectId(booking.ticketId) },
          { $inc: { seats: booking.quantity } }
        );
      } catch (err) {
        console.error("restore seats on reject:", err);
      }

      res.send(result);
    } catch (err) {
      console.error("vendor reject:", err);
      res.status(500).send({ error: "Server error" });
    }
  });

  //  Vendor Revenue Overview Chart Data
  // ----------------------------------------------------------
  router.get("/revenue-overview", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) return res.status(400).send({ error: "email required" });

      const monthly = await bookingsCollection
        .aggregate([
          {
            $match: {
              vendorEmail: email,
              paid: true,
              status: "accepted",
            },
          },
          {
            $group: {
              _id: {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
              },
              revenue: { $sum: "$total" },
              ticketsSold: { $sum: "$quantity" },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ])
        .toArray();

      res.send({ monthly });
    } catch (err) {
      console.error("vendor revenue overview:", err);
      res.status(500).send({ error: "server error" });
    }
  });

  return router;
};

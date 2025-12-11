const express = require("express");
const router = express.Router();

module.exports = (ticketsCollection, bookingsCollection) => {
  router.get("/stats", async (req, res) => {
    const email = req.query.email;

    const tickets = await ticketsCollection
      .find({ vendorEmail: email })
      .toArray();

    const totalBookings = await bookingsCollection.countDocuments({
      vendorEmail: email,
    });

    const revenue = tickets.reduce(
      (sum, t) => sum + t.price * (t.bookings || 0),
      0
    );

    res.send({
      stats: {
        tickets: tickets.length,
        bookings: totalBookings,
        revenue,
      },
      recent: tickets.slice(-5).reverse(),
    });

    // Vendor: Get my tickets
    router.get("/my-tickets", async (req, res) => {
      const email = req.query.email;

      const result = await ticketsCollection
        .find({ vendorEmail: email })
        .toArray();

      res.send(result);
    });
  });

  return router;
};

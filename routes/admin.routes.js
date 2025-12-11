const express = require("express");
const router = express.Router();

module.exports = (usersCollection, ticketsCollection, bookingsCollection) => {
  router.get("/stats", async (req, res) => {
    const users = await usersCollection.countDocuments();
    const tickets = await ticketsCollection.countDocuments();
    const bookings = await bookingsCollection.countDocuments();

    // Calculate revenue (sum of all bookings prices)
    const revenueData = await bookingsCollection.find().toArray();
    const revenue = revenueData.reduce(
      (sum, item) => sum + (item.price || 0),
      0
    );

    res.send({
      users,
      tickets,
      bookings,
      revenue,
    });
  });

  return router;
};

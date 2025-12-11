const express = require("express");
const router = express.Router();
const { ObjectId } = require("mongodb");

/**
 * Bookings Routes
 * module.exports = (bookingsCollection, ticketsCollection) => { ... }
 *
 * Booking document shape:
 * {
 *   _id,
 *   ticketId,           // ObjectId string
 *   ticketTitle,
 *   vendorEmail,
 *   userEmail,
 *   userName,
 *   quantity,           // number of seats booked
 *   price,              // per-seat price (number) OR total price
 *   total,              // quantity * price
 *   paid: false,        // boolean
 *   transactionId: "",  // if paid
 *   createdAt: Date
 * }
 */

module.exports = (bookingsCollection, ticketsCollection) => {
  // Create booking (atomic seat decrement)
  router.post("/", async (req, res) => {
    try {
      const {
        ticketId, // string ID
        quantity = 1,
        userEmail,
        userName,
      } = req.body;

      if (!ticketId || !userEmail) {
        return res.status(400).send({ error: "Missing ticketId or userEmail" });
      }

      const q = Number(quantity);
      if (q <= 0) return res.status(400).send({ error: "Invalid quantity" });

      let ticketObjectId;

      try {
        ticketObjectId = new ObjectId(ticketId);
      } catch (err) {
        return res.status(400).send({ error: "Invalid ticketId format" });
      }

      // Atomically decrement seats
      const ticketUpdate = await ticketsCollection.findOneAndUpdate(
        { _id: ticketObjectId, seats: { $gte: q }, hidden: { $ne: true } },
        { $inc: { seats: -q } },
        { returnDocument: "after" }
      );

      // IMPORTANT FIX:
      if (!ticketUpdate || !ticketUpdate.value) {
        return res.status(400).send({
          error: "Not enough seats, ticket not found, or ticket is hidden",
        });
      }

      const ticket = ticketUpdate.value;

      const price = Number(ticket.price || 0);
      const total = price * q;

      const bookingDoc = {
        ticketId: ticketId,
        ticketTitle: ticket.title || ticket.route || "Ticket",
        vendorEmail: ticket.vendorEmail || null,
        userEmail,
        userName: userName || "",
        quantity: q,
        price,
        total,
        paid: false,
        transactionId: null,
        createdAt: new Date(),
      };

      const result = await bookingsCollection.insertOne(bookingDoc);

      res.send({
        success: true,
        insertedId: result.insertedId,
        booking: bookingDoc,
        remainingSeats: ticketUpdate.value.seats,
      });
    } catch (err) {
      console.error("Booking create error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  // Get bookings for a user (query param ?email=)
  router.get("/", async (req, res) => {
    try {
      const email = req.query.email;
      if (!email) {
        return res.status(400).send({ error: "email query param required" });
      }

      const result = await bookingsCollection
        .find({ userEmail: email })
        .toArray();
      res.send(result);
    } catch (err) {
      console.error("Get user bookings error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  // Admin: get all bookings
  router.get("/all", async (req, res) => {
    try {
      const result = await bookingsCollection.find().toArray();
      res.send(result);
    } catch (err) {
      console.error("Get all bookings error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  // Stats: get total bookings count (for admin dashboard)
  router.get("/count", async (req, res) => {
    try {
      const count = await bookingsCollection.countDocuments();
      res.send({ bookings: count });
    } catch (err) {
      console.error("Get bookings count error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  // Mark booking as paid (attach transaction id etc.)
  router.patch("/pay/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const { transactionId } = req.body;
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paid: true, transactionId } }
      );
      res.send(result);
    } catch (err) {
      console.error("Booking pay error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  // Delete / Cancel booking (restore seats)
  router.delete("/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!booking) {
        return res.status(404).send({ error: "Booking not found" });
      }

      // Remove booking
      const del = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });

      // Restore seats to ticket (if ticket exists)
      try {
        await ticketsCollection.updateOne(
          { _id: new ObjectId(booking.ticketId) },
          { $inc: { seats: booking.quantity } }
        );
      } catch (err) {
        console.error("Failed to restore seats:", err);
      }

      res.send(del);
    } catch (err) {
      console.error("Delete booking error:", err);
      res.status(500).send({ error: err.message });
    }
  });

  return router;
};

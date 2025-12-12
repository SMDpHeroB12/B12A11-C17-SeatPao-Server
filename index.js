const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// MongoDB Setup
const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("MongoDB Connected Successfully!");

    // ============ Collections ============
    const db = client.db("seatpaoDB");

    const usersCollection = db.collection("users");
    const ticketsCollection = db.collection("tickets");
    const bookingsCollection = db.collection("bookings");
    const paymentCollection = db.collection("payments");

    // === Admin API ===
    app.use(
      "/admin",
      require("./routes/admin.routes")(
        usersCollection,
        ticketsCollection,
        bookingsCollection,
        paymentCollection
      )
    );

    // === Vendors API ===

    app.use(
      "/vendor",
      require("./routes/vendor.routes")(ticketsCollection, bookingsCollection)
    );

    // === Users API ===
    app.use(
      "/users",
      require("./routes/users.routes")(usersCollection, ticketsCollection)
    );

    // Tickets API
    app.use(
      "/tickets",
      require("./routes/ticket.routes")(ticketsCollection, usersCollection)
    );

    // === Bookings API ===
    app.use(
      "/bookings",
      require("./routes/bookings.routes")(bookingsCollection, ticketsCollection)
    );

    // === Payments API ===
    app.use(
      "/payments",
      require("./routes/payments.routes")(
        bookingsCollection,
        ticketsCollection,
        paymentCollection
      )
    );

    // TEST API
    app.get("/", (req, res) => {
      res.send("SeatPao Server + MongoDB is Running!");
    });

    // Ready for next API routes...
  } catch (err) {
    console.error("MongoDB Error:", err);
  }
}
run().catch(console.dir);

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

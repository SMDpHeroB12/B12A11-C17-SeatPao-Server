const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");

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

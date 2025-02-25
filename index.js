const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch(err => console.error("MongoDB connection error:", err));

const ListingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  description: String,
  url: String,
  host: {
    name: String,
    hostDetails: [String],
  },
});

// ✅ Fix: Prevent OverwriteModelError
const Listing = mongoose.models.AirbnbListing || mongoose.model("AirbnbListing", ListingSchema);

app.post("/api/save", async (req, res) => {
  try {
    const jsonData = req.body.data;
    if (!jsonData || (Array.isArray(jsonData) && jsonData.length === 0)) {
      return res.status(400).json({ error: "Invalid JSON data format" });
    }

    if (Array.isArray(jsonData)) {
      await Listing.insertMany(jsonData, { ordered: false });
      res.json({ message: `Saved ${jsonData.length} records to MongoDB` });
    } else {
      await Listing.findOneAndUpdate({ id: jsonData.id }, jsonData, {
        upsert: true,
        new: true,
      });
      res.json({ message: "Single record saved to MongoDB" });
    }
  } catch (error) {
    console.error("Error saving data to MongoDB:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

app.get("/api", async (req, res) => {
  try {
    const listings = await Listing.find();
    if (!listings.length) {
      return res.status(404).send("No data found in MongoDB.");
    }
    res.json(listings);
  } catch (error) {
    console.error("Error retrieving data:", error);
    res.status(500).send("Error loading data");
  }
});

module.exports = app;

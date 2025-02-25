const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

// Load .env only in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

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

const Listing = mongoose.model("AirbnbListing", ListingSchema);

const app = express();
app.use(express.json());
app.use(cors({ origin: "*", methods: ["POST", "GET"] }));

app.post("/save", async (req, res) => {
  try {
    const jsonData = req.body.data;

    if (!jsonData || (Array.isArray(jsonData) && jsonData.length === 0)) {
      return res.status(400).json({ error: "Invalid JSON data format" });
    }

    if (Array.isArray(jsonData)) {
      await Listing.insertMany(jsonData, { ordered: false }).catch((err) => {
        console.error("Error inserting bulk data:", err);
      });
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

app.get("/", async (req, res) => {
  try {
    const listings = await Listing.find();
    if (!listings.length) {
      return res.status(404).send("No data found in MongoDB.");
    }

    let html = `
        <html>
        <head>
            <title>Airbnb Listings</title>
            <style>
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid black; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; }
            </style>
        </head>
        <body>
            <h2>Airbnb Listings</h2>
            <p>Total Listings: ${listings.length}</p>
            <table>
                <tr>
                    <th>No.</th>
                    <th>Title</th>
                    <th>Description</th>
                    <th>URL</th>
                    <th>Host Name</th>
                    <th>Host Details</th>
                </tr>`;

    listings.forEach((item, index) => {
      const host = item.host || {};
      const hostDetails = host.hostDetails ? host.hostDetails.join("<br>") : "No details available";

      html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${item.title || "No title"}</td>
                    <td>${item.description || "No description"}</td>
                    <td><a href="${item.url}" target="_blank">${item.url}</a></td>
                    <td>${host.name || "Unknown"}</td>
                    <td>${hostDetails}</td>
                </tr>`;
    });

    html += `</table></body></html>`;

    res.send(html);
  } catch (error) {
    console.error("Error retrieving data from MongoDB:", error);
    res.status(500).send("Error loading data");
  }
});

module.exports = app;

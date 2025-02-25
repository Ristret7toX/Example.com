const express = require("express");
const cors = require("cors");
const connectToDatabase = require("./utils/db");
const mongoose = require("mongoose");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

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

// Dynamic model initialization to prevent OverwriteModelError
const Listing = mongoose.models.AirbnbListing || mongoose.model("AirbnbListing", ListingSchema);

// Connect to the database at startup
let dbConnection;
// Initialize database connection outside of request handlers
(async () => {
  try {
    dbConnection = await connectToDatabase();
    console.log('Database connected at startup');
  } catch (error) {
    console.error('Failed to establish database connection at startup:', error);
  }
})();

app.post("/api/save", async (req, res) => {
  try {
    // Use existing connection instead of connecting on each request
    if (!dbConnection) {
      dbConnection = await connectToDatabase();
    }
    
    const jsonData = req.body.data;

    if (!jsonData || (Array.isArray(jsonData) && jsonData.length === 0)) {
      return res.status(400).json({ error: "Invalid JSON data format" });
    }

    if (Array.isArray(jsonData)) {
      // Add timeout for large operations
      const timeout = setTimeout(() => {
        console.log("Operation taking too long, responding early");
        res.status(202).json({ 
          message: `Processing ${jsonData.length} records in background`,
          status: "processing" 
        });
      }, 5000); // 5 second timeout before responding

      await Listing.insertMany(jsonData, { 
        ordered: false,
        // Add limits to prevent timeout
        lean: true,
        timeout: 30000  // 30 second MongoDB operation timeout
      }).catch((err) => {
        console.error("Error inserting bulk data:", err);
      });
      
      clearTimeout(timeout);
      
      // Only send response if it hasn't been sent already
      if (!res.headersSent) {
        res.json({ message: `Saved ${jsonData.length} records to MongoDB` });
      }
    } else {
      await Listing.findOneAndUpdate({ id: jsonData.id }, jsonData, {
        upsert: true,
        new: true,
        lean: true  // Return plain JavaScript objects instead of Mongoose documents
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
    // Use existing connection
    if (!dbConnection) {
      dbConnection = await connectToDatabase();
    }
    
    // Limit results to prevent timeouts
    const listings = await Listing.find().limit(100).lean();
    
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
            <p>Total Listings (showing max 100): ${listings.length}</p>
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

// Add a simple status endpoint that doesn't require DB access
app.get("/api/status", (req, res) => {
  res.json({ status: "online" });
});

// Listen only in development mode
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

// Export for Vercel serverless deployment
module.exports = app;
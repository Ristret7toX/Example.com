const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const bodyParser = require("body-parser");

// Load .env only in development
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Initialize Firebase
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  }),
});

const db = admin.firestore();
const app = express();
app.use(express.json());
app.use(cors({ origin: "*", methods: ["POST", "GET"] }));

app.post("/save", async (req, res) => {
  try {
      const jsonData = req.body.data; // Expecting a single object OR an array

      if (!jsonData || (Array.isArray(jsonData) && jsonData.length === 0)) {
          return res.status(400).json({ error: "Invalid JSON data format" });
      }

      if (Array.isArray(jsonData)) {
          // Handle Bulk Insert
          let batch = db.batch();
          jsonData.forEach((item) => {
              if (item.id) {
                  const docRef = db.collection("airbnb_listings").doc(item.id);
                  batch.set(docRef, item, { merge: true });
              }
          });
          await batch.commit();
          res.json({ message: `Saved ${jsonData.length} records to Firestore` });
      } else {
          // Handle Single Insert
          if (!jsonData.id) {
              return res.status(400).json({ error: "Missing ID for single record" });
          }
          const docRef = db.collection("airbnb_listings").doc(jsonData.id);
          await docRef.set(jsonData, { merge: true });
          res.json({ message: "Single record saved to Firestore" });
      }
  } catch (error) {
      console.error("Error saving data to Firestore:", error);
      res.status(500).json({ error: "Failed to save data" });
  }
});


app.get("/", async (req, res) => {
  try {
    const snapshot = await db.collection("airbnb_listings").get();
    if (snapshot.empty) {
      return res.status(404).send("No data found in Firestore.");
    }

    let uniqueData = [];
    snapshot.forEach((doc) => {
      uniqueData.push(doc.data());
    });

    // Generate HTML table
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
            <p>Total Listings: ${uniqueData.length}</p>
            <table>
                <tr>
                    <th>No.</th>
                    <th>Title</th>
                    <th>Description</th>
                    <th>URL</th>
                    <th>Host Name</th>
                    <th>Host Details</th>
                </tr>`;

    // Add rows to the table
    uniqueData.forEach((item, index) => {
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
    console.error("Error retrieving data from Firestore:", error);
    res.status(500).send("Error loading data");
  }
});

module.exports = app;

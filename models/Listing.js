const mongoose = require("../db"); // Import db connection

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

// ✅ Prevent OverwriteModelError
const Listing = mongoose.models.AirbnbListing || mongoose.model("AirbnbListing", ListingSchema);

module.exports = Listing;

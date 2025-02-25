// utils/db.js
const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    // Removed deprecated options
    cached.promise = mongoose.connect(process.env.MONGODB_URI)
      .then(mongoose => {
        console.log('MongoDB connected successfully');
        return mongoose;
      });
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectToDatabase;
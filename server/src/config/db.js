const mongoose = require('mongoose');

async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn('MONGODB_URI is not set; skipping MongoDB connection (development only).');
    return;
  }
  await mongoose.connect(uri);
}

module.exports = { connectDb };

/**
 * Drops all collections in the MongoDB database named in MONGODB_URI (full reset for local testing).
 * Usage: node scripts/reset-db.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(uri);
  const name = mongoose.connection.db.databaseName;
  await mongoose.connection.dropDatabase();
  console.log(`Dropped database: ${name}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

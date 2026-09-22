const env = require('../config/env.config');

let isConnected = false;

async function connectDatabase() {
  if (isConnected) return true;

  if (process.env.SKIP_MONGO === 'true' || process.env.ELECTRON_RUN === 'true') {
    console.log('📁 Standalone desktop app mode — using local JSON file storage');
    return false;
  }
  
  const uri = env.MONGO_URI;
  if (!uri || uri.includes('your_database_connection_string') || (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://'))) {
    console.log('⚠️ No valid MongoDB URI found — using local JSON storage');
    return false;
  }

  try {
    // Lazy-require mongoose only when actually needed for DB connection
    const mongoose = require('mongoose');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB — using database storage');
    isConnected = true;
    return true;
  } catch (err) {
    console.log('⚠️ MongoDB connection failed — falling back to local JSON storage');
    console.error(err.message);
    return false;
  }
}

function getDatabaseStatus() {
    return isConnected;
}

module.exports = {
  connectDatabase,
  getDatabaseStatus
};

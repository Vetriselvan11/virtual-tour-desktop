require('dotenv').config();

const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGO_URI: process.env.MONGO_URI || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  TOURS_DIR: process.env.TOURS_DIR || 'tours',
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE, 10) || 50000000,
  EXPORT_DIR: process.env.EXPORT_DIR || 'export',
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
};

// Validate critical environment variables
const requiredVariables = ['PORT', 'CLIENT_URL'];
for (const key of requiredVariables) {
  if (env[key] === undefined || env[key] === null || env[key] === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = env;

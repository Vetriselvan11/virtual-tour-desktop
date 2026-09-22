const { AppError } = require('../shared/errors/AppError');
const env = require('../config/env.config');

function errorMiddleware(err, req, res, next) {
  // Log the error securely
  if (env.NODE_ENV !== 'test') {
    console.error(`[Error] ${req.method} ${req.url} - ${err.message}`);
    if (err.statusCode === 500 || !err.statusCode) {
      console.error(err.stack); // Only log stack for unknown 500 errors
    }
  }

  // Handle Multer errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File size too large. Maximum allowed size is 100MB.' });
    }
    return res.status(400).json({ error: err.message });
  }

  // Handle expected AppErrors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details
    });
  }

  // Handle existing backend throw new Error("Tour not found") strings
  // We want to preserve the exact API contract of `error: err.message`
  if (err.message && !err.statusCode) {
      if (err.message.includes('not found')) {
          return res.status(404).json({ error: err.message });
      }
      if (err.message.includes('No image') || err.message.includes('No audio')) {
          return res.status(400).json({ error: err.message });
      }
      // General error fallback for existing logic
      return res.status(500).json({ error: err.message });
  }

  // Fallback for unexpected errors
  const message = env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;
  return res.status(500).json({ error: message });
}

module.exports = errorMiddleware;

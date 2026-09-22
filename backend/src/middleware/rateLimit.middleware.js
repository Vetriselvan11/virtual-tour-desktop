const rateLimit = require('express-rate-limit');
const env = require('../config/env.config');

const isDesktop = process.env.ELECTRON_RUN === 'true' || process.env.DESKTOP_ENV === 'true' || process.env.NODE_ENV === 'development';

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  skip: () => isDesktop,
  message: {
    error: 'Too many requests, please try again later.'
  },
  standardHeaders: true, 
  legacyHeaders: false, 
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // limit each IP to 50 upload requests per windowMs
  skip: () => isDesktop,
  message: {
    error: 'Too many upload requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 batch requests per minute per IP
  skip: () => isDesktop,
  message: {
    error: 'Too many analytics requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  uploadLimiter,
  analyticsLimiter
};


const { NotFoundError } = require('../shared/errors/AppError');

function notFoundMiddleware(req, res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = notFoundMiddleware;

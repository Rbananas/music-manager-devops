function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  const status = Number.isInteger(error.status)
    ? error.status
    : error.name === 'CastError' || error.name === 'ValidationError'
      ? 400
      : error.code === 11000
        ? 409
        : 500;
  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} failed:`, error);
  }

  res.status(status).json({
    error: {
      message: status >= 500 ? 'Internal server error' : (error.code === 11000 ? 'A record with that value already exists' : error.message)
    }
  });
}

module.exports = errorHandler;

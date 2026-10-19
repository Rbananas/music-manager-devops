const mongoose = require('mongoose');

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: { message: 'Database is unavailable' } });
  }
  next();
}

module.exports = requireDatabase;

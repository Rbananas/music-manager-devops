const jwt = require('jsonwebtoken');

function authenticate(config) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: { message: 'Authentication required' } });
    }
    if (!config.jwtSecret) {
      return res.status(503).json({ error: { message: 'Authentication is not configured' } });
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.userId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: { message: 'Invalid or expired token' } });
    }
  };
}

module.exports = authenticate;

const authService = require('../services/authService');

// Rule (c): only authenticated users can do checkout.
function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token is required' });
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    const payload = authService.verifyToken(token);
    req.user = { id: payload.id, email: payload.email };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };

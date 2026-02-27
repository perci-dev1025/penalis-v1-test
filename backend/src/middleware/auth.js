import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'penalis_token';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment');
}

/**
 * Verify JWT from cookie and attach req.user. Use on protected routes.
 */
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    User.findById(decoded.userId)
      .then((user) => {
        if (!user || user.status !== 'active') {
          return res.status(401).json({ error: 'No autorizado' });
        }
        req.user = user;
        next();
      })
      .catch(() => res.status(401).json({ error: 'No autorizado' }));
  } catch {
    return res.status(401).json({ error: 'No autorizado' });
  }
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export { COOKIE_NAME };

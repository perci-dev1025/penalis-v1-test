import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'penalis_token';

if (!JWT_SECRET) {
  throw new Error('Missing JWT_SECRET in environment');
}

/**
 * Verify JWT from cookie and attach req.user. Use on protected routes.
 */
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'No autorizado' });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'No autorizado' });
  }
}

/**
 * Optionally attach req.user if a valid token is present. Never sends 401.
 * Use for routes like GET /api/auth/me that return 200 with or without a user.
 */
export async function optionalAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });
    if (user && user.status === 'active') {
      req.user = user;
    }
  } catch {
    // ignore invalid/expired token
  }
  next();
}

export function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

export { COOKIE_NAME };

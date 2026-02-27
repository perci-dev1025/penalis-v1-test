import { Router } from 'express';
import { User, hashPassword, comparePassword } from '../models/User.js';
import { requireAuth, signToken, COOKIE_NAME } from '../middleware/auth.js';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

function userToJson(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    plan_id: user.planId ?? null,
    status: user.status,
  };
}

/** POST /api/auth/register */
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const trimmed = String(email).trim().toLowerCase();
    if (!trimmed) {
      return res.status(400).json({ error: 'Email inválido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const existing = await User.findOne({ email: trimmed });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo' });
    }
    const passwordHash = await hashPassword(password);
    const user = await User.create({ email: trimmed, passwordHash });
    const token = signToken(user._id);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    return res.status(201).json({ user: userToJson(user) });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Error al crear la cuenta' });
  }
});

/** POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    const match = await comparePassword(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Cuenta no activa' });
    }
    const token = signToken(user._id);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    return res.json({ user: userToJson(user) });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Error al iniciar sesión' });
  }
});

/** POST /api/auth/logout */
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true });
  return res.json({ ok: true });
});

/** GET /api/auth/me — requires auth */
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: userToJson(req.user) });
});

export default router;

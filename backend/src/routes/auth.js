import { Router } from 'express';
import { prisma } from '../db.js';
import { hashPassword, comparePassword } from '../models/User.js';
import { requireAuth, optionalAuth, signToken, COOKIE_NAME } from '../middleware/auth.js';

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
    id: user.id,
    email: user.email,
    role: user.role,
    plan_id: user.planId ?? null,
    status: user.status,
  };
}

async function getOrCreateDefaultIndividualPlan() {
  let plan = await prisma.plan.findFirst({
    where: { type: 'individual' },
  });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        name: 'Individual',
        type: 'individual',
        maxActiveSessions: 1,
      },
    });
  }
  return plan;
}

/** POST /api/auth/register */
router.post('/register', async (req, res, next) => {
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
    const existing = await prisma.user.findUnique({ where: { email: trimmed } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con este correo' });
    }
    const passwordHash = await hashPassword(password);
    const defaultPlan = await getOrCreateDefaultIndividualPlan();
    const user = await prisma.user.create({
      data: { email: trimmed, passwordHash, planId: defaultPlan.id },
    });
    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    return res.status(201).json({ user: userToJson(user), token });
  } catch (err) {
    console.error('Register error:', err);
    next(err);
  }
});

/** POST /api/auth/login */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: emailNorm },
      select: {
        id: true,
        email: true,
        role: true,
        planId: true,
        status: true,
        passwordHash: true,
      },
    });
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

    // Resolve user's plan and enforce active session limit
    let plan = null;
    if (user.planId) {
      plan = await prisma.plan.findUnique({ where: { id: user.planId } });
    }
    if (!plan) {
      plan = await getOrCreateDefaultIndividualPlan();
      // Attach default plan to user if missing
      await prisma.user.update({
        where: { id: user.id },
        data: { planId: plan.id },
      });
    }

    if (plan.maxActiveSessions != null) {
      const activeCount = await prisma.activeSession.count({
        where: { userId: user.id },
      });
      if (activeCount >= plan.maxActiveSessions) {
        return res.status(403).json({
          error: 'Has alcanzado el número máximo de sesiones activas para tu plan.',
        });
      }
    }

    await prisma.activeSession.create({
      data: {
        userId: user.id,
        userAgent: req.headers['user-agent'] ?? null,
        ip: req.ip,
      },
    });
    const token = signToken(user.id);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    return res.json({ user: userToJson(user), token });
  } catch (err) {
    console.error('Login error:', err);
    next(err);
  }
});

/** POST /api/auth/logout */
router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    await prisma.activeSession.deleteMany({
      where: { userId: req.user.id },
    });
    res.clearCookie(COOKIE_NAME, { path: '/', httpOnly: true });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout error:', err);
    next(err);
  }
});

/** GET /api/auth/me — 200 with { user } or { user: null } */
router.get('/me', optionalAuth, (req, res) => {
  return res.json({ user: req.user ? userToJson(req.user) : null });
});

export default router;

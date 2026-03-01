import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const appointments = await prisma.appointment.findMany({
      where: { userId },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(appointments);
  } catch (err) {
    console.error('Appointments list error:', err?.message || err);
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { title, scheduledAt, type, notes } = req.body || {};
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'El título es requerido.' });
    }
    const at = scheduledAt ? new Date(scheduledAt) : null;
    if (!at || Number.isNaN(at.getTime())) {
      return res.status(400).json({ error: 'La fecha y hora (scheduledAt) es requerida y debe ser válida.' });
    }
    const appointment = await prisma.appointment.create({
      data: {
        userId,
        title: title.trim(),
        scheduledAt: at,
        type: type && typeof type === 'string' ? type.trim() || null : null,
        notes: notes && typeof notes === 'string' ? notes.trim() || null : null,
      },
    });
    res.status(201).json(appointment);
  } catch (err) {
    console.error('Appointment create error:', err?.message || err);
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const appointment = await prisma.appointment.findFirst({
      where: { id, userId },
    });
    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }
    res.json(appointment);
  } catch (err) {
    console.error('Appointment get error:', err?.message || err);
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const existing = await prisma.appointment.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }
    const { title, scheduledAt, type, notes } = req.body || {};
    const data = {};
    if (title !== undefined) data.title = typeof title === 'string' ? title.trim() : existing.title;
    if (scheduledAt !== undefined) {
      const at = new Date(scheduledAt);
      if (!Number.isNaN(at.getTime())) data.scheduledAt = at;
    }
    if (type !== undefined) data.type = type && typeof type === 'string' ? type.trim() || null : null;
    if (notes !== undefined) data.notes = notes && typeof notes === 'string' ? notes.trim() || null : null;
    const appointment = await prisma.appointment.update({
      where: { id },
      data,
    });
    res.json(appointment);
  } catch (err) {
    console.error('Appointment update error:', err?.message || err);
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const existing = await prisma.appointment.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }
    await prisma.appointment.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error('Appointment delete error:', err?.message || err);
    next(err);
  }
});

export default router;

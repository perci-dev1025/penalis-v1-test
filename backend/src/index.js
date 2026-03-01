import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import ragRoutes from './routes/rag.js';
import appointmentsRoutes from './routes/appointments.js';

const app = express();
const PORT = process.env.PORT || 3003;

await connectDB();

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/appointments', appointmentsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set a different PORT in backend/.env (e.g. PORT=3003).`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

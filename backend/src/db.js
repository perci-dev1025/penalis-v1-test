import { PrismaClient } from '@prisma/client';

let DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in environment. Add it to backend/.env');
}

// Neon: require SSL and set timeouts so the DB has time to wake (free tier pauses when idle)
try {
  const url = new URL(DATABASE_URL);
  if (url.hostname.includes('neon.tech')) {
    if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
    if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '30');
    DATABASE_URL = url.toString();
  }
} catch {
  // leave DATABASE_URL unchanged if not a valid URL
}

export const prisma = new PrismaClient({
  datasources: { db: { url: DATABASE_URL } },
});

/**
 * Connect to PostgreSQL via Prisma. Call once at app startup.
 * Does not throw so the server can start; DB errors surface as 503 on first use.
 */
export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected (Prisma)');
  } catch (err) {
    console.error('Database connection error:', err.message);
    console.error('Neon: open https://console.neon.tech and open your project to wake it (free tier pauses when idle). Or try the Direct connection string instead of Pooled.');
    // Don't throw — server starts and returns 503 on auth routes until DB is reachable
  }
}

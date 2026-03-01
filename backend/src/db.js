import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('Missing DATABASE_URL in environment. Add it to backend/.env');
}

export const prisma = new PrismaClient();

/**
 * Connect to PostgreSQL via Prisma. Call once at app startup.
 * Does not throw so the server can start; DB errors surface as 503/500 on first use.
 */
export async function connectDB() {
  try {
    await prisma.$connect();
    console.log('PostgreSQL connected (Prisma)');
  } catch (err) {
    console.error('Database connection error:', err.message);
    // don't throw here so the HTTP server can still start
  }
}

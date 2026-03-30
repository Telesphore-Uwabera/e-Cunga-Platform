import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';

dotenv.config();

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    return { connected: false, reason: 'No MONGODB_URI provided. Running in demo mode.' };
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    return { connected: true, reason: 'MongoDB connected.' };
  } catch (error) {
    return {
      connected: false,
      reason: `MongoDB unavailable. Running in demo mode. ${error.message}`,
    };
  }
}

function unavailableRouter(message) {
  const router = express.Router();
  router.use((_req, res) => {
    res.status(503).json({ error: message });
  });
  return router;
}

export async function createApp() {
  const database = await connectDatabase();
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      mode: database.connected ? 'database' : 'demo',
      message: database.reason,
    });
  });

  app.use('/api/auth', authRoutes);

  if (database.connected) {
    const [{ default: teamRoutes }, { default: activityRoutes }, { default: invoicesRoutes }] = await Promise.all([
      import('./routes/team.routes.js'),
      import('./routes/activity.routes.js'),
      import('./routes/invoices.routes.js'),
    ]);

    app.use('/api/team', teamRoutes);
    app.use('/api/activity', activityRoutes);
    app.use('/api/invoices', invoicesRoutes);
  } else {
    app.use('/api/team', unavailableRouter('Database-backed routes are disabled in demo mode.'));
    app.use('/api/activity', unavailableRouter('Database-backed routes are disabled in demo mode.'));
    app.use('/api/invoices', unavailableRouter('Database-backed routes are disabled in demo mode.'));
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Unexpected server error.' });
  });

  return { app, database };
}

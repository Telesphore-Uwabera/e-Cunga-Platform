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

const DB_MESSAGE = 'Database-backed routes are disabled in demo mode.';

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
    if (process.env.SEED_DEMO_WORKSPACE === 'true') {
      try {
        const { seedDemoWorkspace } = await import('./seed/seedDemoWorkspace.js');
        await seedDemoWorkspace();
      } catch (error) {
        console.error('[seed] Failed:', error);
      }
    }

    const [
      { default: teamRoutes },
      { default: activityRoutes },
      { default: invoicesRoutes },
      { default: portalRoutes },
      { default: stockRoutes },
      { default: requisitionsRoutes },
      { default: companyRoutes },
      { default: workspaceRoutes },
      { default: messagesRoutes },
      { default: notificationsRoutes },
      { default: catalogRoutes },
    ] = await Promise.all([
      import('./routes/team.routes.js'),
      import('./routes/activity.routes.js'),
      import('./routes/invoices.routes.js'),
      import('./routes/portal.routes.js'),
      import('./routes/stock.routes.js'),
      import('./routes/requisitions.routes.js'),
      import('./routes/company.routes.js'),
      import('./routes/workspace.routes.js'),
      import('./routes/messages.routes.js'),
      import('./routes/notifications.routes.js'),
      import('./routes/catalog.routes.js'),
    ]);

    app.use('/api/portal', portalRoutes);
    app.use('/api/stock', stockRoutes);
    app.use('/api/requisitions', requisitionsRoutes);
    app.use('/api/company', companyRoutes);
    app.use('/api/workspace', workspaceRoutes);
    app.use('/api/messages', messagesRoutes);
    app.use('/api/notifications', notificationsRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/team', teamRoutes);
    app.use('/api/activity', activityRoutes);
    app.use('/api/invoices', invoicesRoutes);
  } else {
    app.use('/api/portal', unavailableRouter(DB_MESSAGE));
    app.use('/api/stock', unavailableRouter(DB_MESSAGE));
    app.use('/api/requisitions', unavailableRouter(DB_MESSAGE));
    app.use('/api/company', unavailableRouter(DB_MESSAGE));
    app.use('/api/workspace', unavailableRouter(DB_MESSAGE));
    app.use('/api/messages', unavailableRouter(DB_MESSAGE));
    app.use('/api/notifications', unavailableRouter(DB_MESSAGE));
    app.use('/api/catalog', unavailableRouter(DB_MESSAGE));
    app.use('/api/team', unavailableRouter(DB_MESSAGE));
    app.use('/api/activity', unavailableRouter(DB_MESSAGE));
    app.use('/api/invoices', unavailableRouter(DB_MESSAGE));
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

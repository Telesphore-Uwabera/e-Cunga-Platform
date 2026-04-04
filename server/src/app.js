import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import contactRoutes from './routes/contact.routes.js';

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

  app.get('/', (_req, res) => {
    const clientUrl = process.env.CLIENT_URL?.trim();
    res.json({
      service: 'e-CUNGA API',
      message: 'This host serves the REST API only. Open the SPA for the web app.',
      ...(clientUrl && { frontend: clientUrl }),
      health: '/api/health',
    });
  });

  app.get('/api/health', async (_req, res) => {
    let cloudinary = 'off';
    try {
      const { isCloudinaryConfigured } = await import('./lib/cloudinaryClient.js');
      cloudinary = isCloudinaryConfigured() ? 'ready' : 'off';
    } catch {
      cloudinary = 'off';
    }
    res.json({
      ok: true,
      mode: database.connected ? 'database' : 'demo',
      message: database.reason,
      cloudinary,
    });
  });

  app.use('/api/contact', contactRoutes);
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

    if (process.env.AUTO_SEED_DEMO_IF_EMPTY === 'true') {
      try {
        const User = (await import('./models/User.js')).default;
        const userCount = await User.countDocuments();
        if (userCount === 0) {
          const { seedDemoWorkspace } = await import('./seed/seedDemoWorkspace.js');
          console.log('[seed] AUTO_SEED_DEMO_IF_EMPTY: no users in MongoDB; seeding demo workspace.');
          await seedDemoWorkspace();
        }
      } catch (error) {
        console.error('[seed] AUTO_SEED_DEMO_IF_EMPTY failed:', error);
      }
    }

    if (process.env.SYNC_DB_ON_START === 'true') {
      try {
        const { syncDatabaseCollections } = await import('./services/databaseCollections.js');
        const synced = await syncDatabaseCollections();
        console.log(
          '[db] SYNC_DB_ON_START: collections →',
          synced.collections.map((c) => c.collection).join(', ')
        );
      } catch (error) {
        console.error('[db] SYNC_DB_ON_START failed:', error.message);
      }
    }

    try {
      const { configureCloudinary } = await import('./lib/cloudinaryClient.js');
      configureCloudinary();
    } catch {
      /* optional dependency */
    }

    const [
      { default: publicRoutes },
      { default: databaseRoutes },
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
      { default: chatRoutes },
      { default: mediaRoutes },
      { default: registrationsRoutes },
      { default: insightsRoutes },
    ] = await Promise.all([
      import('./routes/public.routes.js'),
      import('./routes/database.routes.js'),
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
      import('./routes/chat.routes.js'),
      import('./routes/media.routes.js'),
      import('./routes/registrations.routes.js'),
      import('./routes/insights.routes.js'),
    ]);

    app.use('/api/public', publicRoutes);
    app.use('/api/database', databaseRoutes);
    app.use('/api/portal', portalRoutes);
    app.use('/api/stock', stockRoutes);
    app.use('/api/requisitions', requisitionsRoutes);
    app.use('/api/company', companyRoutes);
    app.use('/api/workspace', workspaceRoutes);
    app.use('/api/registrations', registrationsRoutes);
    app.use('/api/messages', messagesRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/media', mediaRoutes);
    app.use('/api/notifications', notificationsRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/team', teamRoutes);
    app.use('/api/activity', activityRoutes);
    app.use('/api/invoices', invoicesRoutes);
    app.use('/api/insights', insightsRoutes);
  } else {
    app.use('/api/public', unavailableRouter(DB_MESSAGE));
    app.use('/api/database', unavailableRouter(DB_MESSAGE));
    app.use('/api/portal', unavailableRouter(DB_MESSAGE));
    app.use('/api/stock', unavailableRouter(DB_MESSAGE));
    app.use('/api/requisitions', unavailableRouter(DB_MESSAGE));
    app.use('/api/company', unavailableRouter(DB_MESSAGE));
    app.use('/api/workspace', unavailableRouter(DB_MESSAGE));
    app.use('/api/registrations', unavailableRouter(DB_MESSAGE));
    app.use('/api/messages', unavailableRouter(DB_MESSAGE));
    app.use('/api/chat', unavailableRouter(DB_MESSAGE));
    app.use('/api/media', unavailableRouter(DB_MESSAGE));
    app.use('/api/notifications', unavailableRouter(DB_MESSAGE));
    app.use('/api/catalog', unavailableRouter(DB_MESSAGE));
    app.use('/api/team', unavailableRouter(DB_MESSAGE));
    app.use('/api/activity', unavailableRouter(DB_MESSAGE));
    app.use('/api/invoices', unavailableRouter(DB_MESSAGE));
    app.use('/api/insights', unavailableRouter(DB_MESSAGE));
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

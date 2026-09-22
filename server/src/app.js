import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.routes.js';
import contactRoutes from './routes/contact.routes.js';
import newsletterRoutes from './routes/newsletter.routes.js';

async function connectDatabase() {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    return { connected: false, reason: 'No MONGODB_URI provided. Running in demo mode.' };
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      maxPoolSize: 10,
      minPoolSize: 2,
      heartbeatFrequencyMS: 10000,
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

function buildAllowedOrigins() {
  const envList = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const clientUrl = String(process.env.CLIENT_URL || '').trim();
  const defaults = [
    'https://www.ecunga.com',
    'https://ecunga.com',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  return new Set([...defaults, ...envList, ...(clientUrl ? [clientUrl] : [])]);
}

export async function createApp() {
  const database = await connectDatabase();
  const app = express();
  const allowedOrigins = buildAllowedOrigins();
  const corsOptions = {
    origin(origin, callback) {
      // Allow server-to-server and health checks with no Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));
  // Compress all responses — cuts payload size by 60-80%
  app.use(compression());
  app.use(express.json({ limit: '4mb' }));

  app.get('/', (_req, res) => {
    const clientUrl = process.env.CLIENT_URL?.trim();
    res.json({
      service: 'e-Cunga Portal API',
      message: 'This host serves the REST API only. Open the SPA for the web app.',
      ...(clientUrl && { frontend: clientUrl }),
      health: '/api/health',
    });
  });

  const healthHandler = async (_req, res) => {
    let cloudinary = 'off';
    try {
      const { isCloudinaryConfigured } = await import('./lib/cloudinaryClient.js');
      cloudinary = isCloudinaryConfigured() ? 'ready' : 'off';
    } catch {
      cloudinary = 'off';
    }
    res.json({
      ok: true,
      service: 'ecunga-api',
      timestamp: new Date().toISOString(),
      mode: database.connected ? 'database' : 'demo',
      message: database.reason,
      cloudinary,
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);
  app.head('/health', (_req, res) => res.status(200).end());
  app.head('/api/health', (_req, res) => res.status(200).end());

  app.use('/api/contact', contactRoutes);
  app.use('/api/newsletter', newsletterRoutes);
  app.use('/api/auth', authRoutes);

  if (database.connected) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && (process.env.SEED_DEMO_WORKSPACE === 'true' || process.env.AUTO_SEED_DEMO_IF_EMPTY === 'true')) {
      console.warn('[seed] Ignoring SEED_DEMO_WORKSPACE / AUTO_SEED_DEMO_IF_EMPTY while NODE_ENV=production.');
    }

    if (!isProduction && process.env.SEED_DEMO_WORKSPACE === 'true') {
      try {
        const { seedDemoWorkspace } = await import('./seed/seedDemoWorkspace.js');
        await seedDemoWorkspace();
      } catch (error) {
        console.error('[seed] Failed:', error);
      }
    }

    if (!isProduction && process.env.AUTO_SEED_DEMO_IF_EMPTY === 'true') {
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
      const { startInternalScheduler } = await import('./services/scheduler.js');
      startInternalScheduler();
    } catch (error) {
      console.error('[scheduler] Failed to start:', error.message);
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
      { default: supplierDirectoryRoutes },
      { default: masterStockRoutes },
      { default: adminRoutes },
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
      import('./routes/supplierDirectory.routes.js'),
      import('./routes/masterStock.routes.js'),
      import('./routes/admin.routes.js'),
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
    app.use('/api/master-stock', masterStockRoutes);
  app.use('/api/chat', chatRoutes);
    app.use('/api/media', mediaRoutes);
    app.use('/api/notifications', notificationsRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/supplier-directory', supplierDirectoryRoutes);
    app.use('/api/team', teamRoutes);
    app.use('/api/activity', activityRoutes);
    app.use('/api/invoices', invoicesRoutes);
    app.use('/api/insights', insightsRoutes);
    app.use('/api/admin', adminRoutes);
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
    app.use('/api/supplier-directory', unavailableRouter(DB_MESSAGE));
    app.use('/api/team', unavailableRouter(DB_MESSAGE));
    app.use('/api/activity', unavailableRouter(DB_MESSAGE));
    app.use('/api/invoices', unavailableRouter(DB_MESSAGE));
    app.use('/api/insights', unavailableRouter(DB_MESSAGE));
    app.use('/api/admin', unavailableRouter(DB_MESSAGE));
  }

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: 'Unexpected server error.' });
  });

  // ── Keep-alive self-ping (prevents Render free tier cold starts) ───────────
  // Pings /api/ecunga/health every 13 minutes so the service never sleeps.
  // Only runs in production — skip in local dev to avoid noise.
  if (process.env.NODE_ENV !== 'development') {
    const selfUrl = process.env.API_URL?.trim();
    if (selfUrl) {
      const PING_INTERVAL_MS = 13 * 60 * 1000; // 13 min — under Render's 15-min idle timeout
      const pingHealth = () => {
        const healthUrl = `${selfUrl}/api/ecunga/health`;
        fetch(healthUrl, { signal: AbortSignal.timeout(8000) })
          .then((r) => r.ok && console.log(`[keep-alive] ping ok — ${new Date().toISOString()}`))
          .catch((e) => console.warn('[keep-alive] ping failed:', e.message));
      };
      // First ping after 1 minute, then every 13 minutes
      setTimeout(() => {
        pingHealth();
        setInterval(pingHealth, PING_INTERVAL_MS);
      }, 60 * 1000);
      console.log(`[keep-alive] Self-ping active → ${selfUrl}/api/ecunga/health every 13 min`);
    }
  }

  return { app, database };
}

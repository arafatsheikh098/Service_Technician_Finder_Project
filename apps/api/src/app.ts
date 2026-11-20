import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { apiDocsEnabled, env } from './config/env.js';
import { pool } from './db/pool.js';
import { logger } from './lib/logger.js';
import { registry as metricsRegistry, metricsMiddleware } from './lib/metrics.js';
import type { Deps } from './lib/deps.js';
import { buildOpenApiDocument } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiters } from './middleware/rate-limit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import {
  catalogRouter,
  publicStatsRouter,
  recentReviewsRouter,
} from './modules/catalog/catalog.routes.js';
import { techniciansRouter } from './modules/technicians/technicians.routes.js';
import { bookingsRouter } from './modules/bookings/bookings.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { triageRouter } from './modules/triage/triage.routes.js';

export function createApp(deps: Deps) {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(
    express.json({
      limit: '100kb',
      // Keep the exact bytes for webhook signature verification.
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  app.use(metricsMiddleware);

  const limiters = createRateLimiters(deps.redis);

  // Health checks for the orchestrator: "live" = process is up, "ready" = can serve traffic.
  app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/health/ready', async (_req, res) => {
    const checks: Record<string, 'ok' | 'fail'> = {};
    checks.database = await pool.query('SELECT 1').then(
      () => 'ok' as const,
      () => 'fail' as const,
    );
    if (deps.redis)
      checks.redis = await deps.redis.ping().then(
        () => 'ok' as const,
        () => 'fail' as const,
      );
    const ok = Object.values(checks).every((c) => c === 'ok');
    res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'degraded', checks });
  });
  app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', metricsRegistry.contentType).send(await metricsRegistry.metrics());
  });

  // Interactive docs: on by default in development, opt-in in production (API_DOCS_ENABLED).
  if (apiDocsEnabled) {
    const openapi = buildOpenApiDocument();
    app.get('/api/v1/openapi.json', (_req, res) => {
      res.json(openapi);
    });
    app.use(
      '/api/docs',
      swaggerUi.serve,
      swaggerUi.setup(openapi, { customSiteTitle: 'TechFinder API' }),
    );
  }

  app.use(
    '/uploads',
    express.static(path.resolve(env.UPLOAD_DIR), {
      maxAge: '7d',
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    }),
  );

  const api = express.Router();
  api.use(limiters.global);
  api.use('/auth', authRouter(deps, limiters.auth, limiters.loginPerAccount));
  api.use('/users', usersRouter(deps));
  api.use('/categories', catalogRouter());
  api.use('/stats', publicStatsRouter());
  api.use('/reviews/recent', recentReviewsRouter());
  api.use('/technicians', techniciansRouter());
  api.use('/bookings', bookingsRouter(deps));
  api.use('/payments', paymentsRouter(deps));
  api.use('/admin', adminRouter(deps));
  api.use('/triage', triageRouter(limiters.ai));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

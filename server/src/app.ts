import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './lib/db';
import { HttpError } from './lib/http';
import { casesRouter } from './routes/cases';
import { auditRouter } from './routes/audit';
import { adminRouter, demoRouter } from './routes/admin';

// The production console is always allowed; WEB_ORIGIN adds more (comma separated).
const PRODUCTION_ORIGINS = ['https://fixd-two.vercel.app'];
const origins = [...PRODUCTION_ORIGINS, ...(process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',')]
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

function allowedOrigin(o: string | undefined): boolean {
  if (!o) return true; // same origin, curl, server to server
  if (origins.includes(o)) return true;
  try {
    const u = new URL(o);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false; // "null" and other opaque origins
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind one proxy; rate limits key on the real client IP
  app.use(helmet());
  app.use(cors({ origin: (o, cb) => cb(null, allowedOrigin(o)) }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/ping', (_req, res) => {
    res.json({ ok: true });
  });

  // Liveness plus database readiness. Served at /health (load balancers, uptime monitors)
  // and /api/health (the console). 503 when the database is unreachable.
  const health: express.RequestHandler = async (_req, res) => {
    const version = process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local';
    const uptimeSeconds = Math.round(process.uptime());
    const t0 = Date.now();
    try {
      const cases = await db.case.count();
      res.json({ ok: true, db: true, dbLatencyMs: Date.now() - t0, cases, version, uptimeSeconds });
    } catch {
      res.status(503).json({ ok: false, db: false, version, uptimeSeconds });
    }
  };
  app.get('/health', health);
  app.get('/api/health', health);

  app.use('/api/cases', casesRouter);
  app.use('/api', auditRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/demo', demoRouter);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'not found' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof HttpError && err.status < 500) {
      return void res.status(err.status).json({ error: err.message });
    }
    const status = (err as { status?: number; type?: string }).status;
    if (status && status >= 400 && status < 500) {
      // body parser errors (malformed JSON, payload too large)
      return void res.status(status).json({ error: 'malformed request body' });
    }
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './lib/db';
import { HttpError } from './lib/http';
import { casesRouter } from './routes/cases';
import { auditRouter } from './routes/audit';
import { adminRouter, demoRouter } from './routes/admin';

const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173')
  .split(',')
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

  app.get('/api/health', async (_req, res) => {
    try {
      const cases = await db.case.count();
      res.json({ ok: true, db: true, cases, version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local' });
    } catch {
      res.status(503).json({ ok: false, db: false });
    }
  });

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

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { db } from './lib/db';
import { casesRouter } from './routes/cases';
import { auditRouter } from './routes/audit';
import { adminRouter } from './routes/admin';

const app = express();
const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim());
app.use(helmet());
app.use(
  cors({
    origin: (o, cb) =>
      cb(null, !o || origins.includes(o) || /\.vercel\.app$/.test(new URL(o).hostname)),
  })
);
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    const cases = await db.case.count();
    res.json({
      ok: true,
      db: true,
      cases,
      version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local',
    });
  } catch {
    res.status(503).json({ ok: false, db: false });
  }
});

app.use('/api/cases', casesRouter);
app.use('/api', auditRouter);
app.use('/api/admin', adminRouter);

app.use(
  (
    err: Error & { status?: number },
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
);

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`fixd api on :${port}`));

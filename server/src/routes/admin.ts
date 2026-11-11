import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { seed } from '../seed';
import { db } from '../lib/db';

let running: Promise<{ questions: number; cases: number }> | null = null;

/** One reseed at a time; concurrent callers share the same run. */
async function reseed(actor: string) {
  running ??= seed().finally(() => {
    running = null;
  });
  const r = await running;
  await db.auditLog.create({ data: { actor, action: 'demo_reset', summary: `Demo reset: ${r.questions} questions, ${r.cases} cases restored` } });
  return r;
}

export const adminRouter = Router();
adminRouter.post('/reset', async (req, res, next) => {
  try {
    if (!process.env.ADMIN_TOKEN || req.header('x-admin-token') !== process.env.ADMIN_TOKEN) {
      return void res.status(401).json({ error: 'unauthorized' });
    }
    res.json({ seeded: await reseed('admin') });
  } catch (e) {
    next(e);
  }
});

const demoLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.DEMO_RESET_PER_HOUR || 5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demo reset limit reached for this hour. Try again later.' },
});

export const demoRouter = Router();
demoRouter.post('/reset', demoLimit, async (_req, res, next) => {
  try {
    res.json({ seeded: await reseed('demo') });
  } catch (e) {
    next(e);
  }
});

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/db';

export const auditRouter = Router();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

auditRouter.get('/audit', async (req, res, next) => {
  try {
    const limit = Math.min(500, Number(req.query.limit ?? 100));
    res.json(await db.auditLog.findMany({ orderBy: { at: 'desc' }, take: limit }));
  } catch (e) {
    next(e);
  }
});

auditRouter.get('/stats', async (_req, res, next) => {
  try {
    const cases = await db.case.findMany({ select: { status: true, route: true, verdict: true } });
    const count = (f: (c: (typeof cases)[number]) => boolean) => cases.filter(f).length;
    res.json({
      cases: cases.length,
      open: count((c) => c.status === 'open'),
      autoApplied: count((c) => c.route === 'auto_apply'),
      defects: count((c) => c.verdict === 'defect'),
      resolved: count((c) => !['open', 'auto_applied', 'no_change'].includes(c.status)),
    });
  } catch (e) {
    next(e);
  }
});

auditRouter.get('/sweep', (_req, res) => {
  const p = path.join(root, 'engine/out/sweep.json');
  res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
});


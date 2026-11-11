import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../lib/db';

export const auditRouter = Router();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

auditRouter.get('/audit', async (req, res, next) => {
  try {
    const n = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isFinite(n) && n >= 1 ? Math.min(500, n) : 100;
    const caseId = typeof req.query.caseId === 'string' && req.query.caseId ? req.query.caseId : undefined;
    const rows = await db.auditLog.findMany({ where: caseId ? { caseId } : {}, orderBy: { id: 'desc' }, take: limit });
    const ids = [...new Set(rows.map((r) => r.questionId).filter((x): x is string => !!x))];
    const qs = await db.question.findMany({ where: { id: { in: ids } }, select: { id: true, qid: true } });
    const qid = new Map(qs.map((q) => [q.id, q.qid]));
    res.json(rows.map((r) => ({ ...r, qid: r.questionId ? qid.get(r.questionId) ?? null : null })));
  } catch (e) {
    next(e);
  }
});

auditRouter.get('/stats', async (_req, res, next) => {
  try {
    const cases = await db.case.findMany({ select: { status: true, route: true, verdict: true } });
    const count = (f: (c: (typeof cases)[number]) => boolean) => cases.filter(f).length;
    const autoApplyActions = await db.action.count({ where: { type: 'auto_apply' } });
    const reverts = await db.action.count({ where: { type: 'revert', undone: false } });
    res.json({
      cases: cases.length,
      open: count((c) => c.status === 'open'),
      autoApplied: count((c) => c.route === 'auto_apply'),
      defects: count((c) => c.verdict === 'defect'),
      resolved: count((c) => !['open', 'auto_applied', 'no_change'].includes(c.status)),
      autoApplyActions,
      reverts,
      autoFixRevertRate: autoApplyActions ? reverts / autoApplyActions : null,
    });
  } catch (e) {
    next(e);
  }
});

auditRouter.get('/sweep', (_req, res, next) => {
  try {
    const p = path.join(root, 'engine/out/sweep.json');
    res.json(fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : []);
  } catch (e) {
    next(e);
  }
});

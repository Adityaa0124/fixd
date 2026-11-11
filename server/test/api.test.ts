import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { createApp } from '../src/app';
import { db } from '../src/lib/db';
import { seed } from '../src/seed';

// Integration tests against the real database in DATABASE_URL. They mutate data and reseed at the end,
// so they only run when opted in: npm run test:db -w @fixd/server
const app = createApp();
const J = (x: unknown) => x as Prisma.InputJsonValue;
const actor = 'test';

async function openCase() {
  const c = await db.case.findFirst({ where: { status: 'open' }, include: { question: { include: { reports: true } } } });
  if (!c) throw new Error('no open case in seed data');
  return c;
}

/** Turns an open case into a controlled fixture: one safe question edit, no guard errors, any field allowed. */
async function fixture() {
  const c = await openCase();
  const v = await db.questionVersion.findUniqueOrThrow({
    where: { questionId_version: { questionId: c.questionId, version: c.question.currentVersion } },
  });
  const edit = { field: 'question', find: v.questionHtml, replace: `${v.questionHtml}<!-- fixd test -->` };
  await db.case.update({ where: { id: c.id }, data: { edits: J([edit]), guardErrors: J([]), repair: null } });
  await db.report.updateMany({ where: { questionId: c.questionId }, data: { replyStatus: 'draft', finalReply: null } });
  return { c, v, edit };
}

describe.skipIf(!process.env.DATABASE_URL || process.env.FIXD_DB_TESTS !== '1')('fixd api', () => {
  beforeAll(async () => {
    await seed();
  });
  afterAll(async () => {
    await seed();
    await db.$disconnect();
  });

  it('ping needs no database and health reports cases', async () => {
    expect((await request(app).get('/api/ping')).body).toEqual({ ok: true });
    const h = await request(app).get('/api/health');
    expect(h.body.ok).toBe(true);
    expect(h.body.cases).toBeGreaterThan(0);
  });

  it('rejects unknown lanes and cases with clean errors', async () => {
    const lane = await request(app).get('/api/cases?lane=toString');
    expect(lane.status).toBe(400);
    const missing = await request(app).get('/api/cases/nope');
    expect(missing.status).toBe(404);
    expect(missing.body.error).toBeTruthy();
  });

  it('lists cases with reports, approvability and ISO dates', async () => {
    const r = await request(app).get('/api/cases?lane=needs_review');
    expect(r.status).toBe(200);
    for (const i of r.body.items) {
      expect(i.reports).toBeGreaterThan(0);
      expect(typeof i.approvable).toBe('boolean');
      expect(i.firstReportedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    }
  });

  it('refuses to approve a no op edit and a guard rejected edit', async () => {
    const { c } = await fixture();
    await db.case.update({ where: { id: c.id }, data: { edits: J([{ field: 'question', find: 'x', replace: 'x' }]) } });
    const noop = await request(app).post(`/api/cases/${c.id}/actions`).send({ type: 'approve', actor });
    expect(noop.status).toBe(409);
    expect(noop.body.error).toMatch(/changes nothing/);

    const { c: c2 } = await fixture();
    await db.case.update({ where: { id: c2.id }, data: { guardErrors: J(['G3 find occurs 0 times']) } });
    const guarded = await request(app).post(`/api/cases/${c2.id}/actions`).send({ type: 'approve', actor });
    expect(guarded.status).toBe(409);
    expect(guarded.body.error).toMatch(/safety guard/);
    const after = await db.case.findUniqueOrThrow({ where: { id: c2.id } });
    expect(after.status).toBe('open');
  });

  it('approves, records audit before and after, sends replies, then undo restores everything', async () => {
    const { c, v } = await fixture();
    const reportId = c.question.reports[0]!.id;
    const ok = await request(app)
      .post(`/api/cases/${c.id}/actions`)
      .send({ type: 'approve', actor, replies: { [reportId]: 'Fixed, thanks.' } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('approved');
    expect(ok.body.currentVersion).toBe(v.version + 1);
    expect(ok.body.current.question).toContain('fixd test');
    expect(ok.body.reports.every((r: { replyStatus: string }) => r.replyStatus === 'sent')).toBe(true);
    const approveId = ok.body.lastActionId as number;
    const ver = await db.questionVersion.findUniqueOrThrow({
      where: { questionId_version: { questionId: c.questionId, version: v.version + 1 } },
    });
    expect(ver.actionId).toBe(approveId);
    const audit = await request(app).get(`/api/audit?caseId=${c.id}&limit=5`);
    expect(audit.body[0].action).toBe('approve');
    expect(audit.body[0].before.question).toBe(v.questionHtml);
    expect(audit.body[0].after.question).toContain('fixd test');

    const wrong = await request(app).post(`/api/cases/${c.id}/actions`).send({ type: 'undo', actor, actionId: approveId + 999 });
    expect(wrong.status).toBe(409);

    const undo = await request(app).post(`/api/cases/${c.id}/actions`).send({ type: 'undo', actor, actionId: approveId });
    expect(undo.status).toBe(200);
    expect(undo.body.status).toBe('open');
    expect(undo.body.current.question).toBe(v.questionHtml);
    expect(undo.body.reports.every((r: { replyStatus: string; finalReply: string | null }) => r.replyStatus === 'draft' && r.finalReply === null)).toBe(true);
    const nothing = await request(app).post(`/api/cases/${c.id}/actions`).send({ type: 'undo', actor });
    expect(nothing.status).toBe(409);
  });

  it('returns 400 for edits that do not apply, malformed answers and foreign replies', async () => {
    const { c } = await fixture();
    const missing = await request(app)
      .post(`/api/cases/${c.id}/actions`)
      .send({ type: 'edit', actor, edits: [{ field: 'question', find: 'definitely not in the question', replace: 'x' }] });
    expect(missing.status).toBe(400);

    const cur = await request(app).get(`/api/cases/${c.id}`);
    const ans = cur.body.current.answer;
    const badAnswer = await request(app)
      .post(`/api/cases/${c.id}/actions`)
      .send({ type: 'edit', actor, edits: [{ field: 'answer', find: Array.isArray(ans) ? JSON.stringify(ans) : ans, replace: cur.body.current.questionType === 'integerQuestion' ? 'abc' : 'Z' }] });
    expect(badAnswer.status).toBe(400);

    const foreign = await request(app)
      .post(`/api/cases/${c.id}/actions`)
      .send({ type: 'reject', actor, reason: 'test', replies: { R999: 'hi' } });
    expect(foreign.status).toBe(400);
    expect((await db.case.findUniqueOrThrow({ where: { id: c.id } })).status).toBe('open');
  });

  it('reverts an auto applied fix and undo brings it back', async () => {
    const c = await db.case.findFirst({ where: { status: 'auto_applied' } });
    if (!c) return;
    const before = await request(app).get(`/api/cases/${c.id}`);
    const rev = await request(app).post(`/api/cases/${c.id}/actions`).send({ type: 'revert', actor, reason: 'test revert' });
    expect(rev.status).toBe(200);
    expect(rev.body.status).toBe('rejected');
    expect(rev.body.current).toEqual(before.body.original);
    const stats = await request(app).get('/api/stats');
    expect(stats.body.reverts).toBe(1);
    expect(stats.body.autoFixRevertRate).toBeGreaterThan(0);

    const undo = await request(app).post(`/api/cases/${c.id}/actions`).send({ type: 'undo', actor });
    expect(undo.status).toBe(200);
    expect(undo.body.status).toBe('auto_applied');
    expect(undo.body.current).toEqual(before.body.current);
    const auto = await db.action.findFirstOrThrow({ where: { caseId: c.id, type: 'auto_apply' } });
    expect(auto.undone).toBe(false);
  });

  it('demo reset restores the seed state', async () => {
    const r = await request(app).post('/api/demo/reset');
    expect(r.status).toBe(200);
    expect(r.body.seeded.cases).toBeGreaterThan(0);
    const stats = await request(app).get('/api/stats');
    expect(stats.body.reverts).toBe(0);
  });
});

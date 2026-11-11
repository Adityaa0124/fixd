import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, type Schema } from '@google/genai';
import type { ZodType } from 'zod';
import { ROOT } from '../data';

export class CacheMissError extends Error {}
export class BudgetError extends Error {}

export type Purpose = 'solve' | 'triage' | 'reply' | 'sweep';

export interface JsonCall<T> {
  purpose: Purpose;
  model: string;
  system: string;
  user: string;
  schema: Schema;
  zod: ZodType<T>;
  temperature: number;
  variant?: string;            // distinguishes solve #1 from solve #2
  promptVersion: string;
}

export interface JsonResult<T> {
  data: T;
  cached: boolean;
  key: string;
}

const CACHE_DIR = path.join(ROOT, 'engine/.cache');
const USAGE_FILE = path.join(ROOT, 'engine/out/usage.jsonl');
const OFFLINE = process.env.FIXD_OFFLINE === '1';
const MAX_CALLS = Number(process.env.FIXD_MAX_CALLS ?? 250);
const RPM = Number(process.env.FIXD_RPM ?? 12);

let networkCalls = 0;
let ai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing (or run with FIXD_OFFLINE=1)');
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
}

export function stats() {
  return { networkCalls, budget: MAX_CALLS, offline: OFFLINE };
}

function keyOf(c: JsonCall<unknown>): string {
  const payload = JSON.stringify({
    m: c.model, s: c.system, u: c.user, sc: c.schema, t: c.temperature, v: c.variant ?? '', pv: c.promptVersion,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function cachePath(key: string) {
  return path.join(CACHE_DIR, key.slice(0, 2), `${key}.json`);
}

function readCache(key: string): unknown | undefined {
  const p = cachePath(key);
  if (!fs.existsSync(p)) return undefined;
  return JSON.parse(fs.readFileSync(p, 'utf8')).response;
}

function writeCache(key: string, c: JsonCall<unknown>, response: unknown) {
  const p = cachePath(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({
    key, purpose: c.purpose, model: c.model, promptVersion: c.promptVersion, variant: c.variant ?? null,
    at: new Date().toISOString(), response,
  }, null, 1));
}

/* ---------- limiter: per model spacing + max 2 in flight ---------- */
const lastStart = new Map<string, number>();
const inFlight = new Map<string, number>();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acquire(model: string) {
  const gap = 60_000 / RPM;
  for (;;) {
    const now = Date.now();
    const last = lastStart.get(model) ?? 0;
    const flying = inFlight.get(model) ?? 0;
    if (now - last >= gap && flying < 2) {
      lastStart.set(model, now);
      inFlight.set(model, flying + 1);
      return;
    }
    await sleep(Math.max(50, gap - (now - last)));
  }
}
function release(model: string) {
  inFlight.set(model, Math.max(0, (inFlight.get(model) ?? 1) - 1));
}

function retryDelayMs(err: unknown, attempt: number): number | null {
  const msg = String((err as Error)?.message ?? err);
  const retryable = /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded|deadline/i.test(msg);
  if (!retryable) return null;
  const hinted = msg.match(/retryDelay["':\s]+(\d+(?:\.\d+)?)s/);
  if (hinted && Number(hinted[1]) > 60) return null; // Daily quota exhausted, do not sleep for hours
  const base = hinted ? Number(hinted[1]) * 1000 : 2000 * 2 ** attempt;
  return base + Math.floor(Math.random() * 750);
}

async function send(c: JsonCall<unknown>, extraUser = ''): Promise<string> {
  if (networkCalls >= MAX_CALLS) throw new BudgetError(`FIXD_MAX_CALLS=${MAX_CALLS} reached`);
  networkCalls++;
  for (let attempt = 0; ; attempt++) {
    await acquire(c.model);
    const t0 = Date.now();
    try {
      const res = await client().models.generateContent({
        model: c.model,
        contents: [{ role: 'user', parts: [{ text: c.user + extraUser }] }],
        config: {
          systemInstruction: c.system,
          temperature: c.temperature,
          responseMimeType: 'application/json',
          responseSchema: c.schema,
        },
      });
      const u = res.usageMetadata;
      fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
      fs.appendFileSync(USAGE_FILE, JSON.stringify({
        at: new Date().toISOString(), purpose: c.purpose, model: c.model,
        promptTokens: u?.promptTokenCount ?? 0, outputTokens: u?.candidatesTokenCount ?? 0,
        thoughtTokens: u?.thoughtsTokenCount ?? 0, ms: Date.now() - t0,
      }) + '\n');
      const text = res.text;
      if (!text) throw new Error('empty response');
      return text;
    } catch (err) {
      const wait = attempt < 4 ? retryDelayMs(err, attempt) : null;
      if (wait == null) throw err;
      console.warn(`[llm] ${c.purpose} retry ${attempt + 1} in ${Math.round(wait / 1000)}s: ${(err as Error).message?.slice(0, 120)}`);
      await sleep(wait);
    } finally {
      release(c.model);
    }
  }
}

export async function callJson<T>(c: JsonCall<T>): Promise<JsonResult<T>> {
  const key = keyOf(c);
  const hit = readCache(key);
  if (hit !== undefined) {
    const parsed = c.zod.safeParse(hit);
    if (parsed.success) return { data: parsed.data, cached: true, key };
  }
  if (OFFLINE) throw new CacheMissError(`cache miss for ${c.purpose} (${key.slice(0, 10)}) in offline mode`);

  let raw = await send(c);
  let parsed = c.zod.safeParse(safeJson(raw));
  if (!parsed.success) {
    const why = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    raw = await send(c, `\n\nYour previous output failed validation: ${why}. Return corrected JSON only.`);
    parsed = c.zod.safeParse(safeJson(raw));
    if (!parsed.success) throw new Error(`${c.purpose}: invalid JSON twice: ${why}`);
  }
  writeCache(key, c, parsed.data);
  return { data: parsed.data, cached: false, key };
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  }
}


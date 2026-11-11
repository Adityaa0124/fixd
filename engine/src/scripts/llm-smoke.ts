import { Type } from '@google/genai';
import { z } from 'zod';
import { callJson, stats } from '../llm/client';
import { MODELS } from '../llm/models';

const r = await callJson({
  purpose: 'reply', model: MODELS.fast, promptVersion: 'smoke-1', temperature: 0,
  system: 'Return JSON only.',
  user: 'Return {"ok": true}.',
  schema: { type: Type.OBJECT, properties: { ok: { type: Type.BOOLEAN } }, required: ['ok'] },
  zod: z.object({ ok: z.boolean() }),
});
console.log(r, stats());


import { callJson } from '../llm/client';
import { MODELS } from '../llm/models';
import { REPLY_SCHEMA, REPLY_SYSTEM, REPLY_VERSION, ReplyZ, replyUser } from '../prompts/reply';

export async function writeReply(v: Parameters<typeof replyUser>[0]): Promise<string> {
  const r = await callJson({
    purpose: 'reply', model: MODELS.fast, system: REPLY_SYSTEM, user: replyUser(v),
    schema: REPLY_SCHEMA, zod: ReplyZ, temperature: 0.4, promptVersion: REPLY_VERSION,
  });
  return r.data.reply.replace(/[—–]/g, ',').trim();   // house style: no dashes in student copy
}


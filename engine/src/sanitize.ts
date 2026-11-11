import type { CommentFlag, Lang } from '@fixd/shared';

const INJECTION = [
  /ignore (all |any )?(the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /\byou are (now )?(an? |the )?(admin|administrator|system|developer|root|bot)\b/i,
  /\b(system|developer) prompt\b/i,
  /\b(change|set|mark) (the )?(answer|key) (to|as)\b/i,
  /\bdisregard\b|\bjailbreak\b|\boverride\b/i,
  /\bact as\b/i,
];

const HINGLISH = /\b(hai|hain|kyu|kyun|nahi|nahin|chahiye|galat|aana|aa raha|kya|toh|hona|kuch|diya|di|ki|ke|ka|mein|me|bhi|sahi|kaise|karu|kar)\b/i;
const LANGUAGE_REQ = /\b(hindi|marathi|tamil|telugu|bengali|bangla|gujarati|kannada|malayalam|odia|punjabi|urdu)\b|हिंदी|हिन्दी/i;
const APP = /\b(clicked|tapped|selected|marked)\b.*\b(saved|recorded|registered|wrong|still)\b|\bnegative\b|\bkeyboard\b|\bcrash|\blag\b|\bsubmit/i;
const DISPLAY = /\b(cut|cropped|screen|phone|load|loading|forever|slow|render|overlap|blurry)\b/i;
const LOW = /^(wrong|wrong ans(wer)?|error|galat|incorrect|mistake|\?+)$/i;

export interface SanitizedComment {
  text: string;             // escaped, trimmed, length capped; safe to embed in a prompt
  flags: CommentFlag[];
  lang: Lang;
}

export function isGibberish(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (!t) return true;
  if (/\s/.test(t)) return false;
  if (/^(asdf|qwer|zxcv|hjkl|jkl|sdfg|dfgh|fghj|ghjk)/.test(t)) return true;
  const letters = t.replace(/[^a-z]/g, '');
  if (letters.length >= 4 && !/[aeiou]/.test(letters)) return true;
  return /^(.)\1{3,}$/.test(t);
}

export function sanitizeComment(raw: string): SanitizedComment {
  const trimmed = (raw ?? '').trim();
  const flags: CommentFlag[] = [];
  if (INJECTION.some((r) => r.test(trimmed))) flags.push('injection');
  if (isGibberish(trimmed)) flags.push('gibberish');
  else if (LOW.test(trimmed)) flags.push('low_content');
  if (LANGUAGE_REQ.test(trimmed)) flags.push('language_request');
  if (APP.test(trimmed)) flags.push('app_behaviour');
  if (DISPLAY.test(trimmed)) flags.push('display_behaviour');
  const text = trimmed
    .slice(0, 500)
    .replace(/</g, '‹')
    .replace(/>/g, '›');           // cannot close <student_comment>
  return { text, flags, lang: HINGLISH.test(trimmed) ? 'hinglish' : 'english' };
}

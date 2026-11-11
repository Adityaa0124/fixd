/**
 * Turns two versions of a production HTML field into one inline "red pen" view:
 * the removed span struck through, the inserted span underlined, right where it sits.
 *
 * Works for any before/after pair (proposed edits, auto applied fixes, faculty edits),
 * so every lane uses the same diff. The changed window is widened until it is safe:
 * never split a tag, never split a word, and never split a <math> element (a change
 * inside a formula is shown as the old formula struck next to the new one).
 */

export type HtmlDiff =
  | { kind: 'same' }
  | { kind: 'inline'; html: string; removedText: string; addedText: string }
  | { kind: 'block'; before: string; after: string; removedText: string; addedText: string };

const VOID = new Set(['br', 'img', 'hr', 'input', 'meta', 'link', 'col', 'wbr', 'mspace', 'none', 'mprescripts']);
const WORD = /[\p{L}\p{N}]/u;
const MAX_INLINE = 900;

function insideTag(s: string, i: number): boolean {
  const lt = s.lastIndexOf('<', i - 1);
  const gt = s.lastIndexOf('>', i - 1);
  return lt > gt;
}

/** [start, end) of the <math> element containing position i, or null. */
function enclosingMath(s: string, i: number): [number, number] | null {
  const open = s.lastIndexOf('<math', i);
  if (open === -1) return null;
  const closeBefore = s.lastIndexOf('</math>', i - 1);
  if (closeBefore > open) return null;
  const close = s.indexOf('</math>', open);
  if (close === -1 || close + 7 < i) return null;
  return [open, close + 7];
}

export function balanced(fragment: string): boolean {
  const stack: string[] = [];
  const re = /<\/?([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment))) {
    const name = m[1]!.toLowerCase();
    const closing = m[0].startsWith('</');
    if (!closing && (m[2] === '/' || VOID.has(name))) continue;
    if (!closing) stack.push(name);
    else if (stack.pop() !== name) return false;
  }
  return stack.length === 0 && !/<[^>]*$/.test(fragment) && !/^[^<]*>/.test(fragment);
}

export function htmlText(html: string): string {
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function diffHtml(before: string, after: string): HtmlDiff {
  if (before === after) return { kind: 'same' };
  const min = Math.min(before.length, after.length);
  let p = 0;
  while (p < min && before[p] === after[p]) p++;
  let s = 0;
  while (s < min - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;

  const widen = () => {
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 50) {
      changed = false;
      // left edge: out of any tag, then to word start
      if (p > 0 && insideTag(before, p)) {
        p = before.lastIndexOf('<', p - 1);
        changed = true;
      }
      while (p > 0 && p < before.length && WORD.test(before[p - 1]!) && WORD.test(before[p]!)) {
        p--;
        changed = true;
      }
      // right edge, measured as suffix length s
      const eB = before.length - s;
      if (eB < before.length && insideTag(before, eB)) {
        const gt = before.indexOf('>', eB);
        s = before.length - (gt + 1);
        changed = true;
      }
      const eB2 = before.length - s;
      if (s > 0 && eB2 > p && WORD.test(before[eB2]!) && WORD.test(before[eB2 - 1]!)) {
        let e = eB2;
        while (e < before.length && WORD.test(before[e]!)) e++;
        s = before.length - e;
        changed = true;
      }
      // never split a formula
      const mL = enclosingMath(before, p);
      if (mL && mL[0] < p) {
        p = mL[0];
        changed = true;
      }
      const mR = enclosingMath(before, Math.max(p, before.length - s - 1));
      if (mR && mR[1] > before.length - s) {
        s = before.length - mR[1];
        changed = true;
      }
      // keep the window valid in "after" too
      if (p + s > after.length) s = after.length - p;
      if (p + s > before.length) s = before.length - p;
      if (s < 0) s = 0;
    }
  };
  widen();

  const removed = before.slice(p, before.length - s);
  const added = after.slice(p, after.length - s);
  const removedText = htmlText(removed);
  const addedText = htmlText(added);

  const big = removed.length > MAX_INLINE || added.length > MAX_INLINE || (removed.length > 240 && removed.length > before.length * 0.6);
  if (big || !balanced(removed) || !balanced(added)) {
    return { kind: 'block', before, after, removedText, addedText };
  }
  const del = removed ? `<del data-fx="1">${removed}</del>` : '';
  const ins = added ? `<ins data-fx="1">${added}</ins>` : '';
  return { kind: 'inline', html: before.slice(0, p) + del + ins + before.slice(before.length - s), removedText, addedText };
}

export function formatAnswer(a: unknown): string {
  if (Array.isArray(a)) {
    const clean = a.map((x) => String(x).trim()).filter(Boolean);
    const looksMalformed = a.some((x) => String(x).trim() === '' || /,/.test(String(x)));
    return looksMalformed ? JSON.stringify(a) : clean.join(', ');
  }
  return String(a ?? '').trim() || 'blank';
}

/** Option letters in an answer, for highlighting options. */
export function answerLetters(a: unknown): string[] {
  const parts = Array.isArray(a) ? a.map(String) : [String(a ?? '')];
  return [...new Set(parts.flatMap((p) => p.split(/[\s,;/]+/)).map((p) => p.replace(/[()"[\]]/g, '').trim().toUpperCase()).filter((p) => /^[A-D]$/.test(p)))];
}

import type { Edit } from '@fixd/shared';

function enclosingMath(html: string, at: number): [number, number] | null {
  const open = html.lastIndexOf('<math', at);
  if (open === -1) return null;
  const closeBefore = html.lastIndexOf('</math>', at);
  if (closeBefore > open) return null;
  const close = html.indexOf('</math>', at);
  return close === -1 ? null : [open, close + 7];
}

/** Returns before/after HTML with the changed span highlighted. */
export function markEdit(html: string, e: Edit): { before: string; after: string } | null {
  if (e.field !== 'question' && e.field !== 'solution') return null;
  const i = e.find ? html.indexOf(e.find) : 0;
  if (i < 0) return null;
  const j = i + e.find.length;
  const after = html.slice(0, i) + e.replace + html.slice(j);
  const m = enclosingMath(html, i);
  if (m) {
    const ma = enclosingMath(after, i);
    return {
      before:
        html.slice(0, m[0]) +
        '<mark data-fx="box">' +
        html.slice(m[0], m[1]) +
        '</mark>' +
        html.slice(m[1]),
      after: ma
        ? after.slice(0, ma[0]) +
          '<mark data-fx="box">' +
          after.slice(ma[0], ma[1]) +
          '</mark>' +
          after.slice(ma[1])
        : after,
    };
  }
  return {
    before: html.slice(0, i) + `<mark data-fx="del">${e.find}</mark>` + html.slice(j),
    after: html.slice(0, i) + `<mark data-fx="ins">${e.replace}</mark>` + html.slice(j),
  };
}


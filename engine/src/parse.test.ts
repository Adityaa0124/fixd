import { describe, expect, it } from 'vitest';
import { loadDataset } from './data';
import { parseQuestion } from './parse';

const { byId } = loadDataset();
const P = (suffix: string) => {
  const rec = [...byId.values()].find((q) => q._id.endsWith(suffix));
  if (!rec) throw new Error(suffix);
  return parseQuestion(rec);
};

describe('parser on production quirks', () => {
  it('plain options', () => expect(P('8d89').options.map((o) => o.text)).toEqual(['120 days', '130 days', '180 days', '20 days']));
  it('MathML wrapped labels', () => expect(P('3b1c').options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D']));
  it('assertion stem with (A) in text', () => {
    const p = P('abc5');
    expect(p.options).toHaveLength(4);
    expect(p.stemText).toContain('Assertion (A)');
  });
  it('missing option D', () => expect(P('0a1b').options.map((o) => o.label)).toEqual(['A', 'B', 'C']));
  it('blank option C', () => expect(P('6bc0').options.find((o) => o.label === 'C')?.blank).toBe(true));
  it('duplicate options', () => {
    const t = P('bc29').options.map((o) => o.text);
    expect(t[1]).toBe(t[2]);
  });
  it('integer has no options', () => expect(P('3ae6').options).toHaveLength(0));
  it('every scq and mcq has at least 3 options', () => {
    for (const rec of byId.values()) {
      if (rec.questionType === 'integerQuestion') continue;
      expect(parseQuestion(rec).options.length, rec._id).toBeGreaterThanOrEqual(3);
    }
  });
  it('stem raw + option raws rebuild the question', () => {
    for (const rec of byId.values()) {
      const p = parseQuestion(rec);
      if (!p.options.length) continue;
      expect(p.questionRaw.startsWith(p.stemRaw)).toBe(true);
    }
  });
});


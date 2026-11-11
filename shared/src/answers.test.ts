import { describe, expect, it } from 'vitest';
import { normalizeAnswer, answerFormatIssues, sameAnswer, letters } from './answers';
import { applyEdit } from './edits';

describe('answers', () => {
  it('splits comma joined mcq', () => expect(letters(['A, B, D'])).toEqual(['A', 'B', 'D']));
  it('drops empty mcq slots', () => expect(letters(['', 'B'])).toEqual(['B']));
  it('flags the two production mcq quirks', () => {
    expect(answerFormatIssues('mcq', ['', 'B'])).toContain('mcq answer array contains an empty string');
    expect(answerFormatIssues('mcq', ['A, B, D'])).toContain('mcq answer stores several letters in one comma joined string');
  });
  it('integer tolerance', () =>
    expect(sameAnswer(normalizeAnswer('integerQuestion', '8'), normalizeAnswer('integerQuestion', '8.0'))).toBe(true));
});

describe('applyEdit', () => {
  const s = { questionType: 'scq' as const, question: '<p>Choroid plexux</p>', solution: '', answer: 'C' };
  it('replaces exactly once', () =>
    expect(applyEdit(s, { field: 'question', find: 'plexux', replace: 'plexus' }).question).toBe('<p>Choroid plexus</p>'));
  it('rejects missing find', () =>
    expect(() => applyEdit(s, { field: 'question', find: 'nope', replace: 'x' })).toThrow());
  it('answer swap', () => expect(applyEdit(s, { field: 'answer', find: 'C', replace: 'A' }).answer).toBe('A'));
});

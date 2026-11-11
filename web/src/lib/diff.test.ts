import { describe, expect, it } from 'vitest';
import { balanced, diffHtml, formatAnswer } from './diff';

describe('diffHtml', () => {
  it('marks a whole misspelt word, not one letter', () => {
    const d = diffHtml('<p>Brachial plexux injury</p>', '<p>Brachial plexus injury</p>');
    expect(d.kind).toBe('inline');
    if (d.kind === 'inline') expect(d.html).toBe('<p>Brachial <del data-fx="1">plexux</del><ins data-fx="1">plexus</ins> injury</p>');
  });

  it('shows a change inside a formula as old formula next to new', () => {
    const d = diffHtml('<p>F = <math><mn>1</mn></math> N</p>', '<p>F = <math><mn>2</mn></math> N</p>');
    expect(d.kind).toBe('inline');
    if (d.kind === 'inline') {
      expect(d.html).toContain('<del data-fx="1"><math><mn>1</mn></math></del>');
      expect(d.html).toContain('<ins data-fx="1"><math><mn>2</mn></math></ins>');
    }
  });

  it('never splits a tag', () => {
    const d = diffHtml('<p><span style="color:red">x</span></p>', '<p><span style="color:blue">x</span></p>');
    expect(d.kind).not.toBe('same');
    if (d.kind === 'inline') expect(d.html).not.toMatch(/<[^>]*<del/);
  });

  it('handles a pure removal', () => {
    const d = diffHtml('<h3>Find x (NEET 2019) quickly</h3>', '<h3>Find x quickly</h3>');
    expect(d.kind).toBe('inline');
    if (d.kind === 'inline') expect(d.removedText).toContain('NEET 2019');
  });

  it('falls back to block view for a rewrite', () => {
    const d = diffHtml('<p>' + 'a '.repeat(600) + '</p>', '<p>' + 'b '.repeat(600) + '</p>');
    expect(d.kind).toBe('block');
  });

  it('reports identical input as same', () => {
    expect(diffHtml('<p>x</p>', '<p>x</p>').kind).toBe('same');
  });
});

describe('helpers', () => {
  it('checks tag balance', () => {
    expect(balanced('<b>x</b><br />')).toBe(true);
    expect(balanced('</span><span>')).toBe(false);
  });
  it('shows malformed keys as stored', () => {
    expect(formatAnswer(['A, B, D'])).toBe('["A, B, D"]');
    expect(formatAnswer(['A', 'C'])).toBe('A, C');
    expect(formatAnswer('8225')).toBe('8225');
  });
});

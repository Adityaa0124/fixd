import { describe, it, expect } from 'vitest';
import { markEdit } from './markEdit';

describe('markEdit', () => {
  it('highlights single word edits', () => {
    const res = markEdit('Brachial plexux injury', { field: 'solution', find: 'plexux', replace: 'plexus' });
    expect(res).not.toBeNull();
    expect(res?.before).toBe('Brachial <mark data-fx="del">plexux</mark> injury');
    expect(res?.after).toBe('Brachial <mark data-fx="ins">plexus</mark> injury');
  });

  it('outlines enclosing mathml if inside <math>', () => {
    const html = '<p>Formula <math><mn>1</mn></math> end</p>';
    const res = markEdit(html, { field: 'question', find: '<mn>1</mn>', replace: '<mn>2</mn>' });
    expect(res).not.toBeNull();
    expect(res?.before).toContain('<mark data-fx="box"><math><mn>1</mn></math></mark>');
  });
});


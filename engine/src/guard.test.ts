import { describe, expect, it } from 'vitest';
import { loadDataset } from './data';
import { parseQuestion } from './parse';
import { guard } from './guard';

const ds = loadDataset();
const P = (s: string) => parseQuestion(ds.questions.find((q) => q._id.endsWith(s))!);
const g = (s: string, repair: string, edit: any, extra: any[] = []) => guard({ repair, edit, extra, p: P(s), taxonomy: ds.taxonomy });

describe('guard', () => {
  it('answer key swap passes', () => expect(g('a949', 'answer_key', { field: 'answer', find: 'C', replace: 'A' }).ok).toBe(true));
  it('answer key to missing option fails', () => expect(g('0a1b', 'answer_key', { field: 'answer', find: 'C', replace: 'D' }).ok).toBe(false));
  it('field outside scope fails', () => expect(g('686b', 'spelling', { field: 'answer', find: 'B', replace: 'A' }).ok).toBe(false));
  it('spelling passes', () => expect(g('686b', 'spelling', { field: 'question', find: 'plexux', replace: 'plexus' }).ok).toBe(true));
  it('spelling that changes a number fails', () => expect(g('6d97', 'spelling', { field: 'solution', find: 'a = 40 cm', replace: 'a = 20 cm' }).ok).toBe(false));
  it('exam tag removal passes', () => expect(g('890f', 'exam_reference', { field: 'question', find: '(NEET 2019) ', replace: '' }).ok).toBe(true));
  it('stem_data must be stated in solution', () =>
    expect(g('81c2', 'stem_data', { field: 'question', find: 'copper cube', replace: 'copper cube of side 25 cm' }).ok).toBe(false));
  it('type mismatch with extra answer edit passes', () =>
    expect(g('4365', 'type_mismatch', { field: 'questionType', find: 'mcq', replace: 'scq' }, [{ field: 'answer', find: '["","B"]', replace: 'B' }]).ok).toBe(true));
});


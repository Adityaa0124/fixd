import {
  type Answer, type ErrorHistoryEntry, type OptionLabel, type QuestionType, type RawQuestion, type Snapshot,
  OPTION_LABELS, normalizeAnswer, answerFormatIssues,
} from '@fixd/shared';
import { htmlToText } from './html';

export interface ParsedOption {
  label: OptionLabel;
  labelStart: number;   // offset of the label (or its <math> wrapper) in raw question HTML
  start: number;        // first char after the label
  end: number;          // start of next label or end of html
  raw: string;
  text: string;
  blank: boolean;
}

export interface ParsedQuestion {
  id: string;
  qid: string | null;
  type: QuestionType;
  subject: string;
  chapter: string;
  level: string;
  updatedAt: string;
  questionRaw: string;
  stemRaw: string;
  stemText: string;
  options: ParsedOption[];
  solutionRaw: string;
  solutionText: string;
  answerRaw: string | string[];
  answer: Answer;
  answerIssues: string[];
  images: { question: number; solution: number };
  errorHistory: ErrorHistoryEntry[];
  snapshot: Snapshot;
}

const LABEL_RE =
  /<math\b[^>]*>\s*(?:<mrow>\s*)?<mo\b[^>]*>\s*\(([A-D])\)\s*<\/mo>\s*(?:<\/mrow>\s*)?<\/math>|\(([A-D])\)/g;

interface LabelHit { label: OptionLabel; start: number; end: number }

export function findLabelRun(html: string): LabelHit[] {
  const hits: LabelHit[] = [];
  for (const m of html.matchAll(LABEL_RE)) {
    const label = (m[1] ?? m[2]) as OptionLabel;
    hits.push({ label, start: m.index!, end: m.index! + m[0].length });
  }
  let best: LabelHit[] = [];
  for (let i = 0; i < hits.length; i++) {
    if (hits[i]!.label !== 'A') continue;
    const run = [hits[i]!];
    for (let j = i + 1; j < hits.length && run.length < 4; j++) {
      const want = OPTION_LABELS[run.length];
      if (hits[j]!.label === want) run.push(hits[j]!);
      else if (hits[j]!.label === 'A') break;
    }
    if (run.length >= best.length) best = run;     // ties: later run wins (options come last)
  }
  return best.length >= 2 ? best : [];
}

export function parseQuestion(rec: RawQuestion): ParsedQuestion {
  const body = rec[rec.questionType];
  if (!body) throw new Error(`${rec._id}: no body under key ${rec.questionType}`);
  const q = body.question ?? '';
  const run = rec.questionType === 'integerQuestion' ? [] : findLabelRun(q);

  const options: ParsedOption[] = run.map((h, i) => {
    const end = run[i + 1]?.start ?? q.length;
    const raw = q.slice(h.end, end);
    const text = htmlToText(raw);
    return { label: h.label, labelStart: h.start, start: h.end, end, raw, text, blank: text.replace(/\s/g, '') === '' };
  });

  const stemRaw = run.length ? q.slice(0, run[0]!.start) : q;
  return {
    id: rec._id,
    qid: rec.qid,
    type: rec.questionType,
    subject: rec.subject,
    chapter: rec.chapter,
    level: rec.level,
    updatedAt: rec.updatedAt,
    questionRaw: q,
    stemRaw,
    stemText: htmlToText(stemRaw),
    options,
    solutionRaw: body.solution ?? '',
    solutionText: htmlToText(body.solution ?? ''),
    answerRaw: body.answer,
    answer: normalizeAnswer(rec.questionType, body.answer),
    answerIssues: answerFormatIssues(rec.questionType, body.answer),
    images: { question: body.quesImages?.length ?? 0, solution: body.solutionImages?.length ?? 0 },
    errorHistory: rec.errorHistory ?? [],
    snapshot: { questionType: rec.questionType, question: q, solution: body.solution ?? '', answer: body.answer },
  };
}

export function optionsText(p: ParsedQuestion): string {
  if (!p.options.length) return '(integer type, no options)';
  return p.options.map((o) => `(${o.label}) ${o.blank ? '[BLANK]' : o.text}`).join('\n');
}

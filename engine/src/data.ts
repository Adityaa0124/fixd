import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RawQuestion, RawReport, Taxonomy } from '@fixd/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const DATA_DIR = path.join(ROOT, 'data');

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8')) as T;
}

export interface Dataset {
  questions: RawQuestion[];
  reports: RawReport[];
  taxonomy: Taxonomy;
  byId: Map<string, RawQuestion>;
}

export function loadDataset(): Dataset {
  const questions = readJson<RawQuestion[]>('questions.json');
  const reports = readJson<RawReport[]>('reports.json');
  const taxonomy = readJson<Taxonomy & { _about?: string }>('taxonomy.json');
  const byId = new Map(questions.map((q) => [q._id, q]));
  for (const r of reports) {
    if (!byId.has(r.questionId)) throw new Error(`report ${r.reportId} points at unknown question ${r.questionId}`);
  }
  return { questions, reports, taxonomy, byId };
}

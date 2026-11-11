import { loadDataset } from '../data';
import { parseQuestion } from '../parse';

const { questions } = loadDataset();
for (const rec of questions) {
  const p = parseQuestion(rec);
  const opts = p.options.map((o) => `${o.label}${o.blank ? '∅' : ''}:${o.text.slice(0, 18)}`).join(' | ');
  console.log(
    `${p.id.slice(-4)} ${p.type.padEnd(15)} ans=${JSON.stringify(p.answerRaw).padEnd(14)} ` +
    `opts=${p.options.length} ${opts}${p.answerIssues.length ? '  !! ' + p.answerIssues.join('; ') : ''}`,
  );
}


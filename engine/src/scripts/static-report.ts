import { loadDataset } from '../data';
import { parseQuestion } from '../parse';
import { staticChecks } from '../checks/static';

const { questions } = loadDataset();
for (const rec of questions) {
  const f = staticChecks(parseQuestion(rec));
  if (f.length) console.log(rec._id.slice(-4), f.map((x) => `${x.code}${x.certain ? '' : '?'}`).join(', '));
}


import { source, fail } from './util.js';
import { rightsEvidence } from '../rights.js';

const license = 'https://creativecommons.org/licenses/by-sa/4.0/';
let pending = null;
let lastRequest = 0;
let queue = [];

// The provider allows one request per IP per five seconds. Batch questions and serialize this page's callers.
async function nextQuestion(json) {
  if (queue.length) return queue.shift();
  if (!pending) pending = (async () => {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 5100 - (Date.now() - lastRequest))));
    lastRequest = Date.now();
    const result = await json('https://opentdb.com/api.php?amount=10&encode=url3986');
    if (result.response_code !== 0 || !Array.isArray(result.results)) fail(`Trivia unavailable (code ${result.response_code})`);
    queue.push(...result.results);
  })().finally(() => { pending = null; });
  await pending;
  if (!queue.length) fail('No trivia questions');
  return queue.shift();
}

export default [source('opentdb', 'Open Trivia DB', 'Trivia', async ({ json, random = Math.random }) => {
  const row = await nextQuestion(json);
  if (!['multiple', 'boolean'].includes(row.type) || !Array.isArray(row.incorrect_answers) ||
    ![row.question, row.correct_answer, row.category, row.difficulty, ...row.incorrect_answers].every(value => typeof value === 'string' && value.trim()) ||
    row.incorrect_answers.length !== (row.type === 'boolean' ? 1 : 3)) fail('Invalid trivia schema');
  const decode = decodeURIComponent;
  const options = [row.correct_answer, ...row.incorrect_answers].map(decode);
  if (new Set(options.map(value => value.trim())).size !== options.length) fail('Duplicate trivia answers');
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const raw = { kind: 'question', title: decode(row.question), subject: decode(row.category),
    subtitle: decode(row.difficulty), options,
    reveal: decode(row.correct_answer), url: 'https://opentdb.com/', credit: 'Open Trivia DB · CC BY-SA 4.0' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC_BY_SA', metadataLicenseUrl: license,
    evidence: 'https://opentdb.com/api_config.php', creator: 'Open Trivia DB contributors',
    attribution: raw.credit, mediaTitle: raw.title,
    changes: 'Question and answers unchanged; answer hidden until revealed.' });
  return raw;
})];
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SOURCES } from '../js/foly/sources.js';
import questions from '../js/foly/sources/questions.js';
import { categorySummary } from '../js/foly/categories.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';
import { discover, present } from '../js/foly/resolver.js';
import { checkSource } from '../js/foly/checks.js';
import { previewDirectory, previewGroups, previewSources, inactiveReason, runPreviewChecks } from '../js/foly/preview-model.js';
import { discoveryCatalog } from '../js/foly/catalog.js';
import { LANGUAGES } from '../js/foly/locale.js';

test('preview includes native discovery categories and enabled visual providers for every language', () => {
  const visuals = SOURCES.filter(source => source.enabled).sort((a, b) => a.name.localeCompare(b.name));
  const originalOrder = SOURCES.map(source => source.id);
  for (const language of Object.keys(LANGUAGES)) {
    const { primary } = discoveryCatalog(language);
    const entries = previewSources(primary, SOURCES);
    assert.ok(primary.length > 0, language);
    assert.equal(entries.length, primary.length + visuals.length, language);
    assert.deepEqual(entries.slice(0, primary.length), primary, language);
    assert.deepEqual(entries.slice(primary.length), visuals, language);
    assert.equal(new Set(entries.map(source => source.id)).size, entries.length, language);
    assert.ok(primary.every(source => source.language === language), language);
  }
  assert.deepEqual(SOURCES.map(source => source.id), originalOrder);
  assert.deepEqual(previewSources([], []), []);
});

const question = { type: 'multiple', question: 'Which%20number%20is%20even%3F', category: 'Mathematics', difficulty: 'easy',
  correct_answer: '2', incorrect_answers: ['1', '3', '5'] };
test('preview directory lists enabled live services separately from local datasets', () => {
  const { apis, datasets } = previewDirectory(SOURCES);
  assert.equal(apis.length, 32);
  assert.equal(datasets.length, 5);
  assert.equal(apis.every(source => source.enabled && source.rightsPolicy.kind !== 'dataset'), true);
  assert.equal(datasets.every(source => source.enabled && source.rightsPolicy.kind === 'dataset'), true);
  for (const rows of [apis, datasets]) {
    assert.deepEqual(rows.map(source => source.name), rows.map(source => source.name).sort((a, b) => a.localeCompare(b)));
    assert.equal(new Set(rows.map(source => source.id)).size, rows.length);
  }
  const input = [{ id: 'z', name: 'Z', enabled: true }, { id: 'a', name: 'A', enabled: false },
    { id: 'd', name: 'Dataset', enabled: true, rightsPolicy: { kind: 'dataset' } }];
  assert.deepEqual(previewDirectory(input).apis.map(source => source.id), ['z']);
  assert.deepEqual(input.map(source => source.id), ['z', 'a', 'd']);
  assert.deepEqual(previewDirectory([]), { apis: [], datasets: [] });
});
let raw;
test('historical trivia batches requests but remains excluded from image-only cards', async () => {
  let requests = 0;
  const json = async () => { requests++; return { response_code: 0, results: [question, question] }; };
  const source = SOURCES.find(source => source.id === 'opentdb');
  assert.equal(source.enabled, false);
  raw = await questions[0].fetch({ json });
  await questions[0].fetch({ json });
  assert.equal(requests, 1);
  assert.equal(raw.title, 'Which number is even?');
  assert.equal(raw.reveal, '2');
  assert.equal(raw.options.length, 4);
  assert.deepEqual([...raw.options].sort(), ['1', '2', '3', '5']);
  assert.equal(raw.description, undefined);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(present(raw, source).kind, 'question');
  await assert.rejects(discover([{ ...source, fetch: async () => raw }], { imageLoader: () => assert.fail('Text must not load an image') }));
  const report = await checkSource(source, { json: async () => ({ response_code: 0, results: [question] }), imageLoader: () => assert.fail('No image') });
  assert.equal(report.ok, false);
});

test('text rejects missing credits, wrong licence, stale evidence, fabricated media and truncation', () => {
  assert.ok(raw);
  for (const field of ['creator', 'attribution', 'metadataLicenseUrl', 'mediaTitle', 'changes']) {
    const bad = structuredClone(raw); bad.rights[field] = '';
    assert.equal(validateDiscoveryRights(bad).ok, false, field);
  }
  for (const mutate of [r => r.rights.metadataLicenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/',
    r => r.rights.verifiedAt = '2000-01-01', r => r.rights.mediaUrl = 'https://images.test/fake.jpg',
    r => r.kind = 'image', r => r.reveal = '']) {
    const bad = structuredClone(raw); mutate(bad); assert.equal(validateDiscoveryRights(bad).ok, false);
  }
  assert.equal(present({ ...raw, title: 'x'.repeat(201) }, { id: 'test' }), null);
  for (const options of [[], ['1', '2', '3'], ['1', '1', '2', '3'], ['a', 'b', 'c', 'd'],
    ['1', '2', '3', 'x'.repeat(201)], ['1', '2', '3', 'pornography'], ['1', '2', '3', null]]) {
    assert.equal(present({ ...raw, options }, { id: 'test' }), null);
  }
});

test('automatic checker never fetches a disabled provider or silently substitutes failures', async () => {
  const disabled = await checkSource({ id: 'disabled', enabled: false, fetch: () => assert.fail('Disabled fetch') });
  assert.equal(disabled.ok, false);
  const result = await checkSource({ id: 'broken', enabled: true, fetch: async () => { throw Error('offline'); } });
  assert.equal(result.ok, false);
  assert.equal(result.id, 'broken');
  assert.equal(result.error, 'offline');
});

test('categories cover the whole registry without inventing active providers', () => {
  const categories = categorySummary(SOURCES);
  assert.equal(categories.reduce((sum, c) => sum + c.registered, 0), SOURCES.length);
  assert.equal(categories.reduce((sum, c) => sum + c.enabled, 0), SOURCES.filter(s => s.enabled).length);
  assert.equal(categories.find(c => c.name === 'Trivia').enabled, 0);
});

test('preview shows active API cards with individual category menus instead of the audit registry', async () => {
  const [html, preview, main, workflow] = await Promise.all(['preview/index.html', 'js/foly/preview.js', 'js/foly/main.js', '.github/workflows/foly-health.yml']
    .map(path => readFile(new URL(`../${path}`, import.meta.url), 'utf8')));
  assert.match(html, /id="providers"/);
  assert.match(preview, /enabled\.map/);
  assert.doesNotMatch(html, /id="(?:inactive|categories|category|checkAll|search)"/);
  assert.match(preview, /sourceCategories\(source\)/);
  assert.match(preview, /checkSource\(source, \{ category \}\)/);
  assert.match(preview, /select.addEventListener\('change'/);
  assert.match(preview, /current !== revision/);
  assert.match(preview, /content.replaceChildren\(\)/);
  assert.match(preview, /discoveryCard\(result.discovery\)/);
  assert.match(preview, /await image.decode\(\)/);
  assert.match(preview, /image.getBoundingClientRect\(\)/);
  assert.match(main, /discoveryCard\(entry.discovery\)/);
  assert.doesNotMatch(main, /session.history.filter\(entry => entry.discovery.image\)/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /check-foly-browser.mjs/);
});

test('gallery contains only enabled integrations; historical adapters have specific explanations', () => {
  const { active, inactive } = previewGroups(SOURCES);
  assert.equal(active.length + inactive.length, SOURCES.length);
  assert.ok(active.every(source => source.enabled));
  assert.ok(inactive.every(source => !source.enabled));
  assert.match(inactiveReason(inactive.find(s => s.id === 'epic'), active), /replaced/);
  assert.match(inactiveReason(inactive.find(s => s.id === 'vam'), active), /no implemented rights/);
});

test('bounded parallel preview checks complete without a slow first API blocking the next ones', async () => {
  let running = 0, peak = 0;
  const completed = [], progress = [];
  await runPreviewChecks(Array.from({ length: 7 }, (_, id) => ({ load: async () => {
    peak = Math.max(peak, ++running);
    await new Promise(resolve => setTimeout(resolve, id === 0 ? 40 : 2));
    completed.push(id); running--;
  } })), { concurrency: 3, onProgress: done => progress.push(done) });
  assert.equal(peak, 3);
  assert.notEqual(completed[0], 0);
  assert.equal(completed.length, 7);
  assert.deepEqual(progress, [1, 2, 3, 4, 5, 6, 7]);
});
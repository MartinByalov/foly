import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { SOURCES } from '../js/foly/sources.js';
import { discover } from '../js/foly/resolver.js';
import { checkSource } from '../js/foly/checks.js';
import { withRights } from './helpers/foly-rights.mjs';

test('API-only counts and categories exclude raw-data charts and unverified image candidates', () => {
  const apis = SOURCES.filter(source => source.enabled && source.rightsPolicy.kind !== 'dataset');
  assert.equal(apis.length, 32);
  assert.deepEqual([...new Set(apis.map(source => source.category))].sort(), [
    'Art', 'Biology', 'Botany', 'Earth', 'Geography', 'Geology', 'History', 'Maps',
    'Molecular biology', 'Music', 'Nature', 'Photography', 'Textures',
  ]);
  assert.equal(new Set(SOURCES.map(source => source.id)).size, SOURCES.length);
  for (const id of ['mealdb', 'cocktaildb', 'dogCeo', 'apod', 'artic', 'smithsonian', 'spacex']) {
    const source = SOURCES.find(source => source.id === id);
    if (source) assert.equal(source.enabled, false, id);
  }
});

test('runtime skips text-only output even when an enabled adapter claims to supply images', async () => {
  const raw = withRights({ title: 'Tree', image: 'https://images.test/tree.jpg' });
  const historical = SOURCES.find(source => source.id === 'openalex');
  const text = await historical.fetch({ random: () => 0, json: async () => ({ results: [{
    id: 'https://openalex.org/W2', title: 'Coastal forests', publication_year: 2023,
    primary_topic: { display_name: 'Forests' },
  }] }) });
  const pretender = { ...historical, enabled: true, visualType: 'image', fetch: async () => text };
  assert.equal((await checkSource(pretender)).ok, false);
  const loads = [];
  const result = await discover([pretender, { id: 'image', fetch: async () => raw }], {
    random: () => 0, imageLoader: async url => loads.push(url),
  });
  assert.equal(result.sourceId, 'image');
  assert.deepEqual(result.failed, [pretender.id]);
  assert.deepEqual(loads, [raw.image]);
});

test('grid and archive use provider media without generated thumbnail code', async () => {
  const main = await readFile(new URL('../js/foly/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /chartThumbnail|thumbnail\.js|data:image/);
  assert.match(main, /const thumb = picture\(entry\?\.discovery.thumb\)/);
  assert.match(main, /class: 'archive-thumb', crossorigin: 'anonymous', src: d.thumb/);
  await assert.rejects(access(new URL('../js/foly/thumbnail.js', import.meta.url)));
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { matchesCategory } from '../js/foly/categories.js';
import { isSuitable } from '../js/foly/safety.js';
import { present, discover } from '../js/foly/resolver.js';
import additional from '../js/foly/sources/additional.js';
import { SOURCES } from '../js/foly/sources.js';
import { withRights } from './helpers/foly-rights.mjs';

test('category search handles case, accents, whitespace and multiple terms', () => {
  assert.equal(matchesCategory('Fantasy Books', '  BOOK fan '), true);
  assert.equal(matchesCategory('Café', 'cafe'), true);
  assert.equal(matchesCategory('Nature', ''), true);
  assert.equal(matchesCategory('Nature', 'music'), false);
});

test('category search is first, above All categories, and never changes selected categories', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const main = await readFile(new URL('../js/foly/main.js', import.meta.url), 'utf8');
  assert.match(html, /id="categoryMenu" hidden>\s*<input[^>]*id="categorySearch"[^>]*\/?>\s*<label[^>]*><input[^>]*id="allCategories"[\s\S]*?id="categoryList"/);
  const search = main.slice(main.indexOf('function searchCategories()'), main.indexOf('function renderFilters()'));
  assert.match(search, /option.hidden = !matchesCategory/);
  assert.match(search, /categoryEmpty/);
  assert.doesNotMatch(search, /chosen\.(add|delete|clear)|\.checked\s*=/);
  assert.match(main, /if \(!input.matches\('input\[type="checkbox"\]'\)\) return/);
});

test('metadata safety rejects explicit flags and terms before presentation', () => {
  for (const raw of [{ nsfw: true }, { adult: true }, { explicit: true }, { safe: false },
    { title: 'NSFW photograph' }, { description: 'pornographic content' }, { title: 'FUCKING example' },
    { title: 'порнография' }]) {
    assert.equal(isSuitable(raw), false);
    assert.equal(present({ image: 'https://example.test/photo.jpg', title: 'Photo', ...raw }, { id: 's' }), null);
  }
  for (const title of ['A mountain landscape', 'Sussex countryside', 'A bird in a tree', 'Classical music']) {
    assert.equal(isSuitable({ title }), true, title);
  }
});

test('unsafe results fall through without loading their images', async () => {
  const loaded = [];
  const found = await discover([
    { id: 'unsafe', fetch: async () => ({ title: 'NSFW', image: 'https://example.test/unsafe.jpg' }) },
    { id: 'safe', fetch: async () => withRights({ title: 'A tree', image: 'https://example.test/tree.jpg' }) },
  ], { random: () => 0, imageLoader: async url => loaded.push(url) });
  assert.equal(found.sourceId, 'safe');
  assert.deepEqual(loaded, ['https://example.test/tree.jpg']);
});

test('unreviewed adapters remain disabled even when they return working pictures', async () => {
  const json = async url => {
    if (url.includes('sampleapis')) return [{ title: 'Latte', description: 'Coffee with milk', ingredients: ['Coffee', 'Milk'], image: 'https://example.test/latte.jpg' }];
    if (url.includes('amiiboapi')) return { amiibo: [
      { name: 'Excluded', gameSeries: 'Other', image: 'https://example.test/other.jpg' },
      { name: 'Mario', gameSeries: 'Super Mario', image: 'https://example.test/mario.jpg' },
    ] };
    if (url.includes('potterapi')) return [{ title: 'Harry Potter', cover: 'https://example.test/book.jpg', pages: 223 }];
    throw new Error('Unexpected URL');
  };
  for (const source of additional) {
    assert.equal(SOURCES.find(s => s.id === source.id).enabled, false);
    const raw = await source.fetch({ json, random: () => 0 });
    assert.equal(present(raw, source), null, source.id);
    if (source.id === 'amiibo') assert.equal(raw.title, 'Mario');
  }
  for (const id of ['rickAndMorty', 'futurama', 'devto', 'figshare', 'wikinews', 'internetArchive', 'wellcome']) {
    assert.equal(SOURCES.find(s => s.id === id).enabled, false, id);
  }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { discover as resolveDiscovery, present as presentDiscovery, sourceSite, userFacingSourceUrl } from '../js/foly/resolver.js';
import { withRights } from './helpers/foly-rights.mjs';
import { loadImage } from '../js/foly/images.js';
import { createSession } from '../js/foly/session.js';
import { SOURCES, text } from '../js/foly/sources.js';

const present = (raw, source) => presentDiscovery(withRights(raw), source);
const source = (id, fetch) => ({ id, name: id, category: 'Test', fetch: fetch && (async context => withRights(await fetch(context))) });
const image = 'https://images.test/discovery.jpg';
const ok = title => async () => ({ title, image, description: 'Something worth seeing.' });
const discover = (sources, options) => resolveDiscovery(sources, { imageLoader: async () => {}, ...options });
const sequence = values => { let i = 0; return () => values[i++ % values.length]; };

test('parallel discovery returns a valid fast source without waiting for a hung source', async () => {
  const attempts = [];
  const result = await discover([
    source('hung', () => new Promise(() => {})),
    source('fast', ok('Fast result')),
    source('unused', () => assert.fail('Unneeded source started')),
  ], { concurrency: 2, random: () => 0, onAttempt: s => attempts.push(s.id) });
  assert.equal(result.title, 'Fast result');
  assert.deepEqual(attempts, ['hung', 'fast']);
});

test('parallel discovery rejects invalid results and caps active providers at two', async () => {
  let active = 0;
  let maximum = 0;
  const sources = Array.from({ length: 5 }, (_, i) => source(`source-${i}`, async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return i === 4 ? { title: 'Valid', image } : null;
  }));
  const result = await discover(sources, { concurrency: 2, random: () => 0 });
  assert.equal(result.title, 'Valid');
  assert.equal(maximum, 2);
});

test('description source notes are omitted while the source link and credit are retained', () => {
  for (const note of ['(Source: MAL)', '(Source: Anime News Network)', '[Source: MAL]', '(source: MAL)']) {
    const found = present({ title: 'A story', image, description: `First paragraph.\n\n${note}\n\nSecond paragraph.`,
      url: 'https://kitsu.app/anime/story', credit: 'Kitsu' }, source('kitsu', null));
    assert.equal(found.description, 'First paragraph.\n\nSecond paragraph.');
    assert.equal(found.url, 'https://kitsu.app/anime/story');
    assert.equal(found.credit, 'Kitsu');
  }
  const found = present({ title: 'A story', image, description: 'A story (with a twist).\n\n(Source: MAL)' }, source('kitsu', null));
  assert.equal(found.description, 'A story (with a twist).');
});

test('source buttons show the destination website rather than the API name', () => {
  assert.equal(sourceSite({ sourceName: 'Studio Ghibli API', url: 'https://en.wikipedia.org/wiki/My_Neighbor_Totoro' }), 'en.wikipedia.org');
  assert.equal(sourceSite({ sourceName: 'The Rick and Morty API', url: 'https://rickandmorty.fandom.com/wiki/Rick' }), 'rickandmorty.fandom.com');
  const saved = { sourceName: 'Nobel Prize API', url: 'https://www.nobelprize.org/prizes/' };
  assert.equal(sourceSite(saved), 'nobelprize.org');
  assert.equal(saved.url, 'https://www.nobelprize.org/prizes/');
});

test('source links must lead to a human-facing page, not an API or raw media response', () => {
  for (const url of [
    'https://api.example.org/item/1',
    'https://example.org/iiif/item/manifest.json',
    'https://example.org/graphql',
    'https://example.org/item/image.jpg',
  ]) assert.equal(userFacingSourceUrl(url), null, url);
  for (const url of [
    'https://example.org/item/1',
    'https://example.org/digital/collection/photos/id/42',
  ]) assert.equal(userFacingSourceUrl(url), url);
  const found = present({ title: 'A historical map', image, url: 'https://api.example.org/iiif/manifest.json',
    sourcePageUrl: 'https://example.org/digital/collection/maps/id/42' }, source('archive', null));
  assert.equal(found.url, 'https://api.example.org/iiif/manifest.json');
  assert.equal(found.sourcePageUrl, 'https://example.org/digital/collection/maps/id/42');
  assert.equal(found.rights.sourceItemUrl, 'https://api.example.org/iiif/manifest.json');
});

test('source labels without a usable website omit API and have a safe fallback', () => {
  assert.equal(sourceSite({ sourceName: 'Dog API' }), 'Dog');
  assert.equal(sourceSite({ sourceName: 'Example API', url: 'not a URL' }), 'Example');
  assert.equal(sourceSite({ sourceName: 'Example API', url: 'javascript:alert(1)' }), 'Example');
  assert.equal(sourceSite({}), 'Source');
});

test('every approved source has a unique id and a fetcher', () => {
  assert.ok(SOURCES.some(s => s.enabled !== false));
  for (const s of SOURCES) assert.ok(s.name && s.category, s.id);
  assert.equal(new Set(SOURCES.map(s => s.id)).size, SOURCES.length);
  for (const s of SOURCES) assert.equal(typeof s.fetch, 'function', s.id);
});

test('each source has an equal chance of being drawn', async () => {
  const sources = ['a', 'b', 'c', 'd'].map(id => source(id, ok(id)));
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  for (let i = 0; i < 400; i++) counts[(await discover(sources, { random: () => (i % 4 + .5) / 4 })).sourceId]++;
  assert.deepEqual(counts, { a: 100, b: 100, c: 100, d: 100 });
});

test('a failing source is replaced by another random source', async () => {
  const calls = [];
  const sources = [
    source('broken', async () => { calls.push('broken'); throw new Error('timeout'); }),
    source('empty', async () => { calls.push('empty'); return { title: '' }; }),
    source('good', async () => { calls.push('good'); return { title: 'Found', image, description: 'x' }; }),
  ];
  const found = await discover(sources, { random: sequence([0]) });
  assert.equal(found.sourceId, 'good');
  assert.deepEqual(found.failed, ['broken', 'empty']);
  assert.deepEqual(calls, ['broken', 'empty', 'good']);
});

test('failures do not change the odds of the next opening', async () => {
  let flaky = true;
  const sources = [source('flaky', async () => { if (flaky) { flaky = false; throw new Error('down'); } return { title: 'back', image, quote: 'x' }; }), source('other', ok('other'))];
  assert.equal((await discover(sources, { random: () => 0 })).sourceId, 'other');
  assert.equal((await discover(sources, { random: () => 0 })).sourceId, 'flaky');
});

test('an opening fails only after every source was tried once', async () => {
  const sources = ['a', 'b', 'c'].map(id => source(id, async () => { throw new Error(id); }));
  await assert.rejects(discover(sources, { random: () => .5 }), error => error.failed.length === 3);
});

test('discoveries share one shape and reject unsafe links and thumbnails', () => {
  const found = present({ title: ' Moon ', description: 'Rock', image }, source('s', null));
  assert.equal(found.title, 'Moon');
  assert.equal(found.image, image);
  assert.equal(found.thumb, image);
  assert.equal(found.url, 'https://images.test/item');
  assert.equal(present({ title: 'Moon', image, url: 'javascript:alert(1)' }, source('s', null)), null);
  assert.equal(present({ title: 'Moon', image, thumb: 'http://x.test/a.jpg' }, source('s', null)), null);
  assert.equal(present({ title: 'Only a title' }, source('s', null)), null);
});

test('unreviewed text-only sources are disabled and never called', async () => {
  const textOnly = ['jokeapi', 'catfacts', 'usgs', 'wiktionary', 'poetrydb', 'swapi'];
  for (const id of textOnly) assert.equal(SOURCES.find(s => s.id === id)?.enabled, false, id);
  assert.equal(SOURCES.find(s => s.id === 'met').enabled, true);
  assert.equal(SOURCES.find(s => s.id === 'openalex').enabled, false);
  let called = false;
  const found = await discover([
    { ...source('text', async () => { called = true; }), enabled: false },
    source('photo', ok('Photo')),
  ], { random: () => 0 });
  assert.equal(called, false);
  assert.equal(found.sourceId, 'photo');
});

test('results without a safe image are rejected, even with text or an answer', () => {
  for (const image of [undefined, '', 'http://images.test/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,x']) {
    assert.equal(present({ title: 'Text', description: 'Description', quote: 'Quote', reveal: 'Answer', image }, source('s', null)), null);
  }
});

test('missing and broken images cause another source to be drawn', async () => {
  const loads = [];
  const found = await discover([
    source('text', async () => ({ title: 'Text', description: 'No photo' })),
    source('broken', async () => ({ title: 'Broken', image: 'https://images.test/broken.jpg' })),
    source('good', ok('Good')),
  ], { random: () => 0, imageLoader: async url => {
    loads.push(url);
    if (url.includes('broken')) throw new Error('404');
  } });
  assert.equal(found.sourceId, 'good');
  assert.deepEqual(found.failed, ['text', 'broken']);
  assert.deepEqual(loads, ['https://images.test/broken.jpg', image]);
});

test('broken thumbnails fall back to the successfully loaded main image', async () => {
  const found = await discover([source('photo', async () => ({ title: 'Photo', image, thumb: 'https://images.test/thumb.jpg' }))], {
    imageLoader: async url => { if (url !== image) throw new Error('Broken thumb'); },
  });
  assert.equal(found.thumb, image);
});

test('a discovery is not returned until its image has loaded', async () => {
  let finish;
  let returned = false;
  const pending = discover([source('photo', ok('Photo'))], {
    imageLoader: () => new Promise(resolve => { finish = resolve; }),
  }).then(found => { returned = true; return found; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(returned, false);
  finish();
  assert.equal((await pending).image, image);
});

test('image loader shares successful loads and retries failed loads', async () => {
  let created = 0;
  let broken = false;
  class ImageStub {
    naturalWidth = 100;
      naturalHeight = 100;
    constructor() { created++; }
    set src(url) { queueMicrotask(() => broken ? this.onerror() : this.onload()); }
    removeAttribute() {}
  }
  const url = 'https://images.test/cached.jpg';
  const first = loadImage(url, { ImageClass: ImageStub });
  assert.equal(loadImage(url, { ImageClass: ImageStub }), first);
  await first;
  assert.equal(created, 1);
  broken = true;
  const retry = 'https://images.test/retry.jpg';
  await assert.rejects(loadImage(retry, { ImageClass: ImageStub }), /failed/);
  broken = false;
  assert.equal(await loadImage(retry, { ImageClass: ImageStub }), retry);
  assert.equal(created, 3);
});

test('image loader times out stalled images and rejects empty images', async () => {
  class StalledImage {
    set src(url) {}
    removeAttribute() {}
  }
  await assert.rejects(loadImage('https://images.test/stalled.jpg', { ImageClass: StalledImage, timeout: 5 }), /timed out/);
  class EmptyImage extends StalledImage {
    naturalWidth = 0;
    set src(url) { queueMicrotask(() => this.onload()); }
  }
  await assert.rejects(loadImage('https://images.test/empty.jpg', { ImageClass: EmptyImage }), /Empty/);
});

test('html from sources becomes plain text', () => {
  assert.equal(text('<i>Felis</i> &amp; <b>cats</b>&#39;s &#x2014; ok'), "Felis & cats's — ok");
});

test('discoveries stay in memory and a new page starts empty even with restored storage', () => {
  const store = new Map();
  store.set('foly:session:v1', JSON.stringify({ opened: [99], history: [{ box: 99 }] }));
  store.set('foly:categories:v1', '["Art"]');
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  const session = createSession(storage);
  session.record(42, { title: 'A' });
  session.record(7, { title: 'B' });
  assert.deepEqual(session.opened, [42, 7]);
  assert.deepEqual(session.history.map(e => [e.n, e.box, e.discovery.title]), [[1, 42, 'A'], [2, 7, 'B']]);
  assert.equal(store.has('foly:session:v1'), false);
  assert.equal(store.get('foly:categories:v1'), '["Art"]');
  const restored = createSession(storage);
  assert.deepEqual(restored.opened, []);
  assert.deepEqual(restored.history, []);
});

test('discoveries work when browser storage is unavailable', () => {
  for (const storage of [null, { removeItem() { throw new Error('Blocked'); } }]) {
    const session = createSession(storage);
    session.record(1, { title: 'A' });
    assert.equal(session.history.length, 1);
    assert.equal(createSession(storage).history.length, 0);
  }
});

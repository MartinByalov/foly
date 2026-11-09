import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryCatalog, discoverWithFallback } from '../js/foly/catalog.js';
import { parseDidYouKnow } from '../js/foly/wikipedia.js';
import { withRights } from './helpers/foly-rights.mjs';

test('catalog includes only implemented language-specific modes and independent enabled fallbacks', () => {
  const en = discoveryCatalog('en');
  assert.ok(en.primary.some(source => source.id === 'wikipedia-dyk'));
  assert.ok(en.fallback.every(source => source.languages?.includes('en')));
  assert.ok(en.fallback.every(source => source.enabled));
  assert.ok(!discoveryCatalog('bg').primary.some(source => source.id === 'wikipedia-dyk'));
});

test('published DYK parser selects bold article targets and skips unsupported markup', () => {
  const apostrophes = "'''";
  const hooks = parseDidYouKnow(`* ... that ${apostrophes}[[Oak|oak trees]]${apostrophes} live long?\n* ... that {{unsupported}}?\n* [[Archive]]`);
  assert.deepEqual(hooks, [{ article: 'Oak', text: 'oak trees live long?' }]);
});

test('provider failure exhausts selected sources before trying independent fallbacks', async () => {
  const attempts = [];
  const broken = id => ({ id, language: 'en', enabled: true, fetch: async () => { attempts.push(id); throw Error('offline'); } });
  await assert.rejects(discoverWithFallback([broken('wiki-one'), broken('wiki-two')],
    [broken('independent-one'), broken('independent-two')], { random: () => 0 }), /Every source/);
  assert.deepEqual(attempts, ['wiki-one', 'wiki-two', 'independent-one', 'independent-two']);
});

test('successful primary discovery never calls fallback', async () => {
  const { primary } = discoveryCatalog('bg');
  const result = await discoverWithFallback([primary[0]], [{ id: 'never', fetch: () => assert.fail('fallback called') }], {
    random: () => 0, imageLoader: async () => {}, json: async url => url.includes('commons.wikimedia.org') ? {
      query: { pages: [{ title: 'File:Tree.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/tree.jpg',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Tree.jpg', extmetadata: {
          LicenseUrl: { value: 'https://creativecommons.org/publicdomain/zero/1.0/' },
        } }] }] },
    } : { query: { rightsinfo: { url: 'https://creativecommons.org/licenses/by-sa/4.0/' }, pages: [{
      ns: 0, pageid: 1, title: 'Tree', extract: 'A tree is a plant.', pageimage: 'Tree.jpg',
      fullurl: 'https://bg.wikipedia.org/wiki/Tree', revisions: [{ revid: 42 }],
    }] } },
  });
  assert.equal(result.title, 'Tree');
});

for (const language of ['en', 'bg', 'fr', 'hi']) {
  test(`${language}: unverified and other-language fallback providers are never called`, async () => {
    const forbidden = id => ({ id, fetch: async () => assert.fail('Wrong-language provider called') });
    const primary = [{ id: 'offline', language, fetch: async () => { throw Error('offline'); } }];
    await assert.rejects(discoverWithFallback(primary, [forbidden('unknown'),
      { ...forbidden('wrong'), languages: [language === 'en' ? 'bg' : 'en'] }], { language }),
    error => { assert.deepEqual(error.failed, ['offline']); return true; });
  });
}

test('a provider claiming Bulgarian support cannot return an English discovery', async () => {
  const source = { id: 'mislabelled', languages: ['bg'], fetch: async () => ({ language: 'en' }) };
  await assert.rejects(discoverWithFallback([], [source], { language: 'bg' }), error => {
    assert.deepEqual(error.failed, ['mislabelled']);
    return true;
  });
});

test('fallback keeps the selected language, rights and mandatory decoded image', async () => {
  const source = createBulgarianSource();
  const decoded = [];
  const result = await discoverWithFallback([{ id: 'offline', language: 'bg', fetch: async () => { throw Error('offline'); } }],
    [source], { language: 'bg', random: () => 0, imageLoader: async url => decoded.push(url), json: async url =>
      url.includes('commons.wikimedia.org') ? { query: { pages: [{ title: 'File:Tree.jpg', imageinfo: [{
        thumburl: 'https://upload.wikimedia.org/tree.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Tree.jpg',
        extmetadata: { LicenseUrl: { value: 'https://creativecommons.org/publicdomain/zero/1.0/' } },
      }] }] } } : { query: { rightsinfo: { url: 'https://creativecommons.org/licenses/by-sa/4.0/' }, pages: [{
        ns: 0, pageid: 1, title: 'Дърво', extract: 'Дървото е растение.', pageimage: 'Tree.jpg',
        fullurl: 'https://bg.wikipedia.org/wiki/Дърво', revisions: [{ revid: 42 }],
      }] } },
    });
  assert.equal(result.language, 'bg');
  assert.equal(result.title, 'Дърво');
  assert.ok(decoded.includes(result.image));
  assert.deepEqual(result.failed, ['offline']);
});

function createBulgarianSource() {
  return discoveryCatalog('bg').primary[0];
}

test('a validated parallel winner cancels the losing transport without starting more providers', async () => {
  const attempts = [];
  let aborted = false;
  const slow = { id: 'slow', language: 'bg', fetch: ({ json }) => json('https://bg.wikipedia.org/slow') };
  const fast = { id: 'fast', language: 'bg', fetch: async () => withRights({
    title: 'Дърво', language: 'bg', image: 'https://images.test/tree.jpg',
    description: 'Дървото е растение.',
  }) };
  const result = await discoverWithFallback([slow, fast, { ...slow, id: 'unused' }], [], {
    language: 'bg', timeout: 1000, concurrency: 2, random: () => 0,
    onAttempt: source => attempts.push(source.id), imageLoader: async () => {},
    json: (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(signal.reason); }, { once: true });
    }),
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(result.title, 'Дърво');
  assert.equal(aborted, true);
  assert.deepEqual(attempts, ['slow', 'fast']);
});

test('opening deadline releases a hung provider without starting fallback', async () => {
  let fallbackCalls = 0;
  await assert.rejects(discoverWithFallback([
    { id: 'hung', language: 'bg', fetch: () => new Promise(() => {}) },
  ], [{ id: 'fallback', language: 'bg', fetch: async () => { fallbackCalls++; } }],
  { language: 'bg', timeout: 25 }), /timed out/);
  assert.equal(fallbackCalls, 0);
});

test('deadline aborts transport and prevents late provider retries', async () => {
  let calls = 0;
  let aborted = false;
  const source = { id: 'slow', language: 'bg', fetch: ({ json }) => json('https://bg.wikipedia.org/w/api.php') };
  await assert.rejects(discoverWithFallback([source, { ...source, id: 'never' }], [], {
    language: 'bg', timeout: 25, json: (url, options) => new Promise((resolve, reject) => {
      calls++;
      assert.equal(options.timeout, 25);
      options.signal.addEventListener('abort', () => { aborted = true; reject(options.signal.reason); });
    }),
  }), /timed out/);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls, 1);
  assert.equal(aborted, true);
});


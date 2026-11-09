import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/open-access.js';
import { SOURCES } from '../js/foly/sources.js';
import { discover } from '../js/foly/resolver.js';
import { checkSource } from '../js/foly/checks.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const get = id => adapters.find(source => source.id === id);
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const uuid = '045279d5-24e5-4838-bec9-0bea86812e35';
const silhouette = () => ({ uuid, build: 562, _links: { license: { href: CC0 },
  rasterFiles: [{ type: 'image/png', sizes: '750x448',
    href: `https://images.phylopic.org/images/${uuid}/raster/750x448.png` }] } });

test('PhyloPic skips eligible rights without usable media and retries distinct pages in one build', async () => {
  const calls = [];
  const raw = await get('phylopicReviewed').fetch({ random: () => 0, json: async url => {
    calls.push(url);
    if (!url.includes('embed_items')) return { build: 562, totalPages: 5 };
    return { build: 562, _embedded: { items: url.includes('page=0&')
      ? [{ ...silhouette(), _links: { license: { href: CC0 } } }]
      : [{ ...silhouette(), build: 561 }, silhouette()] } };
  } });
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.match(raw.rights.verifiedBy, /build=562.*page=1&/);
  assert.equal(calls.length, 4);
});

test('PhyloPic rejects mixed page builds and bounds empty-page retries', async () => {
  for (const build of [561, undefined, 562]) {
    const calls = [];
    await assert.rejects(get('phylopicReviewed').fetch({ random: () => .99, json: async url => {
      calls.push(url);
      if (!url.includes('embed_items')) return { build: 562, totalPages: 5 };
      return { build, _embedded: { items: [] } };
    } }), build === 562 ? /No supported silhouette/ : /Mismatched PhyloPic page build/);
    assert.equal(calls.length, build === 562 ? 5 : 3);
    if (build === 562) assert.deepEqual(calls.slice(2).map(url => new URL(url).searchParams.get('page')), ['4', '0', '1']);
  }
});

test('PhyloPic selects usable licensed media before random choice and rejects path tricks', async () => {
  const bad = silhouette();
  bad._links.rasterFiles[0].href = `https://images.phylopic.org/images/${uuid}/raster/../../other.png`;
  const raw = await get('phylopicReviewed').fetch({ random: () => 0, json: async url => url.includes('embed_items')
    ? { build: 562, _embedded: { items: [bad, silhouette()] } } : { build: 562, totalPages: 1 } });
  assert.equal(raw.image, silhouette()._links.rasterFiles[0].href);
});

const occurrence = (key, license = CC0) => ({ key, scientificName: 'A tree', license: CC0,
  media: [{ type: 'StillImage', license, identifier: `https://images.test/${key}.jpg` }] });

for (const mode of ['adapter', 'checker', 'resolver']) test(`GBIF ${mode} retries failed media without crossing providers or losing rights`, async () => {
  const attempts = [];
  const context = { random: () => 0,
    json: async () => ({ results: [occurrence(1), occurrence(9, 'https://creativecommons.org/licenses/by-nc/4.0/'), occurrence(2)] }),
    imageLoader: async image => { attempts.push(image); if (image.endsWith('/1.jpg')) throw Error('Decode timeout'); } };
  const source = SOURCES.find(source => source.id === 'gbif');
  let raw;
  if (mode === 'adapter') raw = await get('gbif').fetch(context);
  if (mode === 'checker') {
    const result = await checkSource(source, context);
    assert.equal(result.ok, true);
    raw = result.discovery;
  }
  if (mode === 'resolver') raw = await discover([source], context);
  assert.equal(raw.image, 'https://images.test/2.jpg');
  assert.equal(raw.url, 'https://www.gbif.org/occurrence/2');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.deepEqual(attempts.slice(0, 2), ['https://images.test/1.jpg', 'https://images.test/2.jpg']);
  assert.ok(!attempts.includes('https://images.test/9.jpg'));
});

test('GBIF caps failed decode attempts at three unique image URLs', async () => {
  const attempts = [];
  await assert.rejects(get('gbif').fetch({ random: () => 0,
    json: async () => ({ results: [occurrence(1), occurrence(1), occurrence(2), occurrence(3), occurrence(4)] }),
    imageLoader: async image => { attempts.push(image); throw Error('Decode failed'); },
  }), /No occurrence with usable open data AND media/);
  assert.deepEqual(attempts, [1, 2, 3].map(key => `https://images.test/${key}.jpg`));
});

test('GBIF shares in-flight metadata per client but still checks every selected image', async () => {
  let requests = 0;
  let decodes = 0;
  const json = async () => { requests++; return { results: [occurrence(1), occurrence(2)] }; };
  const imageLoader = async () => { decodes++; };
  const rows = await Promise.all([0, .99].map(value => get('gbif').fetch({ json, imageLoader, random: () => value })));
  assert.equal(requests, 1);
  assert.equal(decodes, 2);
  assert.equal(rows[0].rights.verifiedBy, rows[1].rights.verifiedBy);
  assert.notEqual(rows[0].image, rows[1].image);
  await get('gbif').fetch({ random: () => 0, imageLoader, json: async () => { requests++; return { results: [occurrence(3)] }; } });
  assert.equal(requests, 2);
});

test('GBIF evicts rejected metadata instead of retrying rate limits in a tight loop', async () => {
  let requests = 0;
  const json = async () => {
    if (++requests === 1) throw Error('HTTP 429');
    return { results: [occurrence(1)] };
  };
  await assert.rejects(get('gbif').fetch({ json, random: () => 0 }), /HTTP 429/);
  assert.equal(requests, 1);
  const raw = await get('gbif').fetch({ json, random: () => 0 });
  assert.equal(requests, 2);
  assert.equal(validateDiscoveryRights(raw).ok, true);
});
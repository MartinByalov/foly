import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import adapters from '../js/foly/sources/open-access.js';
import { validateDiscoveryRights, requiresCardCredit } from '../js/foly/rights.js';
import { fetchJson, present } from '../js/foly/resolver.js';
import { SOURCES } from '../js/foly/sources.js';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const get = id => adapters.find(source => source.id === id);
const objectId = 'https://data.getty.edu/museum/collection/object/11111111-1111-1111-1111-111111111111';
const mediaId = 'https://data.getty.edu/media/image/22222222-2222-2222-2222-222222222222';
const image = 'https://media.getty.edu/iiif/image/33333333-3333-3333-3333-333333333333/full/!600,600/0/default.jpg';
const rights = () => [{ classified_as: [{ id: CC0 }] }];
function getty() {
  return { object: { id: objectId, type: 'HumanMadeObject', _label: 'A vase', subject_to: rights(),
    referred_to_by: [{ content: 'Separately licensed prose' }], shows: [{ id: mediaId, type: 'VisualItem' }],
    subject_of: [{ id: 'https://www.getty.edu/art/collection/object/ABC123', format: 'text/html' }] },
  media: { id: mediaId, type: 'VisualItem', subject_to: rights(), shown_by: [{ id: objectId }],
    digitally_shown_by: [{ access_point: [{ id: image, format: 'image/jpeg' }] }] } };
}
const fetchGetty = data => get('getty').fetch({ random: () => 0, json: async url => {
  if (url.includes('/sparql?')) return { results: { bindings: [{ s: { value: objectId } }] } };
  return url === objectId ? data.object : data.media;
} });
test('Getty requires independently licensed metadata and the exact linked digital image', async () => {
  const raw = await fetchGetty(getty());
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.description, undefined);
  assert.equal(raw.image, image);
  assert.equal(raw.rights.verifiedBy, mediaId);
});
for (const [name, mutate] of [
  ['metadata rights', data => data.object.subject_to = []],
  ['media rights', data => data.media.subject_to = []],
  ['restricted media', data => data.media.subject_to[0].classified_as[0].id = 'https://creativecommons.org/licenses/by-nc/4.0/'],
  ['object identity', data => data.object.id += 'x'],
  ['media identity', data => data.media.id += 'x'],
  ['reverse item linkage', data => data.media.shown_by = [{ id: objectId + 'x' }]],
  ['untrusted media host', data => data.media.digitally_shown_by[0].access_point[0].id = image.replace('media.getty.edu', 'evil.test')],
  ['untrusted source action', data => data.object.subject_of[0].id = 'https://evil.test/'],
]) test(`Getty rejects missing or changed ${name}`, async () => {
  const data = getty(); mutate(data);
  await assert.rejects(fetchGetty(data));
});
test('Poly Haven uses only raw diffuse files and mandatory bottom credit survives presentation', async () => {
  const raw = await get('polyhaven').fetch({ random: () => 0, json: async () => ({ Diffuse: { '1k': { jpg: {
    url: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/aerial_grass_rock/aerial_grass_rock_diff_1k.jpg',
  } } } }) });
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(requiresCardCredit(present(raw, SOURCES.find(source => source.id === 'polyhaven'))), true);
  for (const image of ['https://cdn.polyhaven.com/asset_img/thumbs/aerial_grass_rock.png',
    'https://evil.test/aerial_grass_rock_diff_1k.jpg', 'http://dl.polyhaven.org/image.jpg']) {
    await assert.rejects(get('polyhaven').fetch({ random: () => 0, json: async () => ({ Diffuse: { '1k': { jpg: { url: image } } } }) }));
  }
});
test('Poly Haven requests identify Foly without changing other providers', async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push(options); return { ok: true, json: async () => ({}) }; };
  await fetchJson('https://api.polyhaven.com/files/test', { fetcher });
  await fetchJson('https://api.example.test/', { fetcher });
  assert.equal(calls[0].headers['User-Agent'], 'Foly/1.0');
  assert.equal(calls[1].headers['User-Agent'], undefined);
});
test('NGA subset contains individually open images and rejects restricted or unbound rows', async () => {
  const data = JSON.parse(await readFile(new URL('../data/foly-nga.json', import.meta.url), 'utf8'));
  assert.equal(data.items.length, 30);
  for (const row of data.items) {
    const raw = await get('nga').fetch({ random: () => 0, json: async () => ({ items: [row] }) });
    assert.equal(validateDiscoveryRights(raw).ok, true);
  }
  for (const change of [{ openaccess: '0' }, { metadataLicense: 'unknown' }, { mediaLicense: 'CC_BY_NC' },
    { provenance: 'https://evil.test/data.csv' }, { image: 'https://evil.test/image.jpg' }]) {
    await assert.rejects(get('nga').fetch({ random: () => 0, json: async () => ({ items: [{ ...data.items[0], ...change }] }) }));
  }
});
test('GBIF resizes only the selected licensed iNaturalist original, not unrelated URLs', async () => {
  const row = { key: 123, scientificName: 'A tree', license: CC0, media: [{ type: 'StillImage', license: CC0,
    identifier: 'https://inaturalist-open-data.s3.amazonaws.com/photos/123/original.jpg' }] };
  const raw = await get('gbif').fetch({ random: () => 0, json: async () => ({ results: [row] }) });
  assert.equal(raw.image, 'https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg');
  assert.equal(raw.rights.mediaUrl, raw.image);
  assert.equal(validateDiscoveryRights(raw).ok, true);
});
test('unadmitted Smithsonian and BHL adapters are not registered', () => {
  for (const id of ['smithsonian', 'bhl']) {
    assert.equal(adapters.some(source => source.id === id), false);
    assert.equal(SOURCES.some(source => source.id === id), false);
  }
});
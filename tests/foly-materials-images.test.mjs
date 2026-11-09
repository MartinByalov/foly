import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import adapters from '../js/foly/sources/materials-images.js';
import { SOURCES } from '../js/foly/sources.js';
import { present } from '../js/foly/resolver.js';
import { validateDiscoveryRights, requiresCardCredit, mediaCredit } from '../js/foly/rights.js';
import { previewGroups, inactiveStatus } from '../js/foly/preview-model.js';

const get = id => adapters.find(source => source.id === id);
const materials = () => ({ header: { origin: 'https://api.physicallybased.info/v2/materials',
  schemaVersion: 2.2, license: 'CC0 1.0 Universal', deprecated: false }, data: [{ name: 'Aluminum',
  images: [{ format: 'jpeg', '600': 'https://raw.githubusercontent.com/AntonPalmqvist/physically-based-api/main/images/renders/cycles/600/aluminum.jpeg' }] }] });

test('RoboHash remains excluded because its generated image URL is not a browseable destination', async () => {
  for (const random of [0, .37, .99]) {
    const raw = await get('robohash').fetch({ random: () => random });
    const image = new URL(raw.image);
    assert.equal(image.hostname, 'robohash.org');
    assert.equal(image.searchParams.get('set'), 'set4');
    assert.equal(image.searchParams.get('size'), '320x320');
    assert.equal(validateDiscoveryRights(raw).ok, true);
    const source = SOURCES.find(source => source.id === 'robohash');
    assert.equal(source.enabled, false);
    assert.equal(present(raw, source), null);
  }
});

test('Flagpedia displays only reviewed country flags with original factual captions', async () => {
  for (let index = 0; index < 18; index++) {
    const raw = await get('flagpedia').fetch({ random: () => index / 18 });
    assert.match(raw.image, /^https:\/\/flagcdn\.com\/w640\/[a-z]{2}\.png$/);
    assert.equal(raw.url, 'https://flagpedia.net/download');
    assert.equal(raw.rights.mediaLicense, 'PDM');
    assert.equal(raw.description, undefined);
    assert.equal(validateDiscoveryRights(raw).ok, true);
  }
});

test('Physically Based keeps independent CC0 metadata and attributed shader-ball media', async () => {
  const raw = await get('physicallyBased').fetch({ random: () => 0, json: async () => materials() });
  assert.equal(raw.rights.metadataLicense, 'CC0');
  assert.equal(raw.rights.mediaLicense, 'CC_BY');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(requiresCardCredit(raw), true);
  assert.match(mediaCredit(raw), /Anton Palmqvist/);
  assert.match(mediaCredit(raw), /ASWF USD Working Group/);
  assert.equal(raw.description, undefined);
});

for (const [name, mutate] of [
  ['licence', data => data.header.license = 'MIT'],
  ['schema', data => data.header.schemaVersion = 3],
  ['origin', data => data.header.origin = 'https://evil.test/'],
  ['deprecated schema', data => data.header.deprecated = true],
  ['media host', data => data.data[0].images[0]['600'] = 'https://evil.test/aluminum.jpeg'],
  ['media format', data => data.data[0].images[0].format = 'avif'],
  ['empty title', data => data.data[0].name = ''],
]) test(`Physically Based rejects changed ${name}`, async () => {
  const data = materials(); mutate(data);
  await assert.rejects(get('physicallyBased').fetch({ random: () => 0, json: async () => data }));
});

const ambient = JSON.parse(await readFile(new URL('../data/foly-ambientcg.json', import.meta.url), 'utf8'));
for (const id of ['openmoji', 'twemoji']) test(`${id} pins its media and credits to one reviewed revision`, async () => {
  for (let index = 0; index < 12; index++) {
    const raw = await get(id).fetch({ random: () => index / 12 });
    assert.match(raw.image, /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\/(color|assets)\/svg\/[a-fA-F0-9]+\.svg$/);
    assert.equal(raw.description, undefined);
    assert.equal(validateDiscoveryRights(raw).ok, true);
    const source = SOURCES.find(source => source.id === id);
    const reopened = present(present(raw, source), source);
    assert.equal(requiresCardCredit(reopened), true);
    assert.equal(reopened.rights.originalMediaUrl, raw.image);
    assert.equal(raw.rights.mediaLicense, id === 'openmoji' ? 'CC_BY_SA' : 'CC_BY');
    assert.equal(raw.rights.author, raw.rights.creator);
    assert.equal(raw.rights.source_url, raw.url);
    assert.equal(raw.rights.license_url, raw.rights.mediaLicenseUrl);
    assert.equal(raw.rights.license_name, id === 'openmoji' ? 'CC BY-SA 4.0' : 'CC BY 4.0');
    assert.ok(mediaCredit(reopened).includes(raw.rights.creator));
    if (id === 'openmoji') {
      assert.equal(raw.rights.deliveryMode, 'direct');
      assert.equal(raw.rights.retention, 'ephemeral');
    }
  }
});

test('ambientCG dataset binds every reviewed image to its exact official asset', async () => {
  assert.equal(ambient.items.length, 17);
  assert.equal(new Set(ambient.items.map(row => row.id)).size, 17);
  for (const row of ambient.items) {
    const raw = await get('ambientcg').fetch({ random: () => 0, json: async url => {
      assert.match(url, /data\/foly-ambientcg\.json$/);
      return { items: [row] };
    } });
    assert.equal(validateDiscoveryRights(raw).ok, true);
    assert.equal(raw.image, row.image);
    assert.equal(raw.rights.verifiedBy, row.provenance);
  }
});

for (const [name, change] of Object.entries({
  metadata: { metadataLicense: 'unknown' }, media: { mediaLicense: 'CC_BY_NC' },
  provenance: { provenance: 'https://evil.test/' }, host: { image: 'https://evil.test/Bark016.jpg' },
  identity: { id: 'Fabric086' },
})) test(`ambientCG rejects unbound ${name}`, async () => {
  await assert.rejects(get('ambientcg').fetch({ random: () => 0,
    json: async () => ({ items: [{ ...ambient.items[0], ...change }] }) }));
});

test('preview classifications are exclusive and do not call text-only or replaced entries broken APIs', () => {
  const { active, inactive, statuses } = previewGroups(SOURCES);
  assert.equal(Object.values(statuses).flat().length, inactive.length);
  assert.equal(new Set(Object.values(statuses).flat()).size, inactive.length);
  for (const [id, status] of [['artic', 'blocked'], ['epic', 'superseded'],
    ['crossref', 'textOnly'], ['vam', 'unfinished']]) {
    assert.equal(inactiveStatus(SOURCES.find(source => source.id === id), active), status);
  }
});
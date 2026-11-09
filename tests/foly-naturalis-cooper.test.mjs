import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import naturalis from '../js/foly/sources/naturalis.js';
import cooper from '../js/foly/sources/cooper.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const specimen = () => ({ id: 'ABC123-123@NSR', sourceSystemId: 'ABC123-123', sourceSystem: { code: 'NSR' },
  sourceInstitutionID: 'Naturalis Biodiversity Center', owner: 'Naturalis Biodiversity Center', license: 'CC0',
  creator: 'Photographer', description: 'Do not reproduce this prose.',
  serviceAccessPoints: [{ format: 'image/jpeg', accessUri: 'https://images.naturalis.nl/original/123_beetle.jpg' }],
  identifications: [{ taxonRank: 'species', defaultClassification: { kingdom: 'Animalia' },
    scientificName: { genusOrMonomial: 'Coccinella', specificEpithet: 'septempunctata' } }] });
const getNaturalis = items => naturalis[0].fetch({ random: () => 0, json: async url => {
  const params = new URL(url).searchParams;
  assert.equal(params.get('license'), 'CC0');
  assert.equal(params.get('_size'), '20');
  return { resultSet: items.map(item => ({ item })) };
} });

test('Naturalis independently checks image rights and uses species facts instead of catalogue descriptions', async () => {
  const raw = await getNaturalis([specimen()]);
  assert.equal(raw.title, 'Coccinella septempunctata');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.doesNotMatch(raw.description, /reproduce/);
  assert.equal(new URL(raw.url).searchParams.get('sourceSystemId'), specimen().sourceSystemId);
});
test('Naturalis rejects unsupported rights, foreign records and unsafe images', async () => {
  for (const mutate of [row => row.license = 'CC BY-NC-ND', row => row.owner = 'Other',
    row => row.sourceSystem.code = 'DCSR', row => row.id = '../escape',
    row => row.sourceInstitutionID = 'Other', row => row.sourceSystemId = 'mismatch',
    row => row.serviceAccessPoints[0].accessUri = 'https://evil.test/image.jpg',
    row => row.serviceAccessPoints[0].accessUri = 'https://images.naturalis.nl/original/../image.jpg',
    row => row.serviceAccessPoints[0].accessUri = 'https://images.naturalis.nl/original/%2e%2e.jpg',
    row => row.identifications[0].defaultClassification.kingdom = 'Plantae',
    row => row.identifications[0].scientificName.genusOrMonomial = '<script>']) {
    const item = specimen(); mutate(item);
    await assert.rejects(getNaturalis([item]));
  }
  await assert.rejects(getNaturalis([]));
  await assert.rejects(naturalis[0].fetch({ random: () => 0, json: async () => { throw Error('Unavailable'); } }), /Unavailable/);
});

const dataset = JSON.parse(await fs.readFile(new URL('../data/foly-cooper.json', import.meta.url), 'utf8'));
const getCooper = data => cooper[0].fetch({ random: () => 0, json: async () => data });
test('Cooper Hewitt accepts separately CC0 image declarations with bound source evidence', async () => {
  assert.ok(dataset.items.length >= 3);
  for (const item of dataset.items) {
    const raw = await getCooper({ ...dataset, items: [item] });
    assert.equal(raw.image, item.image);
    assert.equal(validateDiscoveryRights(raw).ok, true);
  }
});
test('Cooper Hewitt rejects altered licences, evidence, source identifiers and media endpoints', async () => {
  for (const mutate of [row => row.cc0 = false, row => row.mediaLicense = 'CC_BY',
    row => row.metadataLicense = 'unknown', row => row.evidence = 'https://evil.test/',
    row => row.image = 'https://evil.test/image.jpg', row => row.url = 'https://evil.test/',
    row => row.objectId = '../bad', row => row.mediaId = 'bad', row => row.mediaId = 'media-999999', row => row.mediaSha256 = 'bad',
    row => row.title = 'Unreviewed prose']) {
    const data = structuredClone(dataset); data.items = [data.items[0]]; mutate(data.items[0]);
    await assert.rejects(getCooper(data));
  }
  await assert.rejects(getCooper({ ...dataset, items: [] }));
  await assert.rejects(getCooper({ ...dataset, metadataEvidence: '' }));
});
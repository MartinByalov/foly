import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceCategories } from '../js/foly/source-categories.js';
import adapters from '../js/foly/sources/open-access.js';
import { checkSource } from '../js/foly/checks.js';
import { SOURCES } from '../js/foly/sources.js';

const get = id => adapters.find(source => source.id === id);

test('every active API has its own category options without borrowing unrelated Foly categories', async () => {
  for (const source of SOURCES.filter(source => source.enabled && !['met', 'physicallyBased'].includes(source.id))) {
    const options = await sourceCategories(source);
    assert.ok(options.length);
    assert.equal(new Set(options.map(option => option.value)).size, options.length);
    if (source.id !== 'inaturalist') assert.deepEqual(options, [{ value: '', label: 'No category filter' }]);
  }
});

test('Met categories use live department identifiers and reject malformed lists', async () => {
  const options = await sourceCategories({ id: 'met' }, { json: async url => {
    assert.match(url, /\/departments$/);
    return { departments: [{ departmentId: 11, displayName: 'European Paintings' },
      { departmentId: -1, displayName: 'Invalid' }] };
  } });
  assert.deepEqual(options, [{ value: '', label: 'All categories' }, { value: '11', label: 'European Paintings' }]);
  await assert.rejects(sourceCategories({ id: 'met' }, { json: async () => ({}) }), /No supported/);
});

test('Met department selection is sent to search and independently verified on the chosen object', async () => {
  const calls = [];
  const json = async url => {
    calls.push(url);
    if (url.endsWith('/departments')) return { departments: [{ departmentId: 11, displayName: 'European Paintings' }] };
    if (url.includes('/search?')) { assert.equal(new URL(url).searchParams.get('departmentId'), '11'); return { objectIDs: [1, 2] }; }
    return { title: 'A painting', department: url.endsWith('/1') ? 'Wrong department' : 'European Paintings',
      primaryImageSmall: 'https://images.test/painting.jpg', objectURL: 'https://www.metmuseum.org/art/collection/search/2', isPublicDomain: true };
  };
  const raw = await get('met').fetch({ json, random: () => 0, category: '11' });
  assert.equal(raw.rights.verifiedBy.endsWith('/2'), true);
  assert.equal(calls.length, 4);
  await assert.rejects(get('met').fetch({ json, random: () => 0, category: 'invalid' }), /Invalid Met/);
});

test('iNaturalist filters native iconic taxa and rejects out-of-category API results', async () => {
  const row = name => ({ id: 1, license_code: 'cc0', taxon: { name: 'A species', iconic_taxon_name: name },
    photos: [{ license_code: 'cc0', url: 'https://images.test/square.jpg' }] });
  const json = async url => {
    assert.equal(new URL(url).searchParams.get('iconic_taxa'), 'Aves');
    return { results: [row('Mammalia'), row('Aves')] };
  };
  const report = await checkSource(SOURCES.find(source => source.id === 'inaturalist'),
    { json, random: () => 0, category: 'Aves', imageLoader: async () => {} });
  assert.equal(report.ok, true);
  assert.equal(report.discovery.subject, 'Aves');
  await assert.rejects(get('inaturalist').fetch({ json, random: () => 0, category: 'Not a taxon' }), /Unsupported/);
});

const materials = () => ({ header: { origin: 'https://api.physicallybased.info/v2/materials', schemaVersion: 2.2,
  license: 'CC0 1.0 Universal', deprecated: false }, data: ['Metal', 'Plastic'].map((category, index) => ({
  name: `${category} example`, category: [category], images: [{ format: 'jpeg',
    '600': `https://raw.githubusercontent.com/AntonPalmqvist/physically-based-api/main/images/renders/cycles/600/example${index}.jpeg` }],
})) });

test('Physically Based categories come from native metadata and actually constrain the image', async () => {
  const json = async () => materials();
  const options = await sourceCategories({ id: 'physicallyBased' }, { json });
  assert.deepEqual(options.map(option => option.value), ['', 'Metal', 'Plastic']);
  const raw = await get('physicallyBased').fetch({ json, random: () => 0, category: 'Plastic' });
  assert.equal(raw.title, 'Plastic example');
  assert.equal(raw.rights.metadataLicense, 'CC0');
  await assert.rejects(get('physicallyBased').fetch({ json, random: () => 0, category: 'Unknown' }), /No reviewed/);
  await assert.rejects(sourceCategories({ id: 'physicallyBased' }, { json: async () => ({ header: {} }) }), /Unreviewed/);
});
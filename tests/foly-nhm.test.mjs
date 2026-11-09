import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/nhm.js';
import { validateDiscoveryRights, requiresCardCredit, mediaCredit } from '../js/foly/rights.js';
import { SOURCES } from '../js/foly/sources.js';
import { present } from '../js/foly/resolver.js';

const resource = '05ff2255-c38a-40c9-b657-4ccb55ab2feb';
const holder = 'The Trustees of the Natural History Museum, London';
const dataset = () => ({ success: true, result: { name: 'collection-specimens', license_id: 'CC0-1.0',
  private: false, organization: { name: 'nhm' }, resources: [{ id: resource }] } });
const specimen = () => ({ institutionCode: 'NHMUK', collectionCode: 'BOT', basisOfRecord: 'PreservedSpecimen',
  occurrenceID: '671ccdae-fc5b-47f7-a307-bdf85c2e813c', scientificName: 'Taraxacum acutifrons Markl.',
  associatedMedia: [{ type: 'StillImage', category: 'Specimen', rightsHolder: holder,
    license: 'http://creativecommons.org/licenses/by/4.0/', title: '015750842',
    assetID: 'adfc8224-9637-4b14-a7d2-df3f218c5d56', identifier: 'https://data.nhm.ac.uk/media/adfc8224-9637-4b14-a7d2-df3f218c5d56' }] });
const fetchRow = (row = specimen(), meta = dataset()) => adapters[0].fetch({ random: () => .37, json: async url => {
  if (url.includes('package_show')) return meta;
  const p = new URL(url).searchParams;
  assert.ok(['370', '0'].includes(p.get('offset')));
  assert.equal(p.get('limit'), '20');
  assert.deepEqual(JSON.parse(p.get('filters')), { collectionCode: 'BOT', associatedMediaCount: 1 });
  return { success: true, result: { records: row ? [row] : [] } };
} });

test('NHM independently checks metadata and media licences and retains mandatory image credits', async () => {
  const raw = await fetchRow();
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.rights.mediaLicense, 'CC_BY');
  assert.equal(raw.rights.mediaLicenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(raw.rights.mediaTitle, '015750842');
  assert.equal(raw.rights.creator, holder);
  assert.equal(raw.rights.mediaUrl, raw.image);
  assert.equal(raw.rights.originalMediaUrl, raw.image);
  assert.equal(raw.rights.sourceItemUrl, raw.url);
  assert.equal(requiresCardCredit(present(raw, adapters[0])), true);
  assert.doesNotMatch(raw.description, /[;\u2013\u2014]/);
  assert.doesNotMatch(mediaCredit(raw), /[;\u2013\u2014]/);
  assert.equal(SOURCES.find(source => source.id === 'nhmLondon').enabled, true);
});

test('NHM fails closed on changed dataset rights and malformed responses', async () => {
  for (const change of [{ license_id: 'CC-BY-NC' }, { private: true }, { name: 'other' },
    { organization: { name: 'other' } }, { resources: [] }]) {
    const meta = dataset(); Object.assign(meta.result, change);
    await assert.rejects(fetchRow(specimen(), meta));
  }
  await assert.rejects(fetchRow(null));
  await assert.rejects(adapters[0].fetch({ random: () => 0, json: async () => ({ success: false }) }));
  await assert.rejects(adapters[0].fetch({ random: () => 0, json: async () => { throw Error('HTTP 429'); } }), /429/);
});

test('NHM rejects restricted, foreign and unbound media without substitution', async () => {
  for (const change of [{ license: 'https://creativecommons.org/licenses/by-nc/4.0/' }, { license: '' },
    { rightsHolder: '' }, { rightsHolder: 'Other' }, { type: 'Video' }, { category: 'Other' },
    { assetID: '../bad' }, { identifier: 'https://evil.test/image.jpg' }, { title: '' }]) {
    const row = specimen(); Object.assign(row.associatedMedia[0], change);
    await assert.rejects(fetchRow(row));
  }
  for (const change of [{ institutionCode: 'other' }, { collectionCode: 'ZOO' }, { occurrenceID: '../bad' },
    { scientificName: '<script>bad</script>' }, { associatedMedia: null }, { basisOfRecord: 'HumanObservation' }]) {
    await assert.rejects(fetchRow({ ...specimen(), ...change }));
  }
});

test('NHM retries an ineligible batch within the same provider without relaxing rights', async () => {
  let batches = 0;
  const raw = await adapters[0].fetch({ random: () => .87, json: async url => {
    if (url.includes('package_show')) return dataset();
    batches++;
    if (batches === 1) return { success: true, result: { records: [] } };
    assert.equal(new URL(url).searchParams.get('offset'), '0');
    return { success: true, result: { records: [specimen()] } };
  } });
  assert.equal(batches, 2);
  assert.equal(validateDiscoveryRights(raw).ok, true);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import adapters from '../js/foly/sources/fng.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const dataset = JSON.parse(await fs.readFile(new URL('../data/foly-fng.json', import.meta.url), 'utf8'));
const fetchDataset = data => adapters[0].fetch({ random: () => 0, json: async () => data });
test('FNG binds each CC0 image to an official dataset record', async () => {
  assert.ok(dataset.items.length >= 3);
  for (const item of dataset.items) {
    const raw = await fetchDataset({ ...dataset, items: [item] });
    assert.equal(raw.title, item.title);
    assert.equal(raw.image, item.image);
    assert.equal(validateDiscoveryRights(raw).ok, true);
  }
});
test('FNG rejects altered licences, provenance, identifiers and unbound URLs', async () => {
  for (const change of [row => row.metadataLicense = 'CC_BY', row => row.mediaLicense = 'restricted',
    row => row.image += '?redirect=evil', row => row.url = 'https://evil.test/',
    row => row.mediaId = -1, row => row.objectId = '123', row => row.provenance = 'https://evil.test/',
    row => row.metadataEvidence = 'https://evil.test/', row => row.title = '', row => row.mediaSha256 = 'bad']) {
    const data = structuredClone(dataset);
    data.items = [data.items[0]];
    change(data.items[0]);
    await assert.rejects(fetchDataset(data));
  }
  for (const data of [{ ...dataset, items: [] }, { ...dataset, metadataEvidence: '' },
    { ...dataset, mediaEvidence: '' }, { ...dataset, prefixSha256: '' }]) await assert.rejects(fetchDataset(data));
});
test('FNG propagates unavailable dataset without substituting another provider', async () => {
  await assert.rejects(adapters[0].fetch({ random: () => 0, json: async () => { throw Error('HTTP 503'); } }), /503/);
});
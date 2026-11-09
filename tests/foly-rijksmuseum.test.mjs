import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/open-access.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const adapter = adapters.find(source => source.id === 'rijksmuseum');
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const PDM = 'https://creativecommons.org/publicdomain/mark/1.0/';
const entity = id => `https://id.rijksmuseum.nl/${id}`;
const endpoint = id => `https://data.rijksmuseum.nl/${id}?_profile=la-framed`;
const rights = license => ({ subject_to: [{ classified_as: [{ id: license }] }] });
const object = id => ({ id: entity(id), subject_of: [{ id: `https://data.rijksmuseum.nl/${id}`, ...rights(CC0) }],
  shows: [{ id: entity(id + 100) }], identified_by: [{ type: 'Name',
    language: [{ id: 'http://vocab.getty.edu/aat/300388277' }], content: 'A reviewed painting' }] });

test('Rijksmuseum retries a restricted visual without reusing its rights for the next candidate', async () => {
  const fixtures = new Map([
    ['https://data.rijksmuseum.nl/search/collection?type=painting', { orderedItems: [{ id: entity(1) }, { id: entity(2) }] }],
    [endpoint(1), object(1)], [endpoint(101), rights('https://creativecommons.org/licenses/by-nc/4.0/')],
    [endpoint(2), object(2)], [endpoint(102), { ...rights(PDM), digitally_shown_by: [{ id: entity(202) }] }],
    [endpoint(202), { access_point: [{ id: 'https://iiif.micr.io/reviewed/full/max/0/default.jpg' }] }],
  ]);
  const calls = [];
  const raw = await adapter.fetch({ random: () => 0, json: async url => {
    calls.push(url);
    assert.ok(fixtures.has(url), `Unexpected request: ${url}`);
    return fixtures.get(url);
  } });
  assert.equal(raw.url, entity(2));
  assert.equal(raw.image, 'https://iiif.micr.io/reviewed/full/800,/0/default.jpg');
  assert.equal(raw.rights.mediaLicense, 'PDM');
  assert.equal(raw.rights.verifiedBy, endpoint(2));
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(calls.length, 6);
});

test('Rijksmuseum tries at most five distinct candidates and never requests an untrusted entity', async () => {
  const calls = [];
  await assert.rejects(adapter.fetch({ random: () => 0, json: async url => {
    calls.push(url);
    if (calls.length === 1) return { orderedItems: [{ id: 'https://evil.test/1' },
      ...Array.from({ length: 8 }, (_, index) => ({ id: entity(index + 1) }))] };
    return {};
  } }), /No linked Rijksmuseum image/);
  assert.deepEqual(calls.slice(1), [1, 2, 3, 4, 5].map(endpoint));
});
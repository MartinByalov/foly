import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/openverse.js';
import { SOURCES } from '../js/foly/sources.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const id = 'f7da45f0-db49-4d45-9854-56ea68add8f5';
const fixture = () => ({ id, title: 'Christchurch Botanic Gardens.', creator: 'Bernard Spragg',
  license: 'cc0', license_version: '1.0', license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
  mature: false, unstable__sensitivity: [], source: 'flickr', provider: 'flickr',
  foreign_landing_url: 'https://www.flickr.com/photos/88123769@N02/14063342357',
  url: 'https://live.staticflickr.com/2921/14063342357_29c4da5869_b.jpg' });

test('Openverse exposes one active API with individually verified CC0 media', async () => {
  assert.equal(SOURCES.filter(source => source.id === 'openverse' && source.enabled).length, 1);
  const raw = await adapters[0].fetch({ json: async url => {
    assert.equal(url, `https://api.openverse.org/v1/images/${id}/`);
    return fixture();
  } });
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.image, fixture().url);
  assert.equal(raw.rights.mediaLicense, 'CC0');
});

test('Openverse rejects uncertain rights, sensitive content and substituted resources', async () => {
  for (const patch of [{ id: 'other' }, { license: 'by' }, { license_url: '' }, { license_version: '4.0' },
    { mature: true }, { unstable__sensitivity: ['sensitive'] }, { unstable__sensitivity: undefined },
    { url: 'https://example.org/image.jpg' }, { foreign_landing_url: 'https://example.org/' },
    { creator: '' }, { title: 'Nudity' }, { source: 'other' }]) {
    await assert.rejects(adapters[0].fetch({ json: async () => ({ ...fixture(), ...patch }) }));
  }
});
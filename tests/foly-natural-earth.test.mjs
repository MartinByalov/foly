import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/natural-earth.js';
import { SOURCES } from '../js/foly/sources.js';
import { validateDiscoveryRights, discoveryLicense } from '../js/foly/rights.js';

const image = 'https://www.naturalearthdata.com/wp-content/uploads/2009/09/banner_countries.png';
const url = 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/attachment/banner_countries/';
const fixture = () => ({ id: 3259, type: 'attachment', media_type: 'image', mime_type: 'image/png',
  source_url: image, link: url, media_details: { file: '2009/09/banner_countries.png', width: '580', height: '150',
    image_meta: { copyright: '' } } });

test('Natural Earth is active once with a provider map and bound public-domain evidence', async () => {
  assert.equal(SOURCES.filter(source => source.id === 'naturalEarth' && source.enabled).length, 1);
  const raw = await adapters[0].fetch({ random: () => 0, json: async endpoint => {
    assert.equal(endpoint, 'https://www.naturalearthdata.com/wp-json/wp/v2/media/3259');
    return fixture();
  } });
  assert.equal(raw.image, image);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(discoveryLicense(raw.rights.mediaLicenseUrl), 'PUBLIC_DOMAIN');
  assert.equal(discoveryLicense('https://www.naturalearthdata.com/other/'), null);
});

test('Natural Earth rejects unrelated site media, substitutions and copyright notices', async () => {
  for (const mutate of [
    row => { row.id = 999; }, row => { row.type = 'post'; }, row => { row.mime_type = 'text/html'; },
    row => { row.source_url = 'https://example.org/image.png'; }, row => { row.link = 'https://example.org/'; },
    row => { row.media_details.file = 'photo.png'; }, row => { row.media_details.width = 20; },
    row => { row.media_details.height = 20; }, row => { row.media_details.image_meta.copyright = 'Reserved'; },
    row => { delete row.media_details.width; }, row => { row.media_details.height = 'unknown'; },
  ]) {
    const row = fixture(); mutate(row);
    await assert.rejects(adapters[0].fetch({ random: () => 0, json: async () => row }));
  }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/verified-visuals.js';
import { SOURCES } from '../js/foly/sources.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const nasaId = 'GSFC_20171208_Archive_e001386';
const nasa = () => ({ collection: { items: [{
  href: `https://images-assets.nasa.gov/image/${nasaId}/collection.json`,
  data: [{ nasa_id: nasaId, center: 'GSFC', media_type: 'image', title: 'Blue Marble 2012',
    description: 'Credit: NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring' }],
  links: [{ render: 'image', width: 640,
    href: `https://images-assets.nasa.gov/image/${nasaId}/${nasaId}~small.jpg` }],
}] } });
const id = '4b33d024-1861-4809-b4af-67b1e7883d9d';
const ala = () => ({ success: true, imageIdentifier: id, type: 'StillImage', mimeType: 'image/jpeg',
  license: CC0, recognisedLicence: { url: CC0 }, description: 'A museum specimen',
  imageUrl: `https://images.ala.org.au/store/d/9/d/3/${id}/original`, rightsHolder: 'Museum', rights: '' });
const get = id => adapters.find(source => source.id === id);

test('verified visual APIs are active once, with bound open-media evidence', async () => {
  for (const source of adapters) {
    assert.equal(SOURCES.filter(row => row.id === source.id && row.enabled).length, 1);
    const raw = await source.fetch({ random: () => 0, json: async url => {
      if (source.id === 'nasaLibrary') return nasa();
      if (url.includes('/ws/search?')) {
        assert.match(new URL(url).searchParams.get('q'), /publicdomain\/zero\/1\.0/);
        return { images: [{ imageIdentifier: id, format: 'image/jpeg', license: CC0 }] };
      }
      return ala();
    } });
    assert.equal(validateDiscoveryRights(raw).ok, true);
    assert.equal(raw.image, raw.rights.mediaUrl);
  }
});

test('NASA rejects altered credits, third-party works, missing media and identity mismatches', async () => {
  for (const mutate of [
    data => { data.collection.items[0].data[0].description = 'Credit: A photographer'; },
    data => { data.collection.items[0].data[0].description += ' © Another creator'; },
    data => { data.collection.items[0].data[0].secondary_creator = 'Third party'; },
    data => { data.collection.items[0].data[0].nasa_id = 'other'; },
    data => { data.collection.items[0].links = []; },
    data => { data.collection.items[0].links[0].href = 'https://example.org/image.jpg'; },
  ]) {
    const data = nasa(); mutate(data);
    await assert.rejects(get('nasaLibrary').fetch({ random: () => 0, json: async () => data }));
  }
});

test('ALA checks item rights independently and rejects restricted or substituted images', async () => {
  for (const mutate of [
    data => { data.license = 'https://creativecommons.org/licenses/by-nc/4.0/'; },
    data => { data.recognisedLicence.url = ''; },
    data => { data.imageIdentifier = 'other'; },
    data => { data.imageUrl = 'https://example.org/image.jpg'; },
    data => { data.rights = 'All rights reserved'; },
    data => { data.mimeType = 'video/mp4'; },
    data => { data.success = false; },
  ]) {
    const data = ala(); mutate(data);
    await assert.rejects(get('alaImages').fetch({ random: () => 0, json: async url => url.includes('/ws/search?')
      ? { images: [{ imageIdentifier: id, format: 'image/jpeg', license: CC0 }] } : data }));
  }
  await assert.rejects(get('alaImages').fetch({ random: () => 0, json: async () => ({ images: [] }) }));
});
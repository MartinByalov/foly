import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/europeana.js';
import { SOURCES } from '../js/foly/sources.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const adapter = adapters[0];
const id = '/401/item_FDEZFFPSJNUMPHVMMOPXGLI7MTY73SHS';
const image = 'https://www.muis.ee/digitaalhoidla/api/meedia/originaal?id=b5066c9c-86e6-48d5-a936-a6c525339286';
const preview = `https://api.europeana.eu/thumbnail/v2/url.json?${new URLSearchParams({ uri: image, type: 'IMAGE' })}`;
const fixture = () => ({ success: true, object: { about: id,
  aggregations: [{ aggregatedCHO: `/item${id}`, edmRights: { def: ['http://creativecommons.org/publicdomain/zero/1.0/'] },
    edmIsShownBy: image, webResources: [{ about: image, ebucoreHasMimeType: 'image/jpeg' }] }],
  europeanaAggregation: { edmLandingPage: `https://www.europeana.eu/item${id}`, edmPreview: preview },
  proxies: [{ dcTitle: { en: ['Flowers/Flowers'] } }],
} });

test('Europeana is registered once and binds CC0 evidence to provider media', async () => {
  assert.equal(SOURCES.filter(source => source.id === 'europeana' && source.enabled).length, 1);
  const raw = await adapter.fetch({ random: () => 0, json: async url => {
    if (url.includes('/search.json?')) {
      const params = new URL(url).searchParams;
      assert.equal(params.get('reusability'), 'open');
      assert.equal(params.get('media'), 'true');
      assert.equal(params.get('query'), `europeana_id:"${id}"`);
      return { success: true, items: [{ id, rights: ['http://creativecommons.org/publicdomain/zero/1.0/'] }] };
    }
    assert.equal(url, `https://api.europeana.eu/record/v2${id}.json?wskey=api2demo`);
    return fixture();
  } });
  assert.equal(raw.image, preview);
  assert.equal(raw.title, 'Flowers/Flowers');
  assert.equal(raw.rights.metadataLicense, 'CC0');
  assert.equal(validateDiscoveryRights(raw).ok, true);
});

test('Europeana rejects unbound media, unclear rights, unsafe titles and malformed records', async () => {
  for (const mutate of [
    data => { data.success = false; },
    data => { data.object.about = '/other'; },
    data => { data.object.aggregations[0].aggregatedCHO = '/item/other'; },
    data => { data.object.aggregations[0].edmRights.def = []; },
    data => { data.object.aggregations[0].edmRights.def = ['https://creativecommons.org/licenses/by/4.0/']; },
    data => { data.object.aggregations[0].edmIsShownBy = 'https://example.org/image.jpg'; },
    data => { data.object.aggregations[0].webResources = []; },
    data => { data.object.aggregations[0].webResources[0].ebucoreHasMimeType = 'text/html'; },
    data => { data.object.europeanaAggregation.edmLandingPage = 'https://example.org/'; },
    data => { data.object.europeanaAggregation.edmPreview = 'https://example.org/image.jpg'; },
    data => { data.object.europeanaAggregation.edmPreview = preview.replace('type=IMAGE', 'type=VIDEO'); },
    data => { data.object.europeanaAggregation.edmPreview = preview + '&extra=1'; },
    data => { data.object.proxies = []; },
    data => { data.object.proxies[0].dcTitle.en = ['Explicit nudity']; },
  ]) {
    const data = fixture(); mutate(data);
    await assert.rejects(adapter.fetch({ random: () => 0, json: async url => url.includes('/search.json?')
      ? { success: true, items: [{ id, rights: ['http://creativecommons.org/publicdomain/zero/1.0/'] }] } : data }));
  }
});

test('Europeana open search is a prerequisite, never a substitute for item-level rights', async () => {
  for (const response of [{ success: false }, { success: true, items: [] },
    { success: true, items: [{ id, rights: ['https://creativecommons.org/licenses/by-nc/4.0/'] }] }]) {
    await assert.rejects(adapter.fetch({ random: () => 0, json: async () => response }));
  }
});
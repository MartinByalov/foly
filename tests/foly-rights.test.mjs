import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDiscoveryRights, discoveryLicense, mediaCredit } from '../js/foly/rights.js';
import { present, discover } from '../js/foly/resolver.js';
import { SOURCES } from '../js/foly/sources.js';
import adapters from '../js/foly/sources/open-access.js';
import questions from '../js/foly/sources/questions.js';
import bibliographic from '../js/foly/sources/bibliographic.js';
import observations from '../js/foly/sources/observations.js';
import { withRights } from './helpers/foly-rights.mjs';

const photo = () => withRights({ title: 'A tree', image: 'https://images.test/tree.jpg' });
const get = id => adapters.find(s => s.id === id);
const context = data => ({ json: async () => data, random: () => 0 });
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

test('rights reject missing, restricted and separately unlicensed media/data', () => {
  assert.equal(present({ title: 'A tree', image: 'https://images.test/tree.jpg' }, { id: 's' }), null);
  for (const field of ['metadataLicense', 'mediaLicense']) {
    for (const value of [null, '', 'CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'MIT', 'No known copyright restrictions', 'https://creativecommons.org.evil.test/publicdomain/zero/1.0/']) {
      const raw = photo(); raw.rights[field] = value;
      assert.equal(validateDiscoveryRights(raw).ok, false, `${field}: ${value}`);
    }
  }
  assert.equal(validateDiscoveryRights(photo()).ok, true);
  assert.equal(discoveryLicense('http://creativecommons.org/publicdomain/zero/1.0/legalcode'), 'CC0');
  assert.equal(discoveryLicense('https://creativecommons.org.evil.test/publicdomain/zero/1.0/legalcode'), null);
  assert.equal(discoveryLicense('https://creativecommons.org/licenses/by-nc/4.0/legalcode'), null);
});

test('rights evidence is bound to the exact image, thumbnail, item and verification time', () => {
  for (const change of [r => r.image += '?different', r => r.thumb = 'https://images.test/other.jpg',
    r => r.url += '/other', r => r.rights.verifiedBy = 'http://images.test/item',
    r => r.rights.mediaLicenseUrl = 'https://creativecommons.org/licenses/by/4.0/',
    r => r.rights.verifiedAt = 'invalid', r => r.rights.verifiedAt = '2000-01-01',
    r => r.rights.verifiedAt = '2099-01-01']) {
    const raw = photo(); change(raw);
    assert.equal(validateDiscoveryRights(raw).ok, false);
  }
});

test('attributed media supports CC BY and BY-SA 2.0, 3.0 and 4.0 with bound credit fields', () => {
  for (const [code, slug, name] of [
    ['CC_BY', 'by', 'CC BY'], ['CC_BY_SA', 'by-sa', 'CC BY-SA'],
  ]) {
    for (const version of ['2.0', '3.0', '4.0']) {
      const raw = photo();
      const licenseUrl = `https://creativecommons.org/licenses/${slug}/${version}/`;
      Object.assign(raw.rights, { mediaLicense: code, mediaLicenseUrl: licenseUrl,
        creator: 'Original artist', mediaTitle: 'Original image title', attribution: 'Copyright Original artist; supplied notices',
        originalMediaUrl: raw.image, changes: 'No modifications by Foly; displayed at a scaled size.',
        author: 'Original artist', source_url: raw.url, license_url: licenseUrl, license_name: `${name} ${version}`,
        ...(code === 'CC_BY_SA' ? { deliveryMode: 'direct', retention: 'ephemeral' } : {}) });
      assert.equal(validateDiscoveryRights(raw).ok, true);
      assert.equal(discoveryLicense(`${licenseUrl}legalcode`), code);
      assert.equal(discoveryLicense(`${licenseUrl}deed.en`), code);
      assert.ok(mediaCredit(present(raw, { id: 'fixture' })).includes('Copyright Original artist; supplied notices'));
      for (const field of ['creator', 'mediaTitle', 'attribution', 'originalMediaUrl', 'changes']) {
        const bad = structuredClone(raw); bad.rights[field] = '';
        assert.equal(validateDiscoveryRights(bad).ok, false, field);
      }
      for (const field of ['author', 'source_url', 'license_url', 'license_name']) {
        const bad = structuredClone(raw); bad.rights[field] = '';
        assert.equal(validateDiscoveryRights(bad).ok, false, field);
      }
      for (const url of [`https://creativecommons.org/licenses/${slug}/1.0/`,
        `https://creativecommons.org/licenses/${slug}/5.0/`,
        `https://creativecommons.org.evil.test/licenses/${slug}/${version}/`,
        `https://creativecommons.org/licenses/${slug}/${version}/?other=license`,
        'javascript:alert(1)']) {
        const bad = structuredClone(raw); bad.rights.mediaLicenseUrl = url;
        bad.rights.license_url = url;
        assert.equal(validateDiscoveryRights(bad).ok, false);
      }
      const badLabel = structuredClone(raw); badLabel.rights.license_name = 'CC BY-NC 4.0';
      assert.equal(validateDiscoveryRights(badLabel).ok, false);
      for (const [field, value] of [['author', 'Different artist'], ['source_url', 'https://images.test/other-item'],
        ['license_url', 'https://creativecommons.org/licenses/by-nc/4.0/']]) {
        const bad = structuredClone(raw); bad.rights[field] = value;
        assert.equal(validateDiscoveryRights(bad).ok, false, field);
      }
      if (code === 'CC_BY_SA') {
        for (const field of ['deliveryMode', 'retention']) {
          const bad = structuredClone(raw); bad.rights[field] = '';
          assert.equal(validateDiscoveryRights(bad).ok, false, field);
        }
      }
      const metadata = structuredClone(raw); metadata.rights.metadataLicense = code;
      assert.equal(validateDiscoveryRights(metadata).ok, false);
    }
  }
  assert.equal(discoveryLicense('https://creativecommons.org/licenses/by-nd/4.0/'), null);
});

test('unlicensed results fall through before any image network request', async () => {
  const loaded = [];
  const found = await discover([
    { id: 'unknown', fetch: async () => ({ title: 'Photo', image: 'https://images.test/unknown.jpg' }) },
    { id: 'open', fetch: async () => photo() },
  ], { random: () => 0, imageLoader: async url => loaded.push(url) });
  assert.equal(found.sourceId, 'open');
  assert.deepEqual(found.failed, ['unknown']);
  assert.deepEqual(loaded, ['https://images.test/tree.jpg']);
  assert.equal(found.rights.mediaLicense, 'CC0');
});

test('GBIF checks media rights separately from occurrence rights', async () => {
  const r = { key: 123, scientificName: 'A tree', license: `${CC0}legalcode`, media: [
    { type: 'StillImage', identifier: 'https://images.test/restricted.jpg', license: 'https://creativecommons.org/licenses/by-nc/4.0/' },
    { type: 'StillImage', identifier: 'https://images.test/open.jpg', license: CC0 },
  ] };
  const raw = await get('gbif').fetch(context({ results: [r] }));
  assert.equal(raw.image, 'https://images.test/open.jpg');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  await assert.rejects(get('gbif').fetch(context({ results: [{ ...r, media: [r.media[0]] }] })));
  await assert.rejects(get('gbif').fetch(context({ results: [{ ...r, license: 'CC_BY' }] })));
});

test('iNaturalist chooses a CC0 photo, never a restricted default or first photo', async () => {
  const r = { id: 1, license_code: 'cc0', taxon: { name: 'Tree' }, photos: [
    { license_code: 'cc-by-nc', url: 'https://images.test/restricted.jpg' },
    { license_code: 'cc0', url: 'https://images.test/open.jpg' },
  ] };
  assert.equal((await get('inaturalist').fetch(context({ results: [r] }))).image, 'https://images.test/open.jpg');
  await assert.rejects(get('inaturalist').fetch(context({ results: [{ ...r, license_code: 'cc-by-nc' }] })));
  await assert.rejects(get('inaturalist').fetch(context({ results: [{ ...r, photos: [r.photos[0]] }] })));
});

test('museum adapters reject results that violate filters and avoid restricted Chicago prose', async () => {
  await assert.rejects(get('met').fetch(context({ objectIDs: [1], isPublicDomain: false })));
  await assert.rejects(get('artic').fetch(context({ data: [{ title: 'Tree', image_id: 'x', is_public_domain: false }] })));
  await assert.rejects(get('cleveland').fetch(context({ data: [{ title: 'Tree', images: { web: { url: 'https://images.test/tree.jpg' } } }] })));
  await assert.rejects(get('smk').fetch(context({ items: [{ public_domain: true, rights: 'CC_BY' }] })));
  const raw = await get('artic').fetch(context({ data: [{ id: 1, title: 'Tree', image_id: 'x', is_public_domain: true,
    description: 'Restricted prose', artist_display: 'Artist', medium_display: 'Ink' }] }));
  assert.equal(raw.description, 'Artist · Ink');
  assert.equal(validateDiscoveryRights(raw).ok, true);
});

test('enabled providers have reviewed policy, unique provider identities and no unreviewed legacy adapter', () => {
  const active = SOURCES.filter(s => s.enabled);
  assert.equal(new Set(active.map(s => s.rightsPolicy.provider)).size, active.length);
  for (const s of active) {
    assert.ok(s.rightsPolicy.terms.startsWith('https://'));
    assert.ok([...adapters, ...questions, ...bibliographic, ...observations].some(a => a.id === s.id));
  }
  for (const id of ['amiibo', 'potterBooks', 'coffee', 'dogCeo', 'apod', 'picsum', 'vam']) {
    assert.equal(SOURCES.find(s => s.id === id).enabled, false, id);
  }
});

test('research directory is quarantined, deduplicated and not claimed as approved sources', async () => {
  const data = JSON.parse(await readFile(new URL('../data/foly-api-research.json', import.meta.url), 'utf8'));
  assert.ok(data.candidates.length >= 1000);
  assert.equal(new Set(data.candidates.map(c => c.documentation)).size, data.candidates.length);
  assert.ok(data.contentSha256 && data.attribution);
  for (const candidate of data.candidates) {
    assert.equal(candidate.enabled, false);
    assert.equal(candidate.status, 'unreviewed');
    assert.equal(candidate.mediaRights, 'unknown');
  }
});

test('Commons uses CC0 structured captions and checks the selected file, not the search filter', async () => {
  const info = { thumburl: 'https://images.test/thumb.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Tree.jpg',
    extmetadata: { LicenseUrl: { value: 'http://creativecommons.org/publicdomain/zero/1.0/deed.en' },
      LicenseShortName: { value: 'CC0' }, AttributionRequired: { value: 'false' }, Restrictions: { value: '' },
      ImageDescription: { value: 'Do not copy this separately licensed prose' } } };
  const fetchItem = (imageinfo = info, labels = { en: { value: 'A tree' } }) => get('commonsReviewed').fetch({
    random: () => 0, json: async url => new URL(url).searchParams.get('action') === 'wbgetentities'
      ? { entities: { M123: { labels } } }
      : { query: { pages: { 123: { pageid: 123, title: 'Do not use the wikitext filename', imageinfo: [imageinfo] } } } },
  });
  const raw = await fetchItem();
  assert.equal(raw.title, 'A tree');
  assert.equal(raw.description, undefined);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  await assert.rejects(fetchItem(info, {}));
  for (const [key, value] of [['LicenseShortName', 'CC BY'], ['AttributionRequired', 'true'],
    ['Restrictions', 'personality rights'], ['LicenseUrl', 'https://creativecommons.org.evil.test/publicdomain/zero/1.0/']]) {
    await assert.rejects(fetchItem({ ...info, extmetadata: { ...info.extmetadata, [key]: { value } } }));
  }
});

test('reviewed category coverage does not regress below the current nine-category baseline', () => {
  const categories = new Set(SOURCES.filter(source => source.enabled).map(source => source.category));
  for (const category of ['Art', 'Nature', 'Design', 'Photography', 'Biology', 'Earth', 'Geology', 'Molecular biology', 'Botany']) assert.ok(categories.has(category), category);
  // This baseline protects current coverage; it does not assert the 34-category goal is met.
});

test('Mia requires public-domain, public access and a trusted image path independently', async () => {
  const row = { id: 1218, title: 'Olive Trees', rights_type: 'Public Domain', image: 'valid', public_access: 1,
    Rights_Image_Display: 'Full', Cache_Location: '001000\\200\\10\\1218', Primary_RenditionNumber: 'mia_8017891.jpg' };
  const item = data => get('miaReviewed').fetch(context({ hits: { hits: [{ _source: data }] } }));
  const raw = await item(row);
  assert.equal(raw.image, 'https://img.artsmia.org/web_objects_cache/001000/200/10/1218/mia_8017891_800.jpg');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  for (const change of [{ rights_type: 'Copyright' }, { public_access: 0 }, { Rights_Image_Display: 'Thumbnail' },
    { Cache_Location: '../outside' }, { Primary_RenditionNumber: 'https://evil.test/image.jpg' }]) {
    await assert.rejects(item({ ...row, ...change }));
  }
});

test('PhyloPic ignores unreviewed metadata and rejects mixed-license silhouettes', async () => {
  const uuid = '045279d5-24e5-4838-bec9-0bea86812e35';
  const row = { uuid, build: 561, _links: { license: { href: CC0 }, self: { title: 'Separately licensed caption' },
    rasterFiles: [{ type: 'image/png', sizes: '750x448', href: `https://images.phylopic.org/images/${uuid}/raster/750x448.png` }] } };
  const item = data => get('phylopicReviewed').fetch({ random: () => 0, json: async url => url.includes('embed_items')
    ? { build: 561, _embedded: { items: [data] } } : { build: 561, totalPages: 162 } });
  const raw = await item(row);
  assert.equal(raw.title, 'The shape of a living organism');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  await assert.rejects(item({ ...row, _links: { ...row._links, license: { href: 'https://creativecommons.org/licenses/by/4.0/' } } }));
  await assert.rejects(item({ ...row, _links: { ...row._links, rasterFiles: [{ type: 'image/png', href: 'https://evil.test/750.png' }] } }));
  for (const slug of ['by', 'by-sa']) {
    const attributed = { ...row, attribution: 'Artist and supplied copyright notice', _links: { ...row._links,
      license: { href: `https://creativecommons.org/licenses/${slug}/4.0/` } } };
    const found = await item(attributed);
    assert.equal(validateDiscoveryRights(found).ok, true);
    assert.equal(found.rights.attribution, attributed.attribution);
    assert.ok(mediaCredit(found).includes(attributed.attribution));
    assert.equal(found.rights.mediaTitle, row._links.self.title);
    await assert.rejects(item({ ...attributed, attribution: '' }));
    await assert.rejects(item({ ...attributed, attribution: '<a href="https://test.invalid">Artist</a>' }));
    await assert.rejects(item({ ...attributed, _links: { ...attributed._links, license: { href: 'https://creativecommons.org/licenses/by-nc/4.0/' } } }));
  }
});

test('PhyloPic pins one published build and rejects mixed or empty indexes', async () => {
  for (const index of [{ build: 564, totalPages: 10 }, { build: 563, totalPages: 0 }]) {
    const requests = [];
    await assert.rejects(get('phylopicReviewed').fetch({ random: () => 0, json: async url => {
      requests.push(url);
      return requests.length === 1 ? { build: 563, totalPages: 100 } : index;
    } }));
    assert.equal(requests[0], 'https://api.phylopic.org/images');
    assert.match(requests[1], /build=563&filter_license_nc=false/);
    assert.equal(requests.length, 2);
  }
});

test('EPIC accepts only instrument-generated records and the exact reviewed government policy', async () => {
  const row = { image: 'epic_1b_20261029000830', date: '2026-10-29 00:03:42',
    caption: "This image was taken by NASA's EPIC camera onboard the NOAA DSCOVR spacecraft" };
  const raw = await get('epicReviewed').fetch(context([row]));
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.rights.mediaLicense, 'US_GOV_PUBLIC_DOMAIN');
  assert.equal(discoveryLicense('https://epic.gsfc.nasa.gov/about?unreviewed'), null);
  assert.equal(discoveryLicense('https://nasa.gov/'), null);
  for (const change of [{ caption: 'Copyright a third party' }, { image: '../image' }, { date: 'invalid' }]) {
    await assert.rejects(get('epicReviewed').fetch(context([{ ...row, ...change }])));
  }
});

test('Cleveland uses the documented empty cc0 flag without trusting it as rights evidence', async () => {
  await assert.rejects(get('cleveland').fetch({ random: () => 0, json: async url => {
    assert.ok(url.includes('?cc0&'));
    return { data: [{ title: 'Restricted', share_license_status: 'Copyright', images: { web: { url: 'https://images.test/a.jpg' } } }] };
  } }));
});

test('Cleveland retries past CC0 records without a safe title, image or item page', async () => {
  const raw = await get('cleveland').fetch({
    random: () => 0,
    json: async () => ({ data: [
      { title: 'No browse page', share_license_status: 'CC0',
        images: { web: { url: 'https://openaccess-cdn.clevelandart.org/1966.441/1966.441_web.jpg' } },
        url: 'https://openaccess-api.clevelandart.org/api/artworks/1966.441' },
      { title: 'A flower study', type: 'Painting', creation_date: '1900',
        share_license_status: 'CC0',
        images: { web: { url: 'https://openaccess-cdn.clevelandart.org/1966.441/1966.441_web.jpg' } },
        url: 'https://clevelandart.org/art/1966.441' },
    ] }),
  });
  assert.equal(raw.title, 'A flower study');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(present(raw, SOURCES.find(source => source.id === 'cleveland')).url, raw.url);
});

test('Yale metadata CC0 never substitutes for selected canvas image rights', async () => {
  const id = 'https://lux.collections.yale.edu/data/object/d1991510-4c01-400c-9508-2c8f1b815e5e';
  const manifest = { license: CC0, attribution: 'Metadata describing Yale Center for British Art collections is public domain under CC0.',
    sequences: [{ canvases: [{ metadata: [{ label: 'Image Use Rights', value: 'No Copyright: You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission. (CC0 1.0)' }],
      images: [{ resource: { format: 'image/jpeg', service: { '@id': 'https://images.collections.yale.edu/iiif/2/ycba:bce72b77-14bb-4fd2-a3f8-dc4c820fe9bd' } } }] }] }] };
  const item = data => get('yaleReviewed').fetch({ random: () => 0, json: async url => {
    if (url.includes('/api/search/')) return { orderedItems: [{ id }] };
    if (url === id) return { identified_by: [{ type: 'Name', content: 'Mountainous Landscape' }],
      subject_of: [{ digitally_carried_by: [{ access_point: [{ id: 'https://manifests.collections.yale.edu/v2/ycba/obj/8721' }] }] }] };
    return data;
  } });
  assert.equal(validateDiscoveryRights(await item(manifest)).ok, true);
  const restricted = structuredClone(manifest);
  restricted.sequences[0].canvases[0].metadata = [{ label: 'Image Use Rights', value: 'Copyright' }];
  await assert.rejects(item(restricted));
  await assert.rejects(item({ ...manifest, license: 'CC_BY' }));
});

test('USGS rejects partner products, unexpected charts and missing NEIC provenance', async () => {
  const product = { source: 'us', code: 'us7000test', status: 'UPDATE', properties: { 'event-description': 'USGS NEIC ShakeMap' },
    contents: { 'download/mmi_regr.png': { contentType: 'image/png', url: 'https://earthquake.usgs.gov/product/shakemap/us7000test/us/1793336963901/download/mmi_regr.png' } } };
  const item = data => get('usgsReviewed').fetch({ random: () => 0, json: async url => url.includes('eventid=')
    ? { properties: { mag: 5, products: { shakemap: [data] } } } : { features: [{ id: 'us7000test' }] } });
  const raw = await item(product);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  for (const change of [{ source: 'ci' }, { status: 'DELETE' }, { properties: {} }, { contents: {} }]) await assert.rejects(item({ ...product, ...change }));
});

test('USGS retries missing charts but binds the accepted chart to its own event', async () => {
  const run = async mismatch => {
    const calls = [];
    const result = get('usgsReviewed').fetch({ random: () => 0, json: async url => {
      calls.push(url);
      if (!url.includes('eventid=')) return { features: [{ id: 'usfirst' }, { id: 'ussecond' }] };
      if (url.includes('eventid=usfirst')) return { properties: { products: { shakemap: [] } } };
      return { properties: { mag: 5, products: { shakemap: [{ source: 'us', code: 'ussecond', status: 'UPDATE',
        properties: { 'event-description': 'USGS NEIC ShakeMap' }, contents: { 'download/mmi_regr.png': {
          contentType: 'image/png', url: `https://earthquake.usgs.gov/product/shakemap/${mismatch ? 'usfirst' : 'ussecond'}/us/123/download/mmi_regr.png`,
        } } }] } } };
    } });
    if (mismatch) await assert.rejects(result, /No USGS-produced chart/);
    else {
      const raw = await result;
      assert.equal(validateDiscoveryRights(raw).ok, true);
      assert.match(raw.rights.verifiedBy, /eventid=ussecond/);
      assert.match(raw.image, /\/ussecond\/us\//);
    }
    assert.equal(calls.length, 3);
  };
  await run(false);
  await run(true);
});

test('USGS bounds candidate retries and deduplicates event identities', async () => {
  const calls = [];
  await assert.rejects(get('usgsReviewed').fetch({ random: () => 0, json: async url => {
    calls.push(url);
    if (calls.length === 1) return { features: [{ id: 'us0' },
      ...Array.from({ length: 8 }, (_, index) => ({ id: `us${index}` }))] };
    throw Error('Unavailable detail');
  } }), /No USGS-produced chart/);
  assert.equal(calls.length, 6);
  assert.equal(new Set(calls).size, 6);
});

test('RCSB uses experimental assembly renders, not educational illustrations', async () => {
  const row = { rcsb_id: '4HHB', struct: { title: 'Human hemoglobin' }, rcsb_entry_container_identifiers: { entry_id: '4HHB', assembly_ids: ['1'] } };
  const raw = await get('rcsbReviewed').fetch(context(row));
  assert.equal(raw.image, 'https://cdn.rcsb.org/images/structures/4hhb_assembly-1.jpeg');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  await assert.rejects(get('rcsbReviewed').fetch(context({ ...row, rcsb_id: 'OTHER' })));
  await assert.rejects(get('rcsbReviewed').fetch(context({ ...row, rcsb_entry_container_identifiers: { entry_id: '4HHB', assembly_ids: [] } })));
});

test('Wellcome checks the selected image and never copies third-party catalogue prose', async () => {
  const location = { url: 'https://iiif.wellcomecollection.org/image/L0016049/info.json',
    locationType: { id: 'iiif-image' }, license: { id: 'pdm', url: 'https://creativecommons.org/share-your-work/public-domain/pdm/' },
    accessConditions: [{ method: { id: 'view-online' }, status: { id: 'open' } }] };
  const row = { id: 'apmzrdxm', source: { id: 'c2jj7zfd', title: 'Unreviewed third-party title' }, locations: [location] };
  const item = data => get('wellcomeReviewed').fetch(context({ results: [data] }));
  const raw = await item(row);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.image, 'https://iiif.wellcomecollection.org/image/L0016049/full/480,/0/default.jpg');
  assert.equal(raw.rights.verifiedBy, 'https://api.wellcomecollection.org/catalogue/v2/images/apmzrdxm');
  assert.ok(!JSON.stringify(raw).includes(row.source.title));
  for (const change of [
    { license: { id: 'cc-by', url: 'https://creativecommons.org/licenses/by/4.0/' } },
    { license: { id: 'pdm', url: 'https://creativecommons.org.evil.test/publicdomain/mark/1.0/' } },
    { url: 'https://untrusted.test/image/L0016049/info.json' },
    { url: 'https://iiif.wellcomecollection.org/image/../info.json' },
    { accessConditions: [{ method: { id: 'view-online' }, status: { id: 'open-with-advisory' } }] },
    { accessConditions: [] },
  ]) await assert.rejects(item({ ...row, locations: [{ ...location, ...change }] }));
  await assert.rejects(item({ ...row, source: { id: '../other' } }));
  const mixed = await get('wellcomeReviewed').fetch(context({ results: [{ ...row, locations: [
    { ...location, license: { id: 'cc-by' } }, location,
  ] }] }));
  assert.equal(mixed.image, raw.image);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import adapters, { manuscriptProviders, manuscriptDiscovery } from '../js/foly/sources/manuscripts.js';
import { SOURCES } from '../js/foly/sources.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';

const fixtures = {
  austrianLibrary: '../foly-live50-evidence/vienna-1.json', mLeuven: '../foly-live50-evidence/leuven.json',
  nijl: '../foly-live50-evidence/nijl.json', cataloniaMaps: '../foly-live50-evidence/catalonia.json',
  luxembourgEuropeana: '../foly-live50-evidence/europeana.json', bremenLibrary: '../foly-live50-evidence/bremen2.json',
  karlsruheLibrary: '../foly-live50-evidence/karlsruhe-good.json', bonnLibrary: '../foly-live50-evidence/bonn-good.json',
  paderbornLibrary: '../foly-live50-evidence/paderborn-good.json', cardiffLibrary: '../foly-live50-evidence/cardiff.json',
  muzee: '../foly-live40-evidence/muzee.json', museaBrugge: '../foly-live40-evidence/brugge.json',
  kansaiUniversity: '../foly-live40-evidence/kansai.json', swedenLibrary: '../foly-live40-evidence/swedenLibrary.json',
  erara: '../foly-live40-evidence/erara.json', toledoLibrary: '../foly-live40-evidence/toledo-1206.json',
  clevelandLibrary: '../foly-live40-evidence/clevelandLibrary.json',
  bavarianLibrary: 'api.digitale-sammlungen.de.json', heidelbergLibrary: 'digi.ub.uni-heidelberg.de.json',
  stanfordLibrary: 'purl.stanford.edu.json', leidenLibrary: 'digitalcollections.universiteitleiden.nl.json',
  ghentLibrary: 'adore.ugent.be.json', mskGent: 'imagehub.mskgent.be.json',
  slubDresden: 'iiif.slub-dresden.de-1776160169.json', leibnizLibrary: 'digitale-sammlungen.gwlb.de-00068782.json',
  parisMusees: 'paris-160040796.json', nichibun: 'iiif.nichibun.ac.jp.json', gilcrease: 'collections.gilcrease.org.json',
};
const load = async name => JSON.parse(await fs.readFile(new URL(`../data/foly-milestone-evidence/${name}`, import.meta.url), 'utf8'));
const canvas = manifest => (manifest.sequences?.[0]?.canvases || manifest.items)[0];
const body = manifest => canvas(manifest).images?.[0]?.resource || canvas(manifest).items[0].items[0].body;

test('active visual set only counts provider-supplied image APIs separately from local datasets', () => {
  assert.equal(manuscriptProviders.length, 28);
  assert.equal(new Set(manuscriptProviders.map(provider => provider.id)).size, 28);
  const active = SOURCES.filter(source => source.enabled);
  assert.equal(active.length, 37);
  assert.equal(active.filter(source => source.rightsPolicy.kind !== 'dataset').length, 32);
  assert.equal(new Set(active.map(source => source.category)).size, 14);
  assert.ok(active.every(source => source.visualType === 'image'));
  assert.equal(active.filter(source => source.rightsPolicy.kind === 'dataset').length, 5);
  assert.equal(active.filter(source => source.category === 'History').length, 4);
  assert.equal(SOURCES.find(source => source.id === 'openFDAReports').enabled, false);
  assert.match(SOURCES.find(source => source.id === 'cooperHewitt').rightsPolicy.reason, /raw API query/);
  assert.equal(SOURCES.find(source => source.id === 'cooperHewitt').enabled, false);
  assert.equal(SOURCES.some(source => source.id === 'smithsonian'), false);
  for (const id of ['berlinLibrary', 'darmstadtLibrary']) assert.equal(SOURCES.some(source => source.id === id), false);
  for (const id of ['smk', 'robohash', 'dicebear', 'physicallyBased', 'muzee', 'mLeuven',
    'gilcrease', 'karlsruheLibrary', 'paderbornLibrary', 'cardiffLibrary']) {
    assert.equal(SOURCES.find(source => source.id === id).enabled, false, id);
    assert.match(SOURCES.find(source => source.id === id).rightsPolicy.reason, /Excluded from the qualified set/);
  }
  for (const id of ['austrianLibrary', 'bremenLibrary', 'bonnLibrary', 'kansaiUniversity',
    'toledoLibrary', 'clevelandLibrary', 'bavarianLibrary', 'heidelbergLibrary',
    'stanfordLibrary', 'leidenLibrary', 'ghentLibrary', 'leibnizLibrary', 'nichibun']) {
    assert.equal(SOURCES.find(source => source.id === id).enabled, false, id);
    assert.match(SOURCES.find(source => source.id === id).rightsPolicy.reason, /Paused|Excluded/);
  }
});

test('qualified manuscript providers expose reviewed item or collection pages separately from IIIF evidence', async () => {
  const { present, userFacingSourceUrl } = await import('../js/foly/resolver.js');
  for (const [id, url] of [
    ['austrianLibrary', 'https://akon.onb.ac.at/?id=AKON_AK076_113'],
    ['nijl', 'https://kokusho.nijl.ac.jp/biblio/200013970'],
    ['cataloniaMaps', 'https://cartotecadigital.icgc.cat/digital/collection/catalunya/id/3363/rec/1'],
    ['luxembourgEuropeana', 'https://www.europeana.eu/en/item/9200396/BibliographicResource_3000118436165'],
    ['bremenLibrary', 'https://brema.suub.uni-bremen.de/content/titleinfo/2642703'],
    ['bonnLibrary', 'https://digitale-sammlungen.ulb.uni-bonn.de/content/titleinfo/1472083'],
    ['museaBrugge', 'https://www.museabrugge.be/en/collection'],
    ['kansaiUniversity', 'https://www.ku-orcas.kansai-u.ac.jp/'],
    ['swedenLibrary', 'https://www.manuscripta.se/ms/100200'],
    ['erara', 'https://www.e-rara.ch/zut/content/titleinfo/7568336'],
    ['toledoLibrary', 'https://ohiomemory.org/digital/collection/p16007coll31/id/1206/rec/1'],
    ['clevelandLibrary', 'https://cplorg.contentdm.oclc.org/digital/collection/p4014coll9/id/10722/'],
  ]) {
    const manifest = await load(fixtures[id]);
    const raw = await adapters.find(provider => provider.id === id).fetch({ json: async () => manifest, random: () => 0 });
    const discovery = present(raw, SOURCES.find(source => source.id === id));
    assert.equal(discovery.sourcePageUrl, url, id);
    assert.notEqual(discovery.rights.sourceItemUrl, discovery.sourcePageUrl, id);
  }
});

test('manuscript cards use each object label instead of repeating a generic archive title', async () => {
  for (const id of ['austrianLibrary', 'cataloniaMaps', 'luxembourgEuropeana', 'bremenLibrary', 'bonnLibrary']) {
    const manifest = await load(fixtures[id]);
    const raw = await adapters.find(provider => provider.id === id).fetch({ json: async () => manifest, random: () => 0 });
    const expected = Object.values(manifest.label || {}).flat(Infinity).find(value =>
      typeof value === 'string' && value.trim() && !/^[a-z]{2,3}$/i.test(value));
    if (typeof manifest.label === 'string' && manifest.label.trim()) assert.equal(raw.title, manifest.label, id);
    else if (expected) assert.equal(raw.title, expected, id);
    assert.doesNotMatch(raw.title, /^A historical page from /, id);
  }
});

test('every enabled manuscript adapter has a human-facing destination and valid image rights', async () => {
  const { present, userFacingSourceUrl } = await import('../js/foly/resolver.js');
  for (const provider of manuscriptProviders.filter(provider => {
    const source = SOURCES.find(source => source.id === provider.id);
    return source?.enabled && source.rightsPolicy.kind !== 'dataset';
  })) {
    const manifest = await load(fixtures[provider.id]);
    const raw = await adapters.find(adapter => adapter.id === provider.id)
      .fetch({ json: async () => manifest, random: () => 0 });
    const discovery = present(raw, SOURCES.find(source => source.id === provider.id));
    assert.ok(discovery, provider.id);
    assert.ok(userFacingSourceUrl(discovery.sourcePageUrl || discovery.url), provider.id);
    assert.notEqual(discovery.sourcePageUrl || discovery.url, raw.rights.sourceItemUrl, provider.id);
    assert.equal(validateDiscoveryRights(raw).ok, true, provider.id);
  }
});

test('live forty checkpoint preserves complete HTTP and distinct desktop and mobile evidence', async () => {
  const ids = ['muzee', 'museaBrugge', 'kansaiUniversity', 'swedenLibrary', 'erara', 'toledoLibrary', 'clevelandLibrary'];
  for (const type of ['health', 'desktop', 'mobile']) {
    const report = JSON.parse(await fs.readFile(new URL(`../data/foly-live40-${type}.json`, import.meta.url), 'utf8'));
    assert.equal(report.reports.length, type === 'health' ? 7 : 21);
    assert.equal(report.reports.every(row => row.ok), true);
    assert.deepEqual([...new Set(report.reports.map(row => row.id))].sort(), [...ids].sort());
    for (const id of ids) {
      const rows = report.reports.filter(row => row.id === id);
      assert.equal(new Set(rows.map(row => row.image)).size, type === 'health' ? 1 : 3);
      if (type !== 'health') assert.equal(rows.every(row => row.rendered && row.width > 0 && row.height > 0), true);
    }
  }
});

test('live fifty checkpoint preserves complete HTTP and distinct desktop and mobile evidence', async () => {
  const ids = ['austrianLibrary', 'mLeuven', 'nijl', 'cataloniaMaps', 'luxembourgEuropeana',
    'bremenLibrary', 'karlsruheLibrary', 'bonnLibrary', 'paderbornLibrary', 'cardiffLibrary'];
  for (const type of ['health', 'desktop', 'mobile']) {
    const report = JSON.parse(await fs.readFile(new URL(`../data/foly-live50-${type}.json`, import.meta.url), 'utf8'));
    assert.equal(report.reports.length, type === 'health' ? 10 : 30);
    assert.equal(report.reports.every(row => row.ok), true);
    assert.deepEqual([...new Set(report.reports.map(row => row.id))].sort(), [...ids].sort());
    for (const id of ids) {
      const rows = report.reports.filter(row => row.id === id);
      assert.equal(new Set(rows.map(row => row.image)).size, type === 'health' ? 1 : 3);
      if (type !== 'health') assert.equal(rows.every(row => row.rendered && row.width > 0 && row.height > 0), true);
    }
  }
});

test('reviewed external rights reject changed media and rights but tolerate JSON key reordering', async () => {
  for (const provider of manuscriptProviders.filter(row => row.reviewed)) {
    const adapter = adapters.find(row => row.id === provider.id);
    const manifest = await load(fixtures[provider.id]);
    const reordered = Object.fromEntries(Object.entries(manifest).reverse());
    const raw = await adapter.fetch({ json: async () => reordered, random: () => .37 });
    assert.equal(raw.rights.verifiedBy, provider.reviewed.evidence);
    assert.equal(validateDiscoveryRights(raw).ok, true);
    for (const mutate of [
      item => item.rights = 'https://creativecommons.org/licenses/by-nc/4.0/',
      item => canvas(item).rights = 'https://rightsstatements.org/vocab/InC/1.0/',
      item => body(item).rights = 'https://creativecommons.org/licenses/by-nd/4.0/',
      item => {
        const resource = body(item);
        if (resource.id) resource.id += '?unreviewed=1';
        else resource['@id'] += '?unreviewed=1';
      },
    ]) {
      const altered = structuredClone(manifest);
      mutate(altered);
      await assert.rejects(adapter.fetch({ json: async () => altered, random: () => 0 }), /Reviewed manifest changed/);
    }
  }
});

test('CC BY library media preserve creator, title, source and credit through presentation', async () => {
  const { present } = await import('../js/foly/resolver.js');
  for (const id of ['paderbornLibrary', 'cardiffLibrary']) {
    const manifest = await load(fixtures[id]);
    const raw = await adapters.find(row => row.id === id).fetch({ json: async () => manifest, random: () => .37 });
    assert.equal(raw.rights.mediaLicense, 'CC_BY');
    assert.equal(raw.rights.mediaLicenseUrl, 'https://creativecommons.org/licenses/by/4.0/');
    assert.ok(raw.rights.creator);
    assert.ok(raw.rights.mediaTitle);
    assert.ok(raw.rights.attribution);
    assert.equal(raw.rights.originalMediaUrl, raw.image);
    const displayed = present({ ...raw, sourcePageUrl: 'https://example.org/reviewed-item' }, SOURCES.find(row => row.id === id));
    assert.ok(displayed);
    assert.deepEqual(displayed.rights, raw.rights);
  }
});

test('M Leuven keeps the original creditline and bounds both image dimensions', async () => {
  const provider = manuscriptProviders.find(row => row.id === 'mLeuven');
  for (const fixture of ['leuven', 'leuven-2', 'leuven-3']) {
    const manifest = await load(`../foly-live50-evidence/${fixture}.json`);
    const raw = manuscriptDiscovery(manifest, provider, provider.manifests[0], () => 0);
    const credit = manifest.metadata.find(row => row.label === '© Creditline EN').value;
    assert.equal(raw.credit.startsWith(credit), true);
    assert.equal(raw.image.includes('/full/!800,800/'), true);
    manifest.metadata = manifest.metadata.filter(row => row.label !== '© Creditline EN');
    assert.throws(() => manuscriptDiscovery(manifest, provider, provider.manifests[0], () => 0), /Missing original institution credit/);
  }
});

for (const provider of manuscriptProviders) {
  test(`${provider.id} binds open image declarations and preserves original display text separately`, async () => {
    const manifest = await load(fixtures[provider.id]);
    const images = new Set();
    for (const fraction of [.05, .37, .87]) {
      const raw = provider.reviewed
        ? await adapters.find(row => row.id === provider.id).fetch({ json: async () => manifest, random: () => fraction })
        : manuscriptDiscovery(manifest, provider, provider.manifests[0], () => fraction);
      assert.equal(validateDiscoveryRights(raw).ok, true);
      assert.equal(raw.url, provider.manifests[0]);
      assert.equal(raw.rights.metadataOrigin, 'Foly-authored display text. No provider catalogue prose reproduced.');
      assert.equal(raw.description, undefined);
      assert.equal(provider.imageHosts.includes(new URL(raw.image).hostname), true);
      images.add(raw.image);
    }
    assert.ok(images.size > 0);
  });
}

test('restricted or missing rights and foreign image hosts never inherit a public-domain permission', async () => {
  const provider = manuscriptProviders.find(row => row.id === 'bavarianLibrary');
  for (const mutate of [
    manifest => manifest.license = 'https://creativecommons.org/licenses/by-nc/4.0/',
    manifest => delete manifest.license,
    manifest => canvas(manifest).rights = 'https://rightsstatements.org/vocab/InC/1.0/',
    manifest => body(manifest).rights = 'https://creativecommons.org/licenses/by-nc/4.0/',
    manifest => body(manifest).license = 'https://creativecommons.org/licenses/by-nd/4.0/',
    manifest => body(manifest).service['@id'] = 'https://evil.test/image',
    manifest => body(manifest).service['@id'] = 'https://api.digitale-sammlungen.de@evil.test/image',
    manifest => body(manifest).service['@id'] = 'https://api.digitale-sammlungen.de/../escape',
  ]) {
    const manifest = await load(fixtures.bavarianLibrary);
    manifest.sequences[0].canvases = [manifest.sequences[0].canvases[0]];
    mutate(manifest);
    assert.throws(() => manuscriptDiscovery(manifest, provider, provider.manifests[0], () => 0));
  }
  assert.throws(() => manuscriptDiscovery({}, provider, 'https://evil.test/manifest', () => 0));
});

test('institution identifiers prevent cross-provider Ex Libris image substitution', async () => {
  const provider = manuscriptProviders.find(row => row.id === 'leidenLibrary');
  const manifest = await load(fixtures.ghentLibrary);
  manifest.rights = 'https://creativecommons.org/publicdomain/mark/1.0/';
  assert.throws(() => manuscriptDiscovery(manifest, provider, provider.manifests[0], () => 0));
});

test('Heidelberg dataset has four unique JPEG hashes and rejects altered provenance', async () => {
  const dataset = JSON.parse(await fs.readFile(new URL('../data/foly-manuscripts.json', import.meta.url), 'utf8'));
  const adapter = adapters.find(row => row.id === 'heidelbergLibrary');
  const { present } = await import('../js/foly/resolver.js');
  const saved = dataset.providers.heidelbergLibrary;
  assert.equal(saved.media.length, 4);
  assert.equal(new Set(saved.media.map(row => row.image)).size, 4);
  for (const row of saved.media) assert.match(row.sha256, /^[a-f0-9]{64}$/);
  const images = new Set();
  for (const fraction of [.05, .37, .87]) {
    const raw = await adapter.fetch({ random: () => fraction, json: async () => dataset });
    const discovery = present(raw, SOURCES.find(row => row.id === 'heidelbergLibrary'));
    assert.ok(discovery, 'Heidelberg dataset must pass discovery and rights validation');
    assert.equal(discovery.sourcePageUrl, 'https://digi.ub.uni-heidelberg.de/diglit/cpg389');
    assert.notEqual(discovery.sourcePageUrl, discovery.rights.sourceItemUrl);
    images.add(raw.image);
  }
  assert.equal(images.size, 3);
  const altered = structuredClone(dataset);
  altered.providers.heidelbergLibrary.evidence = 'https://evil.test/';
  await assert.rejects(adapter.fetch({ random: () => 0, json: async () => altered }));
});
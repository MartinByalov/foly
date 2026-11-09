import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/open-access.js';
import { SOURCES } from '../js/foly/sources.js';
import { present, discover } from '../js/foly/resolver.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';
import bibliographic from '../js/foly/sources/bibliographic.js';
import observations from '../js/foly/sources/observations.js';
import { withRights } from './helpers/foly-rights.mjs';

test('enabled providers have reviewed provider-supplied images, never generated charts', () => {
  for (const source of SOURCES.filter(s => s.enabled)) {
    assert.equal(source.visualCapable, true, source.id);
    assert.equal(source.imageCapable, true, source.id);
    assert.equal(source.visualType, 'image', source.id);
    assert.ok([...adapters, ...bibliographic, ...observations].some(a => a.id === source.id), source.id);
  }
  for (const id of ['iconify', 'opentdb', 'crossref', 'datacite', 'ror', 'openlibrary', 'doaj', 'nobel', 'noaaTides', 'openalex', 'worldBank', 'openFDAReports']) {
    assert.equal(SOURCES.find(s => s.id === id).enabled, false, id);
  }
});
test('unapproved bibliographic text stays excluded while drawing continues to a licensed image', async () => {
  const text = await bibliographic.find(a => a.id === 'crossref').fetch({ random: () => 0,
    json: async () => ({ status: 'ok', message: { items: [{ DOI: '10.1234/tree', title: ['Tree'] }] } }) });
  assert.equal(validateDiscoveryRights(text).ok, true);
  assert.ok(present(text, { id: 'text' }));
  const loads = [];
  const found = await discover([{ ...SOURCES.find(row => row.id === 'crossref'), fetch: async () => text },
    { id: 'image', fetch: async () => withRights({ title: 'Tree', image: 'https://images.test/tree.jpg' }) }],
  { random: () => 0, imageLoader: async url => loads.push(url) });
  assert.equal(found.sourceId, 'image');
  assert.deepEqual(found.failed, []);
  assert.deepEqual(loads, [found.image]);
});
test('decorative icon glyphs stay disabled instead of taking a gallery slot', () => {
  const source = SOURCES.find(row => row.id === 'iconify');
  assert.equal(source.enabled, false);
  assert.match(source.rightsPolicy.reason, /decorative icon glyphs/);
  assert.equal(adapters.some(row => row.id === 'iconify'), false);
});

test('historical openFDA charts retain rights validation but cannot enter the visual draw', async () => {
  const adapter = adapters.find(row => row.id === 'openFDAReports');
  const source = SOURCES.find(row => row.id === 'openFDAReports');
  const payload = {
    meta: { license: 'https://open.fda.gov/license/', terms: 'https://open.fda.gov/terms/', last_updated: '2026-10-28' },
    results: [
      { term: 'DRUG INEFFECTIVE', count: 1319263 },
      { term: 'OFF LABEL USE', count: 876515 },
      { term: 'DEATH', count: 862380 },
      { term: 'NAUSEA', count: 792241 },
      { term: 'FATIGUE', count: 779351 },
    ],
  };
  let endpoint;
  const raw = await adapter.fetch({ json: async url => { endpoint = url; return payload; } });
  assert.equal(endpoint, 'https://api.fda.gov/drug/event.json?count=patient.reaction.reactionmeddrapt.exact&limit=5');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  const shown = present(raw, source);
  assert.equal(shown.kind, 'chart');
  assert.equal(shown.image, null);
  assert.equal(shown.chart.length, 5);
  assert.equal(shown.rights.metadataLicense, 'CC0');
  for (const mutate of [
    result => result.chart[0].value++,
    result => result.url = 'https://api.fda.gov/drug/event.json',
    result => result.rights.metadataLicenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/',
    result => result.rights.chartData = '[]',
    result => result.rights.verifiedBy = 'https://evil.test/',
  ]) {
    const changed = structuredClone(raw);
    mutate(changed);
    assert.equal(validateDiscoveryRights(changed).ok, false);
  }
  const loaded = [];
  assert.equal(source.enabled, false);
  await assert.rejects(discover([source], { json: async () => payload,
    imageLoader: async url => loaded.push(url), random: () => 0 }));
  await assert.rejects(discover([{ ...source, enabled: true }], { json: async () => payload,
    imageLoader: async url => loaded.push(url), random: () => 0 }));
  assert.deepEqual(loaded, []);
});

test('historical World Bank charts retain attribution but stay outside the visual draw', async () => {
  const adapter = adapters.find(row => row.id === 'worldBank');
  const source = SOURCES.find(row => row.id === 'worldBank');
  const records = [2025, 2024, 2023, 2022, 2021].map((year, index) => ({
    countryiso3code: 'USA', country: { id: 'US', value: 'United States' },
    indicator: { id: 'SP.POP.TOTL', value: 'Population, total' },
    date: String(year), value: 336_000_000 + (year - 2021) * 1_000_000,
  }));
  let endpoint;
  const raw = await adapter.fetch({ random: () => 0, json: async url => {
    if (url === 'https://api.worldbank.org/v2/indicator/SP.POP.TOTL?format=json') {
      return [{ page: 1, pages: 1, per_page: '50', total: 1 }, [{
        id: 'SP.POP.TOTL', name: 'Population, total',
        source: { id: '2', value: 'World Development Indicators' },
        sourceOrganization: 'World Population Prospects, United Nations; national statistical offices; Eurostat; Population and Vital Statistics Report',
      }]];
    }
    endpoint = url;
    return [{ page: 1, pages: 14, per_page: 5, total: 66 }, records];
  } });
  assert.equal(endpoint, 'https://api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL?format=json&per_page=5');
  assert.equal(source.enabled, false);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  const shown = present(raw, source);
  assert.equal(shown.kind, 'chart');
  assert.equal(shown.image, null);
  assert.equal(shown.chart[0].label, '2021');
  assert.equal(shown.rights.license_name, 'CC BY 4.0');
  assert.equal(present(shown, source).chartCountry, 'USA');
  for (const mutate of [
    result => result.chart[0].value++,
    result => result.url = 'https://api.worldbank.org/v2/country/USA/indicator/SP.POP.TOTL',
    result => result.rights.metadataLicenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/',
    result => result.rights.license_name = 'CC0',
    result => result.rights.licenseEvidenceUrl = 'https://evil.test/license',
    result => result.rights.verifiedBy = 'https://evil.test/data',
  ]) {
    const changed = structuredClone(raw);
    mutate(changed);
    assert.equal(validateDiscoveryRights(changed).ok, false);
  }
  const loaded = [];
  await assert.rejects(discover([source], { random: () => 0,
    json: async () => [{ page: 1, pages: 14, per_page: 5, total: 66 }, records],
    imageLoader: async url => loaded.push(url) }));
  assert.deepEqual(loaded, []);
});

test('OpenAlex shows a readable CC0 work record as text without copying linked content', async () => {
  const adapter = bibliographic.find(row => row.id === 'openalex');
  const source = SOURCES.find(row => row.id === 'openalex');
  const raw = await adapter.fetch({ random: () => 0, json: async url => {
    assert.equal(url, 'https://api.openalex.org/works?sample=5&select=id,doi,title,publication_year,primary_topic');
    return { results: [
      { id: 'https://openalex.org/W1', title: 'https://images.example/file.jpg', publication_year: 2025 },
      { id: 'https://openalex.org/W2', title: 'How coastal forests adapt to rising temperatures',
        publication_year: 2023, primary_topic: { display_name: 'Climate adaptation',
          field: { display_name: 'Environmental science' }, domain: { display_name: 'Physical sciences' } } },
    ] };
  } });
  assert.equal(source.enabled, false);
  assert.equal(source.visualType, 'text');
  assert.equal(raw.title, 'How coastal forests adapt to rising temperatures');
  assert.equal(validateDiscoveryRights(raw).ok, true);
  const shown = present(raw, source);
  assert.equal(shown.kind, 'text');
  assert.equal(shown.image, null);
  assert.equal(shown.url, 'https://openalex.org/W2');
  assert.equal(shown.rights.metadataProvider, 'OpenAlex');
  assert.equal(present({ ...raw, rights: { ...raw.rights, verifiedBy: 'https://evil.test/data' } }, source), null);
  const loaded = [];
  await assert.rejects(discover([source], { random: () => 0, imageLoader: url => loaded.push(url),
    json: async () => ({ results: [{ id: 'https://openalex.org/W2', title: raw.title,
      publication_year: 2023, primary_topic: { display_name: 'Climate adaptation',
        field: { display_name: 'Environmental science' }, domain: { display_name: 'Physical sciences' } } }] }) }));
  assert.deepEqual(loaded, []);
});

test('Met skips deleted or restricted search hits without repeating IDs or substituting providers', async () => {
  const ids = [];
  const raw = await adapters.find(a => a.id === 'met').fetch({ random: () => 0, json: async url => {
    if (url.includes('/search?')) return { objectIDs: [1, 1, 2, 3] };
    const id = Number(url.split('/').at(-1)); ids.push(id);
    if (id === 1) throw Error('HTTP 404');
    if (id === 2) return { title: 'Restricted', isPublicDomain: false };
    return { title: 'Tree', isPublicDomain: true, primaryImageSmall: 'https://images.test/tree.jpg', objectURL: 'https://www.metmuseum.org/art/collection/search/3' };
  } });
  assert.deepEqual(ids, [1, 2, 3]);
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.rights.verifiedBy, 'https://collectionapi.metmuseum.org/public/collection/v1/objects/3');
});
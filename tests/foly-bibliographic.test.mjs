import test from 'node:test';
import assert from 'node:assert/strict';
import adapters from '../js/foly/sources/bibliographic.js';
import { SOURCES } from '../js/foly/sources.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';
import { present, discover } from '../js/foly/resolver.js';
import { checkSource } from '../js/foly/checks.js';
import { spawnSync } from 'node:child_process';

const fixtures = {
  artic: { data: [{ id: 123, title: 'Flower study', artist_display: 'An artist', date_display: '1900', medium_display: 'Oil on canvas', description: 'DO NOT COPY', image_id: 'private.jpg' }] },
  openlibrary: { docs: [{ key: '/works/OL123W', title: 'Tree growth', author_name: ['A Researcher'], first_publish_year: 2020, cover_i: 123, description: 'DO NOT COPY' }] },
  doaj: { results: [{ id: '0123456789abcdef0123456789abcdef', bibjson: { title: 'Tree growth', year: '2020', journal: { title: 'Botany' }, author: [{ name: 'A Researcher' }], abstract: 'DO NOT COPY' } }] },
  nobel: { laureates: [{ id: '123', knownName: { en: 'A Researcher' }, nobelPrizes: [{ awardYear: '2020', category: { en: 'Chemistry' }, motivation: { en: 'DO NOT COPY' }, links: [{ rel: 'external', href: 'https://www.nobelprize.org/prizes/chemistry/2020/researcher/facts/' }] }] }] },
  crossref: { status: 'ok', message: { items: [{ DOI: '10.1234/tree', title: ['Tree growth'], author: [{ given: 'A', family: 'Researcher' }], abstract: 'DO NOT COPY', thumbnail: 'https://example.org/private.jpg' }] } },
  openalex: { results: [{ id: 'https://openalex.org/W123', title: 'Tree growth', publication_year: 2024, abstract_inverted_index: { 'DO NOT COPY': [0] } }] },
  datacite: { data: [{ id: '10.1234/tree', type: 'dois', attributes: { doi: '10.1234/tree', state: 'findable', titles: [{ title: 'Tree growth' }], descriptions: [{ description: 'DO NOT COPY' }], rightsList: [{ rights: 'All rights reserved' }] } }] },
  ror: { items: [{ id: 'https://ror.org/0080acb59', status: 'active', names: [{ value: 'Tree Institute', types: ['ror_display'] }], types: ['education'], established: 1973 }] },
};

for (const adapter of adapters) {
  test(`${adapter.id} produces real text cards with independent CC0 metadata evidence`, async () => {
    let request;
    let requests = 0;
    const json = async url => { request = url; requests++; return structuredClone(fixtures[adapter.id]); };
    const raw = await adapter.fetch({ json, random: () => .37 });
    assert.equal(raw.kind, 'text');
    assert.equal(validateDiscoveryRights(raw).ok, true);
    assert.equal(raw.rights.verifiedBy, request);
    assert.equal(raw.rights.metadataLicense, 'CC0');
    assert.equal(raw.image, undefined);
    assert.equal(raw.rights.mediaLicense, undefined);
    assert.doesNotMatch(JSON.stringify(raw), /DO NOT COPY|private\.jpg|All rights reserved/);
    const source = SOURCES.find(s => s.id === adapter.id);
    assert.equal(source.enabled, false);
    assert.equal(SOURCES.filter(s => s.id === adapter.id).length, 1);
    assert.ok(present(raw, source));
    const imageLoader = () => assert.fail('Text must never request an image');
    if (source.enabled) {
      assert.equal((await discover([source], { json, random: () => .37, imageLoader })).kind, 'text');
      assert.equal((await checkSource(source, { json, random: () => .37, imageLoader })).ok, true);
    } else {
      assert.equal((await checkSource(source, { json, random: () => .37, imageLoader })).ok, false);
    }
    if (['openlibrary', 'nobel', 'openalex'].includes(adapter.id)) assert.equal(requests, 1, 'Repeated draws reuse the provider batch');
    for (const mutate of [r => r.rights.metadataLicenseUrl = '', r => r.rights.metadataLicense = 'MIT',
      r => r.rights.metadataLicenseUrl = 'https://creativecommons.org.evil.test/publicdomain/zero/1.0/',
      r => r.thumb = 'https://example.org/unlicensed.jpg', r => r.rights.mediaLicense = 'CC0',
      r => r.rights.creator = '', r => r.rights.changes = '', r => r.rights.verifiedAt = '2000-01-01',
      ...(adapter.id === 'openalex' ? [r => r.rights.metadataProvider = 'Crossref'] : []),
      r => r.url += '/different', r => r.kind = 'image', r => r.reveal = 'fabricated answer']) {
      const bad = structuredClone(raw); mutate(bad);
      assert.equal(validateDiscoveryRights(bad).ok, false);
    }
  });
  test(`${adapter.id} rejects empty and malformed responses`, async () => {
    if (['openlibrary', 'nobel', 'openalex'].includes(adapter.id)) {
      const malformed = structuredClone(fixtures[adapter.id]);
      if (adapter.id === 'openlibrary') malformed.docs[0].key = '/works/../../unsafe';
      else if (adapter.id === 'nobel') malformed.laureates[0].nobelPrizes[0].links[0].href = 'https://evil.test/facts/';
      else malformed.results[0].id = 'https://evil.test/record';
      // A fresh process isolates memoized requests for every candidate fixture.
      for (const fixture of [{}, malformed]) {
        const script = `import assert from 'node:assert/strict';
          import adapters from ${JSON.stringify(new URL('../js/foly/sources/bibliographic.js', import.meta.url).href)};
          await assert.rejects(adapters.find(a => a.id === ${JSON.stringify(adapter.id)}).fetch({json: async () => (${JSON.stringify(fixture)}), random: () => .37}));`;
        const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
      }
      return;
    }
    await assert.rejects(adapter.fetch({ json: async () => ({}), random: () => 0 }));
    const malformed = structuredClone(fixtures[adapter.id]);
    const row = adapter.id === 'artic' ? malformed.data[0] : adapter.id === 'crossref' ? malformed.message.items[0] : ['openalex', 'doaj'].includes(adapter.id) ? malformed.results[0] : adapter.id === 'datacite' ? malformed.data[0].attributes : malformed.items[0];
    if (adapter.id === 'crossref') row.DOI = 'invalid';
    else if (adapter.id === 'datacite') row.state = 'draft';
    else row.id = 'https://evil.test/record';
    await assert.rejects(adapter.fetch({ json: async () => malformed, random: () => 0 }));
  });
}
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactSources, validateWikipediaFact } from '../js/foly/wikipedia.js';
import { discover, present } from '../js/foly/resolver.js';
import { LANGUAGES, information, normalizeLanguage, t } from '../js/foly/locale.js';
import { discoveryCard, displayCopy } from '../js/foly/card.js';

test('display copy uses short dashes and sentence breaks', () => {
  assert.equal(displayCopy('1900 — An event; another detail – more.'), '1900 - An event. Another detail - more.');
});

for (const language of Object.keys(LANGUAGES)) {
  test(`${language}: expanded topics use the selected edition and native category queries`, async () => {
    const sources = createFactSources(language);
    for (const topic of ['art', 'architecture', 'music', 'literature', 'geography', 'technology', 'mathematics', 'animals', 'plants', 'sport']) {
      const source = sources.find(source => source.id === `wikipedia-${topic}`);
      assert.ok(source);
      assert.equal(source.category, t(topic, language));
      assert.notEqual(source.category, topic);
      const result = await source.fetch({ random: () => 0, json: async url => {
        if (url.includes('commons.wikimedia')) return commons();
        const endpoint = new URL(url);
        assert.equal(endpoint.hostname, `${language}.wikipedia.org`);
        assert.match(endpoint.searchParams.get('gsrsearch'), /^deepcat:".+"$/);
        const data = fixture(language);
        data.query.pages[1].pageid = 100 + sources.indexOf(source);
        return data;
      } });
      assert.equal(result.language, language);
      assert.ok(validateWikipediaFact(result));
    }
  });
}

test('published DYK hooks produce validated illustrated discoveries', async () => {
  const source = createFactSources('en').find(source => source.id === 'wikipedia-dyk');
  const found = await discover([source], { random: () => 0, imageLoader: async () => {}, json: async url => {
    if (url.includes('commons.wikimedia.org')) return commons();
    if (new URL(url).searchParams.get('action') === 'parse') return { parse: { revid: 42, wikitext: {
      '*': "* ... that '''[[A discovery]]''' is an illustrated example?",
    } } };
    return fixture('en');
  } });
  assert.equal(found.kind, 'fact');
  assert.equal(found.description, 'A discovery is an illustrated example?');
  assert.equal(found.subject, 'Did you know?');
  assert.ok(validateWikipediaFact(found));
});

function fixture(language, image = true) {
  return { query: { rightsinfo: { url: `https://creativecommons.org/licenses/by-sa/4.0/deed.${language}` }, pages: [
    { ns: 0, pageid: 10, title: 'Disambiguation', extract: 'Not an article.', pageprops: { disambiguation: '' } },
    { ns: 0, pageid: 11, title: 'A discovery', extract: 'A short introduction from an encyclopedia article.',
      fullurl: `https://${language}.wikipedia.org/wiki/Discovery`, revisions: [{ revid: 42 }], ...(image ? { pageimage: 'Tree.jpg' } : {}) },
  ] } };
}
function commons(license = 'https://creativecommons.org/publicdomain/zero/1.0/') {
  return { query: { pages: [{ title: 'File:Tree.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/tree.jpg',
    descriptionurl: 'https://commons.wikimedia.org/wiki/File:Tree.jpg', extmetadata: {
      LicenseUrl: { value: license }, AttributionRequired: { value: 'false' }, Artist: { value: '<b>Photographer</b>' },
    } }] }] } };
}

test('Commons metadata is reused across openings without caching random article draws', async () => {
  const source = createFactSources('bg')[0];
  let images = 0;
  let articles = 0;
  const json = async url => {
    if (url.includes('commons.wikimedia')) { images++; return commons(); }
    const data = fixture('bg');
    data.query.pages[1].pageid = 100 + ++articles;
    return data;
  };
  await source.fetch({ json });
  await source.fetch({ json });
  assert.equal(images, 1);
  assert.equal(articles, 2);
});

for (const language of Object.keys(LANGUAGES)) {
  test(`${language}: failed search falls back to native category members`, async () => {
    const requests = [];
    const source = createFactSources(language).find(source => source.id === 'wikipedia-science');
    const found = await discover([source], { imageLoader: async () => {}, json: async url => {
      if (url.includes('commons.wikimedia')) return commons();
      const endpoint = new URL(url);
      assert.equal(endpoint.hostname, `${language}.wikipedia.org`);
      requests.push(endpoint);
      if (endpoint.searchParams.get('generator') === 'search') throw Error('Search unavailable');
      assert.equal(endpoint.searchParams.get('generator'), 'categorymembers');
      assert.match(endpoint.searchParams.get('gcmtitle'), /^Category:.+/);
      return fixture(language);
    } });
    assert.equal(requests.length, 2);
    assert.equal(found.language, language);
    assert.ok(validateWikipediaFact(found));
  });
}

test('native category fallback follows continuation after an unusable batch', async () => {
  const source = createFactSources('bg').find(source => source.id === 'wikipedia-science');
  let calls = 0;
  await source.fetch({ json: async url => {
    if (url.includes('commons.wikimedia')) return commons();
    const endpoint = new URL(url);
    calls++;
    if (calls === 1) return { error: { code: 'search-error' } };
    if (calls === 2) return { ...fixture('bg', false), continue: { gcmcontinue: 'page|next' } };
    assert.equal(endpoint.searchParams.get('gcmcontinue'), 'page|next');
    return fixture('bg');
  } });
  assert.equal(calls, 3);
});

test('API rate limits stop all native modes without issuing fallback requests', async () => {
  for (const code of ['ratelimited', 'maxlag', 'readonly']) {
    let calls = 0;
    await assert.rejects(discover(createFactSources('bg'), { json: async () => {
      calls++;
      return { error: { code } };
    } }));
    assert.equal(calls, 1);
  }
});

for (const language of Object.keys(LANGUAGES)) {
  test(`${language}: local interface and article source with a mandatory decoded image`, async () => {
    const source = createFactSources(language)[0];
    let endpoint;
    const found = await discover([source], { random: () => 0, json: async url => {
      if (url.includes('commons.wikimedia')) return commons(); endpoint = new URL(url);
      return fixture(language);
    }, imageLoader: async () => {} });
    assert.equal(endpoint.hostname, `${language}.wikipedia.org`);
    assert.equal(endpoint.searchParams.get('generator'), 'random');
    assert.equal(endpoint.searchParams.get('grnnamespace'), '0');
    assert.equal(found.language, language);
    assert.equal(found.kind, 'fact');
    assert.equal(found.title, 'A discovery');
    assert.ok(found.image);
    assert.equal(validateWikipediaFact(found), true);
    assert.ok(information[language].about.length);
    assert.notEqual(t('pick', language), 'pick');
    assert.deepEqual(createFactSources(language).map(s => s.category).slice(1, 5), ['science', 'history', 'space', 'nature'].map(key => t(key, language)));
    await assert.rejects(source.fetch({ json: async () => fixture(language) }), /unseen/);
  });
}

test('unknown languages cannot control the API hostname', () => {
  assert.equal(normalizeLanguage('evil.test'), 'en');
  assert.equal(createFactSources('evil.test')[0].category, t('random', 'en'));
});

test('topic draws use native category search rather than random articles with invented labels', async () => {
  await createFactSources('bg').find(s => s.id === 'wikipedia-space').fetch({ random: () => 0,
    json: async url => {
      if (url.includes('commons.wikimedia')) return commons();
      const query = new URL(url).searchParams;
      assert.equal(query.get('gsrsearch'), 'deepcat:"Астрономия"');
      assert.equal(query.get('generator'), 'search');
      return fixture('bg');
    } });
});

test('mandatory media gets separate exact-file evidence and does not replace text rights', async () => {
  const source = createFactSources('en')[0];
  const found = await discover([source], { random: () => 0, json: async url => url.includes('commons.wikimedia') ? commons() : fixture('en', true), imageLoader: async () => {} });
  assert.equal(found.rights.metadataLicense, 'CC_BY_SA');
  assert.equal(found.rights.mediaLicense, 'CC0');
  assert.equal(found.rights.imageCreator, 'Photographer');
  assert.equal(validateWikipediaFact(found), true);
  for (const mutate of [
    d => d.description = 'Substituted text', d => d.language = 'bg', d => d.url = 'https://evil.test/wiki/X',
    d => d.rights.historyUrl = 'https://evil.test/', d => d.rights.metadataLicenseUrl = 'https://creativecommons.org/licenses/by-nc/4.0/',
    d => d.rights.mediaLicense = 'unknown', d => d.image = 'https://evil.test/image.jpg', d => d.rights.verifiedAt = 'invalid',
  ]) {
    const changed = structuredClone(found); mutate(changed);
    assert.equal(validateWikipediaFact(changed), false);
    assert.equal(present(changed, source), null);
  }
});

test('restricted, absent, failing and undecodable images never leave text-only discoveries', async () => {
  for (const mode of ['restricted', 'failed', 'decode', 'absent']) {
    await assert.rejects(discover([createFactSources('en')[0]], { random: () => 0, json: async url => {
      if (!url.includes('commons.wikimedia')) return fixture('en', mode !== 'absent');
      if (mode === 'failed') throw Error('No image metadata');
      return commons(mode === 'restricted' ? 'https://creativecommons.org/licenses/by-nc/4.0/' : undefined);
    }, imageLoader: async () => { throw Error('Decode failed'); } }));
  }
});

test('unknown text licence, unsafe articles and malformed results cannot enter the draw', async () => {
  for (const modify of [
    data => data.query.rightsinfo.url = 'https://evil.test/licence',
    data => data.query.pages = [],
    data => data.warnings = { search: { '*': 'Category expansion failed' } },
    data => data.query.pages[1].extract = 'pornography',
    data => data.query.pages[1].fullurl = 'https://evil.test/wiki/X',
  ]) {
    await assert.rejects(discover([createFactSources('en')[0]], { json: async () => {
      const data = fixture('en'); modify(data); return data;
    } }));
  }
});

test('On This Day uses the actual local calendar day and cites the event-text calendar page', async () => {
  for (const language of ['en', 'fr']) {
    const date = new Date();
    const source = createFactSources(language).find(s => s.id === 'wikipedia-today');
    const result = await source.fetch({ random: () => 0, json: async url => {
      if (url.includes('commons.wikimedia')) return commons(); assert.ok(url.endsWith(`/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`));
      return { events: [{ year: 1900, text: 'An event on this date.', pages: [{ originalimage: {source: 'https://upload.wikimedia.org/Tree.jpg'}, content_urls: { desktop: { page: `https://${language}.wikipedia.org/wiki/Event` } } }] }] };
    } });
    assert.equal(validateWikipediaFact(result), true);
    assert.ok(result.description.startsWith('1900'));
    assert.notEqual(result.url, `https://${language}.wikipedia.org/wiki/Event`);
  }
  for (const language of ['bg', 'hi']) assert.equal(createFactSources(language).some(s => s.id === 'wikipedia-today'), false);
});

test('rate limiting cools down all modes in the same language source set', async () => {
  const sources = createFactSources('en');
  let calls = 0;
  const json = async () => { calls++; throw Error('HTTP 429'); };
  await assert.rejects(discover(sources, { json }));
  assert.equal(calls, 1);
});

test('missing images are rejected by rights, presenter and renderer', async () => {
  const source = createFactSources('bg')[0];
  const raw = await source.fetch({ json: async url => url.includes('commons.wikimedia') ? commons() : fixture('bg') });
  raw.image = null; raw.thumb = null;
  assert.equal(validateWikipediaFact(raw), false);
  assert.equal(present(raw, source), null);
  assert.throws(() => discoveryCard(raw), /image required/);
});

test('image failure tries another article in the same topic and language', async () => {
  const loaded = [];
  const found = await discover([createFactSources('bg')[1]], { random: () => 0,
    json: async url => {
      if (url.includes('commons.wikimedia')) {
        const data = commons();
        if (new URL(url).searchParams.get('titles') === 'File:Broken.jpg') data.query.pages[0].imageinfo[0].thumburl = 'https://upload.wikimedia.org/broken.jpg';
        return data;
      }
      const data = fixture('bg');
      data.query.pages.splice(1, 0, { ...data.query.pages[1], pageid: 12, pageimage: 'Broken.jpg', title: 'Broken image' });
      return data;
    }, imageLoader: async url => { loaded.push(url); if (url.endsWith('/broken.jpg')) throw Error('Decode failed'); } });
  assert.equal(found.title, 'A discovery');
  assert.equal(found.language, 'bg');
  assert.ok(loaded[0].endsWith('/broken.jpg'));
  assert.ok(found.image.endsWith('/tree.jpg'));
});

test('attributed image licences require a creator and retain separate notices', async () => {
  for (const kind of ['by', 'by-sa']) {
    for (const version of ['2.0', '3.0', '4.0']) {
      const source = createFactSources('en')[0];
      const raw = await source.fetch({ json: async url => {
        if (!url.includes('commons.wikimedia')) return fixture('en');
        const data = commons(`https://creativecommons.org/licenses/${kind}/${version}/`);
        const metadata = data.query.pages[0].imageinfo[0].extmetadata;
        metadata.AttributionRequired.value = 'true';
        metadata.Attribution = { value: 'Required credit' };
        metadata.Credit = { value: 'Original collection' };
        return data;
      } });
      assert.equal(validateWikipediaFact(raw), true);
      assert.equal(raw.rights.imageAttribution, 'Required credit');
      assert.equal(raw.rights.imageCredit, 'Original collection');
      raw.rights.imageCreator = '';
      assert.equal(validateWikipediaFact(raw), false);
    }
  }
});

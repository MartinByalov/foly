import { source, int, pickOne, join, text, fail, once } from './util.js';
import { rightsEvidence } from '../rights.js';
import { isSuitable } from '../safety.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const doi = value => typeof value === 'string' && /^10\.\d{4,9}\/\S+$/i.test(value);
const words = value => typeof value === 'string' && Boolean(value.trim());
const openAlexRequests = new WeakMap();
function openAlexSample(json, evidence) {
  const cached = openAlexRequests.get(json);
  if (cached) return cached;
  const request = Promise.resolve().then(() => json(evidence)).then(result => {
    if (!Array.isArray(result?.results)) fail('Invalid OpenAlex response');
    return result;
  });
  openAlexRequests.set(json, request);
  request.catch(() => { if (openAlexRequests.get(json) === request) openAlexRequests.delete(json); });
  return request;
}
// Select only reviewed bibliographic fields. Resource licences, abstracts, files and thumbnails
// are deliberately not copied: a metadata waiver never licenses the linked resource.
function card(raw, provider, evidence) {
  raw = { ...raw, kind: 'text', credit: `${provider} · CC0 metadata` };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', metadataLicenseUrl: CC0,
    evidence, creator: provider, mediaTitle: raw.title, attribution: raw.credit,
    changes: 'Selected bibliographic facts; no linked full text or media reproduced.' });
  if (provider === 'OpenAlex') raw.rights.metadataProvider = provider;
  return raw;
}
function choose(random, rows, build) {
  const cards = (Array.isArray(rows) ? rows : []).map(build).filter(row => row && isSuitable(row));
  return pickOne(random, cards) || fail('No valid, suitable bibliographic record');
}

export default [
  source('artic', 'Art Institute of Chicago', 'Art', async ({ json, random }) => {
    // IIIF currently returns HTTP 403. Offer catalogue facts, never substitute an image.
    const params = new URLSearchParams({ q: pickOne(random, ['flower', 'landscape', 'bird', 'garden']),
      limit: '20', fields: 'id,title,artist_display,date_display,medium_display,artwork_type_title' });
    const evidence = `https://api.artic.edu/api/v1/artworks/search?${params}`;
    const result = await json(evidence);
    return choose(random, result.data, row => {
      if (!Number.isSafeInteger(row.id) || row.id <= 0 || !words(row.title)) return null;
      return card({ title: text(row.title), subject: row.artwork_type_title || 'Museum catalogue',
        subtitle: join(row.artist_display, row.date_display), description: row.medium_display,
        url: `https://www.artic.edu/artworks/${row.id}` }, 'Art Institute of Chicago', evidence);
    });
  }),
  source('openlibrary', 'Open Library', 'Books', async ({ json, random }) => {
    const topic = pickOne(random, ['astronomy', 'botany', 'architecture', 'gardening', 'music']);
    const evidence = `https://openlibrary.org/search.json?subject=${topic}&limit=20&fields=key,title,author_name,first_publish_year`;
    // Catalogue facts only: cover art, descriptions and linked scans have independent rights.
    const result = await once(`reviewed:openlibrary:${topic}`, () => json(evidence));
    return choose(random, result.docs, row => {
      if (!/^\/works\/OL\d+W$/.test(row.key || '') || !words(row.title)) return null;
      return card({ title: text(row.title), subject: 'Book catalogue',
        subtitle: join(row.author_name?.slice(0, 3), row.first_publish_year),
        description: `A catalogue record found under ${topic}. Follow the source for editions and availability.`,
        url: `https://openlibrary.org${row.key}` }, 'Open Library', evidence);
    });
  }),
  source('doaj', 'Directory of Open Access Journals', 'Science', async ({ json, random }) => {
    const topic = pickOne(random, ['astronomy', 'botany', 'geology', 'ecology', 'mathematics']);
    const evidence = `https://doaj.org/api/search/articles/${topic}?pageSize=10&page=${1 + int(random, 20)}`;
    const result = await json(evidence);
    return choose(random, result.results, row => {
      const item = row.bibjson;
      if (!/^[a-f0-9]{32}$/.test(row.id || '') || !words(item?.title)) return null;
      // DOAJ metadata is CC0, not the licence of the article. Copy no abstract or full text.
      return card({ title: text(item.title), subject: 'Journal article',
        subtitle: join(item.journal?.title, item.year), description: join(item.author?.slice(0, 4).map(author => author.name)),
        url: `https://doaj.org/article/${row.id}` }, 'DOAJ', evidence);
    });
  }),
  source('nobel', 'Nobel Prize API', 'Nobel laureates', async ({ json, random }) => {
    // One cached batch per page avoids repeated API calls, as requested by the provider.
    const evidence = 'https://api.nobelprize.org/2.1/laureates?limit=100&offset=0';
    const result = await once('reviewed:nobel:laureates', () => json(evidence));
    return choose(random, result.laureates, row => {
      const title = row.knownName?.en || row.orgName?.en;
      const prize = row.nobelPrizes?.[0];
      const url = prize?.links?.find(link => link.rel === 'external' &&
        /^https:\/\/www\.nobelprize\.org\/prizes\/[a-z-]+\/\d{4}\/[a-z0-9-]+\/facts\/$/.test(link.href || ''))?.href;
      if (!/^\d+$/.test(row.id || '') || !words(title) || !/^\d{4}$/.test(prize?.awardYear || '') || !words(prize.category?.en) || !url) return null;
      return card({ title, subject: 'Nobel laureate', subtitle: join(prize.category.en, prize.awardYear),
        description: join(row.birth?.place?.country?.en, prize.affiliations?.map(place => place.name?.en)),
        url }, 'Nobel Prize Outreach', evidence);
    });
  }, 'text'),
  source('crossref', 'Crossref', 'Science', async ({ json, random }) => {
    const evidence = 'https://api.crossref.org/works?sample=5&select=DOI,title,author,published,container-title';
    const result = await json(evidence);
    if (result.status !== 'ok') fail('Invalid Crossref response');
    return choose(random, result.message?.items, row => {
      if (!doi(row.DOI) || !words(row.title?.[0])) return null;
      return card({ title: text(row.title[0]), subject: 'Research publication',
        subtitle: join(row['container-title']?.[0], row.published?.['date-parts']?.[0]?.[0]),
        description: join(row.author?.slice(0, 4).map(author => join(author.given, author.family)), `DOI: ${row.DOI}`),
        url: `https://doi.org/${row.DOI}` }, 'Crossref', evidence);
    });
  }),
  source('openalex', 'OpenAlex', 'Science', async ({ json, random }) => {
    const evidence = 'https://api.openalex.org/works?sample=5&select=id,doi,title,publication_year,primary_topic';
    const request = openAlexSample(json, evidence);
    const result = await request;
    try {
      return choose(random, result.results, row => {
        const title = text(row.title);
        if (!/^https:\/\/openalex\.org\/W\d+$/.test(row.id || '') || !words(title) ||
          /^https?:\/\//i.test(title) || !Number.isSafeInteger(row.publication_year) ||
          row.publication_year < 1500 || row.publication_year > new Date().getUTCFullYear() + 1) return null;
        return card({ title, subject: 'Research publication',
          subtitle: join(row.primary_topic?.display_name, row.publication_year),
          description: join(row.primary_topic?.field?.display_name, row.primary_topic?.domain?.display_name),
          url: row.id }, 'OpenAlex', evidence);
      });
    } catch (error) {
      if (openAlexRequests.get(json) === request) openAlexRequests.delete(json);
      throw error;
    }
  }, 'text'),
  source('datacite', 'DataCite', 'Research data', async ({ json, random }) => {
    const topic = pickOne(random, ['astronomy', 'botany', 'geology', 'oceanography', 'ecology']);
    const evidence = `https://api.datacite.org/dois?query=subjects.subject:${topic}&page%5Bsize%5D=10&page%5Bnumber%5D=${1 + int(random, 20)}`;
    const result = await json(evidence);
    return choose(random, result.data, row => {
      const item = row.attributes;
      if (row.type !== 'dois' || !doi(item?.doi) || row.id !== item.doi || item.state !== 'findable' || !words(item.titles?.[0]?.title)) return null;
      return card({ title: text(item.titles[0].title), subject: item.types?.resourceTypeGeneral || 'Research record',
        subtitle: join(item.publisher, item.publicationYear),
        description: join(item.creators?.slice(0, 4).map(author => author.name), `DOI: ${item.doi}`),
        url: `https://doi.org/${item.doi}` }, 'DataCite', evidence);
    });
  }),
  source('ror', 'Research Organization Registry', 'Research organizations', async ({ json, random }) => {
    const evidence = `https://api.ror.org/v2/organizations?page=${1 + int(random, 100)}`;
    const result = await json(evidence);
    return choose(random, result.items, row => {
      const title = row.names?.find(name => name.types?.includes('ror_display'))?.value;
      if (row.status !== 'active' || !/^https:\/\/ror\.org\/0[0-9a-z]{8}$/.test(row.id || '') || !words(title)) return null;
      const place = row.locations?.[0]?.geonames_details;
      return card({ title, subject: 'Research organization', subtitle: join(place?.name, place?.country_name),
        description: join(row.types, Number.isInteger(row.established) && row.established > 0 ? `Established ${row.established}` : null),
        url: row.id }, 'Research Organization Registry', evidence);
    });
  }),
];
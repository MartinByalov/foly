import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Research evidence only. This file never registers or enables a provider.
export const candidates = [
  ['digitalCommonwealth', 'Digital Commonwealth', 'History', 'https://www.digitalcommonwealth.org/api', 'https://www.digitalcommonwealth.org/search.json?q=flowers&per_page=5', 'Requires independent item and metadata rights review.'],
  ['dpla', 'Digital Public Library of America', 'History', 'https://pro.dp.la/developers/policies', null, 'API key required. No private credential is available to this static application.'],
  ['tePapa', 'Museum of New Zealand Te Papa Tongarewa', 'Natural history', 'https://www.tepapa.govt.nz/learn/research/datasets/collections-api/api-terms-of-use', null, 'Production registration key required. Evaluation guest keys expire after 30 minutes.'],
  ['bhl', 'Biodiversity Heritage Library', 'Botany', 'https://www.biodiversitylibrary.org/docs/api3.html', null, 'API key required and image rights vary by item.'],
  ['openverse', 'Openverse', 'Photography', 'https://docs.openverse.org/terms_of_service', 'https://api.openverse.org/v1/images/?q=botanical&license=cc0&page_size=5', 'Aggregator does not verify licensing. Original provider evidence is necessary. Do not scrape or bulk paginate.'],
  ['walters', 'Walters Art Museum', 'Art', 'https://raw.githubusercontent.com/WaltersArtMuseum/api-thewalters-org/master/README.md', null, 'Official v1 API closed in 2023. Static CC0 replacement needs a separate reproducible dataset build and image checks.'],
  ['brooklyn', 'Brooklyn Museum', 'Art', 'https://opencollection.brooklynmuseum.org/search/advanced', 'https://opencollection.brooklynmuseum.org/search/flowers', 'Requires current endpoint and separate media rights verification. HTML search is not proof of a JSON API.'],
  ['scienceMuseum', 'Science Museum Group', 'Technology', 'https://www.sciencemuseumgroup.org.uk/our-work/our-collection/using-our-collection-api', 'https://collection.sciencemuseumgroup.org.uk/search?q=locomotive', 'Review JSON negotiation and per-image licence. Do not bulk download their large datasets.'],
  ['nma', 'National Museum of Australia', 'History', 'https://www.nma.gov.au/about/our-collection/museum-api', null, 'API use is CC BY-NC. Incompatible with the current unrestricted-reuse rights gate.'],
  ['auckland', 'Auckland War Memorial Museum', 'Natural history', 'https://www.aucklandmuseum.com/legal/api-terms-and-conditions', null, 'API metadata terms restrict reuse to non-commercial applications. No unrestricted-use integration.'],
  ['parisMusees', 'Paris Musees', 'Art', 'https://www.parismuseescollections.paris.fr/fr/se-connecter-a-l-api', null, 'Registration and authentication token required. No shared or invented token.'],
  ['nrm', 'Swedish Museum of Natural History', 'Natural history', 'https://samlingar.nrm.se/swagger/', 'https://samlingar.nrm.se/swagger/v1/swagger.json', 'Inspect official schema and item-level media rights before implementation.'],
  ['finnishGallery', 'Finnish National Gallery', 'Art', 'https://kokoelma.kansallisgalleria.fi/api/swagger/', null, 'Search requires x-api-key, but the official objects dump explicitly requires no authentication. Follow up with a reproducible subset build, independent metadata rights evidence and browser image checks. Do not reject the entire provider for search authentication.'],
  ['gallica', 'Bibliotheque nationale de France Gallica', 'Maps', 'https://gallica.bnf.fr/accueil/fr/html/conditions-dutilisation-de-gallica', null, 'Separate document reuse terms need review. Public API access is not an unrestricted image licence.'],
  ['loc', 'Library of Congress', 'Maps', 'https://www.loc.gov/pictures/api', 'https://www.loc.gov/collections/garden-and-forest/?fo=json&c=3', 'Rights vary by collection and item. Requires explicit rights evidence, not access_restricted=false.'],
  ['nypl', 'New York Public Library', 'History', 'https://api-collections.nypl.org/docs', 'https://api-collections.nypl.org/openapi.json', 'Review current Collections API instead of assuming the older token-based API is the only option.'],
  ['ingenium', 'Ingenium', 'Technology', 'https://api.ingenium.ca/en/', null, 'All APIs require an individual token that must not be shared.'],
  ['risd', 'RISD Museum', 'Art', 'https://risdmuseum.org/art-design/projects-publications/articles/risd-museum-collection-api', 'https://risdmuseum.org/api/v1/collection?search_api_fulltext=flowers&items_per_page=5&has_images=1', 'Public JSON endpoint. Must separately establish metadata and image rights.'],
  ['eso', 'European Southern Observatory', 'Astronomy', 'https://www.eso.org/sci/facilities/paranal/astroclimate/ASMDatabase/apicalls.html', null, 'Documented atmospheric API is measurements, not reusable gallery images. A media API was not established.'],
  ['usno', 'US Naval Observatory', 'Astronomy', 'https://aa.usno.navy.mil/data/api.html', 'https://aa.usno.navy.mil/api/moon/phases/date?date=2026-11-03&nump=4', 'Moon-phase API provides calculated data. Do not count a text-only source as an image integration.'],
];

export async function probe(url, request = fetch) {
  const started = Date.now();
  try {
    const response = await request(url, { signal: AbortSignal.timeout(20000), headers: {
      Origin: 'http://localhost:8000', Accept: 'application/json, text/html;q=0.8',
    } });
    const contentType = response.headers.get('content-type') || '';
    // Bound reads as well as concurrency. Do not retain complete catalogues.
    let body = '';
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      try {
        while (body.length < 1000000) {
          const chunk = await reader.read();
          if (chunk.done) break;
          body = (body + decoder.decode(chunk.value, { stream: true })).slice(0, 1000000);
        }
      } finally { await reader.cancel(); }
    }
    let json;
    try { json = JSON.parse(body); } catch { /* A 200 HTML challenge is not a working JSON API. */ }
    return { url, finalUrl: response.url, status: response.status, contentType,
      cors: response.headers.get('access-control-allow-origin'), elapsedMs: Date.now() - started,
      json: json !== undefined, keys: json && typeof json === 'object' ? Object.keys(json).slice(0, 25) : [],
      sample: body.slice(0, 1600) };
  } catch (error) {
    return { url, elapsedMs: Date.now() - started, error: error.message };
  }
}

export async function run() {
  const reports = new Array(candidates.length);
  let next = 0;
  async function worker() {
    while (next < candidates.length) {
      const index = next++;
      const [id, name, theme, documentation, endpoint, assessment] = candidates[index];
      const [docs, api] = await Promise.all([probe(documentation), endpoint ? probe(endpoint) : null]);
      reports[index] = { id, name, theme, documentation, endpoint, assessment,
        assessmentStatus: 'screening note, not legal clearance or a verified production implementation',
        decision: 'not-integrated', docs, api };
      console.log(`${index + 1}/20 ${name}: docs=${docs.status || docs.error}, api=${api?.status || 'not probed'}`);
    }
  }
  await Promise.all(Array.from({ length: 5 }, worker));
  const followups = await Promise.all([
    'https://api-collections.nypl.org/search?q=flowers&rightsFilter=publicDomain&perPage=3',
    'https://www.digitalcommonwealth.org/copyright',
    'https://art.thewalters.org/images/raw/PS1_11.1_Fnt_DD_T12.jpg',
    'https://art.thewalters.org/images/raw/PL7_11.4_Fnt_TR_T03I-tms.jpg',
    'https://art.thewalters.org/images/raw/PL7_49.685_Fnt_TR_T90I-tms.jpg',
  ].map(url => probe(url)));
  const output = { reviewedAt: '2026-11-03', checkedAt: new Date().toISOString(),
    scope: '20 new independent candidates. Research evidence is not a production registry.', reports, followups };
  await fs.writeFile(new URL('../data/foly-api-batch-2026-11-03.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await run();
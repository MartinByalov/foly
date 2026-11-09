import { source, int, pickOne, join, text, fail, once } from './util.js';
import { discoveryLicense, rightsEvidence, validateDiscoveryRights, attributedMediaLicense } from '../rights.js';
import { isSuitable } from '../safety.js';
import batchImages from './batch-images.js';
import materialsImages from './materials-images.js';
import nhm from './nhm.js';
import fng from './fng.js';
import naturalis from './naturalis.js';
import cooper from './cooper.js';
import manuscripts from './manuscripts.js';
import verifiedVisuals from './verified-visuals.js';
import europeana from './europeana.js';
import openverse from './openverse.js';
import naturalEarth from './natural-earth.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const terms = ['flower', 'landscape', 'bird', 'tree', 'vase', 'ship', 'mountain', 'garden'];
const open = value => ['CC0', 'PDM', 'PUBLIC_DOMAIN'].includes(discoveryLicense(value));
const openFdaRequests = new WeakMap();
function openFdaTerms(json) {
  const cached = openFdaRequests.get(json);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const evidence = 'https://api.fda.gov/drug/event.json?count=patient.reaction.reactionmeddrapt.exact&limit=5';
  const request = { expires: Date.now() + 5 * 60_000 };
  request.promise = Promise.resolve().then(() => json(evidence, { timeout: 15_000 }));
  openFdaRequests.set(json, request);
  request.promise.catch(() => { if (openFdaRequests.get(json) === request) openFdaRequests.delete(json); });
  return request.promise;
}
// Reuse a short-lived occurrence batch within one JSON client, including in-flight requests.
// Rejections are evicted; a metadata cache never substitutes for per-image rights or decoding.
const gbifBatches = new WeakMap();
function gbifBatch(json, random) {
  const cached = gbifBatches.get(json);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const evidence = `https://api.gbif.org/v1/occurrence/search?mediaType=StillImage&license=CC0_1_0&limit=20&offset=${int(random, 9999)}`;
  const entry = { expires: Date.now() + 60_000 };
  entry.promise = Promise.resolve().then(() => json(evidence)).then(data => ({ evidence, data }));
  gbifBatches.set(json, entry);
  entry.promise.catch(() => { if (gbifBatches.get(json) === entry) gbifBatches.delete(json); });
  return entry.promise;
}
function licensed(raw, metadataLicense, mediaLicenseUrl, evidence) {
  const rights = rightsEvidence({ ...raw, metadataLicense, mediaLicense: discoveryLicense(mediaLicenseUrl),
    mediaLicenseUrl, evidence, attribution: raw.attribution || raw.credit,
    creator: raw.creator, mediaTitle: raw.mediaTitle, originalMediaUrl: raw.originalMediaUrl, changes: raw.changes,
    deliveryMode: raw.deliveryMode, retention: raw.retention });
  const result = { ...raw, rights };
  if (!validateDiscoveryRights(result).ok) fail('Missing or unsupported item rights');
  return result;
}

export default [
  ...verifiedVisuals,
  ...europeana,
  ...openverse,
  ...naturalEarth,
  ...batchImages,
  ...materialsImages,
  ...nhm,
  ...fng,
  ...naturalis,
  ...cooper,
  ...manuscripts,
  source('wellcomeReviewed', 'Wellcome Collection', 'Botany', async ({ json, random }) => {
    const results = await json('https://api.wellcomecollection.org/catalogue/v2/images?query=botanical&locations.license=pdm&pageSize=40');
    const imageLocation = row => row.locations?.find(location => location.locationType?.id === 'iiif-image' &&
      location.license?.id === 'pdm' && ['https://creativecommons.org/share-your-work/public-domain/pdm/',
        'https://creativecommons.org/publicdomain/mark/1.0/'].includes(location.license.url) &&
      location.accessConditions?.some(condition => condition.method?.id === 'view-online' && condition.status?.id === 'open') &&
      /^https:\/\/iiif\.wellcomecollection\.org\/image\/[A-Za-z0-9_-]+\/info\.json$/.test(location.url || ''));
    const row = pickOne(random, results.results?.filter(row => /^[a-z0-9]{8}$/.test(row.id || '') &&
      /^[a-z0-9]{8}$/.test(row.source?.id || '') && imageLocation(row)));
    if (!row) fail('No openly accessible public-domain Wellcome image');
    const location = imageLocation(row);
    // Catalogue metadata can originate with third parties. Copy no source titles, descriptions or subjects.
    // Foly's original caption is CC0; the selected image has a separate provider PDM declaration.
    return licensed({ title: 'From the botanical collections', subject: 'Botanical collections',
      description: 'A public-domain image discovered in Wellcome Collection’s botanical search. Explore the source record for its historical context.',
      image: location.url.replace('/info.json', '/full/480,/0/default.jpg'),
      url: `https://wellcomecollection.org/works/${row.source.id}`,
      credit: 'Wellcome Collection · Public Domain Mark' }, 'CC0',
    'https://creativecommons.org/publicdomain/mark/1.0/', `https://api.wellcomecollection.org/catalogue/v2/images/${row.id}`);
  }),
  source('rcsbReviewed', 'RCSB Protein Data Bank', 'Molecular biology', async ({ json, random }) => {
    // Structure-summary molecular renders share the archive's CC0 policy, unlike PDB-101 illustrations.
    const id = pickOne(random, ['4HHB', '1CRN', '1BNA', '1A3N', '1UBQ', '4INS']);
    const evidence = `https://data.rcsb.org/rest/v1/core/entry/${id}`;
    const row = await json(evidence);
    if (row.rcsb_id !== id || row.rcsb_entry_container_identifiers?.entry_id !== id || !row.struct?.title ||
      !row.rcsb_entry_container_identifiers.assembly_ids?.includes('1')) fail('No experimental PDB assembly');
    return licensed({ title: row.struct.title, subject: 'Molecular structure', subtitle: `PDB ${id}`,
      image: `https://cdn.rcsb.org/images/structures/${id.toLowerCase()}_assembly-1.jpeg`,
      url: `https://www.rcsb.org/structure/${id}`, credit: 'RCSB Protein Data Bank · CC0' }, 'CC0', CC0, evidence);
  }),
  source('usgsReviewed', 'USGS ShakeMap', 'Geology', async ({ json, random }) => {
    const search = await json('https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&producttype=shakemap&minmagnitude=5&limit=20&orderby=time');
    const candidates = [...new Map((search.features || []).filter(row => /^us[a-z0-9]+$/.test(row.id || '')).map(row => [row.id, row])).values()];
    if (!candidates.length) fail('No USGS event');
    for (let attempt = 0; candidates.length && attempt < 5; attempt++) {
      const [event] = candidates.splice(int(random, candidates.length), 1);
      try {
        const evidence = `https://earthquake.usgs.gov/fdsnws/event/1/query?eventid=${event.id}&format=geojson`;
        const detail = await json(evidence);
        // Partner-network products are not assumed US-government works. Use only NEIC-produced charts.
        // Regression charts avoid third-party basemap tiles that may appear in the intensity maps.
        const product = detail.properties?.products?.shakemap?.find(row => row.source === 'us' && row.code === event.id &&
          row.status !== 'DELETE' && row.properties?.['event-description'] === 'USGS NEIC ShakeMap');
        const chart = product?.contents?.['download/mmi_regr.png'];
        if (chart?.contentType !== 'image/png' || !/^https:\/\/earthquake\.usgs\.gov\/product\/shakemap\/us[a-z0-9]+\/us\/\d+\/download\/mmi_regr\.png$/.test(chart.url || '') ||
          new URL(chart.url).pathname.split('/')[3] !== event.id) continue;
        return licensed({ title: 'How earthquake shaking fades with distance', subject: 'Earthquake science',
          subtitle: Number.isFinite(detail.properties.mag) ? `Magnitude ${detail.properties.mag}` : undefined,
          description: 'A USGS ShakeMap chart comparing observed shaking with its modeled change over distance. This is a scientific observation, not a prediction or safety advisory.',
          image: chart.url, url: `https://earthquake.usgs.gov/earthquakes/eventpage/${event.id}`,
          credit: 'U.S. Geological Survey · U.S. government public domain' }, 'US_GOV_PUBLIC_DOMAIN',
        'https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted', evidence);
      } catch { /* Retry only another USGS event, independently checking its product and chart. */ }
    }
    fail('No USGS-produced chart');
  }),
  source('yaleReviewed', 'Yale Center for British Art', 'Art', async ({ json, random }) => {
    const query = { AND: [{ hasDigitalImage: 1 }, { text: pickOne(random, ['landscape', 'bird', 'tree', 'ship', 'garden']) },
      { memberOf: { id: 'https://lux.collections.yale.edu/data/set/56dc1a97-4dfa-4a30-b028-f816575da1ab' } }] };
    const result = await json(`https://lux.collections.yale.edu/api/search/item?q=${encodeURIComponent(JSON.stringify(query))}`);
    const entries = (result.orderedItems || []).filter(item => /^https:\/\/lux\.collections\.yale\.edu\/data\/object\/[a-f0-9-]{36}$/.test(item.id || ''));
    for (let attempt = 0; attempt < Math.min(3, entries.length); attempt++) {
      const [entry] = entries.splice(int(random, entries.length), 1);
      const object = await json(entry.id);
      const manifestUrl = object.subject_of?.flatMap(part => part.digitally_carried_by || [])
        .flatMap(part => part.access_point || []).find(point => /^https:\/\/manifests\.collections\.yale\.edu\/v2\/ycba\/obj\/\d+$/.test(point.id || ''))?.id;
      if (!manifestUrl) continue;
      const manifest = await json(manifestUrl);
      if (discoveryLicense(manifest.license) !== 'CC0' || !manifest.attribution?.startsWith('Metadata describing Yale Center for British Art collections is public domain under CC0.')) continue;
      // Manifest license is METADATA only. Check the selected canvas' image-use statement separately.
      const canvases = (manifest.sequences || []).flatMap(sequence => sequence.canvases || []).filter(canvas =>
        canvas.metadata?.some(row => row.label === 'Image Use Rights' && row.value === 'No Copyright: You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission. (CC0 1.0)'));
      const canvas = pickOne(random, canvases);
      const service = canvas?.images?.find(annotation => annotation.resource?.format === 'image/jpeg')?.resource?.service?.['@id'];
      if (!/^https:\/\/images\.collections\.yale\.edu\/iiif\/2\/ycba:[a-f0-9-]{36}$/.test(service || '')) continue;
      const title = object.identified_by?.find(name => name.type === 'Name' && name.content)?.content;
      if (!title) continue;
      return licensed({ title, subject: 'British art', image: `${service}/full/480,/0/default.jpg`,
        url: `https://lux.collections.yale.edu/view/object/${entry.id.split('/').at(-1)}`,
        credit: 'Yale Center for British Art · CC0' }, 'CC0', CC0, manifestUrl);
    }
    fail('No Yale canvas with separately declared CC0 image rights');
  }),
  source('miaReviewed', 'Minneapolis Institute of Art', 'Art', async ({ json, random }) => {
    const query = `rights_type:"Public Domain" image:valid ${pickOne(random, terms)}`;
    const evidence = `https://search.artsmia.org/${encodeURIComponent(query)}?size=30`;
    const rows = (await json(evidence)).hits?.hits?.map(hit => hit._source) || [];
    const row = pickOne(random, rows.filter(r => r.rights_type === 'Public Domain' && r.image === 'valid' &&
      r.public_access === 1 && r.Rights_Image_Display === 'Full' && Number.isSafeInteger(r.id) &&
      /^\d+(?:\\\d+)*$/.test(r.Cache_Location || '') && /^mia_\d+\.jpg$/.test(r.Primary_RenditionNumber || '')));
    if (!row) fail('No public-domain Mia image');
    const location = row.Cache_Location.replace(/\\/g, '/');
    const image = `https://img.artsmia.org/web_objects_cache/${location}/${row.Primary_RenditionNumber.replace(/\.jpg$/, '_800.jpg')}`;
    return licensed({ title: row.title, subject: row.classification, subtitle: join(row.artist, row.dated),
      description: join(row.medium, row.country), image, url: `https://collections.artsmia.org/art/${row.id}`,
      credit: join(row.artist, 'Minneapolis Institute of Art · Public domain') }, 'CC0', 'https://creativecommons.org/publicdomain/mark/1.0/', evidence);
  }),
  source('phylopicReviewed', 'PhyloPic', 'Biology', async ({ json, random }) => {
    const base = 'https://api.phylopic.org';
    // Pin the published index build first: independently cached filtered URLs can point
    // at an empty build during publication. Never mix page counts from different builds.
    const published = await json(`${base}/images`);
    if (!Number.isSafeInteger(published.build)) fail('Invalid PhyloPic build');
    const index = await json(`${base}/images?build=${published.build}&filter_license_nc=false`);
    if (index.build !== published.build) fail('Mismatched PhyloPic build');
    if (!Number.isSafeInteger(index.build) || !Number.isSafeInteger(index.totalPages) || index.totalPages < 1) fail('Invalid PhyloPic build');
    const imageOf = row => row._links?.rasterFiles?.filter(file => file.type === 'image/png' &&
      typeof file.href === 'string' && new RegExp(`^https://images\\.phylopic\\.org/images/${row.uuid}/raster/[1-9][0-9]*x[1-9][0-9]*\\.png$`).test(file.href))
      .sort((a, b) => Math.abs(Number(a.sizes?.split('x')[0]) - 800) - Math.abs(Number(b.sizes?.split('x')[0]) - 800))[0]?.href;
    const firstPage = int(random, index.totalPages);
    for (let attempt = 0; attempt < Math.min(3, index.totalPages); attempt++) {
      const evidence = `${base}/images?build=${index.build}&filter_license_nc=false&page=${(firstPage + attempt) % index.totalPages}&embed_items=true`;
      const page = await json(evidence);
      if (page.build !== index.build) fail('Mismatched PhyloPic page build');
      const choices = (page._embedded?.items || []).filter(row => {
        const license = row._links?.license?.href;
        return row.build === index.build && /^[a-f0-9-]{36}$/.test(row.uuid || '') && imageOf(row) && (discoveryLicense(license) === 'CC0' ||
          (attributedMediaLicense(license) && typeof row.attribution === 'string' && row.attribution.trim() &&
            !/[<>]/.test(row.attribution) && typeof row._links?.self?.title === 'string' && row._links.self.title.trim()));
      });
      const row = pickOne(random, choices);
      if (!row) continue;
      const image = imageOf(row);
      const attributed = attributedMediaLicense(row._links.license.href);
      // Original Foly captions are CC0. Do not infer a blanket metadata license from the OpenAPI document license.
      return licensed({ title: 'The shape of a living organism', subject: 'Biological silhouette',
        description: 'A silhouette from the diversity of life. Open the source to identify the organism and explore its relatives.',
        image, url: `https://www.phylopic.org/images/${row.uuid}`, credit: `PhyloPic · ${attributed || 'CC0'}`,
        ...(attributed ? { creator: row.attribution, attribution: row.attribution, mediaTitle: row._links.self.title,
          originalMediaUrl: image, changes: 'No modifications by Foly; displayed at a scaled size.',
          ...(attributed === 'CC_BY_SA' ? { deliveryMode: 'direct', retention: 'ephemeral' } : {}) } : {}) },
      'CC0', row._links.license.href, evidence);
    }
    fail('No supported silhouette with complete rights');
  }),
  source('epicReviewed', 'NASA EPIC', 'Earth', async ({ json, random }) => {
    const evidence = 'https://epic.gsfc.nasa.gov/api/natural';
    const rows = await json(evidence);
    const row = pickOne(random, rows.filter(r => /^epic_1b_\d{14}$/.test(r.image || '') &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.date || '') &&
      r.caption === "This image was taken by NASA's EPIC camera onboard the NOAA DSCOVR spacecraft"));
    if (!row) fail('No NASA-produced EPIC image');
    const date = row.date.slice(0, 10).replace(/-/g, '/');
    return licensed({ title: 'Earth from the sunward side', subject: 'Earth observation', subtitle: row.date,
      description: 'A natural-color view of Earth captured by the EPIC camera aboard DSCOVR.',
      image: `https://epic.gsfc.nasa.gov/archive/natural/${date}/jpg/${row.image}.jpg`,
      url: 'https://epic.gsfc.nasa.gov/', credit: 'NASA EPIC Team · U.S. government public domain' },
    'US_GOV_PUBLIC_DOMAIN', 'https://epic.gsfc.nasa.gov/about', evidence);
  }),
  source('commonsReviewed', 'Wikimedia Commons', 'Photography', async ({ json, random }) => {
    // Captions come from CC0 Structured Data, NOT the CC-BY-SA description wikitext.
    // Search filters are hints only; inspect the exact returned file's rights too.
    const params = new URLSearchParams({ action: 'query', format: 'json', origin: '*',
      generator: 'search', gsrsearch: `filetype:bitmap incategory:CC-Zero ${pickOne(random, ['mountain', 'flower', 'architecture', 'landscape', 'bird', 'forest', 'bridge', 'ocean'])}`,
      gsrnamespace: '6', gsrlimit: '20', prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '800' });
    const endpoint = 'https://commons.wikimedia.org/w/api.php';
    const search = `${endpoint}?${params}`;
    const pages = Object.values((await json(search)).query?.pages || {}).filter(page => {
      const info = page.imageinfo?.[0], rights = info?.extmetadata;
      let license;
      try {
        const url = new URL(rights?.LicenseUrl?.value);
        // Commons sometimes emits localized Creative Commons deed URLs.
        license = discoveryLicense(`${url.origin}${url.pathname.replace(/\/deed\.[a-z_-]+$/i, '/')}`);
      } catch { return false; }
      return license === 'CC0' && rights.LicenseShortName?.value === 'CC0' &&
        rights.AttributionRequired?.value === 'false' && !rights.Restrictions?.value?.trim() &&
        Number.isSafeInteger(page.pageid) && info.thumburl && info.descriptionurl;
    });
    if (!pages.length) fail('No CC0 Commons image');
    const evidence = `${endpoint}?${new URLSearchParams({ action: 'wbgetentities', format: 'json', origin: '*',
      ids: pages.map(page => `M${page.pageid}`).join('|'), props: 'labels', languages: 'en' })}`;
    const entities = (await json(evidence)).entities || {};
    const page = pickOne(random, pages.filter(page => entities[`M${page.pageid}`]?.labels?.en?.value));
    if (!page) fail('No CC0 structured caption');
    const info = page.imageinfo[0];
    return licensed({ title: entities[`M${page.pageid}`].labels.en.value,
      subject: 'Photograph', image: info.thumburl, url: info.descriptionurl,
      credit: 'Wikimedia Commons · CC0' }, 'CC0', CC0, search);
  }),
  source('met', 'The Met', 'Art', async ({ json, random, category = '' }) => {
    if (category && !/^[1-9]\d*$/.test(category)) fail('Invalid Met department');
    const department = category ? (await json('https://collectionapi.metmuseum.org/public/collection/v1/departments')).departments?.find(row => String(row.departmentId) === category)?.displayName : '';
    if (category && !department) fail('Unknown Met department');
    const search = await json(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&limit=100${category ? `&departmentId=${category}` : `&q=${pickOne(random, terms)}`}`);
    const ids = [...new Set(Array.isArray(search.objectIDs) ? search.objectIDs.filter(id => Number.isSafeInteger(id) && id > 0) : [])];
    for (let attempt = 0; attempt < 5 && ids.length; attempt++) {
      const [id] = ids.splice(int(random, ids.length), 1);
      const evidence = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`;
      let r;
      try { r = await json(evidence); }
      catch { continue; } // Search can retain deleted objects. Try another ID from this same provider.
      if (r.isPublicDomain !== true || !r.primaryImageSmall || !r.title || (category && r.department !== department)) continue;
      return licensed({ title: r.title, subject: r.classification || r.objectName, subtitle: join(r.artistDisplayName, r.objectDate),
        description: join(r.medium, r.culture), image: r.primaryImageSmall, url: r.objectURL,
        credit: join(r.artistDisplayName, 'The Metropolitan Museum of Art · CC0') }, 'CC0', CC0, evidence);
    }
    fail('No public-domain Met object');
  }),
  source('artic', 'Art Institute of Chicago', 'Art', async ({ json, random }) => {
    // Search is capped at 1,000 records. Never request page 100 at limit 20.
    const params = new URLSearchParams({ q: pickOne(random, terms), 'query[term][is_public_domain]': 'true',
      limit: '20', fields: 'id,title,image_id,is_public_domain,artist_display,date_display,medium_display,artwork_type_title' });
    const evidence = `https://api.artic.edu/api/v1/artworks/search?${params}`;
    const r = pickOne(random, (await json(evidence)).data?.filter(item => item.is_public_domain === true && item.image_id));
    if (!r?.title) fail('No public-domain Chicago object');
    return licensed({ title: r.title, subject: r.artwork_type_title, subtitle: r.date_display,
      // Do not copy the separately CC-BY licensed `description` field.
      description: join(r.artist_display, r.medium_display), image: `https://www.artic.edu/iiif/2/${encodeURIComponent(r.image_id)}/full/843,/0/default.jpg`,
      url: `https://www.artic.edu/artworks/${r.id}`, credit: join(r.artist_display, 'Art Institute of Chicago · CC0') }, 'CC0', CC0, evidence);
  }),
  source('cleveland', 'Cleveland Museum of Art', 'Art', async ({ json, random }) => {
    const evidence = `https://openaccess-api.clevelandart.org/api/artworks/?cc0&has_image=1&limit=20&q=${pickOne(random, terms)}`;
    const candidates = (await json(evidence)).data?.filter(item => item.share_license_status === 'CC0' &&
      typeof item.title === 'string' && item.title.trim() &&
      /^https:\/\/openaccess-cdn\.clevelandart\.org\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+_web\.jpg$/.test(item.images?.web?.url || '') &&
      /^https:\/\/clevelandart\.org\/art\/[A-Za-z0-9._-]+\/?$/.test(item.url || '')) || [];
    for (let attempt = 0; candidates.length && attempt < 5; attempt++) {
      const [item] = candidates.splice(int(random, candidates.length), 1);
      const raw = licensed({ title: item.title, subject: item.type, subtitle: item.creation_date,
        description: text(item.wall_description || item.description || item.tombstone),
        image: item.images.web.url, url: item.url,
        credit: join(item.creators?.[0]?.description, 'Cleveland Museum of Art · CC0') }, 'CC0', CC0, evidence);
      if (isSuitable(raw)) return raw;
    }
    fail('No safe CC0 Cleveland object with a browseable page and image');
  }),
  source('smk', 'SMK – National Gallery of Denmark', 'Art', async ({ json, random }) => {
    const evidence = `https://api.smk.dk/api/v1/art/search/?keys=*&offset=${int(random, 20000)}&rows=10&filters=[has_image:true],[public_domain:true]&lang=en`;
    const r = pickOne(random, (await json(evidence)).items?.filter(item => item.public_domain === true && open(item.rights) && item.image_thumbnail));
    if (!r) fail('No public-domain SMK object');
    return licensed({ title: r.titles?.[0]?.title || 'Untitled', subject: r.object_names?.[0]?.name,
      subtitle: join(r.production?.[0]?.creator, r.production_date?.[0]?.period), description: join(r.techniques, r.materials),
      image: r.image_thumbnail, url: `https://open.smk.dk/artwork/image/${encodeURIComponent(r.object_number)}`,
      credit: 'SMK · Public domain' }, 'CC0', r.rights, evidence);
  }),
  source('inaturalist', 'iNaturalist', 'Nature', async ({ json, random, category = '' }) => {
    if (category && !['Actinopterygii', 'Amphibia', 'Arachnida', 'Aves', 'Insecta', 'Mammalia', 'Mollusca', 'Plantae', 'Reptilia', 'Fungi'].includes(category)) fail('Unsupported iNaturalist category');
    const params = new URLSearchParams({ photos: 'true', quality_grade: 'research', license: 'cc0', photo_license: 'cc0',
      per_page: '20', order_by: 'id', order: 'asc', id_above: String(int(random, 250_000_000)) });
    if (category) params.set('iconic_taxa', category);
    const evidence = `https://api.inaturalist.org/v1/observations?${params}`;
    const records = (await json(evidence)).results?.filter(r => r.license_code === 'cc0' && r.taxon?.name && (!category || r.taxon.iconic_taxon_name === category) &&
      r.photos?.some(photo => photo.license_code === 'cc0' && photo.url));
    const r = pickOne(random, records);
    if (!r) fail('No observation with CC0 data AND photo');
    // A licensed observation can contain restricted photos; do not pick photos[0].
    const photo = pickOne(random, r.photos.filter(p => p.license_code === 'cc0' && p.url));
    return licensed({ title: r.taxon.preferred_common_name || r.taxon.name, subject: r.taxon.iconic_taxon_name,
      subtitle: r.taxon.name, description: join(r.place_guess, r.observed_on), image: photo.url.replace('/square.', '/medium.'),
      url: `https://www.inaturalist.org/observations/${r.id}`, credit: photo.attribution }, 'CC0', CC0, evidence);
  }),
  source('gbif', 'GBIF', 'Nature', async ({ json, random, imageLoader }) => {
    const { evidence, data } = await gbifBatch(json, random);
    const records = data.results?.filter(r => open(r.license) && r.scientificName &&
      r.media?.some(m => m.type === 'StillImage' && open(m.license) && /^https:/.test(m.identifier || '')));
    const candidates = (records || []).flatMap(r => r.media.filter(m => m.type === 'StillImage' && open(m.license) && /^https:/.test(m.identifier || '')).map(media => ({ r, media })));
    const seen = new Set();
    for (let attempt = 0; candidates.length && attempt < 3;) {
      const [{ r, media }] = candidates.splice(int(random, candidates.length), 1);
      if (seen.has(media.identifier)) continue;
      seen.add(media.identifier); attempt++;
      const raw = licensed({ title: r.vernacularName || r.species || r.scientificName, subject: r.kingdom, subtitle: r.scientificName,
        description: join(r.locality, r.country, r.eventDate?.slice(0, 10)),
        image: /^https:\/\/inaturalist-open-data\.s3\.amazonaws\.com\/photos\/\d+\/original\.(jpg|jpeg|png)$/.test(media.identifier)
          ? media.identifier.replace('/original.', '/medium.') : media.identifier,
        url: `https://www.gbif.org/occurrence/${r.key}`, credit: join(media.creator || media.rightsHolder, 'GBIF', media.license) }, r.license, media.license, evidence);
      try {
        if (imageLoader) await imageLoader(raw.image);
        return raw;
      } catch { /* Retry another independently licensed GBIF image, never the failed URL. */ }
    }
    fail('No occurrence with usable open data AND media');
  }),
  source('dicebear', 'DiceBear Shapes', 'Design', async ({ random }) => {
    const image = `https://api.dicebear.com/10.x/shapes/svg?seed=foly-${int(random, 1e9)}`;
    return licensed({ title: 'A study in shapes', subject: 'Generative design',
      description: 'A small composition of geometric forms, generated for this discovery.', image,
      url: 'https://www.dicebear.com/styles/shapes/', credit: 'Shapes by DiceBear · CC0' }, 'CC0', CC0, 'https://www.dicebear.com/styles/shapes/');
  }),
  source('rijksmuseum', 'Rijksmuseum', 'Art', async ({ json, random }) => {
    const search = await json('https://data.rijksmuseum.nl/search/collection?type=painting');
    const candidates = (search.orderedItems || []).filter(entry => /^https:\/\/id\.rijksmuseum\.nl\/\d+$/.test(entry?.id || ''));
    const endpoint = id => {
      if (!/^https:\/\/id\.rijksmuseum\.nl\/\d+$/.test(id || '')) fail('Unexpected Rijksmuseum entity');
      return id.replace('://id.', '://data.') + '?_profile=la-framed';
    };
    const rights = r => (r?.subject_to || []).flatMap(x => x.classified_as || []).map(x => x.id).find(open);
    for (let attempt = 0; candidates.length && attempt < 5; attempt++) {
      const [entry] = candidates.splice(int(random, candidates.length), 1);
      try {
        const evidence = endpoint(entry.id);
        const object = await json(evidence);
        const metadataLicense = (object.subject_of || []).filter(s => s.id === object.id?.replace('://id.', '://data.')).map(rights).find(Boolean);
        if (!metadataLicense) fail('No metadata licence');
        const visual = await json(endpoint(object.shows?.[0]?.id));
        const mediaLicense = rights(visual);
        if (!mediaLicense) fail('No visual licence');
        const digital = await json(endpoint(visual.digitally_shown_by?.[0]?.id));
        const image = digital.access_point?.find(p => /^https:\/\/iiif\.micr\.io\/[^/]+\/full\/max\/0\/default\.jpg$/.test(p.id))?.id;
        if (!image) fail('No linked image');
        const title = object.identified_by?.find(r => r.type === 'Name' && r.language?.some(l => l.id?.endsWith('/300388277')))?.content;
        if (!title) fail('No English title');
        return licensed({ title, subject: 'Painting', image: image.replace('/full/max/', '/full/800,/'),
          url: object.id, credit: 'Rijksmuseum · Public domain' }, metadataLicense, mediaLicense, evidence);
      } catch { /* Retry only another Rijksmuseum object, with fresh independent media rights. */ }
    }
    fail('No linked Rijksmuseum image with independently open metadata and media');
  }),
  source('openFDAReports', 'openFDA Adverse Event Reports', 'Health data', async ({ json }) => {
    const evidence = 'https://api.fda.gov/drug/event.json?count=patient.reaction.reactionmeddrapt.exact&limit=5';
    const data = await openFdaTerms(json);
    const chart = data.results?.map(row => ({ label: row.term, value: row.count }));
    if (data.meta?.license !== 'https://open.fda.gov/license/' ||
      data.meta?.terms !== 'https://open.fda.gov/terms/' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.meta?.last_updated || '') ||
      !Array.isArray(chart) || chart.length !== 5 ||
      chart.some((row, index) => typeof row.label !== 'string' || !row.label.trim() ||
        !Number.isSafeInteger(row.value) || row.value <= 0 ||
        (index > 0 && row.value > chart[index - 1].value))) {
      fail('No current openFDA aggregate report terms');
    }
    return {
      kind: 'chart', title: 'Terms most often recorded in FDA drug reports',
      subject: 'FAERS report data', subtitle: `Dataset updated ${data.meta.last_updated}`,
      description: 'These are counts of unvalidated reports, not proof that a drug caused a condition. They are not medical advice.',
      chart, url: 'https://open.fda.gov/apis/drug/event/',
      rights: {
        metadataLicense: 'CC0',
        metadataLicenseUrl: CC0,
        license_name: 'CC0 1.0',
        verifiedBy: evidence,
        sourceItemUrl: 'https://open.fda.gov/apis/drug/event/',
        creator: 'U.S. Food and Drug Administration',
        attribution: 'Data provided by the U.S. Food and Drug Administration',
        changes: 'Aggregate counts of unvalidated reports; no causal claims or medical advice.',
        chartProvider: 'openFDAReports',
        chartData: JSON.stringify(chart),
        verifiedAt: new Date().toISOString(),
      },
    };
  }, 'chart'),
  source('worldBank', 'World Bank', 'Geography', async ({ json, random }) => {
    const countries = [
      { code: 'USA', page: 'US' }, { code: 'CHN', page: 'CN' }, { code: 'IND', page: 'IN' },
      { code: 'BRA', page: 'BR' }, { code: 'JPN', page: 'JP' },
    ];
    const country = pickOne(random, countries);
    const indicatorEvidence = 'https://api.worldbank.org/v2/indicator/SP.POP.TOTL?format=json';
    const indicatorResponse = await once('reviewed:worldbank:indicator:SP.POP.TOTL',
      () => json(indicatorEvidence));
    const indicator = indicatorResponse?.[1]?.[0];
    if (indicator?.id !== 'SP.POP.TOTL' || indicator.name !== 'Population, total' ||
      indicator.source?.id !== '2' || indicator.source?.value !== 'World Development Indicators' ||
      !indicator.sourceOrganization?.includes('World Population Prospects') ||
      !indicator.sourceOrganization.includes('national statistical offices') ||
      !indicator.sourceOrganization.includes('Eurostat') ||
      !indicator.sourceOrganization.includes('Population and Vital Statistics Report')) {
      fail('Unreviewed World Bank indicator metadata');
    }
    const evidence = `https://api.worldbank.org/v2/country/${country.code}/indicator/SP.POP.TOTL?format=json&per_page=5`;
    const result = await json(evidence);
    const metadata = result?.[0], records = result?.[1];
    if (!metadata || metadata.page !== 1 || !Array.isArray(records) || records.length !== 5 ||
      records.some(row => row.countryiso3code !== country.code || row.indicator?.id !== 'SP.POP.TOTL' ||
        row.indicator?.value !== 'Population, total' || row.country?.id !== country.page || !row.country?.value ||
        !/^\d{4}$/.test(row.date || '') || !Number.isSafeInteger(row.value) || row.value <= 0)) {
      fail('Invalid World Bank population data');
    }
    const chart = records.map(row => ({ label: row.date, value: row.value }))
      .sort((a, b) => a.label.localeCompare(b.label));
    if (new Set(chart.map(row => row.label)).size !== 5) fail('Incomplete World Bank population series');
    const title = `Population of ${records[0].country.value}`;
    const url = `https://data.worldbank.org/indicator/SP.POP.TOTL?locations=${records[0].country.id}`;
    const rights = rightsEvidence({ metadataLicense: 'CC_BY',
      metadataLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
      evidence, url, creator: 'World Bank', mediaTitle: title,
      attribution: 'The World Bank: World Development Indicators: Population, total. Sources: UN Population Division, national statistical offices, Eurostat and UN Statistics Division.',
      changes: 'Population values displayed as a five-year chart without modification.' });
    Object.assign(rights, { chartProvider: 'worldBank', chartData: JSON.stringify(chart),
      chartCountry: country.code, author: 'World Bank', source_url: url,
      license_url: 'https://creativecommons.org/licenses/by/4.0/', license_name: 'CC BY 4.0',
      licenseEvidenceUrl: 'https://data.worldbank.org/indicator/SP.POP.TOTL' });
    return { kind: 'chart', title, subject: 'Population, total',
      subtitle: `${chart[0].label}-${chart[4].label} · World Development Indicators`,
      description: 'Population by year, as reported by the World Bank.',
      chart, chartCountry: country.code, url, rights };
  }, 'chart'),
];

import { source, pickOne, int, fail } from './util.js';
import { discoveryLicense, rightsEvidence, validateDiscoveryRights } from '../rights.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const cc0 = value => discoveryLicense(value) === 'CC0';
const rights = record => record?.subject_to?.some(right => right.classified_as?.some(type => cc0(type.id)));
const objectUrl = value => /^https:\/\/data\.getty\.edu\/museum\/collection\/object\/[a-f0-9-]{36}$/.test(value || '');
const mediaUrl = value => /^https:\/\/data\.getty\.edu\/media\/image\/[a-f0-9-]{36}$/.test(value || '');

function licensed(raw, evidence) {
  const result = { ...raw, rights: rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC0',
    mediaLicenseUrl: CC0, evidence }) };
  if (!validateDiscoveryRights(result).ok) fail('Incomplete image rights');
  return result;
}

export default [
  source('getty', 'J. Paul Getty Museum', 'Art', async ({ json, random }) => {
    const term = pickOne(random, ['landscape', 'flower', 'vase', 'tree']);
    const query = `SELECT DISTINCT ?s WHERE { ?s a <http://www.cidoc-crm.org/cidoc-crm/E22_Human-Made_Object> ; <http://www.w3.org/2000/01/rdf-schema#label> ?title . FILTER(CONTAINS(LCASE(STR(?title)),"${term}")) } LIMIT 30`;
    const search = await json(`https://data.getty.edu/museum/collection/sparql?${new URLSearchParams({ query, _format: 'json' })}`);
    const candidates = [...new Set((search.results?.bindings || []).map(row => row.s?.value).filter(objectUrl))];
    // Bound retries within Getty. Never silently replace the provider or infer media rights from metadata.
    for (let attempt = 0; candidates.length && attempt < 5; attempt++) {
      const [endpoint] = candidates.splice(int(random, candidates.length), 1);
      try {
        const object = await json(endpoint);
        if (object.id !== endpoint || object.type !== 'HumanMadeObject' || !rights(object) || !object._label) continue;
        const link = object.shows?.find(item => item.type === 'VisualItem' && mediaUrl(item.id));
        if (!link) continue;
        const media = await json(link.id);
        if (media.id !== link.id || media.type !== 'VisualItem' || !rights(media) ||
          !media.shown_by?.some(item => item.id === endpoint)) continue;
        const image = media.digitally_shown_by?.flatMap(item => item.access_point || [])
          .find(item => item.format === 'image/jpeg' && /^https:\/\/media\.getty\.edu\/iiif\/image\/[a-f0-9-]{36}\/full\/!600,600\/0\/default\.jpg$/.test(item.id || ''))?.id;
        const url = object.subject_of?.find(item => item.format === 'text/html' &&
          /^https:\/\/www\.getty\.edu\/art\/collection\/object\/[A-Za-z0-9]+$/.test(item.id || ''))?.id;
        if (!image || !url) continue;
        // Description prose has separate CC BY rights. Only the CC0 catalogue label is copied.
        return licensed({ title: object._label, subject: 'Museum collection', image, url,
          credit: 'J. Paul Getty Museum · CC0' }, link.id);
      } catch { /* Deleted, restricted or unavailable records do not license another record. */ }
    }
    fail('No linked Getty image with separate CC0 evidence');
  }),
  source('polyhaven', 'Poly Haven', 'Textures', async ({ json, random }) => {
    // A small reviewed set keeps requests bounded. Seeds are not counted as separate providers.
    const id = pickOne(random, ['aerial_grass_rock', 'brick_wall_001', 'red_brick_03', 'wood_floor']);
    const evidence = `https://api.polyhaven.com/files/${id}`;
    const files = await json(evidence);
    const image = files.Diffuse?.['1k']?.jpg?.url;
    const suffix = id === 'brick_wall_001' ? 'diffuse' : 'diff';
    if (image !== `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}_${suffix}_1k.jpg`) fail('No reviewed raw diffuse texture');
    // Do not reproduce website descriptions or example renders. This caption is Foly's own.
    return licensed({ title: 'A surface in detail', subject: 'Raw texture', image,
      description: 'A diffuse texture from Poly Haven. Explore the source for the complete material.',
      url: `https://polyhaven.com/a/${id}`, credit: 'Powered by Poly Haven' }, evidence);
  }),
  source('nga', 'National Gallery of Art', 'Art', async ({ json, random }) => {
    const data = await json(new URL('../../../data/foly-nga.json', import.meta.url).href);
    const row = pickOne(random, data.items?.filter(item => item.openaccess === '1' && item.metadataLicense === 'CC0' &&
      item.mediaLicense === 'CC0' && /^https:\/\/raw\.githubusercontent\.com\/NationalGalleryOfArt\/opendata\/[a-f0-9]{40}\/data\/published_images\.csv$/.test(item.provenance || '') &&
      /^https:\/\/api\.nga\.gov\/iiif\/[a-f0-9-]{36}\/full\/!640,640\/0\/default\.jpg$/.test(item.image || '') &&
      /^https:\/\/www\.nga\.gov\/artworks\/\d+$/.test(item.url || '') && item.title));
    if (!row) fail('No individually open-access NGA image');
    return licensed({ title: row.title, subject: 'Museum collection', subtitle: row.artist,
      image: row.image, url: row.url, credit: 'National Gallery of Art · CC0' }, row.provenance);
  }),
];
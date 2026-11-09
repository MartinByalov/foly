import { source, pickOne, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const TERMS = 'https://www.naturalearthdata.com/about/terms-of-use/';
const maps = [
  { id: 3259, title: 'Countries of the world', file: 'banner_countries.png',
    path: '10m-cultural-vectors/10m-admin-0-countries/attachment/banner_countries/' },
  { id: 2783, title: 'Rivers of Europe', file: 'Eur_Riv_banner2.png',
    path: '10m-physical-vectors/10m-rivers-lake-centerlines/attachment/eur_riv_banner2/' },
];

export default [source('naturalEarth', 'Natural Earth', 'Maps', async ({ json, random }) => {
  const selected = pickOne(random, maps);
  const evidence = `https://www.naturalearthdata.com/wp-json/wp/v2/media/${selected.id}`;
  const row = await json(evidence);
  const image = `https://www.naturalearthdata.com/wp-content/uploads/2009/09/${selected.file}`;
  const url = `https://www.naturalearthdata.com/downloads/${selected.path}`;
  // Only reviewed map previews fall under the map-data declaration, not arbitrary site photographs.
  if (row.id !== selected.id || row.type !== 'attachment' || row.media_type !== 'image' ||
    row.mime_type !== 'image/png' || row.source_url !== image || row.link !== url ||
    row.media_details?.file !== `2009/09/${selected.file}` ||
    !(Number(row.media_details.width) >= 500) || !(Number(row.media_details.height) >= 100) ||
    row.media_details.image_meta?.copyright) fail('Unreviewed Natural Earth map');
  const raw = { title: selected.title, subject: 'Cartography', image, url,
    description: 'A map preview from Natural Earth. Explore the source for the complete geographic dataset.',
    credit: 'Made with Natural Earth · Public Domain' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'PUBLIC_DOMAIN',
    mediaLicenseUrl: TERMS, evidence });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete map rights');
  return raw;
})];
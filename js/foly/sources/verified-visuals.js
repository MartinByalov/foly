import { source, pickOne, fail } from './util.js';
import { discoveryLicense, rightsEvidence, validateDiscoveryRights } from '../rights.js';
import { isSuitable } from '../safety.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const NASA_TERMS = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';
const NASA_ITEMS = [
  { id: 'GSFC_20171208_Archive_e001386', credit: 'NASA/NOAA/GSFC/Suomi NPP/VIIRS/Norman Kuring' },
];
const uuid = value => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value || '');
const alaImage = value => /^https:\/\/images\.ala\.org\.au\/store\/[a-f0-9]\/[a-f0-9]\/[a-f0-9]\/[a-f0-9]\/[a-f0-9-]{36}\/original$/.test(value || '');

function licensed(raw, metadataLicense, mediaLicenseUrl, evidence) {
  const result = { ...raw, rights: rightsEvidence({ ...raw, metadataLicense,
    mediaLicense: discoveryLicense(mediaLicenseUrl), mediaLicenseUrl, evidence }) };
  if (!validateDiscoveryRights(result).ok) fail('Incomplete visual rights');
  return result;
}

export default [
  source('nasaLibrary', 'NASA Image and Video Library', 'Earth', async ({ json, random }) => {
    // Explicitly reviewed instrument imagery only; a NASA host alone never clears third-party work.
    const selected = pickOne(random, NASA_ITEMS);
    const evidence = `https://images-api.nasa.gov/search?nasa_id=${selected.id}`;
    const response = await json(evidence);
    const item = response.collection?.items?.find(row => row.data?.some(data => data.nasa_id === selected.id));
    const data = item?.data?.find(row => row.nasa_id === selected.id);
    if (!data || data.center !== 'GSFC' || data.media_type !== 'image' || !data.title ||
      !data.description?.includes(`Credit: ${selected.credit}`) ||
      /copyright|all rights reserved|©/i.test(data.description) || data.secondary_creator ||
      item.href !== `https://images-assets.nasa.gov/image/${selected.id}/collection.json`) fail('Unreviewed NASA item');
    const expected = `https://images-assets.nasa.gov/image/${selected.id}/${selected.id}~small.jpg`;
    const image = item.links?.find(link => link.render === 'image' && link.width === 640 && link.href === expected)?.href;
    if (!image) fail('No provider-supplied NASA image');
    return licensed({ title: data.title, subject: 'Satellite imagery', image,
      url: `https://images.nasa.gov/details/${selected.id}`, credit: selected.credit,
      creator: selected.credit, attribution: selected.credit }, 'US_GOV_PUBLIC_DOMAIN', NASA_TERMS, evidence);
  }),
  source('alaImages', 'Atlas of Living Australia', 'Nature', async ({ json, random }) => {
    const query = 'license:"http://creativecommons.org/publicdomain/zero/1.0/" AND NOT dataResourceUid:dr1411';
    const search = `https://images.ala.org.au/ws/search?${new URLSearchParams({ q: query, pageSize: '20' })}`;
    const response = await json(search);
    const candidates = response.images?.filter(row => uuid(row.imageIdentifier) &&
      row.format === 'image/jpeg' && discoveryLicense(row.license) === 'CC0' && row.dataResourceUid !== 'dr1411');
    const row = pickOne(random, candidates);
    if (!row) fail('No CC0 ALA image');
    const evidence = `https://images.ala.org.au/ws/image/${row.imageIdentifier}`;
    const detail = await json(evidence);
    if (detail.success !== true || detail.imageIdentifier !== row.imageIdentifier || detail.type !== 'StillImage' ||
      detail.mimeType !== 'image/jpeg' || discoveryLicense(detail.license) !== 'CC0' ||
      detail.recognisedLicence?.url !== CC0 || !alaImage(detail.imageUrl) ||
      !detail.imageUrl.includes(`/${row.imageIdentifier}/`) || detail.rights?.trim() ||
      !isSuitable({ title: detail.title, description: detail.description })) fail('Unreviewed ALA image');
    const title = detail.title?.trim() || detail.description?.trim() || 'A biodiversity specimen';
    return licensed({ title, subject: 'Biodiversity collection', image: detail.imageUrl,
      url: `https://images.ala.org.au/image/${row.imageIdentifier}`,
      credit: `${detail.creator || detail.rightsHolder || 'Atlas of Living Australia'} · CC0` }, 'CC0', CC0, evidence);
  }),
];
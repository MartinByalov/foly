import { source, int, pickOne, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const BASE = 'https://api.biodiversitydata.nl/v2/multimedia/query/';
export default [source('naturalis', 'Naturalis Biodiversity Center', 'Nature', async ({ json, random }) => {
  const evidence = `${BASE}?${new URLSearchParams({ license: 'CC0', 'sourceSystem.code': 'NSR',
    _size: '20', _from: String(int(random, 100)) })}`;
  const response = await json(evidence);
  if (!Array.isArray(response?.resultSet)) fail('Invalid Naturalis response');
  const candidates = [];
  for (const { item } of response.resultSet) {
    if (item?.license !== 'CC0' || item.sourceSystem?.code !== 'NSR' ||
      item.sourceInstitutionID !== 'Naturalis Biodiversity Center' || item.owner !== 'Naturalis Biodiversity Center' ||
      !/^[A-Za-z0-9-]{3,80}@NSR$/.test(item.id || '') || item.id !== `${item.sourceSystemId}@NSR`) continue;
    const species = item.identifications?.find(row => row.taxonRank === 'species' &&
      row.defaultClassification?.kingdom === 'Animalia' &&
      /^[A-Z][a-z]{1,50}$/.test(row.scientificName?.genusOrMonomial || '') &&
      /^[a-z]{2,60}$/.test(row.scientificName?.specificEpithet || ''))?.scientificName;
    const image = item.serviceAccessPoints?.find(media => media.format === 'image/jpeg' &&
      /^https:\/\/images\.naturalis\.nl\/original\/[A-Za-z0-9_().%-]+\.jpg$/.test(media.accessUri || '') &&
      !/%(?:2e|2f|5c|00)/i.test(media.accessUri) && !media.accessUri.includes('..'))?.accessUri;
    if (species && image) candidates.push({ item, species, image });
  }
  const selected = pickOne(random, candidates);
  if (!selected) fail('No individually CC0 Naturalis animal image');
  const { item, species, image } = selected;
  const raw = { title: `${species.genusOrMonomial} ${species.specificEpithet}`, subject: 'Animal observation',
    description: 'An animal recorded in the Dutch Species Register.', image,
    url: `${BASE}?${new URLSearchParams({ sourceSystemId: item.sourceSystemId, 'sourceSystem.code': 'NSR', _size: '1' })}`,
    sourcePageUrl: 'https://bioportal.naturalis.nl/en/',
    credit: item.creator ? `${item.creator}. Naturalis Biodiversity Center. CC0.` : 'Naturalis Biodiversity Center. CC0.' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC0',
    mediaLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', evidence });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete Naturalis rights');
  return raw;
})];
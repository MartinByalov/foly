import { source, pickOne, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const ORIGIN = 'https://kokoelma.kansallisgalleria.fi';
const PROVENANCE = `${ORIGIN}/api/v1/objects`;
const METADATA = 'https://www.avoindata.fi/data/api/3/action/package_show?id=4d6bbc3f-792e-458d-818e-7cafd6daa288';
export default [source('finnishGallery', 'Finnish National Gallery', 'Art', async ({ json, random }) => {
  const dataset = await json(new URL('../../../data/foly-fng.json', import.meta.url).href);
  if (dataset?.metadataEvidence !== METADATA || dataset.mediaEvidence !== `${ORIGIN}/docs/swagger.json` ||
    !/^[a-f0-9]{64}$/.test(dataset.prefixSha256 || '')) fail('Unreviewed FNG dataset');
  const row = pickOne(random, dataset.items?.filter(item => Number.isSafeInteger(item.objectId) && item.objectId > 0 &&
    Number.isSafeInteger(item.mediaId) && item.mediaId > 0 && item.metadataLicense === 'CC0' && item.mediaLicense === 'CC0' &&
    item.provenance === PROVENANCE && item.metadataEvidence === METADATA &&
    item.image === `${ORIGIN}/media-assets/1/jpg/1000/${item.mediaId}.jpg` &&
    item.url === `${ORIGIN}/en/object/${item.objectId}` && /^[a-f0-9]{64}$/.test(item.mediaSha256 || '') &&
    typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 200));
  if (!row) fail('No individually licensed FNG image');
  const raw = { title: row.title, subject: 'Museum collection', image: row.image, url: row.url,
    credit: 'Finnish National Gallery. CC0.' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC0',
    metadataLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    mediaLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', evidence: PROVENANCE });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete FNG image rights');
  return raw;
})];
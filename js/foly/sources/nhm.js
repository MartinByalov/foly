import { source, int, pickOne, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const RESOURCE = '05ff2255-c38a-40c9-b657-4ccb55ab2feb';
const BY = 'https://creativecommons.org/licenses/by/4.0/';
const HOLDER = 'The Trustees of the Natural History Museum, London';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

async function nhmFetch({ json, random, retry = false }) {
  const metadata = await json('https://data.nhm.ac.uk/api/3/action/package_show?id=collection-specimens');
  if (metadata?.success !== true || metadata.result?.name !== 'collection-specimens' ||
    metadata.result.license_id !== 'CC0-1.0' || metadata.result.private !== false ||
    metadata.result.organization?.name !== 'nhm' || !metadata.result.resources?.some(row => row.id === RESOURCE)) {
    fail('Unreviewed NHM dataset metadata rights');
  }
  const params = new URLSearchParams({ resource_id: RESOURCE,
    filters: JSON.stringify({ collectionCode: 'BOT', associatedMediaCount: 1 }), limit: '20', offset: String(int(random, 1000)) });
  const evidence = `https://data.nhm.ac.uk/api/3/action/datastore_search?${params}`;
  const response = await json(evidence);
  if (response?.success !== true || !Array.isArray(response.result?.records)) fail('Invalid NHM specimen response');
  const candidates = [];
  for (const row of response.result.records) {
    if (row.institutionCode !== 'NHMUK' || row.collectionCode !== 'BOT' || row.basisOfRecord !== 'PreservedSpecimen' ||
      !UUID.test(row.occurrenceID || '') || typeof row.scientificName !== 'string' ||
      !/^[A-Za-z][A-Za-z .()'-]{2,159}$/.test(row.scientificName) || !Array.isArray(row.associatedMedia)) continue;
    for (const media of row.associatedMedia) {
      if (media?.type !== 'StillImage' || media.category !== 'Specimen' || media.rightsHolder !== HOLDER ||
        ![BY, 'http://creativecommons.org/licenses/by/4.0/'].includes(media.license) || !UUID.test(media.assetID || '') ||
        media.identifier !== `https://data.nhm.ac.uk/media/${media.assetID}` ||
        typeof media.title !== 'string' || !/^[A-Za-z0-9 .()_-]{1,160}$/.test(media.title)) continue;
      candidates.push({ row, media });
    }
  }
  const selected = pickOne(random, candidates);
  if (!selected) {
    if (!retry) return nhmFetch({ json, random: () => 0, retry: true });
    fail('No individually licensed NHM botanical image');
  }
  const { row, media } = selected;
  const raw = { title: row.scientificName, subject: 'Botanical specimen',
    description: 'A preserved plant specimen from the Natural History Museum in London.',
    image: media.identifier, url: `https://data.nhm.ac.uk/object/${row.occurrenceID}`, credit: HOLDER };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC_BY', mediaLicenseUrl: BY,
    evidence, creator: HOLDER, mediaTitle: media.title, originalMediaUrl: media.identifier,
    attribution: `Copyright ${HOLDER}. CC BY 4.0.`, changes: 'No modifications by Foly; displayed at a scaled size.' });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete NHM image rights');
  return raw;
}

export default [source('nhmLondon', 'Natural History Museum, London', 'Botany', nhmFetch)];
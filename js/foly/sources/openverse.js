import { source, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';
import { isSuitable } from '../safety.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const id = 'f7da45f0-db49-4d45-9854-56ea68add8f5';
const evidence = `https://api.openverse.org/v1/images/${id}/`;

export default [source('openverse', 'Openverse', 'Photography', async ({ json }) => {
  const row = await json(evidence);
  // This reviewed botanical photo has no people, trademarks or sensitive subject matter.
  if (row.id !== id || row.license !== 'cc0' || row.license_version !== '1.0' || row.license_url !== CC0 ||
    row.mature !== false || !Array.isArray(row.unstable__sensitivity) || row.unstable__sensitivity.length ||
    row.source !== 'flickr' || row.provider !== 'flickr' ||
    row.foreign_landing_url !== 'https://www.flickr.com/photos/88123769@N02/14063342357' ||
    row.url !== 'https://live.staticflickr.com/2921/14063342357_29c4da5869_b.jpg' ||
    !row.title?.trim() || !row.creator?.trim() || !isSuitable({ title: row.title })) fail('Unreviewed Openverse image');
  const raw = { title: row.title, subject: 'Botanical photography', image: row.url,
    url: row.foreign_landing_url, credit: `${row.creator} · CC0` };
  // Copy only factual catalogue fields, not contributor descriptions or attribution prose.
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC0',
    mediaLicenseUrl: CC0, evidence, creator: row.creator, attribution: raw.credit });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete Openverse rights');
  return raw;
})];
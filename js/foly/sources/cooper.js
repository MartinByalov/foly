import { source, pickOne, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const query = '{object(size:50,hasImages:true,general:"vase"){id title multimedia}}';
const EVIDENCE = `https://api.cooperhewitt.org/?query=${encodeURIComponent(query)}`;
export default [source('cooperHewitt', 'Cooper Hewitt, Smithsonian Design Museum', 'Design', async ({ json, random }) => {
  const data = await json(new URL('../../../data/foly-cooper.json', import.meta.url).href);
  if (data?.metadataEvidence !== 'https://www.cooperhewitt.org/open-source-at-cooper-hewitt/' ||
    data.mediaEvidence !== 'https://apidocs.cooperhewitt.org/images-and-other-media/' ||
    !/^[a-f0-9]{64}$/.test(data.responseSha256 || '')) fail('Unreviewed Cooper Hewitt dataset');
  const row = pickOne(random, data.items?.filter(item => /^object-\d+$/.test(item.objectId || '') &&
    /^media-\d+$/.test(item.mediaId || '') && item.cc0 === true && item.metadataLicense === 'CC0' &&
    item.mediaLicense === 'CC0' && item.evidence === EVIDENCE &&
    item.url === `https://api.cooperhewitt.org/?query=${encodeURIComponent(`{object(id:"${item.objectId}"){id title multimedia}}`)}` &&
    /^https:\/\/ciim-static-media\.s3\.us-east-1\.amazonaws\.com\/\d+\/\d+\/large_[A-Za-z0-9_-]+\.jpg$/.test(item.image || '') &&
    Number(new URL(item.image).pathname.split('/').slice(1, 3).join('')) === Number(item.mediaId.slice(6)) &&
    /^[a-f0-9]{64}$/.test(item.mediaSha256 || '') && item.title === 'A design object from Cooper Hewitt'));
  if (!row) fail('No individually CC0 Cooper Hewitt image');
  const raw = { title: row.title, subject: 'Design collection', image: row.image, url: row.url,
    credit: 'Cooper Hewitt, Smithsonian Design Museum. CC0.' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC0',
    mediaLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', evidence: row.evidence });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete Cooper Hewitt image rights');
  return raw;
})];
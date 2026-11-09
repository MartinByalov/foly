import { source, pickOne, fail, text } from './util.js';
import { discoveryLicense, rightsEvidence, validateDiscoveryRights } from '../rights.js';
import { isSuitable } from '../safety.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
// Reviewed collection objects, not separate API entries. Rights are checked again on every request.
const records = [
  '/401/item_FDEZFFPSJNUMPHVMMOPXGLI7MTY73SHS',
  '/401/item_VMHPNHAEAQ4VZHR6A3S572VGR7XJDFRK',
  '/401/item_45MCN2PBYTAB6Z575TR4L76S76N7U3Z4',
  '/401/item_EAIYJZK3E2MGQXG43V6OOPO7KODHDQ76',
];
const mediaUrl = value => {
  try {
    const url = new URL(value);
    return url.origin === 'https://www.muis.ee' && url.pathname === '/digitaalhoidla/api/meedia/originaal' &&
      !url.username && !url.password && !url.hash && [...url.searchParams.keys()].length === 1 &&
      /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(url.searchParams.get('id') || '');
  } catch { return false; }
};

export default [source('europeana', 'Europeana', 'Art', async ({ json, random }) => {
  const id = pickOne(random, records);
  const params = new URLSearchParams({ wskey: 'api2demo', query: `europeana_id:"${id}"`,
    reusability: 'open', media: 'true', rows: '1' });
  const search = await json(`https://api.europeana.eu/record/v2/search.json?${params}`);
  if (search.success !== true || !search.items?.some(row => row.id === id &&
    row.rights?.length === 1 && discoveryLicense(row.rights[0]) === 'CC0')) fail('No open Europeana result');
  const evidence = `https://api.europeana.eu/record/v2${id}.json?wskey=api2demo`;
  const response = await json(evidence);
  const object = response.object;
  if (response.success !== true || object?.about !== id) fail('Unmatched Europeana record');
  const aggregation = object.aggregations?.find(row => row.aggregatedCHO === `/item${id}` &&
    row.edmRights?.def?.length === 1 && discoveryLicense(row.edmRights.def[0]) === 'CC0' &&
    mediaUrl(row.edmIsShownBy) && row.webResources?.some(resource => resource.about === row.edmIsShownBy &&
      resource.ebucoreHasMimeType === 'image/jpeg'));
  if (!aggregation) fail('No individually cleared Europeana image');
  const url = `https://www.europeana.eu/item${id}`;
  if (object.europeanaAggregation?.edmLandingPage !== url) fail('Unmatched Europeana destination');
  const image = object.europeanaAggregation?.edmPreview;
  let preview;
  try { preview = new URL(image); } catch { fail('No Europeana preview'); }
  if (preview.origin !== 'https://api.europeana.eu' || preview.pathname !== '/thumbnail/v2/url.json' ||
    preview.searchParams.get('uri') !== aggregation.edmIsShownBy || preview.searchParams.get('type') !== 'IMAGE' ||
    [...preview.searchParams.keys()].length !== 2 || preview.hash || preview.username || preview.password) {
    fail('Unbound Europeana preview');
  }
  const titles = object.proxies?.flatMap(proxy => proxy.dcTitle?.en || proxy.dcTitle?.et || []) || [];
  const title = titles.map(text).find(value => value.trim());
  if (!title || !isSuitable({ title })) fail('No suitable Europeana title');
  const raw = { title, subject: 'Museum collection', image, url,
    credit: 'Europeana · CC0' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: 'CC0',
    mediaLicenseUrl: CC0, evidence });
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete Europeana rights');
  return raw;
})];
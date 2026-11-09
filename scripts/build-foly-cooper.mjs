import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const query = '{object(size:50,hasImages:true,general:"vase"){id title multimedia}}';
const evidence = `https://api.cooperhewitt.org/?query=${encodeURIComponent(query)}`;
const response = await fetch(evidence, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw Error(`Cooper Hewitt HTTP ${response.status}`);
const body = await response.text();
const data = JSON.parse(body);
if (data.errors || !Array.isArray(data.data?.object)) throw Error('Invalid Cooper Hewitt catalogue');
const items = [];
for (const object of data.data.object) {
  if (!/^object-\d+$/.test(object.id || '')) continue;
  const media = object.multimedia?.find(row => row.cc0 === true && row.type === 'image' &&
    /^media-\d+$/.test(row.id || '') && row.large?.format === 'jpeg' &&
    /^https:\/\/ciim-static-media\.s3\.us-east-1\.amazonaws\.com\/\d+\/\d+\/large_[A-Za-z0-9_-]+\.jpg$/.test(row.large.url || ''));
  if (!media) continue;
  const file = await fetch(media.large.url, { signal: AbortSignal.timeout(15000) });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!file.ok || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) continue;
  items.push({ objectId: object.id, mediaId: media.id, cc0: true, image: media.large.url,
    title: 'A design object from Cooper Hewitt',
    url: `https://api.cooperhewitt.org/?query=${encodeURIComponent(`{object(id:"${object.id}"){id title multimedia}}`)}`,
    metadataLicense: 'CC0', mediaLicense: 'CC0', evidence,
    mediaSha256: createHash('sha256').update(bytes).digest('hex') });
}
if (items.length < 3) throw Error(`Only ${items.length} verified Cooper Hewitt images`);
await writeFile(new URL('../data/foly-cooper.json', import.meta.url), JSON.stringify({
  built: new Date().toISOString(), responseSha256: createHash('sha256').update(body).digest('hex'),
  metadataEvidence: 'https://www.cooperhewitt.org/open-source-at-cooper-hewitt/',
  mediaEvidence: 'https://apidocs.cooperhewitt.org/images-and-other-media/', items,
}, null, 2) + '\n');
console.log(`Cooper Hewitt: ${items.length} separately CC0 images. One provider.`);
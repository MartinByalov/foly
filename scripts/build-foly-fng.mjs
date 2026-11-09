import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const provenance = 'https://kokoelma.kansallisgalleria.fi/api/v1/objects';
const metadataEvidence = 'https://www.avoindata.fi/data/api/3/action/package_show?id=4d6bbc3f-792e-458d-818e-7cafd6daa288';
const metadata = await (await fetch(metadataEvidence, { signal: AbortSignal.timeout(20000) })).json();
if (metadata.success !== true || metadata.result?.license_id !== 'cc-zero-1.0' ||
  metadata.result.organization?.name !== 'kansallisgalleria' ||
  !metadata.result.resources?.some(row => row.url === 'https://www.kansallisgalleria.fi/api/swagger')) {
  throw Error('Unreviewed Finnish National Gallery metadata rights');
}
const response = await fetch(provenance, { signal: AbortSignal.timeout(60000), headers: { 'Accept-Encoding': 'gzip' } });
if (!response.ok) throw Error(`FNG HTTP ${response.status}`);
// The official dump is large. Parse only a bounded prefix into complete records.
const reader = response.body.getReader();
const decoder = new TextDecoder();
let prefix = '';
try {
  while (prefix.length < 4000000) {
    const chunk = await reader.read();
    if (chunk.done) break;
    prefix += decoder.decode(chunk.value, { stream: true });
  }
} finally { await reader.cancel(); }
const end = prefix.lastIndexOf('\n  },');
if (end < 0) throw Error('No complete FNG records');
const records = JSON.parse(prefix.slice(0, end + 4) + ']');
const items = [];
for (const row of records) {
  if (!Number.isSafeInteger(row.objectId) || row.category?.categoryId !== 'artwork' ||
    !/landscape|flower|tree|forest|lake|garden|bird|boat|still life/i.test(row.title?.en || '') ||
    /nude|naked|dead|death|battle|war|hunting/i.test(row.title.en)) continue;
  const media = row.multimedia?.find(item => item.license === 'CC0' && item.filename_extension === '.jpg' &&
    Number.isSafeInteger(item.id) && item.jpg?.['1000'] === `/media-assets/1/jpg/1000/${item.id}.jpg`);
  if (!media) continue;
  const image = `https://kokoelma.kansallisgalleria.fi${media.jpg['1000']}`;
  try {
    const file = await fetch(image, { signal: AbortSignal.timeout(15000) });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!file.ok || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) continue;
    items.push({ objectId: row.objectId, mediaId: media.id, title: row.title.en,
      image, url: `https://kokoelma.kansallisgalleria.fi/en/object/${row.objectId}`,
      metadataLicense: 'CC0', mediaLicense: media.license, provenance, metadataEvidence,
      mediaSha256: createHash('sha256').update(bytes).digest('hex') });
  } catch { continue; }
  if (items.length === 12) break;
}
if (items.length < 3) throw Error(`Only ${items.length} verified FNG images`);
await writeFile(new URL('../data/foly-fng.json', import.meta.url), JSON.stringify({
  reviewedAt: '2026-11-03', built: new Date().toISOString(),
  prefixSha256: createHash('sha256').update(prefix).digest('hex'),
  metadataEvidence, mediaEvidence: 'https://kokoelma.kansallisgalleria.fi/docs/swagger.json', items,
}, null, 2) + '\n');
console.log(`Finnish National Gallery: ${items.length} individually CC0 images. One dataset provider, not ${items.length} APIs.`);
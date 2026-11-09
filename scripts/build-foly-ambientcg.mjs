// A small, reproducible browser-readable subset. Asset previews are independently covered by CC0.
import { writeFile } from 'node:fs/promises';
import { fetchJson } from '../js/foly/resolver.js';

const ids = ['Bark016', 'Fabric086', 'Bricks001', 'Bricks002', 'Concrete001', 'Concrete002',
  'Wood001', 'Wood002', 'Ground001', 'Ground002', 'Grass001', 'Gravel001', 'Metal001',
  'Marble001', 'Tiles001', 'Tiles002', 'Rock001'];
const items = [];
for (const id of ids) {
  const provenance = `https://ambientcg.com/api/v2/full_json?id=${id}&limit=1`;
  const data = await fetchJson(provenance, { timeout: 15000 });
  const row = data.foundAssets?.find(row => row.assetId === id && row.dataType === 'Material');
  const image = row?.previewImage?.['512-JPG-FFFFFF'];
  if (image !== `https://acg-media.struffelproductions.com/file/ambientCG-Web/media/thumbnail/512-JPG-FFFFFF/${id}.jpg`) {
    throw Error(`Missing or changed official preview for ${id}`);
  }
  const response = await fetch(image, { signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw Error(`Undeliverable ${id}`);
  await response.arrayBuffer();
  items.push({ id, image, provenance, metadataLicense: 'CC0', mediaLicense: 'CC0' });
}
await writeFile(new URL('../data/foly-ambientcg.json', import.meta.url), JSON.stringify({
  provider: 'ambientcg', reviewedAt: '2026-11-02', terms: 'https://docs.ambientcg.com/license/', items,
}, null, 2) + '\n');
console.log(`Built ${items.length} ambientCG records. This is one provider, not ${items.length}.`);
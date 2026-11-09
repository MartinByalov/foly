import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { manuscriptProviders, manuscriptDiscovery } from '../js/foly/sources/manuscripts.js';

const providers = {};
for (const provider of manuscriptProviders.filter(row => row.id === 'heidelbergLibrary')) {
  const evidence = provider.manifests[0];
  const response = await fetch(evidence, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw Error(`Manifest HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const manifest = JSON.parse(bytes);
  // Keep only the image-bearing canvas declarations. No catalogue descriptions are shipped.
  const selected = [];
  const media = [];
  for (const index of [5, 20, 50, 80]) {
    const canvas = manifest.sequences?.[0]?.canvases?.[index];
    if (!canvas) throw Error('Missing selected canvas');
    const narrowed = { license: manifest.license, sequences: [{ canvases: [canvas] }] };
    const raw = manuscriptDiscovery(narrowed, provider, evidence, () => 0);
    const image = await fetch(raw.image, { signal: AbortSignal.timeout(20000) });
    const content = Buffer.from(await image.arrayBuffer());
    if (!image.ok || content[0] !== 255 || content[1] !== 216 || content[2] !== 255) throw Error('Selected image is not a delivered JPEG');
    const body = canvas.images[0].resource;
    selected.push({ '@id': canvas['@id'], '@type': 'sc:Canvas', label: canvas.label, images: [{ resource: body }] });
    media.push({ image: raw.image, sha256: createHash('sha256').update(content).digest('hex') });
  }
  providers[provider.id] = { evidence, sha256: createHash('sha256').update(bytes).digest('hex'),
    manifest: { license: manifest.license, sequences: [{ canvases: selected }] }, media };
}
await writeFile(new URL('../data/foly-manuscripts.json', import.meta.url), JSON.stringify({
  builtAt: new Date().toISOString(), metadataStatement: 'Foly-authored display text is CC0. No provider catalogue prose is reproduced.', providers,
}, null, 2) + '\n');
console.log('Built one independently reviewed Heidelberg dataset with four images.');
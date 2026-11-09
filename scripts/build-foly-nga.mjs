// Reproducible, pinned CC0 catalogue subset. Image permission is checked independently per row.
import { writeFile } from 'node:fs/promises';
const revision = '153be7170c4d4e2192270c52c67398ba642b5158';
const base = `https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/${revision}/data/`;
function csv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (char === ',' || char === '\n')) {
      row.push(cell.replace(/\r$/, '')); cell = '';
      if (char === '\n') { rows.push(row); row = []; }
    } else cell += char;
  }
  if (quoted) throw Error('Unclosed CSV quote');
  if (cell || row.length) rows.push([...row, cell.replace(/\r$/, '')]);
  const headers = rows.shift();
  return rows.filter(row => row.length === headers.length).map(row => Object.fromEntries(headers.map((name, i) => [name, row[i]])));
}
const [objects, images] = await Promise.all(['objects.csv', 'published_images.csv'].map(async file => {
  const response = await fetch(base + file, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error(`Catalogue HTTP ${response.status}`);
  return csv(await response.text());
}));
const byId = new Map(objects.map(row => [row.objectid, row]));
const items = [];
for (const image of images) {
  const object = byId.get(image.depictstmsobjectid);
  if (image.openaccess !== '1' || image.viewtype !== 'primary' || !object?.title ||
    !/^https:\/\/api\.nga\.gov\/iiif\/[a-f0-9-]{36}$/.test(image.iiifurl)) continue;
  const url = `${image.iiifurl}/full/!640,640/0/default.jpg`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    await response.body?.cancel();
    if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) continue;
  } catch { continue; }
  items.push({ title: object.title, artist: object.attribution, image: url,
    url: `https://www.nga.gov/artworks/${object.objectid}`, openaccess: image.openaccess,
    metadataLicense: 'CC0', mediaLicense: 'CC0', provenance: base + 'published_images.csv' });
  if (items.length === 30) break;
}
if (items.length < 10) throw Error('Insufficient verified NGA images');
await writeFile(new URL('../data/foly-nga.json', import.meta.url), JSON.stringify({ revision, built: new Date().toISOString(), items }, null, 2) + '\n');
console.log(`NGA: ${items.length} individually open-access images, one dataset provider`);
import { readFile, writeFile } from 'node:fs/promises';

const met = JSON.parse(await readFile(new URL('../data/collection.json', import.meta.url), 'utf8'));
const usedTitles = new Set(met.map(item => item.title.trim().toLowerCase()));
const records = [];
for (const page of [1, 2]) {
  if (records.length === 10) break;
  const url = `https://api.artic.edu/api/v1/artworks/search?query[term][is_public_domain]=true&limit=25&page=${page}&fields=id,title,image_id,artist_title,date_display,is_public_domain`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Chicago API HTTP ${response.status}`);
  const data = await response.json();
  for (const item of data.data || []) {
    if (records.length === 10) break;
    if (item.is_public_domain !== true || !item.image_id || !item.title ||
        usedTitles.has(item.title.trim().toLowerCase())) continue;
    const image = `https://www.artic.edu/iiif/2/${item.image_id}/full/843,/0/default.jpg`;
    records.push({ id: item.id, title: item.title, image,
      fullImage: `https://www.artic.edu/iiif/2/${item.image_id}/full/1686,/0/default.jpg`,
      detail: [item.artist_title, item.date_display].filter(Boolean).join(' · '),
      url: `https://www.artic.edu/artworks/${item.id}` });
    usedTitles.add(item.title.trim().toLowerCase());
  }
}
if (records.length !== 10) throw new Error('Expected 10 verified Chicago artworks');
await writeFile(new URL('../data/chicago.json', import.meta.url), JSON.stringify(records, null, 2) + '\n');
console.log('Chicago records:', records.length);
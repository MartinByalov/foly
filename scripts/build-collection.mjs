// Run manually to refresh the committed, rights-checked offline snapshot.
import { writeFile } from 'node:fs/promises';

const groups = [
  ['portrait', 12], ['armor', 12], ['landscape', 12], ['musical instrument', 12],
  ['photograph', 12], ['ancient egypt', 12], ['bird', 12], ['sculpture', 12],
  ['painting', 12], ['art', 100],
];
const base = 'https://collectionapi.metmuseum.org/public/collection';
const records = [];
const seen = new Set();
const titleCount = new Map();

async function request(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url);
    if (response.ok) return response.json();
    if (response.status !== 403 && response.status !== 429) throw new Error(`${response.status} ${url}`);
    await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
  }
  throw new Error(`Rate limited: ${url}`);
}

async function collect(query, ids, amount) {
  let count = 0;
  for (const id of ids) {
    if (count === amount) break;
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const item = await request(`${base}/v1/objects/${id}`);
      if (item.isPublicDomain !== true || !item.title ||
          !/^https:\/\/images\.metmuseum\.org\//.test(item.primaryImageSmall || '') ||
          !/^https:\/\/(www\.)?metmuseum\.org\//.test(item.objectURL || '')) continue;
      const title = item.title.trim();
      if ((titleCount.get(title.toLowerCase()) || 0) >= 2) continue;
      records.push({ id, category: query, title: item.title,
        image: item.primaryImageSmall, fullImage: item.primaryImage || item.primaryImageSmall,
        detail: [item.artistDisplayName, item.objectDate, item.medium].filter(Boolean).join(' · ').slice(0, 240),
        url: item.objectURL });
      titleCount.set(title.toLowerCase(), (titleCount.get(title.toLowerCase()) || 0) + 1);
      count++;
    } catch { /* An unavailable record is not admitted into the snapshot. */ }
  }
  console.log(query, count, 'total', records.length);
}

for (const [query, amount] of groups) {
  if (records.length === 100) break;
  const data = await request(`${base}/v1.1/search?hasImages=true&isPublicDomain=true&limit=80&q=${encodeURIComponent(query)}`);
  await collect(query, data.objectIDs || [], Math.min(amount, 100 - records.length));
}

for (let offset = 0; records.length < 100 && offset < 1000; offset += 80) {
  const data = await request(`${base}/v1.1/search?hasImages=true&isPublicDomain=true&limit=80&offset=${offset}&q=art`);
  await collect('art', data.objectIDs || [], 100 - records.length);
}

if (records.length !== 100 || new Set(records.map(item => item.id)).size !== 100)
  throw new Error('Expected exactly 100 unique verified objects');
await writeFile(new URL('../data/collection.json', import.meta.url), JSON.stringify(records, null, 2) + '\n');

export function localDay(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function hash(text) {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

export function makeFormats(records, date) {
  if (!Array.isArray(records) || records.length !== 100) throw new Error('Expected 100 collection records');
  const offset = hash(localDay(date)) % records.length;
  const rotated = records.slice(offset).concat(records.slice(0, offset)).slice(0, 97);
  const collection = rotated.map(record => ({
    id: `met-${record.id}`, title: record.title, group: 'see', record, source: 'met',
  }));
  collection.splice(12, 0, { id: 'moon', title: 'Moon phase', group: 'today', source: 'local' });
  collection.splice(26, 0, { id: 'skyline', title: 'City skyline', group: 'see', source: 'video' });
  collection.splice(38, 0, { id: 'earthquake', title: 'Recent earthquake', group: 'today', source: 'usgs' });
  return collection;
}
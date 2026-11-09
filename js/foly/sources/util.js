// Shared helpers for source adapters. An adapter is { id, name, category, fetch({ json, random }) }
// and returns a raw discovery: { title, subject, subtitle, description, quote, reveal, image, thumb, url, credit }.

export const source = (id, name, category, fetch, visualType = 'image') => ({ id, name, category, fetch, visualType });

export const int = (random, max) => Math.floor(random() * max);
export const pickOne = (random, items) => items?.length ? items[int(random, items.length)] : undefined;
export const pad = value => String(value).padStart(2, '0');
export const join = (...parts) => parts.flat().filter(part => part != null && String(part).trim()).join(' · ');
export const https = value => typeof value === 'string' ? value.replace(/^http:\/\//, 'https://') : value;
export const randomDate = (random, from) => {
  const first = from.getTime(), last = Date.now() - 864e5;
  return new Date(first + int(random, (last - first) / 864e5) * 864e5);
};
export const isoDay = date => `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`;

// Fetches a list once per page load and reuses it for later draws.
const memo = new Map();
export const once = (key, load) => {
  if (!memo.has(key)) memo.set(key, load().catch(error => { memo.delete(key); throw error; }));
  return memo.get(key);
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
export const text = html => String(html ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]*>/g, '')
  .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (match, code) => {
    if (code[0] === '#') return String.fromCodePoint(code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1)));
    return ENTITIES[code.toLowerCase()] ?? match;
  })
  .replace(/[ \t\r\f\v]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();

export const fail = reason => { throw new Error(reason); };

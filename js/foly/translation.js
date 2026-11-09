import { normalizeLanguage, t } from './locale.js';
import { fetchJson } from './resolver.js';

// MyMemory GET accepts at most 500 UTF-8 bytes per segment.
export function translationSegments(text, limit = 480) {
  if (!Number.isInteger(limit) || limit < 4 || limit > 500) throw new RangeError('Invalid translation byte limit');
  const segments = [];
  let remaining = String(text);
  const encoder = new TextEncoder();
  while (remaining) {
    let segment = '';
    let bytes = 0;
    for (const character of remaining) {
      const size = encoder.encode(character).length;
      if (bytes + size > limit) break;
      segment += character;
      bytes += size;
    }
    if (segment.length < remaining.length) {
      const boundaries = [...segment.matchAll(/[.!?。！？]\s+|\s+/gu)];
      const sentences = boundaries.filter(match => /[.!?。！？]/u.test(match[0]));
      const boundary = sentences.at(-1) || boundaries.at(-1);
      if (boundary && boundary.index > 0) segment = segment.slice(0, boundary.index + boundary[0].length);
    }
    segments.push(segment);
    remaining = remaining.slice(segment.length);
  }
  return segments;
}

export function createTranslationClient({ json = fetchJson, delay = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  const cache = new Map();
  let queue = Promise.resolve();
  const request = url => {
    const pending = queue.then(async () => {
      for (let attempt = 0; ; attempt++) {
        try { return await json(url); }
        catch (error) {
          if (attempt >= 1 || !/HTTP (?:502|503|504)|fetch failed|failed to fetch|network|timeout|aborted/i.test(error.message)) throw error;
          await delay(300);
        }
      }
    });
    queue = pending.catch(() => {});
    return pending;
  };
  return async (text, from, to) => {
    if (!text || from === to) return text;
    const key = JSON.stringify([text, from, to]);
    if (!cache.has(key)) {
      const pending = (async () => {
        const translated = [];
        for (const segment of translationSegments(text)) {
          if (!segment.trim()) { translated.push(segment); continue; }
          const url = `https://api.mymemory.translated.net/get?${new URLSearchParams({ q: segment.trim(), langpair: `${from}|${to}` })}`;
          const result = await request(url);
          const value = result.responseData?.translatedText;
          if (Number(result.responseStatus) !== 200 || result.quotaFinished || typeof value !== 'string' || !value.trim()) {
            throw Error('Translation unavailable');
          }
          if (/^(?:MYMEMORY WARNING|QUERY LENGTH LIMIT EXCEEDED|INVALID LANGUAGE PAIR)/i.test(value.trim())) throw Error('Translation unavailable');
          const leading = segment.match(/^\s*/u)[0];
          const trailing = segment.match(/\s*$/u)[0];
          translated.push(leading + value.trim() + trailing);
        }
        return translated.join('');
      })();
      cache.set(key, pending);
      pending.catch(() => cache.delete(key));
    }
    return cache.get(key);
  };
}

export async function translateDiscovery(original, requestedLanguage, translate) {
  const language = normalizeLanguage(requestedLanguage);
  if (original.language === language) return original;
  const result = { ...original, rights: { ...original.rights }, language,
    originalLanguage: original.language, machineTranslated: true };
  for (const field of ['title', 'description', 'subtitle', 'quote', 'reveal']) {
    if (original[field]) result[field] = await translate(original[field], original.language, language);
  }
  if (original.options) result.options = await Promise.all(original.options.map(text => translate(text, original.language, language)));
  if (original.quizChoice) result.quizChoice = await translate(original.quizChoice, original.language, language);
  const topic = original.sourceId?.replace(/^wikipedia-/, '');
  if (topic) {
    result.category = t(topic === 'today' ? 'today' : topic, language);
    result.subject = result.category;
  }
  // This is a display adaptation. The original source and rights evidence stay intact.
  return result;
}

export function createDiscoveryTranslator(translate = createTranslationClient()) {
  const originals = new WeakMap();
  const versions = new WeakMap();
  return async (discovery, language) => {
    const original = originals.get(discovery) || discovery;
    if (original.language === language) return original;
    let cache = versions.get(original);
    if (!cache) { cache = new Map(); versions.set(original, cache); }
    if (!cache.has(language)) {
      const promise = translateDiscovery(original, language, translate).then(result => {
        originals.set(result, original);
        return result;
      });
      cache.set(language, promise);
      promise.catch(() => cache.delete(language));
    }
    return cache.get(language);
  };
}
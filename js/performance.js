import { dayKey } from './engine.js';

// Small API responses are cached separately from final items. This avoids
// downloading a shared pool again when a different card is visited after refresh.
export function responseCache(storage, date, maxBytes = 180000) {
  const prefix = `foly:responses:v1:${dayKey(date)}:`;
  const expires = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return {
    get(key) {
      try {
        const entry = JSON.parse(storage?.getItem(prefix + key));
        return entry?.expires === expires ? entry.data ?? null : null;
      } catch { return null; }
    },
    set(key, data) {
      try {
        const serialized = JSON.stringify({ expires, data });
        if (serialized.length * 2 <= maxBytes) storage?.setItem(prefix + key, serialized);
      } catch { /* A full/disabled storage must not block rendering. */ }
    },
  };
}

export function sharedRequests(cache, failureTTL = 30000) {
  const requests = new Map();
  return (key, work) => {
    const existing = requests.get(key);
    if (existing && (!existing.failedAt || Date.now() - existing.failedAt < failureTTL)) return existing.promise;
    const saved = cache.get(key);
    if (saved !== null) {
      const promise = Promise.resolve(saved);
      requests.set(key, { failedAt: 0, promise });
      return promise;
    }
    const entry = { failedAt: 0, promise: null };
    entry.promise = Promise.resolve().then(work).then(data => {
      cache.set(key, data);
      return data;
    }, error => {
      entry.failedAt = Date.now();
      throw error;
    });
    requests.set(key, entry);
    return entry.promise;
  };
}

// Coalesce titles arriving together. Each caller receives only its own result.
export function batchLookup(load, { delay = 24, max = 40 } = {}) {
  const waiting = new Map();
  let timer = null;
  async function flush() {
    timer = null;
    const entries = [...waiting.entries()].slice(0, max);
    entries.forEach(([key]) => waiting.delete(key));
    if (waiting.size) timer = setTimeout(flush, delay);
    try {
      const results = await load(entries.map(([key]) => key));
      entries.forEach(([key, callbacks]) => callbacks.forEach(({ resolve }) => resolve(results.get(key) ?? null)));
    } catch (error) {
      entries.forEach(([, callbacks]) => callbacks.forEach(({ reject }) => reject(error)));
    }
  }
  return key => new Promise((resolve, reject) => {
    if (!waiting.has(key)) waiting.set(key, []);
    waiting.get(key).push({ resolve, reject });
    if (timer === null) timer = setTimeout(flush, delay);
  });
}

// Bound DOM work per animation frame rather than rendering a burst of responses.
export function frameQueue(render, requestFrame, perFrame = 2) {
  const waiting = [];
  let scheduled = false;
  function flush() {
    const batch = waiting.splice(0, perFrame);
    for (const { card, item } of batch) render(card, item);
    if (waiting.length) requestFrame(flush);
    else scheduled = false;
  }
  return (card, item) => {
    waiting.push({ card, item });
    if (!scheduled) { scheduled = true; requestFrame(flush); }
  };
}

export function pruneOldCache(storage, today) {
  const keep = dayKey(today);
  try {
    const obsolete = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (/^foly:(?:v\d+|responses:v\d+):\d{4}-\d{2}-\d{2}:/.test(key) && !key.includes(`:${keep}:`)) obsolete.push(key);
    }
    obsolete.forEach(key => storage.removeItem(key));
  } catch { /* Private browsing. */ }
}
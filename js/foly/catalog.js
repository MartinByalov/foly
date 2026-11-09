import { SOURCES } from './sources.js';
import { createFactSources } from './wikipedia.js';
import { discover, fetchJson } from './resolver.js';
import { loadImage } from './images.js';
import { normalizeLanguage } from './locale.js';

export function discoveryCatalog(requestedLanguage) {
  const language = normalizeLanguage(requestedLanguage);
  return {
    primary: createFactSources(language),
    fallback: SOURCES.filter(source => source.enabled && source.languages?.includes(language)),
  };
}

// Admission and returned content must both satisfy the selected language.
// Unknown-language adapters remain available in preview, not in the homepage fallback.
export async function discoverWithFallback(primary, fallback, options = {}) {
  if (options.timeout !== undefined) {
    const controller = new AbortController();
    const timeout = options.timeout;
    if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError('Invalid discovery timeout');
    let timer;
    const expired = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Discovery timed out');
        controller.abort(error);
        reject(error);
      }, timeout);
    });
    const { timeout: ignored, ...rest } = options;
    try {
      return await Promise.race([expired, discoverWithFallback(primary, fallback, {
        ...rest, signal: controller.signal,
        json: Object.assign(url => {
          controller.signal.throwIfAborted();
          return (options.json || fetchJson)(url, { timeout: Math.min(4000, timeout), signal: controller.signal });
        }, { cacheIdentity: options.json || fetchJson }),
        imageLoader: url => {
          controller.signal.throwIfAborted();
          return (options.imageLoader || loadImage)(url, { timeout: Math.min(4000, timeout) });
        },
      })]);
    } finally {
      clearTimeout(timer);
      controller.abort(new Error('Discovery opening finished'));
    }
  }
  const language = normalizeLanguage(options.language || primary[0]?.language);
  const scoped = sources => sources.filter(source => source.language === language || source.languages?.includes(language))
    .map(source => ({ ...source, fetch: async context => {
      const raw = await source.fetch(context);
      if (raw?.language !== language) throw Error('Discovery language does not match selected language');
      return raw;
    } }));
  try { return await discover(scoped(primary), options); }
  catch (error) {
    options.signal?.throwIfAborted();
    try {
      const result = await discover(scoped(fallback), options);
      return { ...result, failed: [...(error.failed || []), ...(result.failed || [])] };
    } catch (fallbackError) {
      fallbackError.failed = [...(error.failed || []), ...(fallbackError.failed || [])];
      throw fallbackError;
    }
  }
}
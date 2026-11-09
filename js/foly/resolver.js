// The lottery: every active source has an equal chance. A source that fails is dropped
// for the rest of this opening only; the next box starts again with equal odds for all.
import { loadImage } from './images.js';
import { isSuitable } from './safety.js';
import { validateDiscoveryRights } from './rights.js';

export function fetchJson(url, { timeout = 8000, signal, fetcher = globalThis.fetch, accept = 'application/json' } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  // Poly Haven requires application identification for live API access, including health checks.
  const headers = { Accept: accept };
  if (typeof location === 'undefined' && /(?:^|\.)(?:wikipedia|wikimedia)\.org$/.test(new URL(url).hostname)) headers['User-Agent'] = 'Foly/1.0 (encyclopedia discovery client)';
  const identification = {};
  if (new URL(url).hostname === 'api.polyhaven.com') {
    if (typeof location !== 'undefined') {
      identification.referrer = new URL('/foly-api-client', location.origin).href;
      identification.referrerPolicy = 'unsafe-url';
    } else headers['User-Agent'] = 'Foly/1.0';
  }
  return fetcher(url, { signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal, cache: 'no-store', credentials: 'omit', headers, ...identification })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .finally(() => clearTimeout(timer));
}

const https = value => {
  try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
};

export function userFacingSourceUrl(value) {
  const href = https(value);
  if (!href) return null;
  const url = new URL(href);
  const wikimediaFilePage = /(?:^|\.)wikimedia\.org$/i.test(url.hostname) && /^\/wiki\/File:/i.test(url.pathname);
  if (/^api\./i.test(url.hostname) ||
    /(?:^|\/)(?:api|iiif|graphql|graphiql)(?:\/|$)|\/manifest(?:\.json)?$|\/artwork\/image(?:\/|$)/i.test(url.pathname) ||
    (!wikimediaFilePage && /\.(?:json|jsonld|xml|rdf|ttl|nt|jpe?g|png|gif|svg|webp|tiff?)$/i.test(url.pathname))) return null;
  return href;
}

// Label the destination website, not the API adapter (also works for saved discoveries).
export function sourceSite(discovery) {
  if (https(discovery.sourcePageUrl || discovery.url)) return new URL(discovery.sourcePageUrl || discovery.url).hostname.replace(/^www\./, '');
  return String(discovery.sourceName || '').replace(/\bAPI\b/gi, '').replace(/\s+/g, ' ').trim() || 'Source';
}

const clip = (value, max) => {
  const clean = String(value ?? '').trim();
  return clean.length > max ? `${clean.slice(0, max).replace(/\s+\S*$/, '')}…` : clean;
};

// Provider synopses may include a separate source note; the source button already links out.
const descriptionCopy = value => String(value ?? '')
  .replace(/[ \t]*\(\s*source\s*:[^)]*\)/gi, '')
  .replace(/[ \t]*\[\s*source\s*:[^\]]*\]/gi, '')
  .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trim();

// Turns whatever an adapter produced into one Foly shape, or null when it is not worth showing.
export function present(raw, source) {
  if (!https(raw?.image) && !['chart', 'question', 'text', 'fact'].includes(raw?.kind)) return null;
  const sourceUrl = userFacingSourceUrl(raw.sourcePageUrl ?? raw.url);
  if (!sourceUrl) return null;
  if (!isSuitable(raw)) return null;
  if (!validateDiscoveryRights(raw).ok) return null;
  if (raw.options !== undefined && (raw.kind !== 'question' || !Array.isArray(raw.options) ||
    ![2, 4].includes(raw.options.length) || raw.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 200) ||
    new Set(raw.options.map(option => option.trim())).size !== raw.options.length || !raw.options.includes(raw.reveal))) return null;
  if (raw.kind === 'question' && [['title', 200], ['subject', 60], ['subtitle', 160], ['description', 900], ['reveal', 200]]
    .some(([key, max]) => String(raw[key] || '').length > max)) return null;
  if (raw.kind === 'chart' && (!Array.isArray(raw.chart) || raw.chart.length !== 5 ||
    raw.chart.some(row => typeof row?.label !== 'string' || row.label.length > 80 ||
      !Number.isSafeInteger(row.value) || row.value <= 0))) return null;
  const title = clip(raw?.title, 200);
  if (!title) return null;
  const found = {
    sourceId: source.id, sourceName: source.name, category: source.category, kind: raw.kind || 'image', title,
    ...(raw.language ? { language: raw.language } : {}),
    rights: { ...raw.rights, ...(source.rightsPolicy?.creditRequired ? { creditRequired: true } : {}) },
    subject: clip(raw.subject, 60), subtitle: clip(raw.subtitle, 160), description: clip(descriptionCopy(raw.description), 900), quote: clip(raw.quote, 600),
    reveal: clip(raw.reveal, 200), image: https(raw.image), thumb: https(raw.thumb) || https(raw.image), url: https(raw.url),
    ...(raw.sourcePageUrl ? { sourcePageUrl: sourceUrl } : {}), credit: clip(raw.credit, 200),
    ...(raw.options ? { options: [...raw.options] } : {}),
    ...(raw.kind === 'chart' ? { chart: raw.chart.map(row => ({ label: row.label, value: row.value })) } : {}),
    ...(raw.kind === 'chart' && raw.chartCountry ? { chartCountry: raw.chartCountry } : {}),
  };
  if (!found.image && !['chart', 'question', 'text', 'fact'].includes(found.kind)) return null;
  return found;
}

export async function discover(sources, { json = fetchJson, random = Math.random, onAttempt, imageLoader = loadImage, signal, concurrency = 1 } = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw new RangeError('Invalid discovery concurrency');
  const remaining = sources.filter(source => source.enabled !== false);
  const failed = [];
  if (concurrency > 1 && remaining.length > 1) {
    let finished = false;
    const worker = async () => {
      while (!finished && remaining.length) {
        signal?.throwIfAborted();
        const [source] = remaining.splice(Math.floor(random() * remaining.length), 1);
        onAttempt?.(source, failed.length);
        try {
          const found = await discover([source], { json, random, imageLoader, signal });
          finished = true;
          return { ...found, failed: [...failed] };
        } catch {
          signal?.throwIfAborted();
          failed.push(source.id);
        }
      }
      throw new Error('Worker exhausted');
    };
    try { return await Promise.any(Array.from({ length: Math.min(concurrency, remaining.length) }, worker)); }
    catch {
      signal?.throwIfAborted();
      throw Object.assign(new Error('Every source came back empty'), { failed });
    }
  }
  while (remaining.length) {
    signal?.throwIfAborted();
    const [source] = remaining.splice(Math.floor(random() * remaining.length), 1);
    onAttempt?.(source, failed.length);
    try {
      const found = present(await source.fetch({ json, random, imageLoader }), source);
      signal?.throwIfAborted();
      if (found?.kind === 'fact' && source.factCapable === true) {
        if (!found.image) throw Error('Fact image required');
        await imageLoader(found.image);
        signal?.throwIfAborted();
        return { ...found, failed };
      }
      if (found?.image) {
        if (found.image) await imageLoader(found.image);
        if (found.thumb && found.thumb !== found.image) {
          try { await imageLoader(found.thumb); }
          catch { found.thumb = found.image; found.rights.thumbUrl = found.image; }
        }
        signal?.throwIfAborted();
        return { ...found, failed };
      }
    } catch {
      signal?.throwIfAborted();
      // Fall through to another source only while this opening is active.
    }
    failed.push(source.id);
  }
  throw Object.assign(new Error('Every source came back empty'), { failed });
}

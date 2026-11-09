import { fetchJson, present } from './resolver.js';
import { loadImage } from './images.js';

// Shared live checker for preview and automated browser runs. Never substitute another provider.
export async function checkSource(source, { json = fetchJson, imageLoader = loadImage, random = Math.random, category = '' } = {}) {
  const report = { id: source.id, checkedAt: new Date().toISOString() };
  if (!source.enabled) return { ...report, ok: false, error: 'Provider disabled' };
  try {
    const discovery = present(await source.fetch({ json, random, imageLoader, category }), source);
    if (!discovery?.image) throw Error('Provider media, schema, safety or rights validation rejected this result');
    if (discovery.image) {
      await imageLoader(discovery.image);
      if (discovery.thumb && discovery.thumb !== discovery.image) await imageLoader(discovery.thumb);
    }
    return { ...report, ok: true, kind: discovery.kind, discovery };
  } catch (error) { return { ...report, ok: false, error: error.message }; }
}
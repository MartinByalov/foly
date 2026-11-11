// Live, bounded smoke check. Node image downloads do not replace a browser decode check.
import { writeFile, readFile } from 'node:fs/promises';
import { SOURCES } from '../js/foly/sources.js';
import { fetchJson, present } from '../js/foly/resolver.js';
import { validateDiscoveryRights } from '../js/foly/rights.js';
import { providerHealthExitCode } from './foly-health-status.mjs';

const reports = [];
const json = async url => {
  if (url.startsWith('file:')) return JSON.parse(await readFile(new URL(url), 'utf8'));
  return fetchJson(url, { timeout: 8000, fetcher: async (url, options) => {
    const r = await fetch(url, { ...options, headers: { ...options.headers, Origin: 'http://localhost:8000' } });
    const cors = r.headers.get('access-control-allow-origin');
    const readable = cors === '*' || cors === 'http://localhost:8000';
    if (!readable) throw new Error(`No usable CORS header: ${new URL(url).hostname}`);
    return r;
  } });
};
const requested = new Set((process.env.FOLY_SOURCE_IDS || '').split(',').filter(Boolean));
const selected = SOURCES.filter(s => s.enabled && (!requested.size || requested.has(s.id)));
for (const id of requested) if (!selected.some(source => source.id === id)) throw Error(`Unknown or inactive provider: ${id}`);
const concurrency = Number(process.env.FOLY_CHECK_CONCURRENCY || 4);
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw Error('FOLY_CHECK_CONCURRENCY must be an integer from 1 to 8');
async function check(source) {
  const report = { id: source.id, kind: source.rightsPolicy.kind || 'api', checkedAt: new Date().toISOString() };
  try {
    let raw;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { raw = await source.fetch({ json, random: () => attempt ? .37 : .05 }); if (present(raw, source)) break; }
      catch (error) { if (attempt === 1) throw error; }
    }
    if (!present(raw, source)?.image) throw new Error('Rejected: missing provider image or invalid presentation/rights/safety');
    if (raw.image) {
    const image = await fetch(raw.image, { signal: AbortSignal.timeout(10000) });
    const type = image.headers.get('content-type')?.split(';')[0];
    const fngOctet = source.id === 'finnishGallery' && type === 'application/octet-stream' &&
      /^https:\/\/kokoelma\.kansallisgalleria\.fi\/media-assets\/1\/jpg\/1000\/\d+\.jpg$/.test(raw.image);
    if (!image.ok || (!type?.startsWith('image/') && !fngOctet)) throw new Error(`Image HTTP ${image.status}, ${type}`);
    const reader = image.body.getReader();
    const first = await reader.read();
    await reader.cancel();
    if (!first.value?.length) throw new Error('Empty image response');
    if (fngOctet && !(first.value[0] === 255 && first.value[1] === 216 && first.value[2] === 255)) throw new Error('FNG octet-stream is not a JPEG');
    }
    Object.assign(report, { ok: true, contentKind: raw.kind || 'image', item: raw.url,
      sourcePage: raw.sourcePageUrl || raw.url, image: raw.image, rights: raw.rights, rightsValid: validateDiscoveryRights(raw).ok });
  } catch (error) {
    Object.assign(report, { ok: false, error: error.message,
      ...(error.cause ? { cause: error.cause.message, code: error.cause.code } : {}) });
  }
  reports.push(report);
  console.log(JSON.stringify(report));
}
let next = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
  while (next < selected.length) await check(selected[next++]);
}));
reports.sort((a, b) => selected.findIndex(source => source.id === a.id) - selected.findIndex(source => source.id === b.id));
await writeFile(new URL(requested.size ? '../data/foly-source-health-selected.json' : '../data/foly-source-health.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n');
console.log(JSON.stringify({ checked: reports.length, passed: reports.filter(r => r.ok).length, failed: reports.filter(r => !r.ok).length }));
process.exitCode = providerHealthExitCode(reports);
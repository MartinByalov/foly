import { writeFile } from 'node:fs/promises';
import { MEDIA_CANDIDATES, candidateMedia } from './foly-media-candidates.mjs';
import { SOURCES } from '../js/foly/sources.js';

const origin = 'http://localhost:8000';
const reports = await Promise.all(MEDIA_CANDIDATES.map(async candidate => {
  const source = SOURCES.find(source => source.id === (candidate.registryId || candidate.id));
  const report = { id: candidate.id, endpoint: candidate.endpoint, field: candidate.field,
    registryEnabled: source?.enabled === true, admissionChecked: false,
    note: 'Transport only; existing production admission is independent of this sample.' };
  try {
    const response = await fetch(candidate.endpoint, { headers: { Origin: origin }, signal: AbortSignal.timeout(15000) });
    report.status = response.status;
    report.cors = response.headers.get('access-control-allow-origin');
    if (!response.ok) throw Error(`API HTTP ${response.status}`);
    if (!['*', origin].includes(report.cors)) throw Error('No usable CORS header');
    const data = await response.json();
    report.image = candidateMedia(candidate, data);
    const image = await fetch(report.image, { signal: AbortSignal.timeout(15000) });
    report.imageStatus = image.status;
    report.contentType = image.headers.get('content-type');
    if (!image.ok || !report.contentType?.startsWith('image/')) throw Error(`Image HTTP ${image.status}, ${report.contentType}`);
    const reader = image.body.getReader();
    try { if (!(await reader.read()).value?.length) throw Error('Empty image'); }
    finally { await reader.cancel(); }
    report.ok = true;
  } catch (error) { report.ok = false; report.error = error.message; }
  return report;
}));
await writeFile(new URL('../data/foly-candidate-http.json', import.meta.url),
  JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n');
console.log(JSON.stringify(reports, null, 2));
// Failures are expected candidates, not a reason to turn off unrelated production APIs.
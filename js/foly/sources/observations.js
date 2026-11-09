import { source, pickOne, fail } from './util.js';
import { rightsEvidence } from '../rights.js';

const policy = 'https://oceanservice.noaa.gov/about/faq.html';
const stations = ['9414290', '8518750', '8443970', '9447130', '8724580', '1612340'];
export default [source('noaaTides', 'NOAA Tides & Currents', 'Ocean', async ({ json, random }) => {
  const station = pickOne(random, stations);
  const evidence = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${station}&product=water_level&datum=MLLW&units=metric&time_zone=gmt&format=json`;
  const result = await json(evidence);
  const row = result.data?.[0];
  const time = typeof row?.t === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(row.t) ? Date.parse(`${row.t.replace(' ', 'T')}:00Z`) : NaN;
  const value = typeof row?.v === 'string' && /^-?\d+(?:\.\d+)?$/.test(row.v) ? Number(row.v) : NaN;
  if (result.metadata?.id !== station || typeof result.metadata.name !== 'string' || !result.metadata.name.trim() ||
    !Number.isFinite(value) || Math.abs(value) > 30 || !Number.isFinite(time) ||
    time > Date.now() + 60_000 || Date.now() - time > 864e5 || !['p', 'v'].includes(row.q)) fail('Invalid or stale NOAA station observation');
  const raw = { kind: 'text', title: result.metadata.name, subject: 'Water level',
    subtitle: `${row.v} m · MLLW`, description: `${row.t} UTC · ${row.q === 'p' ? 'Preliminary' : 'Verified'}`,
    url: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station}`, credit: 'NOAA / NOS / CO-OPS' };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'US_GOV_PUBLIC_DOMAIN', metadataLicenseUrl: policy,
    evidence, creator: 'NOAA / NOS / CO-OPS', attribution: raw.credit, mediaTitle: raw.title,
    changes: 'Selected observation values; no linked full text or media reproduced.' });
  return raw;
}, 'text')];
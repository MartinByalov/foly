import { canonicalLicense } from '../license.js';
import { validateWikipediaFact } from './wikipedia.js';

// Metadata remains independently reviewed; attributed media require complete display evidence.
// A provider declaration is evidence, not a guarantee of third-party rights.
const OPEN = new Set(['CC0', 'PDM', 'PUBLIC_DOMAIN', 'US_GOV_PUBLIC_DOMAIN']);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const secure = value => {
  try { return typeof value === 'string' && new URL(value).protocol === 'https:'; } catch { return false; }
};

function attributedLicenseDetails(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'creativecommons.org' || url.username || url.password ||
      url.search || url.hash) return null;
    const path = url.pathname.replace(/\/(?:legalcode|deed(?:\.[a-z-]+)?)\/?$/i, '').replace(/\/$/, '');
    const match = path.match(/^\/licenses\/(by|by-sa)\/(2\.0|3\.0|4\.0)$/i);
    if (!match) return null;
    const kind = match[1].toLowerCase();
    const version = match[2];
    return { code: kind === 'by' ? 'CC_BY' : 'CC_BY_SA', name: `CC ${kind === 'by' ? 'BY' : 'BY-SA'} ${version}` };
  } catch { return null; }
}

export const attributedMediaLicense = url => attributedLicenseDetails(url)?.code || null;

// GBIF publishes exact CC legalcode URLs as well as deed URLs.
export function discoveryLicense(value) {
  if (typeof value !== 'string') return null;
  if (value === 'https://www.naturalearthdata.com/about/terms-of-use/') return 'PUBLIC_DOMAIN';
  // Only this reviewed first-party instrument policy, not any NASA URL or image credit.
  if (value === 'https://epic.gsfc.nasa.gov/about') return 'US_GOV_PUBLIC_DOMAIN';
  if (value === 'https://www.nasa.gov/nasa-brand-center/images-and-media/') return 'US_GOV_PUBLIC_DOMAIN';
  if (value === 'https://oceanservice.noaa.gov/about/faq.html') return 'US_GOV_PUBLIC_DOMAIN';
  if (value === 'https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted') return 'US_GOV_PUBLIC_DOMAIN';
  try {
    const url = new URL(value);
    if (url.hostname === 'creativecommons.org' && ['http:', 'https:'].includes(url.protocol)) {
      const attributed = attributedLicenseDetails(value);
      if (attributed) return attributed.code;
      return canonicalLicense(`${url.origin}${url.pathname.replace(/\/legalcode\/?$/, '/')}`);
    }
  } catch { /* Canonical short code, rather than a URL. */ }
  return canonicalLicense(value);
}

export function rightsEvidence({ metadataLicense, metadataLicenseUrl = '', mediaLicense, mediaLicenseUrl, url, image, thumb, evidence, attribution = '',
  creator = '', mediaTitle = '', originalMediaUrl = '', changes = '', deliveryMode, retention }) {
  return { metadataLicense, metadataLicenseUrl, mediaLicense, mediaLicenseUrl, sourceItemUrl: url,
    mediaUrl: image, thumbUrl: thumb || image, verifiedBy: evidence,
    author: creator, source_url: url, license_url: mediaLicenseUrl,
    license_name: attributedLicenseDetails(mediaLicenseUrl)?.name || mediaLicense,
    deliveryMode, retention,
    verifiedAt: new Date().toISOString(), attribution, creator, mediaTitle, originalMediaUrl, changes };
}

export function validateDiscoveryRights(raw) {
  if (raw?.kind === 'fact') return validateWikipediaFact(raw) ? { ok: true } : { ok: false, reason: 'wikipedia_rights' };
  const rights = raw?.rights;
  if (!rights) return { ok: false, reason: 'missing_rights' };
  const openFdaChart = raw.kind === 'chart' && !raw.image && !raw.thumb &&
    rights.chartProvider === 'openFDAReports' &&
    raw.url === 'https://open.fda.gov/apis/drug/event/' &&
    rights.metadataLicense === 'CC0' &&
    rights.metadataLicenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/' &&
    rights.verifiedBy === 'https://api.fda.gov/drug/event.json?count=patient.reaction.reactionmeddrapt.exact&limit=5' &&
    rights.sourceItemUrl === raw.url &&
    rights.creator === 'U.S. Food and Drug Administration' &&
    rights.attribution === 'Data provided by the U.S. Food and Drug Administration' &&
    rights.changes === 'Aggregate counts of unvalidated reports; no causal claims or medical advice.' &&
    rights.chartData === JSON.stringify(raw.chart) &&
    !rights.mediaUrl && !rights.thumbUrl && !rights.mediaLicense && !rights.mediaLicenseUrl &&
    Array.isArray(raw.chart) && raw.chart.length === 5 &&
    raw.chart.every(row => typeof row?.label === 'string' && row.label.trim().length > 0 &&
      row.label.length <= 80 && Number.isSafeInteger(row.value) && row.value > 0) &&
    new Set(raw.chart.map(row => row.label)).size === raw.chart.length;
  const worldBankChart = raw.kind === 'chart' && !raw.image && !raw.thumb &&
    rights.chartProvider === 'worldBank' &&
    /^https:\/\/data\.worldbank\.org\/indicator\/SP\.POP\.TOTL\?locations=(US|CN|IN|BR|JP)$/.test(raw.url || '') &&
    rights.metadataLicense === 'CC_BY' &&
    rights.metadataLicenseUrl === 'https://creativecommons.org/licenses/by/4.0/' &&
    rights.licenseEvidenceUrl === 'https://data.worldbank.org/indicator/SP.POP.TOTL' &&
    rights.verifiedBy === `https://api.worldbank.org/v2/country/${raw.chartCountry}/indicator/SP.POP.TOTL?format=json&per_page=5` &&
    rights.sourceItemUrl === raw.url &&
    rights.author === 'World Bank' &&
    rights.source_url === raw.url &&
    rights.license_url === rights.metadataLicenseUrl &&
    rights.license_name === 'CC BY 4.0' &&
    rights.creator === rights.author &&
    rights.mediaTitle === raw.title &&
    rights.attribution === 'The World Bank: World Development Indicators: Population, total. Sources: UN Population Division, national statistical offices, Eurostat and UN Statistics Division.' &&
    rights.changes === 'Population values displayed as a five-year chart without modification.' &&
    rights.chartData === JSON.stringify(raw.chart) &&
    Array.isArray(raw.chart) && raw.chart.length === 5 &&
    raw.chart.every((row, index) => typeof row?.label === 'string' && /^\d{4}$/.test(row.label) &&
      Number(row.label) >= 1900 && Number(row.label) <= new Date().getUTCFullYear() &&
      Number.isSafeInteger(row.value) && row.value > 0 && (index === 0 || row.label > raw.chart[index - 1].label)) &&
    new Set(raw.chart.map(row => row.label)).size === raw.chart.length &&
    ({ USA: 'US', CHN: 'CN', IND: 'IN', BRA: 'BR', JPN: 'JP' })[raw.chartCountry] ===
      new URL(raw.url).searchParams.get('locations') &&
    /^https:\/\/api\.worldbank\.org\/v2\/country\/(USA|CHN|IND|BRA|JPN)\/indicator\/SP\.POP\.TOTL\?format=json&per_page=5$/.test(rights.verifiedBy || '');
  const validChart = raw.kind === 'chart' && Array.isArray(raw.chart) && raw.chart.length === 5 &&
    raw.chart.every(row => typeof row?.label === 'string' && row.label.trim().length > 0 &&
      row.label.length <= 80 && Number.isSafeInteger(row.value) && row.value >= 0) &&
    raw.chart.some(row => row.value > 0) &&
    new Set(raw.chart.map(row => row.label)).size === raw.chart.length &&
    rights.chartData === JSON.stringify(raw.chart) &&
    rights.sourceItemUrl === raw.url && secure(raw.url) && secure(rights.verifiedBy) &&
    !rights.mediaUrl && !rights.thumbUrl && !rights.mediaLicense && !rights.mediaLicenseUrl;
  const attributedText = !raw.image && raw.kind === 'question' &&
    attributedMediaLicense(rights.metadataLicenseUrl) === discoveryLicense(rights.metadataLicense) &&
    [rights.creator, rights.attribution, rights.mediaTitle, rights.changes].every(nonempty) &&
    rights.changes === 'Question and answers unchanged; answer hidden until revealed.';
  const openAlexText = raw.kind === 'text' && !raw.image && !raw.reveal && rights.metadataProvider === 'OpenAlex' &&
    /^https:\/\/openalex\.org\/W\d+$/.test(raw.url || '') &&
    rights.metadataLicense === 'CC0' &&
    rights.metadataLicenseUrl === 'https://creativecommons.org/publicdomain/zero/1.0/' &&
    rights.sourceItemUrl === raw.url &&
    rights.verifiedBy === 'https://api.openalex.org/works?sample=5&select=id,doi,title,publication_year,primary_topic' &&
    rights.creator === 'OpenAlex' &&
    rights.attribution === 'OpenAlex · CC0 metadata' &&
    rights.mediaTitle === raw.title &&
    rights.changes === 'Selected bibliographic facts; no linked full text or media reproduced.' &&
    !rights.mediaUrl && !rights.thumbUrl && !rights.mediaLicense && !rights.mediaLicenseUrl;
  if (!OPEN.has(discoveryLicense(rights.metadataLicense)) && !attributedText && !worldBankChart) return { ok: false, reason: 'metadata_license' };
  if (!raw.image) {
    const openText = raw.kind === 'text' && !raw.reveal &&
      !rights.metadataProvider &&
      discoveryLicense(rights.metadataLicenseUrl) === discoveryLicense(rights.metadataLicense) &&
      OPEN.has(discoveryLicense(rights.metadataLicenseUrl)) &&
      [rights.creator, rights.attribution, rights.mediaTitle, rights.changes].every(nonempty) &&
      ['Selected bibliographic facts; no linked full text or media reproduced.',
        'Selected observation values; no linked full text or media reproduced.'].includes(rights.changes);
    if (!((openFdaChart || worldBankChart) && validChart ||
      openAlexText || openText || (raw.kind === 'question' && nonempty(raw.reveal) && attributedText)) ||
      raw.thumb || rights.mediaUrl || rights.thumbUrl || rights.mediaLicense || rights.mediaLicenseUrl) {
      return { ok: false, reason: 'text_rights' };
    }
    if (![raw.url, rights.verifiedBy].every(secure) || raw.url !== rights.sourceItemUrl) return { ok: false, reason: 'unbound_evidence' };
    const time = Date.parse(rights.verifiedAt);
    if (!Number.isFinite(time) || time > Date.now() + 60_000 || Date.now() - time > 864e5) return { ok: false, reason: 'stale_evidence' };
    return { ok: true };
  }
  const license = discoveryLicense(rights.mediaLicense);
  const attributedDetails = attributedLicenseDetails(rights.mediaLicenseUrl);
  const attributed = attributedDetails?.code === license && ['CC_BY', 'CC_BY_SA'].includes(license);
  if ((!OPEN.has(license) && !attributed) || discoveryLicense(rights.mediaLicenseUrl) !== license) return { ok: false, reason: 'media_license' };
  if (attributed && (![rights.author, rights.source_url, rights.license_url, rights.license_name, rights.creator,
    rights.attribution, rights.mediaTitle].every(nonempty) ||
    rights.author !== rights.creator || rights.source_url !== raw.url || rights.source_url !== rights.sourceItemUrl ||
    rights.license_url !== rights.mediaLicenseUrl || rights.license_name !== attributedDetails.name ||
    (license === 'CC_BY_SA' && (rights.deliveryMode !== 'direct' || rights.retention !== 'ephemeral')) ||
    !secure(rights.originalMediaUrl) || rights.changes !== 'No modifications by Foly; displayed at a scaled size.')) {
    return { ok: false, reason: 'missing_attribution' };
  }
  if (![raw.image, raw.thumb || raw.image, raw.url, rights.verifiedBy].every(secure) || raw.url !== rights.sourceItemUrl ||
    raw.image !== rights.mediaUrl || (raw.thumb || raw.image) !== rights.thumbUrl) return { ok: false, reason: 'unbound_evidence' };
  const time = Date.parse(rights.verifiedAt);
  if (!Number.isFinite(time) || time > Date.now() + 60_000 || Date.now() - time > 864e5) return { ok: false, reason: 'stale_evidence' };
  return { ok: true };
}

// Keep mandatory credits outside resolver clipping. The renderer uses text nodes, never provider HTML.
export function requiresCardCredit(raw) {
  return raw.rights?.creditRequired === true || Boolean(attributedMediaLicense(raw.image
    ? raw.rights?.mediaLicenseUrl : raw.rights?.metadataLicenseUrl));
}

export function mediaCredit(raw) {
  const rights = raw.rights;
  const presentationNote = value => value?.replaceAll('; ', '. ');
  if (!raw.image && !attributedMediaLicense(rights?.metadataLicenseUrl)) return rights?.attribution || raw.credit || '';
  if (!raw.image) return `${rights.mediaTitle} - ${rights.creator}. ${rights.attribution} · ${presentationNote(rights.changes)}`;
  if (!attributedMediaLicense(rights?.mediaLicenseUrl)) return raw.credit || '';
  return `${rights.mediaTitle} - ${rights.creator}. ${rights.attribution} · ${presentationNote(rights.changes)}`;
}
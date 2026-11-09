import { normalizeLanguage, t } from './locale.js';
import { isSuitable } from './safety.js';
import { additionalTopics } from './languages-extra.js';

const LICENSE = 'https://creativecommons.org/licenses/by-sa/4.0/';
const topics = {
  ...additionalTopics,
  en: { science: 'Science', history: 'History', space: 'Astronomy', nature: 'Nature', art: 'Art', architecture: 'Architecture', music: 'Music', literature: 'Literature', geography: 'Geography', technology: 'Technology', mathematics: 'Mathematics', animals: 'Animals', plants: 'Plants', sport: 'Sports' },
  bg: { science: 'Наука', history: 'История', space: 'Астрономия', nature: 'Природа', art: 'Изкуство', architecture: 'Архитектура', music: 'Музика', literature: 'Литература', geography: 'География', technology: 'Технологии', mathematics: 'Математика', animals: 'Животни', plants: 'Растения', sport: 'Спорт' },
  fr: { science: 'Science', history: 'Histoire', space: 'Astronomie', nature: 'Nature', art: 'Art', architecture: 'Architecture', music: 'Musique', literature: 'Littérature', geography: 'Géographie', technology: 'Technologie', mathematics: 'Mathématiques', animals: 'Animal', plants: 'Plante', sport: 'Sport' },
  hi: { science: 'विज्ञान', history: 'इतिहास', space: 'खगोलशास्त्र', nature: 'प्रकृति', art: 'कला', architecture: 'स्थापत्य', music: 'संगीत', literature: 'साहित्य', geography: 'भूगोल', technology: 'प्रौद्योगिकी', mathematics: 'गणित', animals: 'प्राणी', plants: 'पादप', sport: 'खेल' },
};
const choose = (items, random) => items[Math.min(items.length - 1, Math.floor(random() * items.length))];
const plain = value => String(value || '').replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
function imageLicense(url) {
  if (url === 'https://creativecommons.org/publicdomain/zero/1.0/') return 'CC0';
  if (url === 'https://creativecommons.org/publicdomain/mark/1.0/') return 'PDM';
  const match = String(url).match(/^https:\/\/creativecommons\.org\/licenses\/(by|by-sa)\/(2\.0|3\.0|4\.0)\/$/);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : null;
}
const wikiUrl = (value, language, path) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === `${language}.wikipedia.org` && !url.username && !url.password && url.pathname.startsWith(path);
  } catch { return false; }
};

function articleQuery(language, params) {
  return `https://${language}.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*',
    prop: 'extracts|pageprops|pageimages|info|revisions', exintro: '1', explaintext: '1', exchars: '900', exlimit: 'max',
    inprop: 'url', rvprop: 'ids', piprop: 'name', meta: 'siteinfo', siprop: 'rightsinfo', ...params })}`;
}

async function verifiedImage(filename, json) {
  if (!filename) return null;
  const evidence = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*',
    titles: `File:${filename}`, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '640' })}`;
  try {
    const file = (await json(evidence)).query?.pages?.[0];
    const info = file?.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const licenseUrl = metadata?.LicenseUrl?.value?.replace('http:', 'https:');
    const license = imageLicense(licenseUrl);
    if (!license || plain(metadata?.Restrictions?.value) ||
      ((license.startsWith('CC BY') || metadata?.AttributionRequired?.value === 'true') && !plain(metadata?.Artist?.value))) return null;
    const url = info.thumburl || info.url;
    if (!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(url || '') ||
      !/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(info.descriptionurl || '')) return null;
    if (!file.title || !isSuitable({ title: file.title, description: plain(metadata?.ImageDescription?.value) })) return null;
    return { url, source: info.descriptionurl, license, licenseUrl, evidence,
      creator: plain(metadata.Artist?.value), title: file.title,
      attribution: plain(metadata.Attribution?.value), credit: plain(metadata.Credit?.value) };
  } catch { return null; }
}

function makeFact({ language, title, description, url, revision, evidence, topic, image }) {
  return { kind: 'fact', title, description, language, subject: t(topic, language), url, image: image?.url || null, thumb: image?.url || null,
    credit: 'Wikipedia contributors · CC BY-SA 4.0',
    rights: { metadataProvider: 'Wikipedia', metadataLicense: 'CC_BY_SA', metadataLicenseUrl: LICENSE,
      sourceItemUrl: url, verifiedBy: evidence, verifiedAt: new Date().toISOString(), creator: 'Wikipedia contributors',
      attribution: 'Wikipedia contributors · CC BY-SA 4.0', mediaTitle: title,
      historyUrl: `https://${language}.wikipedia.org/w/index.php?${new URLSearchParams({ title: revision.title, action: 'history' })}`,
      revisionUrl: revision.id ? `https://${language}.wikipedia.org/w/index.php?oldid=${revision.id}` : url,
      changes: 'Excerpt selected from Wikipedia; no translation by Foly.', text: description, textExcerpted: true,
      ...(image ? { mediaUrl: image.url, thumbUrl: image.url, mediaLicense: image.license, mediaLicenseUrl: image.licenseUrl,
        originalMediaUrl: image.source, imageEvidence: image.evidence, imageCreator: image.creator, imageTitle: image.title,
        imageAttribution: image.attribution, imageCredit: image.credit,
        deliveryMode: 'direct', retention: 'ephemeral', imageChanges: 'No modifications by Foly; displayed at a scaled size.' } : {}) } };
}

export function validateWikipediaFact(raw) {
  const r = raw?.rights;
  const language = raw?.language;
  if (raw?.kind !== 'fact' || normalizeLanguage(language) !== language || !r || r.metadataProvider !== 'Wikipedia' ||
    r.metadataLicense !== 'CC_BY_SA' || r.metadataLicenseUrl !== LICENSE || r.sourceItemUrl !== raw.url ||
    !wikiUrl(raw.url, language, '/wiki/') || !wikiUrl(r.verifiedBy, language, '/') ||
    !wikiUrl(r.historyUrl, language, '/w/index.php') || !wikiUrl(r.revisionUrl, language, '/') ||
    r.creator !== 'Wikipedia contributors' || r.attribution !== 'Wikipedia contributors · CC BY-SA 4.0' ||
    r.mediaTitle !== raw.title || r.text !== raw.description || !raw.title?.trim() || !raw.description?.trim() ||
    raw.title.length > 200 || raw.description.length > 900 ||
    r.changes !== 'Excerpt selected from Wikipedia; no translation by Foly.') return false;
  const time = Date.parse(r.verifiedAt);
  if (!Number.isFinite(time) || time > Date.now() + 60000 || Date.now() - time > 864e5) return false;
  if (!raw.image) return false;
  return /^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(raw.image) && raw.image === raw.thumb && raw.image === r.mediaUrl && raw.image === r.thumbUrl &&
    /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(r.originalMediaUrl || '') &&
    /^https:\/\/commons\.wikimedia\.org\/w\/api\.php\?/.test(r.imageEvidence || '') &&
    Boolean(imageLicense(r.mediaLicenseUrl)) && imageLicense(r.mediaLicenseUrl) === r.mediaLicense &&
    Boolean(r.imageTitle) && (!r.mediaLicense.startsWith('CC BY') || Boolean(r.imageCreator?.trim())) &&
    r.deliveryMode === 'direct' && r.retention === 'ephemeral' &&
    r.imageChanges === 'No modifications by Foly; displayed at a scaled size.';
}

export function createFactSources(requestedLanguage) {
  const language = normalizeLanguage(requestedLanguage);
  const seen = new Set();
  const metadata = new WeakMap();
  let blockedUntil = 0;
  const request = async (json, url) => {
    if (Date.now() < blockedUntil) throw Error('Wikipedia temporarily unavailable');
    const commons = new URL(url).hostname === 'commons.wikimedia.org';
    const identity = json.cacheIdentity || json;
    let cache = metadata.get(identity);
    if (!cache) { cache = new Map(); metadata.set(identity, cache); }
    const cached = cache.get(url);
    if (commons && cached && Date.now() - cached.at < 300_000) return cached.data;
    try {
      const data = await json(url);
      if (['ratelimited', 'maxlag', 'readonly'].includes(data.error?.code)) {
        blockedUntil = Date.now() + 60_000;
        throw Error('Wikipedia temporarily unavailable');
      }
      if (commons && !data.error && data.query?.pages) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value);
        cache.set(url, { at: Date.now(), data });
      }
      return data;
    }
    catch (error) {
      if (/HTTP (?:429|503)/.test(error.message)) blockedUntil = Date.now() + 60_000;
      throw error;
    }
  };
  const articleSource = topic => ({ id: `wikipedia-${topic}`, name: 'Wikipedia', language, category: t(topic, language), enabled: true, factCapable: true,
    fetch: async ({ json, random = Math.random, imageLoader }) => {
      const attempted = new Set();
      let continuation = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const params = topic === 'random' ? { generator: 'random', grnnamespace: '0', grnlimit: '8' } : attempt > 0 ? {
          generator: 'categorymembers', gcmtitle: `Category:${topics[language][topic]}`, gcmtype: 'page', gcmnamespace: '0', gcmlimit: '10',
          ...(continuation ? { gcmcontinue: continuation } : {}),
        } : {
          generator: 'search', gsrsearch: `deepcat:"${topics[language][topic]}"`, gsrnamespace: '0', gsrlimit: '10', gsroffset: String(Math.floor(random() * 5) * 10),
        };
        const evidence = articleQuery(language, params);
        let data;
        try {
          data = await request(json, evidence);
          if (data.error || data.warnings) throw Error('Wikipedia query could not be applied reliably');
        } catch (error) {
          if (topic === 'random' || attempt > 0 || Date.now() < blockedUntil) throw error;
          continue;
        }
        continuation = data.continue?.gcmcontinue || null;
        if (!/^https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/(?:deed\.[a-z-]+)?$/.test(data.query?.rightsinfo?.url || '')) throw Error('Unverified Wikipedia text licence');
        const pages = (data.query?.pages || []).filter(page => page.ns === 0 && page.extract?.trim() && page.title?.length <= 200 &&
          page.pageimage && !Object.hasOwn(page.pageprops || {}, 'disambiguation') && !seen.has(page.pageid) && !attempted.has(page.pageid) &&
          wikiUrl(page.fullurl, language, '/wiki/') && isSuitable({ title: page.title, description: page.extract }));
        while (pages.length) {
        const page = choose(pages, random);
        pages.splice(pages.indexOf(page), 1);
        attempted.add(page.pageid);
        const description = page.extract.length <= 900 ? page.extract : `${page.extract.slice(0, 896).trimEnd()}…`;
        const image = await verifiedImage(page.pageimage, url => request(json, url));
        if (!image) continue;
        if (imageLoader) { try { await imageLoader(image.url); } catch { continue; } }
        seen.add(page.pageid);
        return makeFact({ language, title: page.title, description, url: page.fullurl, evidence, topic,
          revision: { title: page.title, id: page.revisions?.[0]?.revid }, image });
        }
        if (topic !== 'random' && attempt > 0 && !continuation) break;
      }
      throw Error('No suitable unseen article');
    } });
  const sources = ['random', ...Object.keys(topics[language])].map(articleSource);
  if (language === 'en') sources.push({ id: 'wikipedia-dyk', name: 'Wikipedia Did You Know', category: t('dyk', language), enabled: true, factCapable: true,
    fetch: async ({ json, random = Math.random, imageLoader }) => {
      const title = 'Template:Did you know';
      const evidence = `https://en.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'parse', page: title, prop: 'wikitext', format: 'json', origin: '*' })}`;
      const data = await request(json, evidence);
      const hooks = parseDidYouKnow(data.parse?.wikitext?.['*'] || '').filter(hook => !seen.has(hook.text));
      while (hooks.length) {
        const hook = choose(hooks, random); hooks.splice(hooks.indexOf(hook), 1);
        if (!isSuitable({ description: hook.text })) continue;
        const article = await request(json, articleQuery(language, { titles: hook.article }));
        if (!/^https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/(?:deed\.[a-z-]+)?$/.test(article.query?.rightsinfo?.url || '')) throw Error('Unverified Wikipedia text licence');
        const page = article.query?.pages?.find(page => page.pageimage && wikiUrl(page.fullurl, language, '/wiki/'));
        if (!page) continue;
        const image = await verifiedImage(page.pageimage, url => request(json, url));
        if (!image) continue;
        if (imageLoader) { try { await imageLoader(image.url); } catch { continue; } }
        seen.add(hook.text);
        return makeFact({ language, title: hook.article, description: hook.text,
          url: 'https://en.wikipedia.org/wiki/Template:Did_you_know', revision: { title, id: data.parse.revid }, evidence, topic: 'dyk', image });
      }
      throw Error('No illustrated Did You Know hook');
    } });
  if (['en', 'fr'].includes(language)) sources.push({ id: 'wikipedia-today', name: 'Wikipedia On This Day', category: t('today', language), enabled: true, factCapable: true,
    fetch: async ({ json, random = Math.random, imageLoader }) => {
      const date = new Date();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const evidence = `https://${language}.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`;
      const data = await request(json, evidence);
      const events = (data.events || []).filter(event => event.text && event.text.length < 850 && Number.isInteger(event.year) && isSuitable({ description: event.text }) &&
        event.pages?.some(page => wikiUrl(page.content_urls?.desktop?.page, language, '/wiki/')) && !seen.has(`${month}/${day}:${event.year}:${event.text}`));
      let attempts = 0;
      while (events.length && attempts++ < 8) {
      const event = choose(events, random);
      events.splice(events.indexOf(event), 1);
      const calendar = language === 'en' ? `${date.toLocaleString('en', { month: 'long' })}_${date.getDate()}` : `${date.getDate() === 1 ? '1er' : date.getDate()}_${date.toLocaleString('fr', { month: 'long' })}`;
      const url = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(calendar)}`;
      let image = null;
      for (const page of event.pages.filter(page => page.originalimage?.source).slice(0, 3)) {
        try {
          const filename = decodeURIComponent(new URL(page.originalimage.source).pathname.split('/').at(-1));
          const candidate = await verifiedImage(filename, url => request(json, url));
          if (!candidate) continue;
          if (imageLoader) await imageLoader(candidate.url);
          image = candidate; break;
        } catch { /* Try the next article linked to this event. */ }
      }
      if (!image) continue;
      seen.add(`${month}/${day}:${event.year}:${event.text}`);
      return makeFact({ language, title: `${t('today', language)} · ${new Intl.DateTimeFormat(language, { month: 'long', day: 'numeric' }).format(date)}`,
        description: `${event.year} - ${event.text}`, url, revision: { title: calendar }, evidence, topic: 'today',
        image });
      }
      throw Error('No unseen event with a verified, loadable image');
    } });
  return sources.map(source => ({ ...source, language }));
}

export function parseDidYouKnow(wikitext) {
  return wikitext.split('\n').filter(line => /^\*\s*\.\.\. that /.test(line) && !/[{}<>]/.test(line)).flatMap(line => {
    const main = line.match(/'''(?:'')?\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (!main) return [];
    const text = line.replace(/^\*\s*\.\.\. that /, '').replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
      .replace(/'{2,5}/g, '').replace(/\s*\(pictured\)/g, '').trim();
    return text.length <= 900 ? [{ article: main[1], text }] : [];
  });
}
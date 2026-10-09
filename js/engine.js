export function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function seed(text) {
  let value = 2166136261;
  for (const char of text) { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); }
  return value >>> 0;
}

export function pick(items, key) { return items.length ? items[seed(key) % items.length] : null; }
export function shuffle(items, key) {
  const result = [...items];
  let state = seed(key);
  for (let i = result.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function safeUrl(value, hosts) {
  try { const url = new URL(value); return url.protocol === 'https:' && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)); }
  catch { return false; }
}

export function cardImageUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname === 'images.metmuseum.org') url.pathname = url.pathname.replace('/web-large/', '/web-thumb/');
    if (url.hostname === 'ids.si.edu' && !url.search && url.pathname.endsWith('&max=640')) {
      url.pathname=url.pathname.slice(0,-8);url.searchParams.set('max','640');
    }
    if (['inaturalist-open-data.s3.amazonaws.com', 'static.inaturalist.org'].includes(url.hostname)) {
      url.pathname = url.pathname.replace(/(\/photos\/\d+\/)original\.(jpe?g|png)$/i, '$1medium.$2');
    }
    return url.href;
  } catch { return value; }
}

export function isMediaAllowed(item) {
  if (!item?.image || !item.mediaAllowed) return false;
  if (['wikidata','wikipedia','nasaLibrary'].includes(item.sourceId)) return item.mediaVerified===true &&
    /^(CC0|Public domain|CC BY(?:-SA)? [\d.]+)$/i.test(item.mediaLicense || '') &&
    safeUrl(item.image,['upload.wikimedia.org','thumb.wikimedia.org']);
  if (item.sourceId === 'smithsonian') return item.publicDomain === true && item.license === 'CC0' && safeUrl(item.image,['ids.si.edu']);
  if (item.sourceId === 'met') return item.publicDomain === true && item.license === 'CC0' && safeUrl(item.image, ['images.metmuseum.org']);
  if (item.sourceId === 'cleveland') return item.publicDomain === true && item.license === 'CC0' && safeUrl(item.image, ['openaccess-cdn.clevelandart.org']);
  if (item.sourceId === 'chicago') return item.publicDomain === true && item.license === 'CC0' && safeUrl(item.image, ['artic.edu']);
  if (item.sourceId === 'gbif') {
    try { const url=new URL(item.image);return url.protocol==='https:' &&
      ['CC0', 'CC BY', 'CC BY-SA'].includes(item.license) && !!item.attribution &&
      /^https?:\/\/creativecommons\.org\/(publicdomain\/zero|licenses\/(by|by-sa))\//.test(item.licenseUrl || ''); }
    catch { return false; }
  }
  if (item.sourceId === 'nasa') return item.publicDomain === true && !item.copyright && safeUrl(item.image, ['nasa.gov']);
  return false;
}

export function normalize(item) {
  if (!item?.id || !item?.formatId || !item?.title || !item?.sourceName) return null;
  const fields = ['id', 'formatId', 'title', 'subtitle', 'description', 'image', 'imageAlt',
    'sourceName', 'sourceUrl', 'sourceItemUrl', 'author', 'license', 'licenseUrl',
    'attribution', 'date', 'facts', 'interaction', 'mediaAllowed'];
  const result = Object.fromEntries(fields.map(field => [field, item[field] ?? null]));
  result.sourceId = item.sourceId || null;
  result.publicDomain = item.publicDomain === true;
  result.copyright = item.copyright ?? null;
  result.unavailable = item.unavailable === true;
  for(const field of ['mediaVerified','mediaLicense','mediaLicenseUrl','mediaAttribution'])result[field]=item[field] ?? null;
  result.facts = Array.isArray(item.facts) ? item.facts.slice(0, 3) : [];
  result.sourceItemUrl = result.sourceItemUrl && safeUrl(result.sourceItemUrl,
    ['metmuseum.org','wikipedia.org','wikimedia.org','wikidata.org','opentdb.com','usgs.gov','nasa.gov','clevelandart.org','artic.edu','gbif.org','si.edu','n2t.net']) ? result.sourceItemUrl : null;
  result.image = isMediaAllowed(item) ? cardImageUrl(item.image) : null;
  result.mediaAllowed = !!result.image;
  return result;
}

export function dayCache(storage, date) {
  const prefix = `foly:v2:${dayKey(date)}:`;
  const expiry = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
  return {
    key: id => prefix + id,
    get(id) {
      try { const entry = JSON.parse(storage.getItem(prefix + id)); return entry?.expires === expiry && entry?.item ? entry.item : null; }
      catch { return null; }
    },
    set(id, item) { try { storage.setItem(prefix + id, JSON.stringify({ expires: expiry, item })); } catch { /* Quota or private browsing. */ } },
  };
}

export async function resolve(format, date, cache, loaders, fallback) {
  const key = `${format.source}:${format.id}`;
  const saved = cache.get(key);
  const needsImageRefresh=saved && saved.imageRevision!==4;
  if (saved?.formatId === format.id && saved?.title && saved?.sourceName && !needsImageRefresh) return normalize(saved);
  let item = null;
  try { item = normalize(await loaders[format.adapter]?.(format, date)); } catch { /* Safe fallback below. */ }
  if ((!item || !item.image) && ['met','cleveland','chicago'].includes(format.source)) {
    for(const adapter of ['cleveland','chicago']){
      if(adapter===format.adapter || !loaders[adapter])continue;
      try {
        const candidate=normalize(await loaders[adapter](format,date));
        if(candidate?.image){item=candidate;break;}
      }catch{ /* Try the next compatible museum. */ }
    }
  }
  if (!item) {
    try { item = normalize(await fallback(format, date)); } catch { item = null; }
  }
  if (item && !item.unavailable) cache.set(key, {...item,imageRevision:4});
  return item;
}

export function queueTasks(limit = 4) {
  let active = 0;
  const waiting = [];
  const drain = () => {
    while (active < limit && waiting.length) {
      const { task, done, fail } = waiting.shift(); active++;
      Promise.resolve().then(task).then(done, fail).finally(() => { active--; drain(); });
    }
  };
  return task => new Promise((done, fail) => { waiting.push({ task, done, fail }); drain(); });
}
import { pick, shuffle, dayKey, normalize, safeUrl, cardImageUrl } from './engine.js';
import { SOURCE_REGISTRY } from './registry.js';
import { responseCache, sharedRequests, batchLookup } from './performance.js';
import { shortDescription, entitySentence } from './copy.js';
import { centuryLabel } from './interactions.js';
import { imageAvailable } from './media-health.js';
import { scheduleRequest } from './resolution-network.js';

let storage;
try { storage = globalThis.localStorage; } catch { storage = null; }
const shared = sharedRequests(responseCache(storage, new Date()));
async function json(url) {
  return scheduleRequest(new URL(url,globalThis.location?.href || 'http://localhost/').href,async()=>{
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`),{status:response.status,retryAfter:response.headers.get('retry-after')});
    return await response.json();
  } finally { clearTimeout(timeout); }
  });
}
function item(format, source, id, title, fields = {}) {
  return normalize({ id: `${source}:${id}`, formatId: format.id, title, subtitle: '', description: '',
    image: null, imageAlt: title, sourceName: SOURCE_REGISTRY[source].name,
    sourceUrl: `https://${SOURCE_REGISTRY[source].host || 'example.org'}/`, sourceItemUrl: null,
    author: null, license: null, licenseUrl: null, attribution: null, date: null,
    facts: [], interaction: format.interaction || null, mediaAllowed: false, sourceId: source, ...fields });
}
function brief(text, max = 360) { return shortDescription(text, max); }
const commonsLookup = batchLookup(async filenames => {
  const data=await json('https://commons.wikimedia.org/w/api.php?'+new URLSearchParams({
    action:'query',format:'json',origin:'*',titles:filenames.map(filename=>`File:${filename}`).join('|'),
    prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'480',
  }));
  const pages=new Map(Object.values(data?.query?.pages || {}).map(page=>[page.title.replace(/^File:/,''),page.imageinfo?.[0]]));
  for(const change of data.query?.normalized || [])pages.set(change.from.replace(/^File:/,''),pages.get(change.to.replace(/^File:/,'')));
  return new Map(filenames.map(filename=>[filename,pages.get(filename)]));
});
export async function commonsMedia(filename) {
  if(!filename)return {};
  filename=filename.replace(/^File:/,'');
  const info=await shared(`commons:${filename}`,()=>commonsLookup(filename)).catch(()=>null);
  const meta=info?.extmetadata,license=meta?.LicenseShortName?.value || '';
  if(!/^(CC0|Public domain|CC BY(?:-SA)? [\d.]+)$/i.test(license) || /NC|ND/i.test(license))return {};
  if(!await imageAvailable(info.thumburl))return {};
  return {image:info.thumburl,imageAlt:filename.replace(/^File:/,''),
    mediaAllowed:true,mediaVerified:true,mediaLicense:license,
    mediaLicenseUrl:meta?.LicenseUrl?.value,mediaAttribution:brief(meta?.Artist?.value,120)};
}
const pageImageLookup = batchLookup(async titles => {
  const data=await json('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({
    action:'query',format:'json',origin:'*',prop:'pageimages',piprop:'name',titles:titles.join('|'),redirects:'1',
  }));
  const pages=new Map(Object.values(data?.query?.pages || {}).map(page=>[page.title,page.pageimage || null]));
  for(const change of [...(data.query?.redirects || []),...(data.query?.normalized || [])].reverse())pages.set(change.from,pages.get(change.to));
  return new Map(titles.map(title=>[title,pages.get(title)]));
});
async function wikipediaMedia(page, includeArticleImages=false) {
  const title=page?.titles?.normalized || page?.normalizedtitle || page?.title;
  if(!title)return {};
  const filename=await shared(`wiki-image:${title}`,()=>pageImageLookup(title)).catch(()=>null);
  const primary=await commonsMedia(filename);
  if(primary.image || !includeArticleImages)return primary;
  const data=await shared(`wiki-article-images:${title}`,()=>json('https://en.wikipedia.org/w/api.php?'+new URLSearchParams({
    action:'query',format:'json',origin:'*',prop:'images',titles:title,redirects:'1',imlimit:'10',
  }))).catch(()=>null);
  const files=Object.values(data?.query?.pages || {}).flatMap(entry=>entry.images || [])
    .map(entry=>entry.title).filter(name=>! /\.(svg|ogg|webm)$/i.test(name));
  for(const name of files.slice(0,3)){
    const media=await commonsMedia(name);
    if(media.image)return media;
  }
  return {};
}
const mm = date => String(date.getMonth() + 1).padStart(2, '0');
const dd = date => String(date.getDate()).padStart(2, '0');

export async function wikipediaFeatured(format, date) {
  const d = await shared(`featured:${dayKey(date)}`, () => json(`https://en.wikipedia.org/api/rest_v1/feed/featured/${date.getFullYear()}/${mm(date)}/${dd(date)}`));
  let selected = null;
  if (format.id === 'picture-of-the-day') selected = d.image;
  else if (format.id === 'most-read') selected = pick(d.mostread?.articles || [], `${dayKey(date)}:most-read`);
  else if (format.id === 'current-event') selected = pick(d.news || [], `${dayKey(date)}:news`);
  else if (format.id === 'rabbit-hole') selected = pick(d.mostread?.articles || [], `${dayKey(date)}:rabbit`);
  else selected = d.tfa;
  if (!selected) return null;
  const title = selected.normalizedtitle || selected.titles?.normalized || selected.title || selected.story;
  const url = selected.content_urls?.desktop?.page || selected.pages?.[0]?.content_urls?.desktop?.page ||
    (format.id === 'picture-of-the-day' && /^File:/.test(title) ? `https://commons.wikimedia.org/wiki/${encodeURIComponent(title).replace(/%3A/i, ':')}` : 'https://en.wikipedia.org/');
  const media=format.id==='picture-of-the-day' ? await commonsMedia(title) :
    ['featured-article','rabbit-hole','most-read'].includes(format.id) ? await wikipediaMedia(selected,true) : {};
  return item(format, 'wikipedia', selected.pageid || title, brief(title), {
    description: brief(selected.extract || selected.description?.text || selected.story || title),
    sourceItemUrl: safeUrl(url, ['wikipedia.org','wikimedia.org']) ? url : 'https://en.wikipedia.org/',
    license: 'CC BY-SA', attribution: 'Wikipedia contributors · CC BY-SA',
    ...media,
  });
}

export async function wikipediaOnThisDay(format, date) {
  const data = await shared(`onthisday:${mm(date)}:${dd(date)}`, () => json(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${mm(date)}/${dd(date)}`));
  const category = ({'born-today':'births','died-today':'deaths','historical-event':'events','anniversary':'selected'})[format.id] || 'selected';
  const selected = pick(data[category]?.length ? data[category] : data.events || [], `${dayKey(date)}:${format.id}`);
  if (!selected?.text) return null;
  const page = selected.pages?.[0];
  const media=format.id==='born-today' ? await wikipediaMedia(page) : {};
  const title=format.id==='died-today' ? page?.titles?.normalized || page?.normalizedtitle || page?.title || brief(selected.text,170) : `${selected.year || 'Today'} · ${format.title}`;
  return item(format, 'wikipedia', `${category}:${selected.year}:${brief(selected.text,40)}`, title, {
    description: brief(selected.text, 170), facts: [brief(selected.text, 170)],
    sourceItemUrl: page?.content_urls?.desktop?.page || 'https://en.wikipedia.org/',
    license: 'CC BY-SA', attribution: 'Wikipedia contributors · CC BY-SA', date: dayKey(date),
    ...media,
  });
}

const MET = 'https://collectionapi.metmuseum.org/public/collection';
export async function metArtwork(format, date) {
  const term = format.query?.term || 'art';
  const found = await shared(`met:${term}`, () => json(`${MET}/v1.1/search?hasImages=true&limit=60&q=${encodeURIComponent(term)}`));
  const ids = shuffle(found.objectIDs || [], `${dayKey(date)}:${format.id}`).slice(0, 6);
  for (const id of ids) {
    try {
      const record = await shared(`met:object:${id}`, () => json(`${MET}/v1/objects/${id}`));
      if (record.isPublicDomain !== true || !safeUrl(record.primaryImageSmall, ['images.metmuseum.org']) ||
        !safeUrl(record.objectURL, ['metmuseum.org'])) continue;
      if (format.id === 'guess-artist' && !record.artistDisplayName) continue;
      if (format.id === 'guess-material' && !record.medium) continue;
      if (format.id === 'guess-century' && !centuryLabel(record.objectBeginDate)) continue;
      if(!await imageAvailable(cardImageUrl(record.primaryImageSmall)))continue;
      const answer = format.id === 'guess-artist' ? record.artistDisplayName :
        format.id === 'guess-material' ? record.medium : format.id === 'guess-century' ?
          centuryLabel(record.objectBeginDate) : record.title || 'Untitled';
      const hidden = !!format.interaction && format.interaction !== 'caption';
      const prompt = format.interaction === 'caption' ? 'Give this artwork a new caption.' : format.title;
      const label = hidden ? prompt : answer;
      return item(format, 'met', id, label, {
        description: hidden ? 'Tap Reveal to discover the object.' : brief([record.artistDisplayName, record.objectDate].filter(Boolean).join(' · ')),
        image: record.primaryImageSmall, imageAlt: hidden ? 'Museum artwork to discover' : answer,
        sourceItemUrl: record.objectURL, license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        attribution: 'The Met · Open Access · CC0', mediaAllowed: true, publicDomain: true,
        facts: hidden ? [] : [brief(record.objectDate), brief(record.medium), brief(record.artistDisplayName)].filter(Boolean),
        interaction: hidden ? { type: format.id==='guess-crop' ? 'crop' : 'reveal', answer, details: brief([record.objectDate, record.medium, record.artistDisplayName].filter(Boolean).join(' · ')) } :
          format.interaction === 'caption' ? { type: 'caption', answer: pick(['Me, pretending I have a plan.', 'When the group chat goes quiet.', 'Just one more masterpiece.'], `${dayKey(date)}:caption:${id}`) } : null,
      });
    } catch { /* Try another verified record. */ }
  }
  return null;
}

export async function cleveland(format, date) {
  const term = format.query?.term || 'painting';
  const d = await shared(`cleveland:${term}`, () => json(`https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&limit=30&q=${encodeURIComponent(term)}`));
  const candidates = shuffle(d.data || [], `${dayKey(date)}:${format.id}`).filter(r => r.share_license_status === 'CC0' &&
    safeUrl(r.images?.web?.url, ['openaccess-cdn.clevelandart.org']) && safeUrl(r.url, ['clevelandart.org']));
  for(const record of candidates.slice(0,3)){
  if(!await imageAvailable(record.images.web.url))continue;
  const result=item(format, 'cleveland', record.id, record.title, { description: brief(record.creation_date),
    image: record.images.web.url, imageAlt: record.title, sourceItemUrl: record.url,
    license: 'CC0', attribution: 'Cleveland Museum of Art · CC0', mediaAllowed: true, publicDomain: true });
  const presented=museumPresentation(format,result,record.creators?.[0]?.description,record.creation_date_earliest,record.technique);
  if(presented)return presented;
  }
  return null;
}

function museumPresentation(format,result,artist,year,medium){
  if(!format.interaction)return result;
  const answer=format.id==='guess-artist'?artist:format.id==='guess-century'?centuryLabel(year):format.id==='guess-material'?medium:result.title;
  if(!answer)return null;
  return {...result,title:format.title,imageAlt:'Museum object to discover',facts:[],description:'',author:null,
    interaction:{type:format.id==='guess-crop'?'crop':'reveal',answer,details:[result.description,medium,artist].filter(Boolean).join(' · ')}};
}

export async function chicago(format,date){
  const term=format.query?.term || 'art';
  const fields='id,title,image_id,is_public_domain,artist_display,date_display,date_start,medium_display';
  const data=await shared(`chicago:${term}`,()=>json('https://api.artic.edu/api/v1/artworks/search?'+new URLSearchParams({
    q:term,limit:'30',fields,'query[term][is_public_domain]':'true',
  })));
  const base=data.config?.iiif_url;
  if(!safeUrl(base,['artic.edu']))return null;
  for(const record of shuffle(data.data || [],`${dayKey(date)}:${format.id}`).slice(0,4)){
    if(record.is_public_domain!==true || !record.image_id)continue;
    const image=`${base}/${encodeURIComponent(record.image_id)}/full/600,/0/default.jpg`;
    if(!await imageAvailable(image))continue;
    const result=item(format,'chicago',record.id,record.title,{image,imageAlt:record.title,
      description:brief([record.artist_display,record.date_display].filter(Boolean).join(' · ')),
      sourceItemUrl:`https://www.artic.edu/artworks/${record.id}`,publicDomain:true,mediaAllowed:true,
      license:'CC0',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Art Institute of Chicago · CC0'});
    const presented=museumPresentation(format,result,record.artist_display,record.date_start,record.medium_display);
    if(presented)return presented;
  }
  return null;
}

export function snapshot(format, date) {
  const record = format.query?.record;
  if (!record?.id || !record.title || !safeUrl(record.image, ['images.metmuseum.org']) ||
      !safeUrl(record.url, ['metmuseum.org'])) return null;
  const hidden = format.interaction === 'reveal';
  return item(format, 'met', record.id, hidden ? format.title : record.title, {
    description: hidden ? 'What could this object be? Reveal to find out.' : brief(record.detail, 150),
    image: record.image.replace('/web-large/', '/web-thumb/'),
    imageAlt: hidden ? 'Museum object to identify' : record.title,
    sourceItemUrl: record.url,
    license: 'CC0', attribution: 'The Met · Open Access · CC0',
    mediaAllowed: true, publicDomain: true,
    interaction: hidden ? { type: 'reveal', answer: record.title, details: brief(record.detail, 150) } : null,
  });
}

export async function wikidata(format, date) {
  const category = format.query?.category;
  const pools = await shared('knowledge:pools', () => json('./data/knowledge-pools.json'));
  if (!pools[category]) return null;
  const categories = Object.keys(pools);
  const group = Math.floor(categories.indexOf(category) / 5);
  const ids = [...new Set(categories.slice(group*5,group*5+5).flatMap(key => pools[key]))];
  const data = await shared(`knowledge:group:${group}`, () => json('https://www.wikidata.org/w/api.php?' + new URLSearchParams({
    action:'wbgetentities',format:'json',origin:'*',ids:ids.join('|'),languages:'en|mul',languagefallback:'1',props:'labels|descriptions|sitelinks',sitefilter:'enwiki',redirects:'yes',
  })));
  const candidates = pools[category].map(id=>data.entities?.[id]).filter(entity=>entity?.labels?.en?.value || entity?.labels?.mul?.value);
  const ordered=shuffle(candidates,`${dayKey(date)}:${format.id}`);
  let backup=null;
  for(const chosen of ordered.slice(0,3)){
  if (!chosen) return null;
  const title = chosen.labels.en?.value || chosen.labels.mul?.value;
  const pageTitle=chosen.sitelinks?.enwiki?.title;
  const filename=pageTitle ? await shared(`wiki-image:${pageTitle}`,()=>pageImageLookup(pageTitle)).catch(()=>null) : null;
  let media=await commonsMedia(filename);
  if(!media.image){
    const images=await shared(`knowledge:images:${chosen.id}`,()=>json('https://www.wikidata.org/w/api.php?'+new URLSearchParams({
      action:'wbgetentities',format:'json',origin:'*',ids:chosen.id,props:'claims',
    }))).catch(()=>null);
    const claims=images?.entities?.[chosen.id]?.claims;
    const candidates=[...(claims?.P18 || []),...(category==='language' ? claims?.P242 || [] : [])].map(claim=>claim.mainsnak?.datavalue?.value).filter(value=>typeof value==='string');
    for(const candidate of candidates.slice(0,3)){
      media=await commonsMedia(candidate);
      if(media.image)break;
    }
  }
  const result=item(format, 'wikidata', chosen.id, title, {
    description: entitySentence(title, chosen.descriptions?.en?.value), sourceItemUrl: `https://www.wikidata.org/wiki/${chosen.id}`,
    license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', attribution: 'Wikidata · CC0',
    ...media,
  });
  backup ||= result;
  if(result.image)return result;
  }
  return backup;
}

export async function trivia(format, date) {
  const d = await shared('trivia:daily', () => json('https://opentdb.com/api.php?amount=10&type=multiple'));
  const question = pick(d.results || [], `${dayKey(date)}:${format.id}`);
  if (!question?.question || !question.correct_answer) return null;
  const decode = text => { const textarea = typeof document !== 'undefined' ? document.createElement('textarea') : null;
    if (!textarea) return String(text); textarea.innerHTML = text; return textarea.value; };
  const answer = decode(question.correct_answer);
  return item(format, 'trivia', `${dayKey(date)}:${format.id}`, decode(question.question), {
    description: '', sourceItemUrl: 'https://opentdb.com/', license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', attribution: 'Open Trivia DB · CC BY-SA 4.0',
    interaction: { type: 'quiz', answer, options: shuffle([answer, ...(question.incorrect_answers || []).map(decode)], `${dayKey(date)}:${format.id}:options`) },
  });
}

export async function earthquake(format, date) {
  const d = await shared(`usgs:${dayKey(date)}`, () => json('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson'));
  const event = [...(d.features || [])].filter(e => Number.isFinite(e.properties?.mag)).sort((a,b) => b.properties.mag-a.properties.mag)[0];
  if (!event) return item(format, 'usgs', dayKey(date), 'Quiet Earth today', { description: 'No matching earthquake in the past-day feed.', sourceItemUrl:'https://earthquake.usgs.gov/earthquakes/map/', license:'Public domain', attribution:'USGS' });
  return item(format, 'usgs', event.id, `M ${event.properties.mag.toFixed(1)} · ${event.properties.place || 'Unknown location'}`, {
    description: `Depth: ${Number(event.geometry?.coordinates?.[2] || 0).toFixed(1)} km · ${new Date(event.properties.time).toLocaleString()}`,
    sourceItemUrl: event.properties.url, date: new Date(event.properties.time).toISOString(), license:'Public domain', attribution:'USGS',
  });
}

export function moon(format, date) {
  const phase = (((date.getTime()/1000 - 947182440) % 2551443) + 2551443) % 2551443 / 2551443;
  const names = ['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  return item(format, 'local', dayKey(date), names[Math.floor(phase*8+.5)%8], {
    description: `Approximate illumination: ${Math.round((1-Math.cos(phase*2*Math.PI))*50)}%`,
    sourceName: 'Foly calculation', sourceUrl: null, date: dayKey(date), license: 'Original',
  });
}

export async function apod(format, date) {
  const code=String(date.getFullYear()).slice(-2)+mm(date)+dd(date);
  const d = await shared(`apod:date:${dayKey(date)}`, () => json(`https://science.nasa.gov/wp-json/wp/v2/apod-basic/${code}`));
  const entry = Array.isArray(d) ? d.find(x => x.date === dayKey(date)) : d?.date===dayKey(date) ? d : null;
  if (!entry) return null;
  let image=null;
  if(entry.media_type==='image' && !entry.copyright){
    const candidate=entry.hdurl || entry.url;
    if(safeUrl(candidate,['assets.science.nasa.gov']) && /\.(png|jpe?g|webp)(?:\?|$)/i.test(candidate)){
      const url=new URL(candidate);url.searchParams.set('w','640');url.searchParams.set('h','480');url.searchParams.set('fit','contain');image=url.href;
    }
  }
  return item(format, 'nasa', entry.date, entry.title, { description: brief(entry.explanation),
    image,imageAlt:entry.alt || entry.title,mediaAllowed:!!image,publicDomain:!!image,
    sourceItemUrl: entry.permalink, date: entry.date, author: brief(entry.credit),
    copyright: entry.copyright, license: entry.copyright ? 'Third-party copyright' : 'NASA media; verify rights',
    attribution: `NASA APOD${entry.credit ? ` · ${brief(entry.credit,60)}` : ''}`,
    // Copyright-bearing APOD images remain metadata only, even on NASA hosting.
  });
}

const TAXA = {animal:1,bird:212,fish:204,reptile:358,amphibian:131,insect:216,flower:220,tree:6,plant:6};
export async function gbif(format,date) {
  const category=format.query?.taxon;
  let taxon=TAXA[category];
  if(['tree','flower'].includes(category)){
    const match=await shared(`gbif:match:${category}`,()=>json('https://api.gbif.org/v1/species/match?name='+
      encodeURIComponent(category==='tree'?'Quercus robur':'Rosa canina')));
    taxon=match.usageKey;
  }
  if(!taxon)return null;
  let data;
  if(['reptile','fish','plant'].includes(category)){
    const species=shuffle(category==='plant' ? ['Taraxacum officinale','Urtica dioica','Plantago major'] : category==='fish' ? ['Salmo salar','Amphiprion ocellaris','Esox lucius'] :
      ['Lacerta agilis','Chelonia mydas','Crocodylus niloticus'],`${dayKey(date)}:${category}`);
    for(const name of species){
      try{
        const match=await shared(`gbif:${category}-match:${name}`,()=>json('https://api.gbif.org/v1/species/match?name='+encodeURIComponent(name)));
        if(match.rank!=='SPECIES' || !match.usageKey || match.matchType==='HIGHERRANK')continue;
        const found=await shared(`gbif:${category}-occurrences:${match.usageKey}`,()=>json(`https://api.gbif.org/v1/occurrence/search?taxonKey=${match.usageKey}&mediaType=StillImage&limit=30`));
        if(found.results?.some(row=>row.species || row.scientificName)){
          data=found;
          if(category!=='plant' || found.results.some(row=>(row.media || []).some(media=>media.type==='StillImage' &&
            /^https:\/\//.test(media.identifier || '') && /creativecommons\.org\/(publicdomain\/zero|licenses\/(by|by-sa))\//.test(media.license || ''))))break;
        }
      }catch{ /* Try the next species when its occurrence pool is unavailable. */ }
    }
    if(!data)return null;
  }else data=await shared(`gbif:${category}`,()=>json(`https://api.gbif.org/v1/occurrence/search?taxonKey=${taxon}&mediaType=StillImage&limit=30`));
  const entries=shuffle(data.results || [],`${dayKey(date)}:${format.id}`).filter(row=>row.species || row.scientificName);
  const permitted=entries.filter(record=>(record.media || []).some(media=>media.type==='StillImage'&&
    /creativecommons\.org\/(publicdomain\/zero|licenses\/(by|by-sa))\//.test(media.license || '')));
  let record=null;
  for(const candidate of permitted.slice(0,4)){
    const photo=(candidate.media || []).find(media=>media.type==='StillImage' && /^https:\/\//.test(media.identifier || '') &&
      /creativecommons\.org\/(publicdomain\/zero|licenses\/(by|by-sa))\//.test(media.license || ''));
    if(photo && await imageAvailable(cardImageUrl(photo.identifier))){record=candidate;break;}
  }
  const hasWorkingImage=!!record;
  record ||= entries[0];if(!record)return null;
  // Metadata stays usable even if every occurrence photo is restricted.
  let media=null,license=null;
  for(const candidate of hasWorkingImage ? record.media || [] : []){
    const url=candidate.license || '';
    const allowed=/creativecommons\.org\/(publicdomain\/zero|licenses\/(by|by-sa))\//.test(url);
    if(candidate.type==='StillImage'&&allowed&&/^https:\/\//.test(candidate.identifier || '')){
      media=candidate;license=url.includes('/zero/')?'CC0':url.includes('/by-sa/')?'CC BY-SA':'CC BY';break;
    }
  }
  return item(format,'gbif',record.key,record.species || record.scientificName,{
    description:record.family ? `${record.species || record.scientificName} belongs to the ${record.family} family.` : '',
    facts:[record.order,record.country].filter(Boolean),
    image:media?.identifier || null,license:license || 'Per-record data license',licenseUrl:media?.license,
    author:media?.creator || media?.rightsHolder,
    attribution:media ? [media.creator || media.rightsHolder,'GBIF',license].filter(Boolean).join(' · ') : 'GBIF publisher metadata',
    mediaAllowed:!!media,sourceItemUrl:`https://www.gbif.org/occurrence/${record.key}`,
  });
}

export async function nasaLibrary(format,date){
  const query=format.id==='spacecraft'?'spacecraft':pick(['Apollo 11','Apollo 17','Voyager 1','STS-41-B'],`${dayKey(date)}:mission`);
  const data=await shared(`nasa-library:${query}`,()=>json(`https://images-api.nasa.gov/search?media_type=image&page_size=30&q=${encodeURIComponent(query)}`));
  const record=pick(data.collection?.items || [],`${dayKey(date)}:${format.id}`),meta=record?.data?.[0];
  if(!meta?.title)return null;
  const media=format.id==='space-mission' ? await wikipediaMedia({title:query},true) : {};
    // No automatic ownership inference from a NASA search result.
  return item(format,'nasaLibrary',meta.nasa_id,meta.title,{
    description:brief(meta.description),author:meta.photographer || meta.secondary_creator || meta.center,
    sourceItemUrl:`https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`,
    license:'Per-item NASA media policy',attribution:meta.center || 'NASA Image Library',
    ...media,
  });
}

export async function smithsonian(format,date){
  const data=await shared('smithsonian:snapshot',()=>json('./data/smithsonian.json'));
  for(const record of shuffle(data.pools?.[format.id] || [],`${dayKey(date)}:${format.id}`).slice(0,4)){
  if(record.license!=='CC0' || record.mediaLicense!=='CC0')continue;
  if(!await imageAvailable(cardImageUrl(record.image)))continue;
  return item(format,'smithsonian',record.id,record.title,{
    description:brief(record.description),image:record.image,sourceItemUrl:record.url,
    publicDomain:true,mediaAllowed:true,license:'CC0',attribution:'Smithsonian Open Access · CC0',
  });
  }
  return null;
}

export const ADAPTERS = Object.freeze({
  featured: wikipediaFeatured, onthisday: wikipediaOnThisDay, metArtwork, cleveland, chicago, snapshot, wikidata,
  trivia, earthquake, moon, apod, gbif, nasaLibrary, smithsonian,
});
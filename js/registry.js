import { shuffle, dayKey } from './engine.js';
import { configureProviders } from './provider-config.js';

export const SOURCE_REGISTRY = Object.freeze({
  rijksmuseum:{id:'rijksmuseum',name:'Rijksmuseum',host:'data.rijksmuseum.nl',mode:'runtime',requiresKey:false,licenseMode:'per-item',attributionRequired:true,supportsStaticFrontend:true},
  noaa:{id:'noaa',name:'NOAA SWPC',host:'services.swpc.noaa.gov',mode:'runtime',requiresKey:false,licenseMode:'US_GOV_PUBLIC_DOMAIN',attributionRequired:true,supportsStaticFrontend:true},
  wellcome:{id:'wellcome',name:'Wellcome Collection',host:'api.wellcomecollection.org',mode:'runtime',requiresKey:false,licenseMode:'per-item',attributionRequired:true,supportsStaticFrontend:true},
  inaturalist:{id:'inaturalist',name:'iNaturalist',host:'api.inaturalist.org',mode:'runtime',requiresKey:false,licenseMode:'per-item',attributionRequired:true},
  openverse:{id:'openverse',name:'Openverse',host:'api.openverse.org',mode:'runtime',requiresKey:false,licenseMode:'per-item',attributionRequired:true},
  wikidata: { id: 'wikidata', name: 'Wikidata', licenseMode: 'CC0 structured data', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: false, host: 'query.wikidata.org' },
  wikipedia: { id: 'wikipedia', name: 'Wikipedia', licenseMode: 'CC BY-SA text; per-image rights', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'en.wikipedia.org' },
  met: { id: 'met', name: 'The Metropolitan Museum of Art', licenseMode: 'public-domain-only', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: false, host: 'collectionapi.metmuseum.org' },
  chicago: { id: 'chicago', name: 'Art Institute of Chicago', licenseMode: 'public-domain-only', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: false, host: 'api.artic.edu' },
  cleveland: { id: 'cleveland', name: 'Cleveland Museum of Art', licenseMode: 'CC0 artwork and media', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: false, host: 'openaccess-api.clevelandart.org' },
  smithsonian: { id: 'smithsonian', name: 'Smithsonian Open Access', licenseMode: 'per-item static snapshot only', commercialSafe: false, requiresKey: true, supportsStaticFrontend: false, attributionRequired: true },
  trivia: { id: 'trivia', name: 'Open Trivia DB', licenseMode: 'CC BY-SA 4.0', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'opentdb.com' },
  usgs: { id: 'usgs', name: 'USGS', licenseMode: 'public domain', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'earthquake.usgs.gov' },
  nasa: { id: 'nasa', name: 'NASA APOD', licenseMode: 'per-item copyright check', commercialSafe: false, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'science.nasa.gov' },
  nasaLibrary: { id: 'nasaLibrary', name: 'NASA Image Library', licenseMode: 'per-item', commercialSafe: false, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'images-api.nasa.gov' },
  gbif: { id: 'gbif', name: 'GBIF', licenseMode: 'per-item', allowedLicenses: ['CC0', 'CC BY', 'CC BY-SA'], commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'api.gbif.org' },
  naturalEarth: { id: 'naturalEarth', name: 'Natural Earth', licenseMode: 'public domain', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: false },
  wiktionary: { id: 'wiktionary', name: 'Wiktionary', licenseMode: 'CC BY-SA text', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: true, host: 'en.wiktionary.org' },
  local: { id: 'local', name: 'Foly', licenseMode: 'original', commercialSafe: true, requiresKey: false, supportsStaticFrontend: true, attributionRequired: false },
});

const formats = [];
const dailyTitleFormats = new Set(['picture-of-the-day', 'space-image']);
const add = (id, title, group, source, adapter, query = {}, interaction = null, enabled = true) =>
  formats.push({ id, title: dailyTitleFormats.has(id) ? title : title.replace(/ of the Day$/i, ''), group, source, adapter, query, interaction,
    enabled: ['wikidata','gbif','nasaLibrary','smithsonian'].includes(adapter) && !interaction ? true : enabled });

const knowledge = [
  'Person','Scientist','Inventor','Artist','Writer','Philosopher','Explorer','Architect','Composer','Athlete',
  'Country','City','Island','Mountain','River','Lake','Waterfall','Castle','Bridge','Landmark',
  'Dinosaur','Mineral','Gemstone','Chemical Element','Volcano','Cave',
  'Planet','Moon','Exoplanet','Star','Constellation','Galaxy','Nebula','Asteroid','Comet',
  'Book','Film','Song','Album','Video Game','Board Game','Language','Writing System','Mythological Figure','Architectural Style',
  'Invention','Discovery','Scientific Concept','Mathematical Concept','Unit of Measurement',
];
const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/,'');
knowledge.forEach((name, index) => add(slug(name), `${name} of the Day`, index < 10 ? 'know' : 'see', 'wikidata', 'wikidata', { category: slug(name) }, null, false));

[
  ['on-this-day','On This Day','onthisday'],['born-today','Born Today','onthisday'],
  ['died-today','Died Today','onthisday'],['featured-article','Featured Article','featured'],
  ['picture-of-the-day','Picture of the Day','featured'],['most-read','Most Read','featured'],
  ['current-event','Current Event','featured'],['rabbit-hole','Wikipedia Rabbit Hole','featured'],
  ['historical-event','Historical Event','onthisday'],['anniversary','Anniversary','onthisday'],
].forEach(([id,title,adapter]) => add(id,title,'today','wikipedia',adapter));

[
  ['artwork','Artwork','art'],['painting','Painting','painting'],['sculpture','Sculpture','sculpture'],
  ['ancient-artifact','Ancient Artifact','ancient'],['coin','Coin','coin'],['jewelry','Jewelry','jewelry'],
  ['armor','Armor','armor'],['musical-instrument','Musical Instrument','musical instrument'],
  ['fashion-object','Fashion Object','costume'],['manuscript','Manuscript','manuscript'],
].forEach(([id,title,q]) => add(id,title,'see','met','metArtwork',{ term:q }));

[
  ['mystery-object','Mystery Object','ancient','reveal'],['what-used-for','What Was This Used For?','ancient','reveal'],
  ['weapon-or-decoration','Weapon or Decoration?','armor','reveal'],['guess-century','Guess the Century','painting','reveal'],
  ['guess-artist','Guess the Artist','painting','reveal'],['guess-material','Guess the Material','ancient','reveal'],
  ['guess-artwork','Guess the Artwork','art','reveal'],['guess-crop','Guess From the Crop','art','reveal'],
].forEach(([id,title,q,interaction]) => add(id,title,'play','met','metArtwork',{term:q},interaction));

add('trivia','Trivia','play','trivia','trivia');
add('question','Question','play','trivia','trivia');
add('earthquake','Earthquake','today','usgs','earthquake');
add('space-image','Space Image','today','nasa','apod');
add('spacecraft','Spacecraft','see','nasaLibrary','nasaLibrary',{},null,false);
add('space-mission','Space Mission','know','nasaLibrary','nasaLibrary',{},null,false);

['animal','bird','fish','reptile','amphibian','insect','flower','tree','plant'].forEach(name =>
  add(name,`${name[0].toUpperCase()}${name.slice(1)} of the Day`,'see','gbif','gbif',{taxon:name},null,false));

['fossil','historical-object','aircraft','machine','tool','strange-object','museum-oddity'].forEach(name =>
  add(name,`${name.split('-').map(part => part[0].toUpperCase()+part.slice(1)).join(' ')} of the Day`,'see','smithsonian','smithsonian',{},null,false));

const CORE_FORMATS = Object.freeze(formats.slice());
// Editorial replacements preserve the total of 100 while introducing independent sources.
Object.assign(formats.find(f=>f.id==='most-read'),{id:'geomagnetic-activity',title:'Geomagnetic Activity',source:'noaa',adapter:'spaceWeather',query:{},enabled:true});
Object.assign(formats.find(f=>f.id==='strange-object'),{id:'anatomy-illustration',title:'Anatomy Illustration',source:'wellcome',adapter:'wellcome',query:{term:'anatomy illustration',originalCaption:true},enabled:true});
add('moon-phase','Moon Phase','today','local','moon');

const extra = [
  ['photography','Photography','see','cleveland','cleveland',{term:'photograph'}],
  ['textile','Textile','see','cleveland','cleveland',{term:'textile'}],
  ['odd-one-out','Odd One Out','play','met','metArtwork',{term:'art'},'reveal',false],
  ['caption-this','Caption This','play','met','metArtwork',{term:'painting'},'caption'],
  ['foly-meme','Foly Meme','play','met','metArtwork',{term:'painting'},'caption'],
  ['word','Word','know','wiktionary','wiktionary',{},null,false],
  ['fossil-finds','Fossil Finds','see','smithsonian','smithsonian',{},null,false],
  ['country-silhouette','Country Silhouette','play','naturalEarth','naturalEarth',{},null,false],
  ['true-or-false','True or False?','play','wikidata','wikidata',{category:'scientist'},'reveal',false],
  ['guess-who','Guess Who?','play','wikidata','wikidata',{category:'scientist'},'reveal',false],
  ['older-or-newer','Older or Newer?','play','met','metArtwork',{term:'art'},'reveal',false],
  ['art-or-everyday','Art or Everyday Object?','play','met','metArtwork',{term:'ancient'},'reveal',false],
  ['material-challenge','Material Challenge','play','met','metArtwork',{term:'art'},'reveal',false],
  ['ancient-or-modern','Ancient or Modern?','play','met','metArtwork',{term:'ancient'},'reveal',false],
  ['photo','Photograph','see','cleveland','cleveland',{term:'photography'}],
  ['art-history','Art History','know','met','metArtwork',{term:'art'}],
  ['museum-discovery','Museum Discovery','know','cleveland','cleveland',{term:'art'}],
];
extra.forEach(([id,title,group,source,adapter,query={},interaction=null,enabled=true]) => add(id,title,group,source,adapter,query,interaction,enabled));
// Keep legacy fields during migration; the new resolver reads this configuration.
formats.forEach(format=>Object.assign(format,configureProviders(format)));

// The first hundred are exactly the requested 100; extensions are registered separately.
export const FORMAT_REGISTRY = Object.freeze(formats);
export { CORE_FORMATS };
export const EXTENDED_FORMATS = Object.freeze(formats.slice(100));

export function dailyFormats(date, count = 20) {
  const available = formats.filter(f => f.enabled);
  const must = ['on-this-day','born-today','died-today','featured-article','picture-of-the-day',
    'geomagnetic-activity','current-event','earthquake','space-image','moon-phase'];
  const anchors = must.map(id => available.find(f => f.id === id)).filter(Boolean);
  const key = dayKey(date);
  const groups = ['play','see','know'];
  const groupPicks = groups.flatMap(group => shuffle(available.filter(f => f.group === group && !anchors.includes(f)), `${key}:${group}`).slice(0, group === 'know' ? 2 : 3));
  const chosen = [...new Set([...anchors, ...groupPicks])];
  chosen.push(...shuffle(available.filter(f => !chosen.includes(f)), `${key}:rest`).slice(0, Math.max(0,count-chosen.length)));
  return shuffle(chosen.slice(0,count), `${key}:layout`);
}

// The homepage uses the actual core formats, never museum filler cards.
export function editionFormats(date) {
  return shuffle(CORE_FORMATS, `${dayKey(date)}:edition`);
}
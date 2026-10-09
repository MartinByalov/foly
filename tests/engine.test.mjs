import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dayKey, seed, shuffle, dayCache, normalize, isMediaAllowed, resolve, queueTasks } from '../js/engine.js';
import { CORE_FORMATS, FORMAT_REGISTRY, SOURCE_REGISTRY, dailyFormats, editionFormats } from '../js/registry.js';
import { ADAPTERS } from '../js/adapters.js';
import { RUNTIME_POOLS } from '../js/runtime-pools.js';
import { fallback } from '../js/fallback.js';

const date = new Date(2026, 9, 8, 12);
const records = JSON.parse(await readFile(new URL('../data/collection.json', import.meta.url), 'utf8'));
const format = FORMAT_REGISTRY.find(f => f.id === 'painting');
const valid = { id: 'sample', formatId: format.id, title:'Artwork',sourceId:'met',
  sourceName:'The Met',image:records[0].image,license:'CC0',publicDomain:true,mediaAllowed:true };

test('registries contain 100 distinct core formats and usable adapters', () => {
  assert.equal(CORE_FORMATS.length, 100);
  assert.equal(new Set(FORMAT_REGISTRY.map(f => f.id)).size, FORMAT_REGISTRY.length);
  assert.ok(Object.keys(SOURCE_REGISTRY).length >= 12);
  for (const f of FORMAT_REGISTRY.filter(f => f.enabled)) assert.equal(typeof RUNTIME_POOLS[f.providers[0].adapter], 'function', f.id);
});

test('daily selection is seeded, balanced and includes date-linked formats', () => {
  const first = dailyFormats(date);
  assert.deepEqual(dailyFormats(date), first);
  assert.equal(first.length,20);
  assert.ok(new Set(first.map(f => f.id)).size === 20);
  assert.ok(['play','see','know','today'].every(group => first.some(f => f.group === group)));
  for (const id of ['on-this-day','born-today','died-today','featured-article','picture-of-the-day','geomagnetic-activity','current-event','earthquake','space-image','moon-phase'])
    assert.ok(first.some(f => f.id === id), id);
  assert.equal(dayKey(date), '2026-10-08');
  assert.equal(seed('2026-10-08'), seed('2026-10-08'));
  assert.deepEqual(shuffle([1,2,3,4,5], '2026-10-08'), shuffle([1,2,3,4,5], '2026-10-08'));
});

test('homepage renders the 100 actual source-backed core formats, not collection substitutes', () => {
  const edition = editionFormats(date);
  assert.equal(edition.length, 100);
  assert.equal(new Set(edition.map(f => f.id)).size, 100);
  assert.deepEqual(editionFormats(date).map(f => f.id), edition.map(f => f.id));
  assert.deepEqual([...edition.map(f=>f.id)].sort(),[...CORE_FORMATS.map(f=>f.id)].sort());
  assert.equal(edition.filter(f => f.adapter === 'snapshot').length, 0);
  assert.ok(['play','see','know','today'].every(group => edition.some(f => f.group === group)));
  for (const f of edition) assert.equal(typeof RUNTIME_POOLS[f.providers[0].adapter],'function',f.id);
});

test('homepage uses the actual Wix video without a separate poster or pause control', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../js/ui.js', import.meta.url), 'utf8');
  assert.match(html, /<video class="background-video" muted playsinline preload="auto">/);
  assert.doesNotMatch(html, /poster=/);
  assert.match(html, /video\.wixstatic\.com/);
  assert.doesNotMatch(html, /autoplay|backgroundToggle|class="background-image"/);
  assert.match(html, /class="cards" id="cards"/);
  assert.doesNotMatch(html, /<footer class="credits"/);
  assert.match(renderer, /credit\.textContent = item\.sourceName/);
});

test('all 50 knowledge categories have verified entity candidate pools', async () => {
  const pools=JSON.parse(await readFile(new URL('../data/knowledge-pools.json',import.meta.url),'utf8'));
  const formats=CORE_FORMATS.filter(f=>f.adapter==='wikidata');
  assert.equal(formats.length,50);
  for(const format of formats){
    assert.ok(pools[format.query.category]?.length>=1,format.id);
    assert.ok(pools[format.query.category].every(id=>/^Q\d+$/.test(id)),format.id);
  }
});

test('Smithsonian static pools retain source and per-media CC0 evidence', async () => {
  const data=JSON.parse(await readFile(new URL('../data/smithsonian.json',import.meta.url),'utf8'));
  for(const format of CORE_FORMATS.filter(f=>f.adapter==='smithsonian')){
    assert.ok(data.pools[format.id]?.length,format.id);
    for(const record of data.pools[format.id]){
      assert.equal(record.license,'CC0');assert.equal(record.mediaLicense,'CC0');
      assert.match(record.image,/^https:\/\/ids\.si\.edu\//);
      assert.match(record.provenance,/smithsonian-open-access/);
    }
  }
});

test('a failed format is never replaced by unrelated art or cached all day', async () => {
  const data=new Map();
  const cache=dayCache({getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},date);
  const format=CORE_FORMATS.find(f=>f.id==='person');
  const result=await resolve(format,date,cache,{wikidata:async()=>null},fallback);
  assert.equal(result.title,format.title);assert.equal(result.image,null);
  assert.equal(result.unavailable,true);assert.equal(data.size,0);
});

test('only verified, permitted media is displayed', () => {
  assert.equal(isMediaAllowed(valid),true);
  assert.equal(normalize(valid).image, valid.image.replace('/web-large/', '/web-thumb/'));
  assert.equal(normalize({...valid, publicDomain:false}).image,null);
  assert.equal(normalize({...valid, image:'https://evil.example/photo.jpg'}).image,null);
  assert.equal(normalize({...valid, sourceId:'wikipedia'}).image,null);
  assert.equal(normalize({...valid,sourceId:'gbif',license:'CC BY-NC',attribution:'A'}).image,null);
  assert.equal(normalize({...valid,sourceId:'nasa',copyright:'Photographer',image:'https://science.nasa.gov/photo.jpg'}).image,null);
});

test('day cache suppresses repeat requests, expires at local midnight and uses fallback', async () => {
  const data = new Map();
  const storage = {getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value)};
  const cache = dayCache(storage,date);
  let calls = 0;
  const loaders = {metArtwork: async()=>{calls++;return valid;}};
  const fallback = async()=>valid;
  assert.equal((await resolve(format,date,cache,loaders,fallback)).title,'Artwork');
  await resolve(format,date,cache,loaders,fallback);
  assert.equal(calls,1);
  assert.match([...data.keys()][0],/^foly:v2:2026-10-08:met:painting$/);
  assert.equal(dayCache(storage,new Date(2026,9,9)).get('met:painting'),null);
  assert.equal((await resolve({...format,id:'broken'},date,cache,{metArtwork:async()=>{throw Error('offline');}},fallback)).title,'Artwork');
});

test('queue runs at most four tasks at once', async () => {
  const enqueue = queueTasks(4);
  let active = 0, peak = 0;
  await Promise.all(Array.from({length:16},(_,i)=>enqueue(async()=>{
    active++; peak=Math.max(active,peak);
    await new Promise(done=>setTimeout(done,3));
    active--; return i;
  })));
  assert.equal(peak,4);
});

test('NASA APOD with third-party copyright remains metadata only', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ok:true,json:async()=>[{
      date:dayKey(date),title:'A visitor photo',permalink:'https://science.nasa.gov/story',
      media_type:'image',copyright:'Photographer',credit:'Photographer',url:'https://science.nasa.gov/story',
      explanation:'A beautiful space photograph.',
    }]});
    const result = await ADAPTERS.apod(FORMAT_REGISTRY.find(f=>f.id==='space-image'), date);
    assert.equal(result.title,'A visitor photo');
    assert.equal(result.image,null);
    assert.equal(result.mediaAllowed,false);
  } finally { globalThis.fetch = previous; }
});

test('Museum object must have explicit public domain status for its image', async () => {
  const previous = globalThis.fetch;
  try {
    globalThis.fetch = async url => ({ok:true,json:async()=>String(url).includes('/search?') ?
      {objectIDs:[123]} : {objectID:123,title:'Protected object',isPublicDomain:false,
        primaryImageSmall:records[0].image,objectURL:records[0].url}});
    assert.equal(await ADAPTERS.metArtwork(format,date),null);
  } finally { globalThis.fetch = previous; }
});

test('APOD uses the requested date and resizes copyright-free image media',async()=>{
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async url=>{
      assert.match(String(url),/apod-basic\/261007$/);
      return {ok:true,json:async()=>({date:'2026-10-07',title:'NASA image',media_type:'image',copyright:'',
        hdurl:'https://assets.science.nasa.gov/dynamicimage/space.jpg?w=4000',permalink:'https://science.nasa.gov/image-article/example'})};
    };
    const result=await ADAPTERS.apod({id:'space-image'},new Date(2026,9,7));
    assert.equal(result.mediaAllowed,true);
    assert.equal(new URL(result.image).searchParams.get('w'),'640');
  }finally{globalThis.fetch=previous;}
});
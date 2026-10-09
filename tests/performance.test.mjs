import test from 'node:test';
import assert from 'node:assert/strict';
import { responseCache, sharedRequests, batchLookup, frameQueue, pruneOldCache } from '../js/performance.js';
import { cardImageUrl } from '../js/engine.js';
import { readFile } from 'node:fs/promises';

function storage() {
  const data=new Map();
  return {get length(){return data.size;},key:index=>[...data.keys()][index],
    getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
}
const date=new Date(2026,9,8);

test('shared response cache survives a new session without repeating work',async()=>{
  const store=storage();let calls=0;
  const cache=responseCache(store,date);
  const shared=sharedRequests(cache);
  const work=async()=>{calls++;return {pool:[1,2,3]};};
  const [a,b]=await Promise.all([shared('pool',work),shared('pool',work)]);
  assert.deepEqual(a,b);assert.equal(calls,1);
  await sharedRequests(responseCache(store,date))('pool',work);
  assert.equal(calls,1);
  assert.equal(responseCache(store,new Date(2026,9,9)).get('pool'),null);
});

test('oversized responses are not serialized into storage',()=>{
  const store=storage();const cache=responseCache(store,date,100);
  cache.set('large',{text:'x'.repeat(500)});
  assert.equal(store.length,0);
});

test('batched titles use one request and preserve individual mapping',async()=>{
  let calls=0;
  const lookup=batchLookup(async titles=>{
    calls++;return new Map(titles.map(title=>[title,`${title}:image`]));
  },{delay:1});
  const result=await Promise.all(['Paris','Tokyo','Paris'].map(lookup));
  assert.deepEqual(result,['Paris:image','Tokyo:image','Paris:image']);
  assert.equal(calls,1);
});

test('a failed batch rejects callers and a later batch can recover',async()=>{
  let fail=true;
  const lookup=batchLookup(async keys=>{
    if(fail)throw new Error('offline');return new Map(keys.map(key=>[key,key]));
  },{delay:1});
  await assert.rejects(lookup('title'),/offline/);
  fail=false;assert.equal(await lookup('title'),'title');
});

test('DOM work is limited to two cards per animation frame',()=>{
  const callbacks=[],rendered=[];
  const paint=frameQueue((card,item)=>rendered.push([card,item]),callback=>callbacks.push(callback));
  for(let i=0;i<7;i++)paint(i,i);
  assert.equal(callbacks.length,1);
  callbacks.shift()();assert.equal(rendered.length,2);
  callbacks.shift()();assert.equal(rendered.length,4);
  callbacks.shift()();assert.equal(rendered.length,6);
  callbacks.shift()();assert.equal(rendered.length,7);
});

test('pruning removes only old Foly day entries',()=>{
  const store=storage();
  store.setItem('foly:v2:2026-10-07:person','old');
  store.setItem('foly:responses:v1:2026-10-07:pool','old');
  store.setItem('foly:v2:2026-10-08:person','today');
  store.setItem('other:preferences','keep');
  pruneOldCache(store,date);
  assert.equal(store.length,2);
  assert.equal(store.getItem('other:preferences'),'keep');
});

test('known providers use card thumbnails, unknown URLs are not guessed',()=>{
  assert.equal(cardImageUrl('https://inaturalist-open-data.s3.amazonaws.com/photos/123/original.jpg'),
    'https://inaturalist-open-data.s3.amazonaws.com/photos/123/medium.jpg');
  assert.equal(cardImageUrl('https://images.metmuseum.org/CRDImages/es/web-large/123.jpg'),
    'https://images.metmuseum.org/CRDImages/es/web-thumb/123.jpg');
  const unknown='https://image.laji.fi/123/photo.jpg';
  assert.equal(cardImageUrl(unknown),unknown);
  assert.equal(cardImageUrl('https://ids.si.edu/ids/deliveryService/id/example/90&max=640'),
    'https://ids.si.edu/ids/deliveryService/id/example/90?max=640');
});

test('the obsolete Unsplash background does not initiate a request',async()=>{
  const css=await readFile(new URL('../css/base.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/images\.unsplash\.com/);
});

test('static background image is not duplicated in CSS',async()=>{
  const css=await readFile(new URL('../css/theme.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/static\.wixstatic\.com|radial-gradient/);
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.equal((html.match(/class="video-bg"/g)||[]).length,1);
  assert.equal((html.match(/class="background-video"/g)||[]).length,1);
  assert.doesNotMatch(html, /autoplay|backgroundToggle|class="background-image"/);
});
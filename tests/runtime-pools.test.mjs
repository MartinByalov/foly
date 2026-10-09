import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RUNTIME_POOLS, inaturalistPool, openversePool } from '../js/runtime-pools.js';
import { CORE_FORMATS } from '../js/registry.js';
import { validateRights } from '../js/license.js';

test('homepage uses the new resolver and every configured pool has a loader',async()=>{
  const app=await readFile(new URL('../js/app.js',import.meta.url),'utf8');
  assert.match(app,/resolveGuaranteed\(format,today,context\)/);
  assert.doesNotMatch(app,/retry-item|resolve\(format, today, cache/);
  for(const format of CORE_FORMATS)for(const provider of format.providers)assert.equal(typeof RUNTIME_POOLS[provider.adapter],'function',provider.adapter);
});

test('new runtime pools reject restricted records and preserve accepted attribution',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('inaturalist')?{results:[
    {id:1,license_code:'cc-by',taxon:{name:'Salmo salar'},photos:[{license_code:'cc-by-nc',url:'https://static.inaturalist.org/photos/1/square.jpg'}]},
    {id:2,license_code:'cc0',taxon:{name:'Esox lucius'},photos:[{license_code:'cc-by',attribution:'Photo creator',url:'https://static.inaturalist.org/photos/2/square.jpg'}]},
  ]}:{results:[
    {id:1,license:'by-nc',title:'Restricted',thumbnail:'https://example.org/1.jpg',foreign_landing_url:'https://example.org/1'},
    {id:2,license:'by',title:'Historical photograph',creator:'Photographer',license_url:'https://creativecommons.org/licenses/by/4.0/',thumbnail:'https://example.org/2.jpg',foreign_landing_url:'https://example.org/2'},
  ]}});
  try{
    const fish=await inaturalistPool({taxon:'fish'},{id:'fish'});
    assert.equal(fish.length,1);assert.match(fish[0].image,/medium\.jpg$/);
    assert.equal(validateRights(fish[0].rights,true).ok,true);
    const photos=await openversePool({term:'test historic photograph'},{id:'photography'});
    assert.equal(photos.length,1);assert.equal(validateRights(photos[0].rights,true).ok,true);
  }finally{globalThis.fetch=original;}
});
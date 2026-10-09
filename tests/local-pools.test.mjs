import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CORE_FORMATS, SOURCE_REGISTRY } from '../js/registry.js';
import { loadLocalPools, localCandidateValid } from '../js/local-pools.js';
import { createResolutionContext, resolveGuaranteed } from '../js/resolver.js';
const pools=await loadLocalPools(path=>readFile(new URL(`../${path.slice(2)}`,import.meta.url),'utf8').then(JSON.parse));

test('all core formats declare provider chains and explicit local requirements',()=>{
  for(const format of CORE_FORMATS){
    assert.ok(format.providers.length);
    assert.ok(format.fallbackFamily in pools);
    assert.equal(format.requirements.commercialReuse,true);
    for(const provider of format.providers)assert.ok(SOURCE_REGISTRY[provider.id]);
  }
});

test('committed fallback files retain provenance and only local image bytes',async()=>{
  let count=0;
  for(const pool of Object.values(pools))for(const item of pool){
    const format=CORE_FORMATS.find(f=>f.id===item.formatId);
    assert.ok(format);
    assert.ok(localCandidateValid(item,format),item.id);
    if(item.image){const bytes=await readFile(new URL(`../${item.image.slice(2)}`,import.meta.url));assert.ok(bytes.length>0);}
    count++;
  }
  assert.ok(count>0);
});

test('covered formats resolve from committed files with every remote loader offline',async()=>{
  const previous=globalThis.fetch;
  let covered=0;
  try{
    globalThis.fetch=async()=>{throw new TypeError('offline');};
    for(const format of CORE_FORMATS){
      if(!pools[format.fallbackFamily].some(item=>localCandidateValid(item,format)))continue;
      const ctx=createResolutionContext({cache:{get:()=>null,set:()=>{}},sources:SOURCE_REGISTRY,
        loaders:Object.fromEntries(format.providers.map(p=>[p.adapter,async()=>{throw new TypeError('offline');}])),
        retry:{sleep:async()=>{}},localPools:pools,
        checkMedia:async path=>{try{await readFile(new URL(`../${path.slice(2)}`,import.meta.url));return true;}catch{return false;}}});
      const item=await resolveGuaranteed(format,new Date(2026,9,8),ctx);
      assert.equal(item.state,'resolved');assert.ok(item.rights);covered++;
    }
  }finally{globalThis.fetch=previous;}
  const report=JSON.parse(await readFile(new URL('../data/fallbacks/report.json',import.meta.url),'utf8'));
  assert.equal(covered,report.covered);
  // This deliberately does not claim full edition/deduplication coverage.
});
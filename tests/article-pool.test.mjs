import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { articlePool } from '../js/article-pool.js';
import { CORE_FORMATS } from '../js/registry.js';
test('all fifty knowledge categories have independent article seeds and a Wikipedia provider',async()=>{
  const seeds=JSON.parse(await readFile(new URL('../data/article-seeds.json',import.meta.url)));
  for(const f of CORE_FORMATS.filter(f=>f.source==='wikidata')){
    assert.ok(seeds[f.id]?.length,f.id);
    assert.ok(f.providers.some(p=>p.id==='wikipedia' && p.adapter==='articlePool'),f.id);
  }
});
test('article fallback needs no Wikidata request and rejects disambiguation pages',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
    assert.ok(!String(url).includes('wikidata'));
    return {ok:true,json:async()=>String(url).startsWith('./')?{mineral:['Quartz']}:{query:{pages:{
      1:{pageid:1,title:'Quartz',extract:'Quartz is a mineral.'},
      2:{pageid:2,title:'Ambiguous',extract:'Different things.',pageprops:{disambiguation:''}},
    }}}};
  };
  try{const pool=await articlePool({category:'mineral'},{id:'mineral'},new Date(2026,9,8));assert.equal(pool.length,1);assert.equal(pool[0].rights.metadataLicense,'CC_BY_SA');}
  finally{globalThis.fetch=original;}
});
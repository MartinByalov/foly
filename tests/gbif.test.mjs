import test from 'node:test';
import assert from 'node:assert/strict';
import { gbif } from '../js/adapters.js';

test('Reptile resolves species keys and retries an empty occurrence pool',async()=>{
  const previous=globalThis.fetch;const urls=[];let count=0;
  try{
    globalThis.fetch=async url=>{
      urls.push(String(url));
      if(String(url).includes('/species/match'))return {ok:true,json:async()=>({rank:'SPECIES',matchType:'EXACT',usageKey:++count})};
      return {ok:true,json:async()=>({results:count===1?[]:[{key:123,species:'Lacerta agilis',family:'Lacertidae',media:[]}]})};
    };
    const item=await gbif({id:'reptile',query:{taxon:'reptile'}},new Date(2026,9,8));
    assert.equal(item.title,'Lacerta agilis');
    assert.equal(count,2);
    assert.ok(urls.every(url=>!url.includes('taxonKey=358')));
    assert.equal(item.sourceName,'GBIF');
  }finally{globalThis.fetch=previous;}
});

test('Fish resolves a species instead of the empty legacy class and retains licensed media',async()=>{
  const previous=globalThis.fetch;const urls=[];
  try{
    globalThis.fetch=async url=>{
      urls.push(String(url));
      if(String(url).includes('/species/match'))return {ok:true,json:async()=>({rank:'SPECIES',matchType:'EXACT',usageKey:98765})};
      return {ok:true,json:async()=>({results:[{key:456,species:'Salmo salar',media:[{
        type:'StillImage',identifier:'https://example.org/fish.jpg',license:'https://creativecommons.org/licenses/by/4.0/',creator:'Photographer',
      }]}]})};
    };
    const item=await gbif({id:'fish',query:{taxon:'fish'}},new Date(2026,9,8));
    assert.equal(item.title,'Salmo salar');
    assert.equal(item.mediaAllowed,true);
    assert.equal(item.author,'Photographer');
    assert.ok(urls.every(url=>!url.includes('taxonKey=204')));
  }finally{globalThis.fetch=previous;}
});

test('Plant tries another species when the first has only restricted media',async()=>{
  const previous=globalThis.fetch;let count=0;
  try{
    globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('/species/match') ?
      {rank:'SPECIES',matchType:'EXACT',usageKey:++count} : {results:[{key:count,species:'Plant species',media:[{
        type:'StillImage',identifier:'https://example.org/plant.jpg',creator:'Botanist',
        license:count===1?'https://creativecommons.org/licenses/by-nc/4.0/':'https://creativecommons.org/licenses/by/4.0/',
      }]}]}});
    const result=await gbif({id:'plant',query:{taxon:'plant'}},new Date(2026,9,8));
    assert.equal(count,2);
    assert.equal(result.mediaAllowed,true);
  }finally{globalThis.fetch=previous;}
});
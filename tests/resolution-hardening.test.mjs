import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolutionContext, resolveGuaranteed } from '../js/resolver.js';
import { isInfrastructureFailure, requestQueue } from '../js/resolution-network.js';

test('malformed candidate and blocked cache do not discard the next valid candidate',async()=>{
  const format={id:'test',providers:[{id:'source',adapter:'pool'}],requirements:{},fallbackFamily:'art'};
  const good={id:'valid',formatId:'test',title:'Valid object',sourceId:'source',sourceName:'Source',rights:{
    metadataLicense:'CC0',sourceItemUrl:'https://example.org/item',verifiedBy:'fixture',verifiedAt:'2026-10-08',commercialReuse:true,derivativesAllowed:true}};
  const context=createResolutionContext({sources:{source:{}},cache:{get(){throw Error('blocked');},set(){throw Error('full');}},
    loaders:{pool:async()=>[{...good,title:123},good]},checkMedia:async()=>true,debug:()=>{}});
  assert.equal((await resolveGuaranteed(format,new Date(2026,9,8),context)).state,'resolved');
});
test('TimeoutError is retryable and queue enforces both global and per-host limits',async()=>{
  assert.equal(isInfrastructureFailure({name:'TimeoutError'}),true);
  const queue=requestQueue({globalLimit:4,hostLimit:2});let active=0,peak=0;const hosts=new Map();
  await Promise.all(Array.from({length:16},(_,i)=>{
    const host=i%2?'a.example':'b.example';
    return queue(`https://${host}/`,async()=>{
      active++;peak=Math.max(peak,active);hosts.set(host,(hosts.get(host)||0)+1);
      assert.ok(hosts.get(host)<=2);assert.ok(active<=4);
      await new Promise(r=>setTimeout(r,2));hosts.set(host,hosts.get(host)-1);active--;
    });
  }));assert.equal(peak,4);
});
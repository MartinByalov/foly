import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalLicense } from '../js/license.js';
import { createResolutionContext, resolveGuaranteed } from '../js/resolver.js';
import { withNetworkRetry, circuitBreaker } from '../js/resolution-network.js';
const date=new Date(2026,9,8);
const format={id:'painting',requirements:{image:true},fallbackFamily:'art',providers:[{id:'met',adapter:'met'},{id:'chicago',adapter:'chicago'}]};
function candidate(id,license='CC0') {return {id,formatId:'painting',title:id,sourceId:'met',sourceName:'The Met',sourceItemUrl:`https://example.org/${id}`,image:`./media/${id}.jpg`,rights:{metadataLicense:'CC0',mediaLicense:license,commercialReuse:true,derivativesAllowed:true,sourceItemUrl:`https://example.org/${id}`,verifiedBy:'fixture',verifiedAt:'2026-10-08'}};}
function context(loaders,local=[candidate('local')]){const map=new Map();return createResolutionContext({cache:{get:k=>map.get(k),set:(k,v)=>map.set(k,v)},sources:{met:{}},loaders,localPools:{art:local},checkMedia:async url=>!url.includes('broken'),retry:{sleep:async()=>{}}});}
test('central licenses reject NC, ND, missing and forged license hosts',()=>{
  for(const value of [null,'','CC BY-NC 4.0','CC BY-ND','https://evil.org/licenses/by/4.0/'])assert.equal(canonicalLicense(value),null);
  assert.equal(canonicalLicense('https://creativecommons.org/licenses/by-sa/4.0/'),'CC_BY_SA');
});
test('primary outage resolves secondary and refresh uses cache',async()=>{
  let calls=0;const ctx=context({met:async()=>{throw Object.assign(Error(),{status:500});},chicago:async()=>{calls++;return [candidate('second')];}});
  assert.equal((await resolveGuaranteed(format,date,ctx)).id,'second');
  assert.equal((await resolveGuaranteed(format,date,ctx)).id,'second');assert.equal(calls,1);
});
test('reject bad licenses, broken images and duplicates before accepting',async()=>{
  const ctx=context({met:async()=>[candidate('bad','CC BY-NC'),candidate('broken'),candidate('duplicate'),candidate('valid')]});
  ctx.edition.claim({...candidate('duplicate'),formatId:'other'});
  assert.equal((await resolveGuaranteed(format,date,ctx)).id,'valid');
});
test('entire family offline resolves actual supplied local pool',async()=>{
  const ctx=context({met:async()=>{throw new TypeError('offline');},chicago:async()=>{throw new TypeError('offline');}});
  assert.equal((await resolveGuaranteed(format,date,ctx)).state,'resolved');
});
test('missing fallback is a build invariant, not fabricated content',async()=>{
  await assert.rejects(resolveGuaranteed(format,date,context({},[])),/Build invariant/);
});
test('retry respects status and breaker opens after infrastructure failures',async()=>{
  let calls=0;await assert.rejects(withNetworkRetry(async()=>{calls++;throw Object.assign(Error(),{status:403});},{sleep:async()=>{}}));assert.equal(calls,1);
  const b=circuitBreaker();for(let i=0;i<3;i++)b.failure('source',Object.assign(Error(),{status:429}));assert.equal(b.isOpen('source'),true);
});
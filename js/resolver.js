import { dayKey, shuffle, seed } from './engine.js';
import { validateRights } from './license.js';
import { imageAvailable } from './media-health.js';
import { circuitBreaker, withNetworkRetry } from './resolution-network.js';

export function editionContext(){
  const usedIds=new Set(),usedUrls=new Set(),usedMedia=new Set(),usedTitles=new Set();
  const owners=new Map();
  const detailUrl=item=>{try{const url=new URL(item.sourceItemUrl);return url.pathname==='/' && !url.search?null:url.href;}catch{return null;}};
  const keys=item=>[['id',item.id],['url',detailUrl(item)],['media',item.image],['title',item.title?.trim().toLocaleLowerCase()]].filter(([,value])=>value);
  return {usedIds,usedUrls,usedMedia,usedTitles,
    isDuplicate(item){return keys(item).some(([kind,value])=>owners.has(`${kind}:${value}`)&&owners.get(`${kind}:${value}`)!==item.formatId);},
    claim(item){if(this.isDuplicate(item))return false;for(const [kind,value]of keys(item)){owners.set(`${kind}:${value}`,item.formatId);({id:usedIds,url:usedUrls,media:usedMedia,title:usedTitles})[kind].add(value);}return true;},
  };
}
export function createResolutionContext(options={}){
  return {edition:editionContext(),circuitBreaker:circuitBreaker(),checkMedia:imageAvailable,
    debug:(format,provider,reason)=>{if(globalThis.FOLY_DEBUG)console.debug(`[${format.id}] ${provider.id}: ${reason}`);},...options};
}
export async function validateResolvedItem(item,format,ctx){
  if(!item || item.formatId!==format.id || !item.id || !item.title?.trim() || !item.sourceName || item.unavailable)return {ok:false,reason:'missing_required_field'};
  if(!ctx.sources?.[item.sourceId])return {ok:false,reason:'invalid_source'};
  const rights=validateRights(item.rights,!!item.image);
  if(!rights.ok)return rights;
  if(format.requirements?.image && !item.image)return {ok:false,reason:'missing_required_field'};
  if(item.image && !await ctx.checkMedia(item.image))return {ok:false,reason:'media_failed'};
  if(ctx.edition.isDuplicate(item))return {ok:false,reason:'duplicate_item'};
  return {ok:true};
}
export function providerSequence(format,date){
  const providers=format.providers || [];
  return format.providerSelection==='daily-rotation'
    ? shuffle(providers,`${dayKey(date)}:${format.id}:providers`)
    : providers.slice();
}
export async function resolveGuaranteed(format,date,ctx){
  const key=`foly:v3:${dayKey(date)}:${format.id}`;
  const accept=async candidate=>{
    let verdict;
    try{verdict=await validateResolvedItem(candidate,format,ctx);}
    catch{return {ok:false,reason:'missing_required_field'};}
    if(!verdict.ok)return verdict;
    if(!ctx.edition.claim(candidate))return {ok:false,reason:'duplicate_item'};
    return {ok:true,item:{...candidate,state:'resolved'}};
  };
  let cached;
  try{cached=ctx.cache.get(key);}catch{/* Blocked storage is not a content failure. */}
  const save=item=>{try{ctx.cache.set(key,item);}catch{/* Keep the resolved card. */}};
  if(cached){const verdict=await accept(cached);if(verdict.ok)return verdict.item;}
  for(const provider of providerSequence(format,date)){
    if(ctx.circuitBreaker.isOpen(provider.id))continue;
    const loader=ctx.loaders[provider.adapter];
    if(!loader){ctx.debug(format,provider,'invalid_source');continue;}
    let pool;
    try{
      pool=await withNetworkRetry(()=>loader(provider.query,format,date),{...ctx.retry,jitter:seed(provider.id)%75});
      ctx.circuitBreaker.success(provider.id);
    }catch(error){ctx.circuitBreaker.failure(provider.id,error);ctx.debug(format,provider,error.status===429?'rate_limited':'network_error');continue;}
    if(!Array.isArray(pool)||!pool.length){ctx.debug(format,provider,'empty_pool');continue;}
    for(const candidate of shuffle(pool,`${dayKey(date)}:${format.id}:${provider.id}`).slice(0,8)){
      const verdict=await accept(candidate);
      if(!verdict.ok){ctx.debug(format,provider,verdict.reason);continue;}
      save(verdict.item);return verdict.item;
    }
  }
  const local=ctx.localPools?.[format.fallbackFamily] || [];
  for(const candidate of shuffle(local.filter(item=>item.formatId===format.id),`${dayKey(date)}:${format.id}:local`)){
    // Local guarantee cannot depend on third-party media hosts.
    if(candidate.image && !candidate.image.startsWith('./media/'))continue;
    const verdict=await accept(candidate);
    if(verdict.ok){save(verdict.item);return verdict.item;}
  }
  throw new Error(`Build invariant violated: no validated local fallback for ${format.id}`);
}
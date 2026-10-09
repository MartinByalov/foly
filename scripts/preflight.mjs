import { readFile } from 'node:fs/promises';
import { CORE_FORMATS, SOURCE_REGISTRY } from '../js/registry.js';
import { validateRights } from '../js/license.js';
import { localCandidateValid } from '../js/local-pools.js';
import { RUNTIME_POOLS } from '../js/runtime-pools.js';
import { createResolutionContext, resolveGuaranteed } from '../js/resolver.js';
import { loadLocalPools } from '../js/local-pools.js';
const errors=[];
if(CORE_FORMATS.length!==100 || new Set(CORE_FORMATS.map(f=>f.id)).size!==100)errors.push('Expected exactly 100 unique formats');
for(const format of CORE_FORMATS){
  if(!format.providers?.length)errors.push(`${format.id}: missing provider array`);
  for(const provider of format.providers || []){
    if(typeof RUNTIME_POOLS[provider.adapter]!=='function')errors.push(`${format.id}: missing loader ${provider.adapter}`);
    const source=SOURCE_REGISTRY[provider.id];
    if(!source?.licenseMode || typeof source.attributionRequired!=='boolean')errors.push(`${format.id}: missing source policy ${provider.id}`);
  }
  if(!format.fallbackFamily){errors.push(`${format.id}: missing local family`);continue;}
  let pool;
  try{pool=JSON.parse(await readFile(new URL(`../data/fallbacks/${format.fallbackFamily}.json`,import.meta.url),'utf8'));}
  catch{errors.push(`${format.id}: missing fallback file`);continue;}
  const candidates=Array.isArray(pool)?pool:[];
  if(candidates.length<20)errors.push(`${format.fallbackFamily}: fewer than 20 records`);
  const matching=candidates.filter(item=>localCandidateValid(item,format) && SOURCE_REGISTRY[item.sourceId] && validateRights(item.rights,!!item.image).ok);
  if(!matching.length)errors.push(`${format.id}: no rights-validated fallback`);
  if(format.requirements?.image && !matching.some(item=>item.image?.startsWith('./media/')))errors.push(`${format.id}: no local media`);
  for(const item of matching){
    if(item.image?.startsWith('./media/'))try{await readFile(new URL(`../${item.image.slice(2)}`,import.meta.url));}catch{errors.push(`${format.id}: missing media file`);}
  }
}
// One edition context: per-format successes alone cannot prove deduplicated coverage.
try{
  const localPools=await loadLocalPools(path=>readFile(new URL(`../${path}`,import.meta.url),'utf8').then(JSON.parse));
  const context=createResolutionContext({sources:SOURCE_REGISTRY,loaders:{},localPools,
    cache:{get:()=>null,set:()=>{}},debug:()=>{},checkMedia:async image=>{
      if(!image.startsWith('./media/'))return false;
      try{return (await readFile(new URL(`../${image}`,import.meta.url))).length>0;}catch{return false;}
    }});
  for(const format of CORE_FORMATS)try{await resolveGuaranteed(format,new Date(2026,9,8),context);}
  catch{errors.push(`${format.id}: cannot resolve unique offline card`);}
}catch(error){errors.push(`Offline edition check: ${error.message}`);}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`Preflight passed: ${CORE_FORMATS.length} formats`);
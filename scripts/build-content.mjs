// Imports existing provenance-bearing snapshots. No credentials enter browser JS.
// --download-media fetches licensed Smithsonian thumbnails and stores actual bytes.
// Uncovered formats remain errors in preflight, never fabricated records.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CORE_FORMATS } from '../js/registry.js';
import { FALLBACK_FAMILIES, localCandidateValid } from '../js/local-pools.js';
import { canonicalLicense, validateRights } from '../js/license.js';
import { shortDescription } from '../js/copy.js';
import { cardImageUrl, safeUrl } from '../js/engine.js';
import { metArtworkPool, triviaPool } from '../js/candidate-pools.js';
import { RUNTIME_POOLS } from '../js/runtime-pools.js';
const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
// Browser adapters can read same-origin snapshots during a local build as well.
const networkFetch=globalThis.fetch;
globalThis.fetch=(url,options)=>String(url).startsWith('./data/')
  ? readFile(new URL(String(url),root)).then(bytes=>new Response(bytes,{headers:{'content-type':'application/json'}}))
  : networkFetch(url,options);
const download=process.argv.includes('--download-media');
const harvestKnowledge=process.argv.includes('--harvest-knowledge');
const harvestMet=process.argv.includes('--harvest-met');
const harvestTrivia=process.argv.includes('--harvest-trivia');
const harvestProviders=process.argv.includes('--harvest-providers');
const selected=(process.argv.find(arg=>arg.startsWith('--formats=')) || '').slice(10).split(',').filter(Boolean);
const pools=Object.fromEntries(FALLBACK_FAMILIES.map(family=>[family,[]]));
for(const family of FALLBACK_FAMILIES){
  try{const records=await read(`data/fallbacks/${family}.json`);if(Array.isArray(records))pools[family]=records;}catch(error){if(error.code!=='ENOENT')throw error;}
}
const knowledge=await read('data/knowledge-backup.json');
const smithsonian=await read('data/smithsonian.json');
const errors=[];
await mkdir(new URL('data/fallbacks/',root),{recursive:true});
await mkdir(new URL('media/fallbacks/',root),{recursive:true});
function add(format,item){
  if(!localCandidateValid(item,format)){errors.push(`${format.id}: rejected ${item.id}`);return;}
  const pool=pools[format.fallbackFamily];
  const existing=pool.findIndex(entry=>entry.id===item.id && entry.formatId===item.formatId);
  if(existing<0)pool.push(item);else pool[existing]=item;
}
if(harvestKnowledge){
  const idsByCategory=await read('data/knowledge-pools.json');
  const ids=[...new Set(Object.values(idsByCategory).flat())];
  const entities={};
  for(let offset=0;offset<ids.length;offset+=40){
    try{
      const url='https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbgetentities',format:'json',ids:ids.slice(offset,offset+40).join('|'),languages:'en|mul',props:'labels|descriptions',redirects:'yes'});
      const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json'}});
      if(!response.ok)throw Error(`Wikidata HTTP ${response.status}`);
      const data=await response.json();Object.assign(entities,data.entities);
    }catch(error){errors.push(error.message);}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  const verifiedAt=new Date().toISOString();
  for(const format of CORE_FORMATS.filter(f=>f.source==='wikidata'))for(const id of idsByCategory[format.id] || []){
    const record=entities[id];
    const title=record?.labels?.en?.value || record?.labels?.mul?.value;
    const description=record?.descriptions?.en?.value;
    if(!title || !description)continue;
    const sourceItemUrl=`https://www.wikidata.org/wiki/${id}`;
    // Store factual metadata only. No P18/Commons image inherits Wikidata CC0.
    add(format,{id:`wikidata:${id}`,formatId:format.id,title,description:shortDescription(description),image:null,
      sourceId:'wikidata',sourceName:'Wikidata',sourceItemUrl,facts:[],interaction:null,
      rights:{metadataLicense:'CC0',mediaLicense:null,mediaLicenseUrl:null,creator:'Wikidata contributors',attribution:'Wikidata · CC0',sourceItemUrl,
        commercialReuse:true,derivativesAllowed:true,verifiedBy:'Wikidata wbgetentities labels/descriptions',verifiedAt}});
  }
}
async function localImage(url){
  if(!safeUrl(url,['ids.si.edu','images.metmuseum.org','clevelandart.org','artic.edu','iiif.micr.io','iiif.wellcomecollection.org','inaturalist-open-data.s3.amazonaws.com','static.inaturalist.org','upload.wikimedia.org']))throw Error('Unexpected media host');
  const response=await fetch(cardImageUrl(url),{signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw Error(`Media HTTP ${response.status}`);
  const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'};
  const extension=types[response.headers.get('content-type')?.split(';')[0]];
  if(!extension)throw Error('Not a supported image');
  const reader=response.body.getReader(),chunks=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2500000){await reader.cancel();throw Error('Image exceeds 2.5MB');}chunks.push(value);}
  const bytes=Buffer.concat(chunks);
  const signature=extension==='jpg'?bytes[0]===255&&bytes[1]===216:extension==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):extension==='webp'?bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP':bytes.toString('ascii',0,3)==='GIF';
  if(!signature)throw Error('Image signature mismatch');
  const hash=createHash('sha256').update(bytes).digest('hex');
  const path=`media/fallbacks/${hash}.${extension}`;
  await writeFile(new URL(path,root),bytes);
  return `./${path}`;
}
for(const format of CORE_FORMATS){
  if(harvestProviders && (!selected.length || selected.includes(format.id))){
    for(const provider of format.providers){
      const loader=RUNTIME_POOLS[provider.adapter];if(!loader)continue;
      try{
        const candidates=await loader(provider.query,format,new Date());
        let accepted=0;
        for(const candidate of candidates){
          if(!validateRights(candidate.rights,!!candidate.image).ok)continue;
          try{
            const item={...candidate,description:shortDescription(candidate.description || candidate.title),
              image:candidate.image?await localImage(candidate.image):null,
              snapshot:{capturedAt:new Date().toISOString(),provider:provider.id,originalImage:candidate.image || null}};
            // Day-specific feeds must not become undated evergreen fallbacks.
            if(format.group==='today')continue;
            if(localCandidateValid(item,format)){add(format,item);accepted++;}
          }catch(error){errors.push(`${format.id}/${provider.id}: ${error.message}`);}
          if(accepted>=4)break;
        }
        if(accepted>=4)break;
      }catch(error){errors.push(`${format.id}/${provider.id}: ${error.message}`);}
    }
  }
  if(harvestTrivia && format.source==='trivia')try{
    for(const item of await triviaPool(format.query,format,new Date()))add(format,item);
  }catch(error){errors.push(`${format.id}: ${error.message}`);}
  if(harvestMet && format.source==='met')try{
    const records=await metArtworkPool(format.query,format,new Date());
    let accepted=0;
    for(const item of records){
      try{const image=await localImage(item.image);add(format,{...item,image});accepted++;}catch(error){errors.push(`${format.id}: ${error.message}`);}
      if(accepted>=3)break;
    }
  }catch(error){errors.push(`${format.id}: ${error.message}`);}
  if(format.source==='wikidata')for(const record of knowledge.pools?.[format.id] || []){
    const license=canonicalLicense(record.license);
    if(!license || !['wikipedia','wikidata'].includes(record.sourceId) || !safeUrl(record.sourceItemUrl,['wikipedia.org','wikidata.org']))continue;
    const item={...record,id:`${record.sourceId}:${record.id}`,formatId:format.id,description:shortDescription(record.description),
      sourceName:record.sourceName || record.sourceId,image:null,facts:[],interaction:null,
      rights:{metadataLicense:license,mediaLicense:null,mediaLicenseUrl:null,creator:record.sourceId==='wikipedia'?'Wikipedia contributors':'Wikidata contributors',
        attribution:`${record.sourceName || record.sourceId} · ${record.license}`,sourceItemUrl:record.sourceItemUrl,
        commercialReuse:true,derivativesAllowed:true,verifiedBy:'knowledge-backup provenance',verifiedAt:knowledge.built}};
    add(format,item);
  }
  if(download && format.source==='smithsonian')for(const record of (smithsonian.pools?.[format.id] || []).slice(0,3)){
    if(record.license!=='CC0' || record.mediaLicense!=='CC0' || !record.provenance || !safeUrl(record.url,['si.edu','n2t.net']))continue;
    try{
      const image=await localImage(record.image);
      const item={id:`smithsonian:${record.id}`,formatId:format.id,title:record.title,description:shortDescription(record.description),
        image,imageAlt:record.title,sourceId:'smithsonian',sourceName:'Smithsonian Open Access',sourceItemUrl:record.url,
        facts:[],interaction:null,mediaAllowed:true,publicDomain:true,
        rights:{metadataLicense:'CC0',mediaLicense:'CC0',mediaLicenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
          creator:'Smithsonian Institution',attribution:'Smithsonian Open Access',sourceItemUrl:record.url,commercialReuse:true,derivativesAllowed:true,
          verifiedBy:record.provenance,verifiedAt:smithsonian.built},
      };
      if(validateRights(item.rights,true).ok)add(format,item);
    }catch(error){errors.push(`${format.id}: ${error.message}`);}
  }
}
for(const [family,pool] of Object.entries(pools))await writeFile(new URL(`data/fallbacks/${family}.json`,root),JSON.stringify(pool,null,2)+'\n');
const covered=CORE_FORMATS.filter(format=>pools[format.fallbackFamily].some(item=>localCandidateValid(item,format)));
const report={covered:covered.length,total:CORE_FORMATS.length,missing:CORE_FORMATS.filter(f=>!covered.includes(f)).map(f=>f.id),errors};
await writeFile(new URL('data/fallbacks/report.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(report.missing.length || errors.length)process.exitCode=1;
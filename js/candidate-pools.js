import { centuryLabel } from './interactions.js';
import { shortDescription } from './copy.js';
import { safeUrl, cardImageUrl, shuffle, dayKey } from './engine.js';
import { scheduleRequest as queue } from './resolution-network.js';
const shared=new Map();
export async function poolJson(url){
  if(shared.has(url))return shared.get(url);
  const promise=queue(new URL(url,globalThis.location?.href || 'http://localhost/').href,async()=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(7000),headers:{Accept:'application/json'}});
    if(!response.ok)throw Object.assign(new Error(`HTTP ${response.status}`),{status:response.status,retryAfter:response.headers.get('retry-after')});
    return response.json();
  });
  shared.set(url,promise);
  try{return await promise;}catch(error){shared.delete(url);throw error;}
}
const json=poolJson;
export function metCandidate(record,format,verifiedAt=new Date().toISOString()){
  if(record.isPublicDomain!==true || !record.title || !safeUrl(record.primaryImageSmall,['images.metmuseum.org']) || !safeUrl(record.objectURL,['metmuseum.org']))return null;
  let interaction=null;
  if(format.interaction){
    const answer=format.id==='guess-artist'?record.artistDisplayName:format.id==='guess-century'?centuryLabel(record.objectBeginDate):format.id==='guess-material'?record.medium:record.title;
    if(!answer)return null;
    interaction={type:format.id==='guess-crop'?'crop':'reveal',answer,details:shortDescription([record.objectDate,record.medium,record.artistDisplayName].filter(Boolean).join(' · '))};
  }
  const description=shortDescription([record.objectDate,record.medium,record.culture].filter(Boolean).join(' · '));
  if(!description)return null;
  return {id:`met:${record.objectID}`,formatId:format.id,title:record.title,description,
    image:cardImageUrl(record.primaryImageSmall),imageAlt:record.title,sourceId:'met',sourceName:'The Metropolitan Museum of Art',
    sourceItemUrl:record.objectURL,facts:[],interaction,mediaAllowed:true,publicDomain:true,
    rights:{metadataLicense:'CC0',mediaLicense:'CC0',mediaLicenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',
      creator:record.artistDisplayName || 'Unidentified maker',attribution:'The Metropolitan Museum of Art · Open Access',sourceItemUrl:record.objectURL,
      commercialReuse:true,derivativesAllowed:true,verifiedBy:`https://collectionapi.metmuseum.org/public/collection/v1/objects/${record.objectID}`,verifiedAt}};
}
export async function metArtworkPool(query,format,date){
  const search=await json('https://collectionapi.metmuseum.org/public/collection/v1.1/search?'+new URLSearchParams({hasImages:'true',q:query?.term || 'art',limit:'30'}));
  const ids=shuffle(search.objectIDs || [],`${dayKey(date)}:${format.id}:met`).slice(0,12);
  const results=await Promise.allSettled(ids.map(id=>json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)));
  const pool=results.filter(r=>r.status==='fulfilled').map(r=>metCandidate(r.value,format)).filter(Boolean);
  if(!pool.length && results.length && results.every(r=>r.status==='rejected'))throw results[0].reason;
  return pool;
}
export async function triviaPool(query,format,date){
  const data=await json('https://opentdb.com/api.php?amount=30&type=multiple&encode=url3986');
  if(data.response_code!==0)throw Object.assign(new Error('Trivia response error'),{status:data.response_code===5?429:400});
  const decode=value=>decodeURIComponent(value);
  return (data.results || []).flatMap(record=>{
    try{
      const title=decode(record.question),answer=decode(record.correct_answer);
      const options=shuffle([answer,...record.incorrect_answers.map(decode)],`${dayKey(date)}:${title}`);
      if(!title || !answer || new Set(options).size!==4)return [];
      return [{id:`trivia:${title}`,formatId:format.id,title,description:shortDescription(decode(record.category)),image:null,
        sourceId:'trivia',sourceName:'Open Trivia DB',sourceItemUrl:'https://opentdb.com/',facts:[],interaction:{type:'quiz',answer,options},
        rights:{metadataLicense:'CC_BY_SA',mediaLicense:null,mediaLicenseUrl:null,creator:'Open Trivia DB contributors',
          attribution:'Open Trivia DB · CC BY-SA 4.0',sourceItemUrl:'https://opentdb.com/',commercialReuse:true,derivativesAllowed:true,
          verifiedBy:'https://opentdb.com/api_config.php',verifiedAt:new Date().toISOString()}}];
    }catch{return [];}
  });
}
export const CANDIDATE_POOLS=Object.freeze({metArtworkPool,triviaPool});
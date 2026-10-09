import { dayKey, pick } from './engine.js';
import { SOURCE_REGISTRY } from './registry.js';
import { shortDescription } from './copy.js';
let backup;
export async function fallback(format,date) {
  if(format.source==='wikidata'){
    try{
      if(!backup)backup=fetch('./data/knowledge-backup.json').then(response=>{
        if(!response.ok)throw new Error('Backup missing');return response.json();
      }).catch(()=>null);
      const data=await backup;
      const record=pick(data?.pools?.[format.query?.category] || [],`${dayKey(date)}:${format.id}:backup`);
      if(record)return {id:record.id,formatId:format.id,title:record.title,
        description:shortDescription(record.description),sourceName:record.sourceName || 'Wikidata',
        sourceId:record.sourceId || 'wikidata',sourceItemUrl:record.sourceItemUrl,
        license:record.license,licenseUrl:record.sourceId==='wikipedia'?'https://creativecommons.org/licenses/by-sa/4.0/':'https://creativecommons.org/publicdomain/zero/1.0/',
        attribution:record.sourceName || 'Wikidata',image:null,mediaAllowed:false,facts:[],date:dayKey(date)};
    }catch{ /* Continue to concise retry state. */ }
  }
  return {id:`unavailable:${dayKey(date)}:${format.id}`,formatId:format.id,title:format.title,
    description:'Try this pick again.',
    sourceName:SOURCE_REGISTRY[format.source]?.name || 'Foly',sourceId:format.source,
    image:null,date:dayKey(date),facts:[],interaction:null,mediaAllowed:false,unavailable:true};
}
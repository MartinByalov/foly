import { poolJson } from './candidate-pools.js';
import { canonicalLicense } from './license.js';
import { dayKey, shuffle } from './engine.js';
import { centuryLabel } from './interactions.js';
const english=r=>r.language?.some(l=>l.id?.endsWith('/300388277'));
const rights=r=>(r?.subject_to || []).flatMap(x=>x.classified_as || []).map(x=>x.id).find(x=>canonicalLicense(x));
const endpoint=id=>{
  if(!/^https:\/\/id\.rijksmuseum\.nl\/\d+$/.test(id || ''))throw Error('Invalid Rijksmuseum identifier');
  return id.replace('://id.', '://data.')+'?_profile=la-framed';
};
export function rijksCandidate(object,visual,digital,format){
  const metadataUrl=(object.subject_of || []).filter(s=>s.id===object.id.replace('://id.', '://data.')).map(rights).find(Boolean);
  const mediaUrl=rights(visual),license=canonicalLicense(mediaUrl);
  const image=digital.access_point?.find(p=>/^https:\/\/iiif\.micr\.io\/[^/]+\/full\/max\/0\/default\.jpg$/.test(p.id))?.id;
  const title=object.identified_by?.find(r=>r.type==='Name' && english(r))?.content;
  if(!metadataUrl || !license || !image || !title || !object.shows?.some(s=>s.id===visual.id) ||
    !visual.digitally_shown_by?.some(s=>s.id===digital.id))return null;
  const production=object.produced_by;
  const year=production?.timespan?.identified_by?.find(english)?.content;
  const creator=production?.referred_to_by?.find(english)?.content;
  const material=object.referred_to_by?.find(r=>english(r)&&r.classified_as?.some(c=>c.id?.endsWith('/300435429')))?.content;
  const begin=Number(production?.timespan?.begin_of_the_begin?.slice(0,4));
  const description=[year,material,creator].filter(Boolean).join(' · ');
  const url=object.subject_of?.flatMap(s=>s.digitally_carried_by || []).flatMap(s=>s.access_point || []).find(s=>s.id?.startsWith('https://www.rijksmuseum.nl/'))?.id || object.id;
  let interaction=null;
  if(format.interaction){
    if(format.interaction==='caption')return null;
    const answer=format.id==='guess-artist'?creator:format.id==='guess-material'?material:format.id==='guess-century'?centuryLabel(begin):title;
    if(!answer)return null;
    interaction={type:format.id==='guess-crop'?'crop':'reveal',answer,details:description};
  }
  return {id:object.id,formatId:format.id,title,description,image:image.replace('/full/max/','/full/600,/'),imageAlt:title,
    sourceId:'rijksmuseum',sourceName:'Rijksmuseum',sourceItemUrl:url,interaction,facts:[],rights:{metadataLicense:canonicalLicense(metadataUrl),
      mediaLicense:license,mediaLicenseUrl:mediaUrl,creator:creator || 'Rijksmuseum',attribution:[creator,'Rijksmuseum',license].filter(Boolean).join(' · '),
      sourceItemUrl:url,commercialReuse:true,derivativesAllowed:true,verifiedBy:endpoint(object.id),verifiedAt:new Date().toISOString()}};
}
export async function rijksmuseumPool(query,format,date){
  const data=await poolJson('https://data.rijksmuseum.nl/search/collection?'+new URLSearchParams({type:query.type || 'painting'}));
  const ids=shuffle(data.orderedItems || [],`${dayKey(date)}:${format.id}:rijks`).slice(0,8);
  const results=await Promise.allSettled(ids.map(async entry=>{
    const object=await poolJson(endpoint(entry.id));
    // Independently confirm the resolved object's category, even if search filters change.
    if(query.type && !object.classified_as?.some(c=>(Array.isArray(c.notation)?c.notation:[c.notation]).some(n=>n?.['@language']==='en' && n['@value']===query.type)))return null;
    const visualId=object.shows?.[0]?.id;if(!visualId)return null;
    const visual=await poolJson(endpoint(visualId));
    if(!rights(visual))return null;
    const digitalId=visual.digitally_shown_by?.[0]?.id;if(!digitalId)return null;
    return rijksCandidate(object,visual,await poolJson(endpoint(digitalId)),format);
  }));
  if(results.length && results.every(r=>r.status==='rejected'))throw results[0].reason;
  return results.filter(r=>r.status==='fulfilled' && r.value).map(r=>r.value);
}
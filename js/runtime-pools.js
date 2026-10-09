import { ADAPTERS } from './adapters.js';
import { CANDIDATE_POOLS, poolJson } from './candidate-pools.js';
import { canonicalLicense } from './license.js';
import { safeUrl } from './engine.js';
import { clevelandPool, chicagoPool, wellcomePool } from './museum-pools.js';
import { articlePool } from './article-pool.js';
import { spaceWeatherPool } from './space-weather.js';
import { rijksmuseumPool } from './rijks-pool.js';
const licenseCode=code=>({cc0:'CC0',pdm:'PDM','cc-by':'CC_BY','cc-by-sa':'CC_BY_SA',by:'CC_BY','by-sa':'CC_BY_SA'})[code] || null;
function legacyRights(item){
  if(!item || item.unavailable)return null;
  const metadata=canonicalLicense(item.license);
  const media=canonicalLicense(item.mediaLicense || item.license);
  if(!metadata)return null;
  return {...item,rights:{metadataLicense:metadata,mediaLicense:item.image?media:null,
    mediaLicenseUrl:item.mediaLicenseUrl || item.licenseUrl,
    creator:item.mediaAttribution || item.author || item.attribution,
    attribution:item.mediaAttribution || item.attribution,sourceItemUrl:item.sourceItemUrl,
    commercialReuse:true,derivativesAllowed:true,verifiedBy:`${item.sourceId} adapter policy`,verifiedAt:new Date().toISOString()}};
}
export async function inaturalistPool(query,format){
  const taxa={animal:'Animalia',bird:'Aves',fish:'Actinopterygii',reptile:'Reptilia',amphibian:'Amphibia',insect:'Insecta',plant:'Plantae',tree:'Plantae',flower:'Plantae'};
  const params=new URLSearchParams({iconic_taxa:taxa[query.taxon] || 'Plantae',photo_license:'cc0,cc-by,cc-by-sa',license:'cc0,cc-by,cc-by-sa',quality_grade:'research',per_page:'30',order_by:'id',order:'desc'});
  if(query.taxon==='tree')params.set('taxon_name','Quercus');
  if(query.taxon==='flower')params.set('taxon_name','Rosa');
  const data=await poolJson(`https://api.inaturalist.org/v1/observations?${params}`);
  return (data.results || []).flatMap(record=>{
    const photo=record.photos?.find(p=>licenseCode(p.license_code));
    const metadata=licenseCode(record.license_code),media=licenseCode(photo?.license_code);
    if(!metadata || !media || !record.taxon?.name || !safeUrl(photo.url,['inaturalist-open-data.s3.amazonaws.com','static.inaturalist.org']))return [];
    const sourceItemUrl=`https://www.inaturalist.org/observations/${record.id}`;
    const licenseUrl=media==='CC0'?'https://creativecommons.org/publicdomain/zero/1.0/':`https://creativecommons.org/licenses/${media==='CC_BY'?'by':'by-sa'}/4.0/`;
    return [{id:`inaturalist:${record.id}`,formatId:format.id,title:record.taxon.name,description:record.taxon.preferred_common_name || record.taxon.name,
      image:photo.url.replace('/square.','/medium.'),imageAlt:record.taxon.name,sourceId:'inaturalist',sourceName:'iNaturalist',sourceItemUrl,
      author:photo.attribution,facts:[],interaction:null,rights:{metadataLicense:metadata,mediaLicense:media,mediaLicenseUrl:licenseUrl,
        creator:photo.attribution,attribution:photo.attribution,sourceItemUrl,commercialReuse:true,derivativesAllowed:true,
        verifiedBy:'iNaturalist observation/photo license_code',verifiedAt:new Date().toISOString()}}];
  });
}
export async function openversePool(query,format){
  const data=await poolJson('https://api.openverse.org/v1/images/?'+new URLSearchParams({q:query.term || format.title,license:'cc0,pdm,by,by-sa',license_type:'commercial',page_size:'20'}));
  return (data.results || []).flatMap(record=>{
    const license=licenseCode(record.license);
    if(!license || !/^https:\/\//.test(record.thumbnail || '') || !record.title || !/^https:\/\//.test(record.foreign_landing_url || ''))return [];
    return [{id:`openverse:${record.id}`,formatId:format.id,title:record.title,description:`${record.title}.`,image:record.thumbnail,imageAlt:record.title,
      sourceId:'openverse',sourceName:'Openverse',sourceItemUrl:record.foreign_landing_url,author:record.creator,facts:[],interaction:null,
      rights:{metadataLicense:license,mediaLicense:license,mediaLicenseUrl:record.license_url,creator:record.creator,attribution:record.attribution || record.creator,
        sourceItemUrl:record.foreign_landing_url,commercialReuse:true,derivativesAllowed:true,verifiedBy:'Openverse per-result license',verifiedAt:new Date().toISOString()}}];
  });
}
// Transitional adapters remain explicit single-candidate pools, not fake multi-result APIs.
export const RUNTIME_POOLS={...Object.fromEntries(Object.entries(ADAPTERS).map(([name,load])=>[`${name}Pool`,async(query,format,date)=>{
  const result=legacyRights(await load({...format,query},date));return result?[result]:[];
}])),...CANDIDATE_POOLS,inaturalistPool,openversePool,clevelandPool,chicagoPool,wellcomePool,articlePool,spaceWeatherPool,rijksmuseumPool};
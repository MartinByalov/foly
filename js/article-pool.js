import { poolJson } from './candidate-pools.js';
import { commonsMedia } from './adapters.js';
import { shortDescription } from './copy.js';
import { shuffle, dayKey } from './engine.js';

// Category seeds ship with the site: this fallback does not call Wikidata.
export async function articlePool(query,format,date){
  const seeds=await poolJson('./data/article-seeds.json');
  const titles=shuffle(seeds[query.category] || [],`${dayKey(date)}:${format.id}:articles`).slice(0,6);
  if(!titles.length)return [];
  const endpoint='https://en.wikipedia.org/w/api.php?'+new URLSearchParams({action:'query',format:'json',origin:'*',
    titles:titles.join('|'),redirects:'1',prop:'extracts|pageimages|pageprops',exintro:'1',explaintext:'1',exlimit:'max',piprop:'name'});
  const data=await poolJson(endpoint);
  const pages=Object.values(data.query?.pages || {}).filter(page=>page.pageid>0 && page.extract && !Object.hasOwn(page.pageprops || {},'disambiguation'));
  return Promise.all(pages.map(async page=>{
    const media=await commonsMedia(page.pageimage).catch(()=>({}));
    const url=`https://en.wikipedia.org/?curid=${page.pageid}`;
    return {id:`wikipedia:${page.pageid}`,formatId:format.id,title:page.title,description:shortDescription(page.extract),
      image:media.image || null,imageAlt:page.title,sourceId:'wikipedia',sourceName:'Wikipedia',sourceItemUrl:url,facts:[],interaction:null,
      rights:{metadataLicense:'CC_BY_SA',mediaLicense:media.mediaLicense || null,mediaLicenseUrl:media.mediaLicenseUrl || null,
        creator:media.mediaAttribution || 'Wikipedia contributors',attribution:[media.mediaAttribution,'Wikipedia contributors · CC BY-SA 4.0'].filter(Boolean).join(' · '),
        sourceItemUrl:url,commercialReuse:true,derivativesAllowed:true,verifiedBy:endpoint,verifiedAt:new Date().toISOString()}};
  }));
}
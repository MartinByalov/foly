import { poolJson } from './candidate-pools.js';
const endpoint='https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
export function geomagneticCandidate(rows,format,date){
  const end=new Date(date.getFullYear(),date.getMonth(),date.getDate()+1).getTime();
  const start=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
  const valid=rows.filter(r=>Number.isFinite(r.estimated_kp) && r.estimated_kp>=0 && r.estimated_kp<=9 &&
    Date.parse(`${r.time_tag}Z`)>=start && Date.parse(`${r.time_tag}Z`)<end).sort((a,b)=>a.time_tag.localeCompare(b.time_tag));
  const last=valid.at(-1);if(!last)return null;
  const url='https://www.swpc.noaa.gov/products/planetary-k-index';
  return {id:`noaa:kp:${last.time_tag}`,formatId:format.id,title:`Kp ${last.estimated_kp.toFixed(2)}`,
    description:'Estimated planetary geomagnetic activity on a scale from 0 to 9. This Foly presentation is not an official NOAA product.',
    facts:[`Observed ${last.time_tag.replace('T',' ')} UTC`],image:null,sourceId:'noaa',sourceName:'NOAA SWPC',sourceItemUrl:url,
    visual:{type:'meter',value:last.estimated_kp,min:0,max:9,label:'Estimated planetary Kp'},
    rights:{metadataLicense:'US_GOV_PUBLIC_DOMAIN',mediaLicense:null,creator:'NOAA SWPC',attribution:'Data: NOAA SWPC · Presentation: Foly',
      sourceItemUrl:url,commercialReuse:true,derivativesAllowed:true,verifiedBy:'https://www.weather.gov/disclaimer',verifiedAt:new Date().toISOString()}};
}
export async function spaceWeatherPool(query,format,date){
  const data=await poolJson(endpoint);
  const candidate=geomagneticCandidate(Array.isArray(data)?data:[],format,date);
  return candidate?[candidate]:[];
}
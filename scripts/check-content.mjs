import { readFile } from 'node:fs/promises';
import { ADAPTERS } from '../js/adapters.js';
import { CORE_FORMATS } from '../js/registry.js';
const original=globalThis.fetch;
globalThis.fetch=async (url,options)=>{
  if(String(url).startsWith('./data/'))return {ok:true,json:async()=>JSON.parse(await readFile(new URL('../'+String(url).slice(2),import.meta.url),'utf8'))};
  return original(url,options);
};
const date=new Date(2026,9,8);
for(const id of ['person','scientist','country','dinosaur','album','plant','bird','spacecraft','fossil','aircraft','painting','picture-of-the-day']){
  const format=CORE_FORMATS.find(f=>f.id===id);
  try{const item=await ADAPTERS[format.adapter](format,date);console.log(id,item?.title || 'NULL',item?.image?'image':'metadata');}
  catch(error){console.log(id,'ERROR',error.message);}
}
globalThis.fetch=original;
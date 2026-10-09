import { validateRights } from './license.js';
export const FALLBACK_FAMILIES=Object.freeze(['art','people','history','biodiversity','science','space','geography','books','oddities','trivia','technology']);

export function localCandidateValid(item,format){
  if(!item || !item.id || !item.title || !item.description || !item.sourceName || item.formatId!==format.id)return false;
  if(!validateRights(item.rights,!!item.image).ok)return false;
  if(item.image && !/^\.\/media\/fallbacks\/[a-f0-9]+\.(jpg|png|webp|gif)$/.test(item.image))return false;
  if(format.requirements?.image && !item.image)return false;
  if(format.interaction && !item.interaction?.answer)return false;
  if(['trivia','question'].includes(format.id) && (item.interaction?.type!=='quiz' || !item.interaction.options?.includes(item.interaction.answer)))return false;
  return true;
}

// Caller injects I/O so preflight and offline tests use precisely the same checks.
export async function loadLocalPools(readJson){
  const entries=await Promise.all(FALLBACK_FAMILIES.map(async family=>[family,await readJson(`./data/fallbacks/${family}.json`)]));
  for(const [family,pool] of entries)if(!Array.isArray(pool))throw Error(`Invalid fallback pool: ${family}`);
  return Object.fromEntries(entries);
}
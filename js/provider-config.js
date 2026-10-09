const people=new Set(['person','scientist','inventor','artist','writer','philosopher','explorer','architect','composer','athlete']);
const geography=new Set(['country','city','island','mountain','river','lake','waterfall','castle','bridge','landmark','volcano','cave','language','writing-system','architectural-style']);
const space=new Set(['planet','moon','exoplanet','star','constellation','galaxy','nebula','asteroid','comet','space-image','spacecraft','space-mission','moon-phase']);
const technology=new Set(['invention','discovery','video-game','board-game','machine','tool','aircraft']);
export function fallbackFamily(format){
  if(format.source==='noaa')return 'space';
  if(format.source==='wellcome')return 'art';
  if(people.has(format.id))return 'people';
  if(space.has(format.id))return 'space';
  if(geography.has(format.id))return 'geography';
  if(technology.has(format.id))return 'technology';
  if(format.source==='trivia')return 'trivia';
  if(format.source==='gbif' || format.id==='dinosaur')return 'biodiversity';
  if(format.source==='wikipedia')return 'history';
  if(format.source==='smithsonian')return 'oddities';
  if(['met','cleveland','chicago'].includes(format.source))return format.interaction?'oddities':'art';
  if(['book','film','song','album','mythological-figure'].includes(format.id))return 'books';
  return 'science';
}
export function configureProviders(format){
  const providers=[{id:format.source,adapter:`${format.adapter}Pool`,query:{...format.query}}];
  if(format.source==='wikidata' && !format.interaction)providers.push({id:'wikipedia',adapter:'articlePool',query:{...format.query}});
  if(format.source==='gbif')providers.unshift({id:'inaturalist',adapter:'inaturalistPool',query:{...format.query}});
  if(['photography','photo'].includes(format.id))providers.unshift({id:'openverse',adapter:'openversePool',query:{term:'historic photography'}});
  if(['met','chicago','cleveland'].includes(format.source)){
    for(const id of ['met','cleveland','chicago'])if(id!==format.source)providers.push({id,adapter:id==='met'?'metArtworkPool':`${id}Pool`,query:{...format.query}});
  }
  if(['painting','guess-artist','guess-century'].includes(format.id))providers.unshift({id:'rijksmuseum',adapter:'rijksmuseumPool',query:{type:'painting'}});
  // Wellcome's media adapter is implemented but awaits per-record metadata rights;
  // do not add a provider that the central rights gate would always reject.
  return {
    providers,
    providerSelection:['met','chicago','cleveland','gbif'].includes(format.source)?'daily-rotation':'priority',
    fallbackFamily:fallbackFamily(format),
    requirements:{image:['met','chicago','cleveland','smithsonian','gbif','wellcome'].includes(format.source) || ['picture-of-the-day','space-image'].includes(format.id),commercialReuse:true},
  };
}
import { writeFile, readFile } from 'node:fs/promises';

const additions = {
  person:['Ada Lovelace','Nelson Mandela'],scientist:['Galileo Galilei','Michael Faraday'],
  inventor:['Alexander Graham Bell','Johannes Gutenberg'],artist:['Claude Monet','Frida Kahlo'],
  writer:['Virginia Woolf','Leo Tolstoy'],philosopher:['Immanuel Kant','René Descartes'],
  explorer:['James Cook','Roald Amundsen'],architect:['Antoni Gaudí','Le Corbusier'],
  composer:['Johann Sebastian Bach','Frédéric Chopin'],athlete:['Usain Bolt','Simone Biles'],
  country:['Canada','Italy'],city:['Rome','Sydney'],island:['Madagascar','Crete'],
  mountain:['Kilimanjaro','Mont Blanc'],river:['Amazon River','Rhine'],lake:['Lake Superior','Lake Geneva'],
  waterfall:['Angel Falls','Iguazu Falls'],castle:['Edinburgh Castle','Himeji Castle'],
  bridge:['Brooklyn Bridge','Sydney Harbour Bridge'],landmark:['Taj Mahal','Colosseum'],
  dinosaur:['Stegosaurus','Diplodocus'],mineral:['Gypsum','Pyrite'],gemstone:['Sapphire','Opal'],
  'chemical-element':['Oxygen','Iron'],volcano:['Mauna Loa','Mount Fuji'],
  cave:['Carlsbad Caverns National Park','Lascaux'],planet:['Mars','Saturn'],
  moon:['Europa (moon)','Enceladus'],exoplanet:['Proxima Centauri b','HD 209458 b'],
  star:['Vega','Polaris'],constellation:['Ursa Major','Scorpius'],
  galaxy:['Whirlpool Galaxy','Sombrero Galaxy'],nebula:['Eagle Nebula','Ring Nebula'],
  asteroid:['3 Juno','433 Eros'],comet:['67P/Churyumov–Gerasimenko','Comet Hyakutake'],
  book:['The Hobbit','Frankenstein'],film:['Spirited Away','The Grand Budapest Hotel'],
  song:['Hey Jude','Good Vibrations'],album:['The Dark Side of the Moon','Rumours (album)'],
  'video-game':['Tetris','Portal (video game)'],'board-game':['Scrabble','Catan'],
  language:['Spanish language','Arabic'],'writing-system':['Greek alphabet','Hangul'],
  'mythological-figure':['Thor','Anubis'],'architectural-style':['Art Deco','Brutalist architecture'],
  invention:['Steam engine','Compass'],discovery:['Electromagnetic induction','X-ray'],
  'scientific-concept':['Evolution','Plate tectonics'],'mathematical-concept':['Prime number','Fibonacci sequence'],
  'unit-of-measurement':['Second','Kelvin'],
};

const titles = {
  person:['Albert Einstein','Marie Curie'], scientist:['Isaac Newton','Charles Darwin'],
  inventor:['Thomas Edison','Nikola Tesla'], artist:['Leonardo da Vinci','Vincent van Gogh'],
  writer:['William Shakespeare','Jane Austen'], philosopher:['Plato','Aristotle'],
  explorer:['Marco Polo','Ferdinand Magellan'], architect:['Frank Lloyd Wright','Zaha Hadid'],
  composer:['Wolfgang Amadeus Mozart','Ludwig van Beethoven'], athlete:['Michael Jordan','Serena Williams'],
  country:['Japan','France'], city:['Paris','Tokyo'], island:['Bali','Sicily'],
  mountain:['Mount Everest','K2'], river:['Nile','Danube'], lake:['Lake Baikal','Lake Victoria'],
  waterfall:['Niagara Falls','Victoria Falls'], castle:['Neuschwanstein Castle','Windsor Castle'],
  bridge:['Golden Gate Bridge','Tower Bridge'], landmark:['Eiffel Tower','Stonehenge'],
  dinosaur:['Tyrannosaurus','Triceratops'], mineral:['Quartz','Calcite'], gemstone:['Ruby','Emerald'],
  'chemical-element':['Hydrogen','Carbon'], volcano:['Mount Vesuvius','Mount Etna'],
  cave:['Mammoth Cave National Park','Postojna Cave'], planet:['Mercury (planet)','Jupiter'],
  moon:['Titan (moon)','Ganymede (moon)'], exoplanet:['51 Pegasi b','Kepler-22b'],
  star:['Sirius','Betelgeuse'], constellation:['Orion (constellation)','Cassiopeia (constellation)'],
  galaxy:['Andromeda Galaxy','Triangulum Galaxy'], nebula:['Orion Nebula','Crab Nebula'],
  asteroid:['4 Vesta','2 Pallas'], comet:["Halley's Comet",'Comet Hale–Bopp'],
  book:['Nineteen Eighty-Four','Pride and Prejudice'], film:['Inception','Cinema Paradiso'],
  song:['Bohemian Rhapsody','Imagine (song)'], album:['Abbey Road','Thriller (album)'],
  'video-game':['Minecraft','Super Mario Bros.'], 'board-game':['Chess','Go (game)'],
  language:['French language','Japanese language'], 'writing-system':['Latin script','Cyrillic script'],
  'mythological-figure':['Zeus','Athena'], 'architectural-style':['Gothic architecture','Romanesque architecture'],
  invention:['Telephone','Printing press'], discovery:['Penicillin','Radioactivity'],
  'scientific-concept':['Gravity','Entropy'], 'mathematical-concept':['Pi','Pythagorean theorem'],
  'unit-of-measurement':['Metre','Kilogram'],
};
for (const [category, names] of Object.entries(additions)) titles[category].push(...names);
const all = [...new Set(Object.values(titles).flat())];
const resolved = new Map();
try {
  const existing=JSON.parse(await readFile(new URL('../data/knowledge-pools.json',import.meta.url),'utf8'));
  for(const [category,names] of Object.entries(titles))names.forEach((name,index)=>{if(existing[category]?.[index])resolved.set(name,existing[category][index]);});
}catch { /* First build. */ }
for (let offset=0; offset<all.length; offset+=40) {
  if(all.slice(offset,offset+40).every(title=>resolved.has(title)))continue;
  const response = await fetch('https://en.wikipedia.org/w/api.php?' + new URLSearchParams({
    action:'query', format:'json', redirects:'1', prop:'pageprops', ppprop:'wikibase_item',
    titles:all.slice(offset,offset+40).join('|'), origin:'*',
  }), {signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
  const data = await response.json();
  for(const page of Object.values(data.query?.pages || {})) if(page.pageprops?.wikibase_item) resolved.set(page.title,page.pageprops.wikibase_item);
  for(const change of [...(data.query?.normalized || []),...(data.query?.redirects || [])].reverse())
    if(resolved.has(change.to)) resolved.set(change.from,resolved.get(change.to));
}
const pools=Object.fromEntries(Object.entries(titles).map(([category,names])=>[category,names.map(name=>resolved.get(name)).filter(Boolean)]));
if(Object.values(pools).some(ids=>ids.length<3)) throw new Error('Insufficient candidates for a category');
await writeFile(new URL('../data/knowledge-pools.json',import.meta.url),JSON.stringify(pools,null,2)+'\n');
console.log('Verified',Object.keys(pools).length,'categories',Object.values(pools).flat().length,'entity candidates');
// Ship rights-safe metadata backups for source outages, not unrelated artwork.
const entities = {};
try {
  const existing=JSON.parse(await readFile(new URL('../data/knowledge-backup.json',import.meta.url),'utf8'));
  for(const records of Object.values(existing.pools))for(const record of records)entities[record.id]=record;
}catch { /* First backup. */ }
const ids = [...new Set(Object.values(pools).flat())];
for(let offset=0;process.argv.includes('--wikidata-backup') && offset<ids.length;offset+=20){
  let data;
  for(let attempt=0;attempt<4;attempt++){
    try {
      const response=await fetch('https://www.wikidata.org/w/api.php?'+new URLSearchParams({
        action:'wbgetentities',format:'json',ids:ids.slice(offset,offset+20).join('|'),
        languages:'en|mul',languagefallback:'1',props:'labels|descriptions',
      }),{signal:AbortSignal.timeout(25000)});
      if(!response.ok)throw new Error(`Wikidata ${response.status}`);
      data=await response.json();break;
    }catch(error){if(attempt===3){console.warn(error.message,'— using Wikipedia metadata backup');break;}await new Promise(resolve=>setTimeout(resolve,2500*(attempt+1)));}
  }
  for(const entity of Object.values(data?.entities || {})){
    const title=entity.labels?.en?.value || entity.labels?.mul?.value;
    if(title)entities[entity.id]={id:entity.id,title,description:entity.descriptions?.en?.value || '',
      sourceItemUrl:`https://www.wikidata.org/wiki/${entity.id}`,license:'CC0'};
  }
  await new Promise(resolve=>setTimeout(resolve,400));
}
// Wikipedia lead extracts provide a separately attributed secondary text source.
const missingCategories=Object.keys(titles).filter(category=>!pools[category].some(id=>entities[id]));
const backupTitles=process.argv.includes('--full-backup') ? all : missingCategories.flatMap(category=>titles[category]);
for(let offset=0;offset<backupTitles.length;offset++){
  const title=backupTitles[offset];
  const category=Object.keys(titles).find(key=>titles[key].includes(title));
  if(!process.argv.includes('--full-backup') && pools[category].some(id=>entities[id]))continue;
  if(entities[resolved.get(title)])continue;
  try {
    const response=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(title),{signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw new Error(`Wikipedia backup ${response.status}`);
    const page=await response.json();
    const id=page.wikibase_item;
    if(id && page.extract)entities[id]={id,title:page.titles?.normalized || page.title,description:page.extract,
      sourceId:'wikipedia',sourceName:'Wikipedia contributors',license:'CC BY-SA',
      sourceItemUrl:`https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`};
  }catch(error){console.warn(title,error.message);}
  const partial=Object.fromEntries(Object.entries(pools).map(([category,qs])=>[category,qs.map(id=>entities[id]).filter(Boolean)]));
  await writeFile(new URL('../data/knowledge-backup.json',import.meta.url),JSON.stringify({built:new Date().toISOString(),pools:partial},null,2)+'\n');
  await new Promise(resolve=>setTimeout(resolve,600));
}
const backup=Object.fromEntries(Object.entries(pools).map(([category,qs])=>[category,qs.map(id=>entities[id]).filter(Boolean)]));
const missing=Object.keys(backup).filter(category=>!backup[category].length);
if(missing.length)console.warn('Backup coverage incomplete:',missing.join(', '));
await writeFile(new URL('../data/knowledge-backup.json',import.meta.url),JSON.stringify({built:new Date().toISOString(),pools:backup},null,2)+'\n');
console.log('Saved source-backed metadata backups for',Object.keys(backup).length,'categories');
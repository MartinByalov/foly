import { writeFile } from 'node:fs/promises';
const categories={fossil:{unit:'nmnhpaleo',match:/fossil|paleo|specimen/i},
  'historical-object':{unit:'nmah',match:/./},aircraft:{unit:'nasm',match:/aircraft|airplane|aeroplane/i},
  machine:{unit:'nmah',match:/machine|engine|motor/i},tool:{unit:'nmah',match:/tool|hammer|wrench|knife|instrument/i},
  'strange-object':{unit:'nmah',match:/./},'museum-oddity':{unit:'nmah',match:/./}};
const result=Object.fromEntries(Object.keys(categories).map(key=>[key,[]]));
for(const unit of ['nasm','nmah','nmnhpaleo']){
  const relevant=Object.entries(categories).filter(([,config])=>config.unit===unit);
  for(const shard of ['00','01','02']){
    const url=`https://smithsonian-open-access.s3-us-west-2.amazonaws.com/metadata/edan/${unit}/${shard}.txt`;
    const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
    if(!response.ok) throw new Error(`${response.status} ${url}`);
    const reader=response.body.getReader(), decoder=new TextDecoder();let buffer='';
    try {
      while(relevant.some(([key])=>result[key].length<8)){
        const part=await reader.read();if(part.done)break;
        buffer+=decoder.decode(part.value,{stream:true});
        let end;
        while((end=buffer.indexOf('\n'))>=0){
          const line=buffer.slice(0,end);buffer=buffer.slice(end+1);
          if(!line.trim())continue;
          const record=JSON.parse(line),content=record.content,meta=content?.descriptiveNonRepeating;
          if(meta?.metadata_usage?.access!=='CC0')continue;
          const media=meta.online_media?.media?.find(m=>m.usage?.access==='CC0'&&m.type==='Images'&&m.thumbnail?.startsWith('https://ids.si.edu/'));
          if(!media)continue;
          const title=record.title || meta.title?.content;
          if(/NSF|ADBC|TCN|project|collection database/i.test(title))continue;
          const text=JSON.stringify(content.indexedStructured || {})+' '+title;
          for(const [key,config]of relevant)if(result[key].length<8&&config.match.test(text))result[key].push({
            id:record.id,title,image:(()=>{const url=new URL(media.thumbnail);url.searchParams.set('max','640');return url.href;})(),
            url:(meta.record_link || '').replace(/^http:/,'https:'),
            description:(content.freetext?.notes?.find(n=>n.label==='Summary')?.content || title).slice(0,180),
            license:'CC0',mediaLicense:media.usage.access,unit,provenance:url,
          });
        }
      }
    }finally{await reader.cancel();}
    if(relevant.every(([key])=>result[key].length>=8))break;
  }
}
if(Object.values(result).some(items=>!items.length))throw new Error('Missing Smithsonian category');
await writeFile(new URL('../data/smithsonian.json',import.meta.url),JSON.stringify({built:new Date().toISOString(),pools:result},null,2)+'\n');
console.log(Object.fromEntries(Object.entries(result).map(([key,items])=>[key,items.length])));
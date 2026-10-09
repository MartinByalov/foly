import test from 'node:test';
import assert from 'node:assert/strict';
import { wikipediaFeatured, wikipediaOnThisDay, wikidata, nasaLibrary } from '../js/adapters.js';

test('article and birthday adapters attach verified Commons thumbnails; knowledge falls back to entity claims',async()=>{
  const previous=globalThis.fetch;
  const date=new Date(2026,9,8);
  try{
    globalThis.fetch=async address=>{
      const url=String(address),params=new URL(url,'https://local.test').searchParams;
      let data;
      if(url.includes('images-api.nasa.gov'))data={collection:{items:[{data:[{nasa_id:'mission',title:'Mission photo',center:'JSC'}]}]}};
      else if(url.includes('feed/featured'))data={tfa:{title:'Featured subject',extract:'An article.',content_urls:{desktop:{page:'https://en.wikipedia.org/wiki/Featured_subject'}}},mostread:{articles:[{title:'Rabbit subject'}]}};
      else if(url.includes('feed/onthisday'))data={births:[{year:1900,text:'Birthday subject was born.',pages:[{title:'Birthday subject'}]}],deaths:[{year:1900,text:'Death subject died.',pages:[{title:'Death subject'}]}]};
      else if(url.includes('knowledge-pools'))data={language:['Q1'],'chemical-element':['Q2']};
      else if(params.get('props')==='claims')data={entities:{[params.get('ids')]:{claims:{P18:[{mainsnak:{datavalue:{value:'Element.jpg'}}}]}}}};
      else if(url.includes('wikidata.org'))data={entities:{Q1:{id:'Q1',labels:{en:{value:'Language'}},sitelinks:{enwiki:{title:'Language'}}},Q2:{id:'Q2',labels:{en:{value:'Element'}},sitelinks:{enwiki:{title:'Element'}}}}};
      else if(url.includes('en.wikipedia.org/w/api.php'))data={query:{pages:{1:{title:params.get('titles'),pageimage:['Language','Element'].includes(params.get('titles'))?undefined:'Subject.jpg'}}}};
      else if(url.includes('commons.wikimedia.org'))data={query:{pages:{1:{title:params.get('titles'),imageinfo:[{thumburl:'https://upload.wikimedia.org/thumbnail.jpg',extmetadata:{LicenseShortName:{value:'CC BY 4.0'},Artist:{value:'Creator'}}}]}}}};
      else throw Error('Unexpected request: '+url);
      return {ok:true,json:async()=>data};
    };
    for(const [loader,format] of [
      [wikipediaFeatured,{id:'featured-article'}],
      [wikipediaFeatured,{id:'rabbit-hole'}],
      [wikipediaFeatured,{id:'most-read'}],
      [nasaLibrary,{id:'space-mission'}],
      [wikipediaOnThisDay,{id:'born-today',title:'Born Today'}],
      [wikidata,{id:'language',query:{category:'language'}}],
      [wikidata,{id:'chemical-element',query:{category:'chemical-element'}}],
    ]){
      const item=await loader(format,date);
      assert.equal(item.mediaAllowed,true,format.id);
      assert.equal(item.mediaLicense,'CC BY 4.0');
      assert.equal(item.mediaAttribution,'Creator.');
    }
    const deceased=await wikipediaOnThisDay({id:'died-today',title:'Died Today'},date);
    assert.equal(deceased.title,'Death subject');
  }finally{globalThis.fetch=previous;}
});
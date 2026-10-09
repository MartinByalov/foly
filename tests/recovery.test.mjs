import test from 'node:test';
import assert from 'node:assert/strict';
import { chicago } from '../js/adapters.js';
import { imageAvailable } from '../js/media-health.js';

test('Chicago rejects restricted records and preserves the guessing interaction',async()=>{
  const previous=globalThis.fetch;
  try{
    globalThis.fetch=async()=>({ok:true,json:async()=>({config:{iiif_url:'https://www.artic.edu/iiif/2'},data:[
      {id:1,title:'Restricted',image_id:'bad',is_public_domain:false},
      {id:2,title:'Painting',image_id:'good',is_public_domain:true,artist_display:'Artist',date_start:1889,medium_display:'Oil'},
    ]})});
    const result=await chicago({id:'guess-century',title:'Guess the Century',interaction:'reveal',query:{term:'painting'}},new Date(2026,9,8));
    assert.equal(result.id,'chicago:2');
    assert.equal(result.interaction.answer,'19th century');
    assert.equal(result.mediaAllowed,true);
    assert.match(result.sourceItemUrl,/artic.edu/);
  }finally{globalThis.fetch=previous;}
});

test('browser media checks detect failures and reuse completed checks',async()=>{
  const previous=globalThis.Image;let loads=0;
  try{
    globalThis.Image=class {
      naturalWidth=600;
      set src(value){loads++;queueMicrotask(()=>value.includes('broken')?this.onerror():this.onload());}
    };
    assert.equal(await imageAvailable('https://example.org/broken'),false);
    assert.equal(await imageAvailable('https://example.org/working'),true);
    assert.equal(await imageAvailable('https://example.org/working'),true);
    assert.equal(loads,2);
  }finally{globalThis.Image=previous;}
});
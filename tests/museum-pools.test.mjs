import test from 'node:test';
import assert from 'node:assert/strict';
import { clevelandPool, chicagoPool, wellcomePool } from '../js/museum-pools.js';
import { validateRights } from '../js/license.js';
import { CORE_FORMATS } from '../js/registry.js';

test('museum formats have three independent providers',()=>{
  for(const format of CORE_FORMATS.filter(f=>f.source==='met')){
    assert.ok(new Set(format.providers.map(p=>p.id)).size>=3,format.id);
  }
});
test('museum pools preserve multiple candidates, reject restricted media and keep quiz answers',async()=>{
  const fetch=globalThis.fetch;
  globalThis.fetch=async url=>({ok:true,json:async()=>String(url).includes('clevelandart')?{data:[
    ...[1,2].map(id=>({id,title:`Painting ${id}`,share_license_status:'CC0',images:{web:{url:`https://example.org/${id}.jpg`}},creation_date_earliest:1800,accession_number:String(id)})),
    {id:3,title:'Restricted',share_license_status:'Copyright',images:{web:{url:'https://example.org/3.jpg'}}},
  ]}:String(url).includes('artic')?{data:[{id:4,title:'Chicago painting',is_public_domain:true,image_id:'a',artist_display:'An artist'},
    {id:5,title:'Restricted',is_public_domain:false,image_id:'b'}]}:{results:[{id:'a',source:{id:'b',title:'Manuscript'},locations:[{url:'https://iiif.wellcomecollection.org/image/a/info.json',license:{url:'https://creativecommons.org/licenses/by/4.0/'},credit:'Wellcome'}]}]}});
  try{
    const c=await clevelandPool({term:'test'}, {id:'guess-century',interaction:'reveal'});
    assert.equal(c.length,2);assert.equal(c[0].interaction.answer,'18th century');assert.equal(validateRights(c[0].rights,true).ok,true);
    const a=await chicagoPool({term:'test'},{id:'guess-artist',interaction:'reveal'});
    assert.equal(a.length,1);assert.equal(a[0].interaction.answer,'An artist');
    const w=await wellcomePool({term:'test'},{id:'manuscript'});
    assert.equal(w.length,1);assert.equal(validateRights(w[0].rights,true).ok,false,'image rights must not be copied onto metadata');
  }finally{globalThis.fetch=fetch;}
});
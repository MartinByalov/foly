import test from 'node:test';
import assert from 'node:assert/strict';
import { rijksCandidate } from '../js/rijks-pool.js';
import { validateRights } from '../js/license.js';
const en=[{id:'http://vocab.getty.edu/aat/300388277'}];
const right=id=>[{classified_as:[{id}]}];
function fixture(){return [
  {id:'https://id.rijksmuseum.nl/123',identified_by:[{type:'Name',content:'Painting',language:en}],
    subject_of:[{id:'https://data.rijksmuseum.nl/123',subject_to:right('https://creativecommons.org/publicdomain/zero/1.0/')}],
    shows:[{id:'visual'}],produced_by:{timespan:{begin_of_the_begin:'1899-01-01',identified_by:[{content:'1899',language:en}]}}},
  {id:'visual',subject_to:right('https://creativecommons.org/publicdomain/mark/1.0/'),digitally_shown_by:[{id:'digital'}]},
  {id:'digital',access_point:[{id:'https://iiif.micr.io/abc/full/max/0/default.jpg'}]},
];}
test('Rijks keeps metadata and media evidence separate and preserves century reveal',()=>{
  const item=rijksCandidate(...fixture(),{id:'guess-century',interaction:'reveal'});
  assert.equal(item.rights.metadataLicense,'CC0');assert.equal(item.rights.mediaLicense,'PDM');
  assert.equal(item.interaction.answer,'19th century');assert.match(item.image,/full\/600,/);
  assert.equal(validateRights(item.rights,true).ok,true);
});
test('Rijks rejects restricted media, missing metadata rights and mismatched images',()=>{
  let f=fixture();f[1].subject_to=right('https://creativecommons.org/licenses/by-nc/4.0/');
  assert.equal(rijksCandidate(...f,{id:'painting'}),null);
  f=fixture();f[0].subject_of=[];assert.equal(rijksCandidate(...f,{id:'painting'}),null);
  f=fixture();f[2].id='unrelated';assert.equal(rijksCandidate(...f,{id:'painting'}),null);
});
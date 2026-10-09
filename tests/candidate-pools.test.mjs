import test from 'node:test';
import assert from 'node:assert/strict';
import { metCandidate } from '../js/candidate-pools.js';
import { editionContext } from '../js/resolver.js';
import { validateRights } from '../js/license.js';
const record={objectID:1,title:'Painting',isPublicDomain:true,primaryImageSmall:'https://images.metmuseum.org/CRDImages/ep/web-large/image.jpg',objectURL:'https://www.metmuseum.org/art/collection/search/1',objectDate:'1889',objectBeginDate:1889,medium:'Oil',artistDisplayName:'Artist'};
test('museum pool normalization preserves content identity and rights',()=>{
  const item=metCandidate(record,{id:'guess-artist',interaction:'reveal'});
  assert.equal(item.title,'Painting');
  assert.equal(item.interaction.answer,'Artist');
  assert.equal(validateRights(item.rights,true).ok,true);
  assert.match(item.image,/web-thumb/);
  assert.equal(metCandidate({...record,isPublicDomain:false},{id:'painting'}),null);
});
test('distinct trivia may share source homepage but not a question or title',()=>{
  const edition=editionContext();
  edition.claim({id:'question:1',formatId:'trivia',title:'First question',sourceItemUrl:'https://opentdb.com/'});
  assert.equal(edition.isDuplicate({id:'question:2',formatId:'question',title:'Second question',sourceItemUrl:'https://opentdb.com/'}),false);
  assert.equal(edition.isDuplicate({id:'question:1',formatId:'question',title:'First question',sourceItemUrl:'https://opentdb.com/'}),true);
});
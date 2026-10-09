import test from 'node:test';
import assert from 'node:assert/strict';
import { providerSequence } from '../js/resolver.js';
test('daily provider rotation is stable, preserves fallbacks and varies primary sources',()=>{
  const format={id:'painting',providerSelection:'daily-rotation',providers:['met','chicago','cleveland'].map(id=>({id}))};
  const primaries=new Set();
  for(let day=1;day<=30;day++){
    const date=new Date(2026,9,day),sequence=providerSequence(format,date);
    assert.deepEqual(sequence,providerSequence(format,date));
    assert.deepEqual(sequence.map(p=>p.id).sort(),['chicago','cleveland','met']);
    primaries.add(sequence[0].id);
  }
  assert.equal(primaries.size,3);
  assert.deepEqual(providerSequence({...format,providerSelection:'priority'},new Date()),format.providers);
});
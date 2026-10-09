import test from 'node:test';
import assert from 'node:assert/strict';
import { geomagneticCandidate } from '../js/space-weather.js';
test('geomagnetic card selects latest same-edition measurement and rejects stale data',()=>{
  const date=new Date(2026,9,8,12),format={id:'geomagnetic-activity'};
  const time=new Date(2026,9,8,10).toISOString().replace(/\.000Z$/,'');
  const item=geomagneticCandidate([{time_tag:time,estimated_kp:2.3}],format,date);
  assert.equal(item.visual.value,2.3);assert.equal(item.rights.metadataLicense,'US_GOV_PUBLIC_DOMAIN');
  assert.equal(geomagneticCandidate([{time_tag:'2020-01-01T00:00:00',estimated_kp:2}],format,date),null);
  assert.equal(geomagneticCandidate([{time_tag:time,estimated_kp:12}],format,date),null);
});
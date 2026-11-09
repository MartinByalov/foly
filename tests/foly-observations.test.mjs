import test from 'node:test';
import assert from 'node:assert/strict';
import observations from '../js/foly/sources/observations.js';
import { SOURCES } from '../js/foly/sources.js';
import { present, discover } from '../js/foly/resolver.js';
import { validateDiscoveryRights, requiresCardCredit } from '../js/foly/rights.js';

const fixture = () => ({ metadata: { id: '9414290', name: 'San Francisco' }, data: [{
  t: new Date(Date.now() - 600_000).toISOString().slice(0, 16).replace('T', ' '), v: '1.277', q: 'p',
}] });
const adapter = observations[0];
test('NOAA observations retain datum, UTC, quality and required provider credit without media', async () => {
  const json = async url => {
    assert.equal(new URL(url).searchParams.get('station'), '9414290');
    return fixture();
  };
  const raw = await adapter.fetch({ json, random: () => 0 });
  assert.equal(validateDiscoveryRights(raw).ok, true);
  assert.equal(raw.image, undefined);
  assert.match(raw.subtitle, /1.277 m · MLLW/);
  assert.match(raw.description, /UTC · Preliminary/);
  const source = SOURCES.find(s => s.id === adapter.id);
  assert.equal(source.enabled, false);
  assert.equal(source.visualType, 'text');
  assert.equal(source.imageCapable, false);
  assert.equal(SOURCES.filter(s => s.id === adapter.id).length, 1);
  assert.equal(present(raw, source).kind, 'text');
  assert.equal(requiresCardCredit(present(raw, source)), true);
  await assert.rejects(discover([source], { json, random: () => 0,
    imageLoader: () => assert.fail('No media requested') }));
});
test('NOAA rejects stale, future, malformed and mismatched observations', async () => {
  for (const mutate of [r => r.metadata.id = 'other', r => r.metadata.name = '',
    r => r.data = [], r => r.data[0].v = '', r => r.data[0].v = 'Infinity',
    r => r.data[0].v = '100', r => r.data[0].q = 'unknown',
    r => r.data[0].t = '2000-01-01 00:00', r => r.data[0].t = '2999-01-01 00:00',
    r => r.data[0].t = 'not a date']) {
    const result = fixture(); mutate(result);
    await assert.rejects(adapter.fetch({ json: async () => result, random: () => 0 }));
  }
});
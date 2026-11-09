import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates, probe } from '../scripts/research-foly-batch.mjs';
import { SOURCES } from '../js/foly/sources.js';
import { manuscriptProviders } from '../js/foly/sources/manuscripts.js';

test('research batch has twenty unique independent leads without registering speculative adapters', () => {
  assert.equal(candidates.length, 20);
  assert.equal(new Set(candidates.map(row => row[0])).size, 20);
  assert.equal(new Set(candidates.map(row => row[1])).size, 20);
  for (const [id, name, theme, documentation, endpoint, assessment] of candidates) {
    assert.ok(name && theme && assessment);
    assert.equal(new URL(documentation).protocol, 'https:');
    if (endpoint) assert.equal(new URL(endpoint).protocol, 'https:');
    const implemented = new Set(['finnishGallery', 'openverse', ...manuscriptProviders.map(provider => provider.id)]);
    if (!implemented.has(id)) assert.equal(SOURCES.some(source => source.id === id), false, id);
  }
});

test('research probe records status, CORS and JSON without treating HTML challenges as a JSON API', async () => {
  const report = await probe('https://example.test/api', async (url, options) => {
    assert.equal(url, 'https://example.test/api');
    assert.equal(options.headers.Origin, 'http://localhost:8000');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response('{"items":[]}', { status: 200, headers: {
      'content-type': 'application/json', 'access-control-allow-origin': '*',
    } });
  });
  assert.equal(report.status, 200);
  assert.equal(report.json, true);
  assert.equal(report.cors, '*');
  assert.deepEqual(report.keys, ['items']);
  const challenge = await probe('https://example.test/api', async () =>
    new Response('<html>Blocked</html>', { status: 403, headers: { 'content-type': 'text/html' } }));
  assert.equal(challenge.status, 403);
  assert.equal(challenge.json, false);
  assert.equal(challenge.cors, null);
});

test('research probe bounds retained evidence and records request failures', async () => {
  const large = await probe('https://example.test/api', async () => new Response('x'.repeat(1100000)));
  assert.equal(large.sample.length, 1600);
  assert.equal(large.json, false);
  const failed = await probe('https://example.test/api', async () => { throw Error('Network unavailable'); });
  assert.equal(failed.error, 'Network unavailable');
  assert.equal(failed.status, undefined);
});
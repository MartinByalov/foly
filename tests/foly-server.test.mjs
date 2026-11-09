import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevServer } from '../scripts/serve.mjs';

test('development server serves preview and fresh module exports without conditional cache hits', async () => {
  const server = createDevServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const route of ['/preview', '/preview/']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /text\/html/);
      assert.match(await response.text(), /preview-entry.js\?v=/);
    }
    const response = await fetch(`${base}/js/foly/categories.js?v=20261102-2`, {
      headers: { 'If-Modified-Since': 'Wed, 01 Jan 2099 00:00:00 GMT', 'If-None-Match': '*' },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('content-type'), /javascript/);
    assert.match(await response.text(), /export function categorySummary/);
    assert.equal((await fetch(base + '/missing.js')).status, 404);
    assert.equal((await fetch(base + '/preview', { method: 'HEAD' })).status, 200);
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/%2e%2e%5csecret')).status, 403);
    for (const route of ['/.env', '/.git/config', '/%2eenv', '/.env.example']) {
      assert.equal((await fetch(base + route)).status, 403);
    }
    for (const id of ['smithsonian', 'bhl', 'arbitrary']) {
      assert.equal((await fetch(`${base}/api/visuals/${id}`)).status, 404);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { SOURCES } from '../js/foly/sources.js';
import { SOURCE_POLICIES } from '../js/foly/sources/policies.js';
import { readFile } from 'node:fs/promises';

test('rejected iDigBio and 3DTexel integrations cannot return through registry or diagnostic overrides', async () => {
  for (const id of ['idigbio', 'texel']) {
    assert.equal(SOURCES.some(source => source.id === id), false);
    assert.equal(SOURCE_POLICIES[id], undefined);
    await assert.rejects(readFile(new URL(`../js/foly/sources/${id}.js`, import.meta.url)), { code: 'ENOENT' });
  }
  const checker = await readFile(new URL('../scripts/check-foly-browser.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(checker, /FOLY_IDIGBIO_CANDIDATE|FOLY_TEXEL_CANDIDATE/);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('discovery copy has a readable measure and shares one spacing unit for actions and credits', async () => {
  const css = await readFile(new URL('../css/foly.css', import.meta.url), 'utf8');
  assert.match(css, /\.find \.card-copy \{[^}]*width: 100%; max-width: 44ch;/);
  assert.match(css, /\.discovery \.find \{ --card-spacing: 20px;[^}]*padding-bottom: var\(--card-spacing\);/);
  assert.match(css, /\.discovery \.find-actions \{[^}]*margin-top: var\(--card-spacing\); gap: var\(--card-spacing\);/);
  assert.match(css, /\.discovery \.card-copy \{ padding: 0; \}/);
  assert.match(css, /\.discovery \.card-rights \{ margin: var\(--card-spacing\) 0 0;/);
});

test('mobile copy uses separate portrait and landscape measures', async () => {
  const css = await readFile(new URL('../css/foly.css', import.meta.url), 'utf8');
  assert.match(css, /@media[^\{]*\(orientation: portrait\)[^\{]*\{\s*\.discovery \.card-copy \{ width: 90%; max-width: 44ch; \}/);
  assert.match(css, /@media[^\{]*\(orientation: landscape\)[^\{]*\{\s*\.discovery \.card-copy \{ width: 88%; max-width: none; \}/);
});
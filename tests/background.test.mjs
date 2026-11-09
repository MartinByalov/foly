import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { information, informationLinks } from '../js/foly/information.js';

test('background is a local WebP image with no playback dependency', async () => {
  const [image, main, app, css] = await Promise.all([
    readFile(new URL('../media/background.webp', import.meta.url)),
    readFile(new URL('../js/foly/main.js', import.meta.url), 'utf8'),
    readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../css/theme.css', import.meta.url), 'utf8'),
  ]);
  assert.equal(image.toString('ascii', 0, 4), 'RIFF');
  assert.equal(image.toString('ascii', 8, 12), 'WEBP');
  assert.ok(image.length > 1000);
  assert.doesNotMatch(main + app, /freezeBackground|background-video/);
  assert.match(css, /\.video-bg \.background-image\s*\{[^}]*object-fit: cover;/);
});

test('information no longer describes an external background host', () => {
  for (const [language, sections] of Object.entries(information)) {
    assert.doesNotMatch(JSON.stringify(sections), /Wix|wixstatic/);
    assert.equal(informationLinks('privacy', language).length, 2);
  }
});
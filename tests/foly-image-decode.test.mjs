import test from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '../js/foly/images.js';
import { fetchJson } from '../js/foly/resolver.js';

test('external metadata requests omit cookies', async () => {
  await fetchJson('https://example.test/data', { fetcher: async (url, options) => {
    assert.equal(options.credentials, 'omit');
    return { ok: true, json: async () => ({ ok: true }) };
  } });
});

test('image requests set anonymous CORS before assigning the URL', async () => {
  class AnonymousImage {
    naturalWidth = 10;
    naturalHeight = 10;
    set src(value) { assert.equal(this.crossOrigin, 'anonymous'); queueMicrotask(() => this.onload()); }
    decode() { return Promise.resolve(); }
  }
  await loadImage('https://images.test/anonymous.png', { ImageClass: AnonymousImage });
});

test('image load success waits for decoding and requires both dimensions', async () => {
  let completeDecode;
  class ImageStub {
    naturalWidth = 100;
    naturalHeight = 100;
    set src(url) { queueMicrotask(() => this.onload()); }
    decode() { return new Promise(resolve => { completeDecode = resolve; }); }
    removeAttribute() {}
  }
  let done = false;
  const loading = loadImage('https://images.test/decode-wait.png', { ImageClass: ImageStub }).then(() => { done = true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(done, false);
  completeDecode();
  await loading;
  assert.equal(done, true);
  class FlatImage extends ImageStub { naturalHeight = 0; }
  await assert.rejects(loadImage('https://images.test/flat.png', { ImageClass: FlatImage }), /Empty image/);
});

test('decode failure is not cached as success and a late decode cannot undo a timeout', async () => {
  let broken = true;
  let completeDecode;
  class ImageStub {
    naturalWidth = 100;
    naturalHeight = 100;
    set src(url) { queueMicrotask(() => this.onload()); }
    decode() { return broken ? Promise.reject(Error('Decode rejected')) : Promise.resolve(); }
    removeAttribute() {}
  }
  const url = 'https://images.test/decode-retry.png';
  await assert.rejects(loadImage(url, { ImageClass: ImageStub }), /Decode rejected/);
  broken = false;
  assert.equal(await loadImage(url, { ImageClass: ImageStub }), url);
  class SlowImage extends ImageStub {
    decode() { return new Promise(resolve => { completeDecode = resolve; }); }
  }
  const slowUrl = 'https://images.test/decode-timeout.png';
  await assert.rejects(loadImage(slowUrl, { ImageClass: SlowImage, timeout: 10 }), /timed out/);
  completeDecode();
  assert.equal(await loadImage(slowUrl, { ImageClass: ImageStub }), slowUrl);
});
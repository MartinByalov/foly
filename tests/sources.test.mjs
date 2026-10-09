import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeFormats, localDay } from '../js/catalog.js';
import { museum, moon, skyline, load, collection } from '../js/sources.js';

const records = JSON.parse(await readFile(new URL('../data/collection.json', import.meta.url), 'utf8'));
const chicago = JSON.parse(await readFile(new URL('../data/chicago.json', import.meta.url), 'utf8'));

test('100 distinct, verified collection objects in the local snapshot', () => {
  assert.equal(records.length, 100);
  assert.equal(new Set(records.map(record => record.id)).size, 100);
  const titleCounts = Object.values(Object.groupBy(records, record => record.title.toLowerCase()))
    .map(items => items.length);
  assert.ok(Math.max(...titleCounts) <= 2, 'avoid repeated generic titles');
  for (const item of records) {
    assert.match(item.image, /^https:\/\/images\.metmuseum\.org\//);
    assert.match(item.fullImage, /^https:\/\/images\.metmuseum\.org\//);
    assert.match(item.url, /^https:\/\/www\.metmuseum\.org\//);
    assert.ok(item.title.trim());
  }
});

test('the edition has 100 distinct cards including a playable video', () => {
  const formats = makeFormats(records, new Date(2026, 9, 8));
  assert.equal(formats.length, 100);
  assert.equal(new Set(formats.map(item => item.id)).size, 100);
  assert.equal(formats.filter(item => item.source === 'met').length, 97);
  assert.equal(formats.filter(item => item.source === 'chicago').length, 0);
  assert.equal(formats.filter(item => item.source === 'video').length, 1);
  assert.equal(formats.filter(item => item.source === 'usgs').length, 1);
  assert.equal(records.filter(record => !formats.some(item => item.source === 'met' && item.record.id === record.id)).length, 3);
  assert.equal(makeFormats(records, new Date(2026, 9, 8))[0].id, formats[0].id);
  assert.match(localDay(new Date(2026, 9, 8)), /^2026-10-08$/);
});

test('offline media and moon are usable without remote services', async () => {
  assert.equal(museum(records[0]).kind, 'image');
  assert.equal(skyline().kind, 'video');
  assert.match(moon(new Date(2026, 9, 8)).headline, /^\d+%$/);
  assert.equal((await load({ record: records[0] }, new Date(), records[1])).url, records[0].url);
});

test('USGS errors fall back to a verified museum object without error copy', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error('offline'); };
    const item = await load({ source: 'usgs' }, new Date(), records[1]);
    assert.equal(item.kind, 'image');
    assert.equal(item.url, records[1].url);
  } finally { globalThis.fetch = original; }
});

test('local collection is checked before it is displayed', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => records });
    assert.equal((await collection()).length, 100);
    globalThis.fetch = async () => ({ ok: true, json: async () => [records[0]] });
    await assert.rejects(collection(), /integrity/);
  } finally { globalThis.fetch = original; }
});

test('Chicago preview remains unpublished while external image delivery is unreliable', () => {
  assert.equal(chicago.length, 10);
  assert.ok(chicago.every(item => /^https:\/\/www\.artic\.edu\/artworks\/\d+$/.test(item.url)));
  const edition = makeFormats(records, new Date(2026, 9, 8));
  assert.ok(edition.every(item => item.source !== 'chicago'));
});
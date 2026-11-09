import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationClient, translationSegments, createDiscoveryTranslator } from '../js/foly/translation.js';

test('UTF-8 segmentation preserves text within provider byte limits', () => {
  const text = 'Природа 🌳 中文 '.repeat(90);
  const segments = translationSegments(text);
  assert.equal(segments.join(''), text);
  assert.ok(segments.every(segment => new TextEncoder().encode(segment).length <= 480));
});

test('segmentation prefers sentences and words and validates byte limits', () => {
  assert.deepEqual(translationSegments('First sentence. Second sentence.', 20), ['First sentence. ', 'Second sentence.']);
  assert.deepEqual(translationSegments('one two three four', 10), ['one two ', 'three four']);
  for (const limit of [0, 3, 501, NaN]) assert.throws(() => translationSegments('text', limit), RangeError);
  const text = '🌳'.repeat(200);
  assert.equal(translationSegments(text).join(''), text);
});

test('segmented translations retain boundary whitespace and never join adjacent words', async () => {
  const text = 'A complete sentence. '.repeat(50);
  const translate = createTranslationClient({ json: async url => ({ responseStatus: 200,
    responseData: { translatedText: new URL(url).searchParams.get('q').toUpperCase() } }) });
  assert.equal(await translate(text, 'en', 'bg'), text.toUpperCase());
});

test('requests are serialized and identical concurrent translations share one request', async () => {
  let active = 0;
  let maximum = 0;
  let calls = 0;
  const translate = createTranslationClient({ json: async () => {
    calls++;
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { responseStatus: 200, responseData: { translatedText: 'Превод' } };
  } });
  await Promise.all([translate('Tree', 'en', 'bg'), translate('Tree', 'en', 'bg'), translate('Forest', 'en', 'bg')]);
  assert.equal(calls, 2);
  assert.equal(maximum, 1);
});

test('temporary network failures retry once while quota failures do not retry', async () => {
  let calls = 0;
  const translate = createTranslationClient({ delay: async () => {}, json: async () => {
    if (++calls === 1) throw Error('HTTP 503');
    return { responseStatus: 200, responseData: { translatedText: 'Дърво' } };
  } });
  assert.equal(await translate('Tree', 'en', 'bg'), 'Дърво');
  assert.equal(calls, 2);
  for (const response of [{ responseStatus: 429 }, { responseStatus: 200, quotaFinished: true },
    { responseStatus: 200, responseData: { translatedText: 'MYMEMORY WARNING: quota exceeded' } }]) {
    let attempts = 0;
    const fail = createTranslationClient({ json: async () => { attempts++; return response; } });
    await assert.rejects(fail('Tree', 'en', 'bg'));
    assert.equal(attempts, 1);
  }
});

test('failed partial discovery translation is atomic and can be retried', async () => {
  const original = { language: 'en', sourceId: 'wikipedia-nature', title: 'Tree', description: 'A tree.',
    image: 'https://upload.wikimedia.org/tree.jpg', rights: { text: 'A tree.' } };
  const snapshot = structuredClone(original);
  let fail = true;
  const translate = createDiscoveryTranslator(async text => {
    if (fail && text === 'A tree.') throw Error('Unavailable');
    return `bg: ${text}`;
  });
  await assert.rejects(translate(original, 'bg'));
  assert.deepEqual(original, snapshot);
  fail = false;
  const result = await translate(original, 'bg');
  assert.equal(result.description, 'bg: A tree.');
  assert.deepEqual(original, snapshot);
});

test('translation client caches successful results and rejects quota failures', async () => {
  let calls = 0;
  const translate = createTranslationClient({ json: async url => {
    calls++;
    assert.equal(new URL(url).searchParams.get('langpair'), 'en|bg');
    return { responseStatus: 200, responseData: { translatedText: 'Дърво' } };
  } });
  assert.equal(await translate('Tree', 'en', 'bg'), 'Дърво');
  assert.equal(await translate('Tree', 'en', 'bg'), 'Дърво');
  assert.equal(calls, 1);
  const fail = createTranslationClient({ json: async () => ({ responseStatus: 403, quotaFinished: true }) });
  await assert.rejects(fail('Tree', 'en', 'bg'), /unavailable/);
});

test('existing discoveries translate from original and retain exact image and rights evidence', async () => {
  const original = { language: 'en', sourceId: 'wikipedia-nature', title: 'Tree', description: 'A tree.',
    image: 'https://upload.wikimedia.org/tree.jpg', url: 'https://en.wikipedia.org/wiki/Tree',
    rights: { text: 'A tree.', imageCreator: 'Photographer', metadataLicense: 'CC_BY_SA' } };
  const calls = [];
  const translate = createDiscoveryTranslator(async (text, from, to) => {
    calls.push([from, to]); return `${to}: ${text}`;
  });
  const bg = await translate(original, 'bg');
  assert.equal(bg.title, 'bg: Tree');
  assert.equal(bg.category, 'Природа');
  assert.equal(bg.image, original.image);
  assert.deepEqual(bg.rights, original.rights);
  assert.equal(bg.machineTranslated, true);
  assert.equal(await translate(bg, 'en'), original);
  const fr = await translate(bg, 'fr');
  assert.equal(fr.title, 'fr: Tree');
  assert.ok(calls.every(([from]) => from === 'en'));
  assert.equal(await translate(original, 'bg'), bg);
});
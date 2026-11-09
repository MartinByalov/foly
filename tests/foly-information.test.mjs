import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, information } from '../js/foly/locale.js';
import { informationLinks } from '../js/foly/information.js';

test('information has exactly the supported languages and consistent sections', () => {
  assert.deepEqual(Object.keys(information).sort(), Object.keys(LANGUAGES).sort());
  for (const language of Object.keys(LANGUAGES)) {
    const sections = information[language];
    assert.equal(sections.about.length, 3, language);
    assert.equal(sections.sources.length, 3, language);
    assert.equal(sections.privacy.length, 4, language);
    for (const paragraphs of Object.values(sections)) {
      assert.ok(paragraphs.every(text => typeof text === 'string' && text.length > 30), language);
      assert.equal(new Set(paragraphs).size, paragraphs.length, language);
    }
    assert.ok(sections.about.some(text => text.includes('MyMemory')), language);
    assert.ok(sections.sources.some(text => text.includes('CC BY-SA 4.0')), language);
    assert.ok(sections.privacy.some(text => text.includes('sessionStorage')), language);
    assert.ok(sections.privacy.some(text => text.includes('MyMemory') && text.includes('IP')), language);
    assert.ok(sections.privacy.some(text => text.includes('CORS')), language);
    assert.equal(informationLinks('about', language).length, 0);
    const sources = informationLinks('sources', language);
    assert.equal(sources.length, 3);
    assert.equal(new URL(sources[0].href).hostname, `${language}.wikipedia.org`);
    assert.equal(informationLinks('privacy', language).length, 2);
    for (const link of [...sources, ...informationLinks('privacy', language)]) {
      assert.equal(new URL(link.href).protocol, 'https:');
      assert.ok(link.label.length > 0);
    }
  }
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, normalizeLanguage, information, t } from '../js/foly/locale.js';
import { discoveryCatalog } from '../js/foly/catalog.js';

test('language menu includes readable names for all fourteen languages', () => {
  assert.equal(Object.keys(LANGUAGES).length, 14);
  assert.match(LANGUAGES.hi, /Hindi/);
  for (const language of ['es', 'pt', 'de', 'zh', 'ar', 'ru', 'it', 'nl', 'pl', 'tr']) {
    assert.equal(normalizeLanguage(language), language);
    assert.ok(LANGUAGES[language].length > 2);
  }
});

for (const language of Object.keys(LANGUAGES)) {
  test(`${language}: controls, information and topic labels are complete`, () => {
    for (const key of ['pick', 'categories', 'all', 'search', 'noCategories', 'about', 'sources', 'privacy',
      'random', 'retry', 'language', 'selected', 'originalImage', 'excerptShort', 'unavailable']) {
      assert.equal(typeof t(key, language), 'string', key);
      assert.ok(t(key, language).length > 0, key);
    }
    for (const section of ['about', 'sources', 'privacy']) {
      assert.ok(information[language][section].every(text => text.length > 30));
    }
    const { primary, fallback } = discoveryCatalog(language);
    assert.ok(primary.every(source => source.language === language));
    assert.ok(fallback.every(source => source.languages.includes(language)));
    assert.equal(primary.filter(source => !['wikipedia-dyk', 'wikipedia-today'].includes(source.id)).length, 15);
  });
}

for (const language of ['it', 'nl', 'pl', 'tr']) {
  test(`${language}: every control and translation notice is localized`, () => {
    for (const key of ['pick', 'categories', 'all', 'search', 'noCategories', 'discoveries', 'cleared', 'empty',
      'close', 'about', 'sources', 'privacy', 'random', 'today', 'science', 'history', 'space', 'nature',
      'reveal', 'open', 'loading', 'opened', 'failed', 'failedDetail', 'retry', 'notices', 'articleHistory',
      'information', 'language', 'selected', 'originalImage', 'machineTranslation', 'translationFailed',
      'excerpt', 'excerptShort', 'unavailable']) {
      assert.equal(typeof t(key, language), 'string', key);
      assert.ok(t(key, language).trim().length > 0, key);
      assert.notEqual(t(key, language), key, key);
    }
    assert.ok(information[language].privacy.some(text => text.includes('MyMemory')));
  });
}
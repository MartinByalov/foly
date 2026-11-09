import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryCard } from '../js/foly/card.js';

class Element {
  constructor(tag) {
    this.tag = tag; this.children = []; this.attributes = {}; this.listeners = {};
    this.className = ''; this.textContent = ''; this.disabled = false;
    this.classList = { toggle: (name, enabled) => {
      const names = new Set(this.className.split(' ').filter(Boolean));
      if (enabled) names.add(name); else names.delete(name);
      this.className = [...names].join(' ');
    } };
  }
  setAttribute(key, value) { this.attributes[key] = value; }
  append(...children) { this.children.push(...children); }
  addEventListener(key, callback) { this.listeners[key] = callback; }
  click() { if (!this.disabled) this.listeners.click?.({ target: this }); }
}
const nodes = (node, className) => [node, ...node.children.filter(child => child instanceof Element).flatMap(child => nodes(child, className))]
  .filter(child => child.className.split(' ').includes(className));
const find = (node, name) => nodes(node, name)[0];
const elements = node => [node, ...node.children.filter(child => child instanceof Element).flatMap(elements)];

test('SVG discoveries get definite-size vector media without changing raster images or required credits', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  try {
    for (const [filename, vector] of [['cat.svg', true], ['cat.SVG?version=1', true], ['shapes/svg?seed=cat', true], ['cat.jpg', false]]) {
      const discovery = { title: 'Cat artwork', category: 'Design', image: `https://example.org/${filename}`,
        url: 'https://example.org/item', rights: { mediaLicense: 'CC_BY', mediaLicenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
          creator: 'Artist', mediaTitle: 'Cat artwork', attribution: 'Artist credit', changes: 'Scaled' } };
      const card = discoveryCard(discovery);
      const media = find(card, 'media');
      assert.equal(Boolean(find(card, 'media-vector')), vector);
      assert.equal(media.children[0].tag, 'img');
      assert.equal(media.children[0].attributes.src, discovery.image);
      assert.equal(media.children[0].attributes.alt, discovery.title);
      assert.equal(card.children.at(-1), find(card, 'card-rights'));
    }
  } finally { globalThis.document = previous; }
});

test('only mandatory attribution appears at the bottom after the source action', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: tag => new Element(tag) };
  try {
    for (const [license, required] of [['CC0', false], ['PDM', false], ['CC_BY', true], ['CC_BY_SA', true]]) {
      const rights = { mediaLicense: license, mediaLicenseUrl: license === 'CC_BY'
        ? 'https://creativecommons.org/licenses/by/4.0/' : license === 'CC_BY_SA'
          ? 'https://creativecommons.org/licenses/by-sa/4.0/' : 'https://creativecommons.org/publicdomain/zero/1.0/',
      license_name: license === 'CC_BY' ? 'CC BY 4.0' : license === 'CC_BY_SA' ? 'CC BY-SA 4.0' : 'PDM',
      creator: 'Artist', mediaTitle: 'Tree', attribution: 'Artist credit', changes: 'Scaled' };
      const d = { title: 'Tree', category: 'Art', image: 'https://example.org/tree.jpg', url: 'https://example.org/item', rights };
      const card = discoveryCard(d);
      assert.equal(Boolean(find(card, 'card-rights')), required);
      if (required) {
        assert.equal(card.children.at(-1), find(card, 'card-rights'));
        const licenseLink = elements(card).find(element => element.tag === 'a' && element.attributes.href === rights.mediaLicenseUrl);
        assert.equal(licenseLink.children[0], rights.license_name);
      }
      rights.creditRequired = true;
      assert.ok(find(discoveryCard(d), 'card-rights'));
    }
  } finally { globalThis.document = previous; }
});

for (const options of [
  ['Colossus of Rhodes', 'Great Pyramid of Giza', 'Great Wall of China', 'Hanging Gardens of Babylon'],
  ['True', 'False'],
]) {
  for (const correct of [true, false]) {
    test(`${options.length} answer buttons handle ${correct ? 'correct' : 'wrong'} choices and reopening`, () => {
      const previous = globalThis.document;
      globalThis.document = { createElement: tag => new Element(tag) };
      try {
        const d = { sourceId: 'opentdb', kind: 'question', title: 'Which answer?', category: 'Trivia', subtitle: 'medium', options, reveal: options[options.length - 1], rights: { metadataLicense: 'CC_BY_SA' } };
        const card = discoveryCard(d);
        const buttons = nodes(card, 'quiz-option');
        assert.equal(buttons.length, options.length);
        assert.equal(find(card, 'reveal-btn'), undefined);
        assert.equal(find(card, 'card-copy'), undefined);
        assert.equal(find(card, 'card-rights'), undefined);
        assert.ok(nodes(card, 'ghost-btn').some(node => node.attributes.href?.endsWith('#about-trivia')));
        assert.equal(find(card, 'quiz-feedback'), undefined);
        assert.equal(buttons.some(button => button.className.includes('correct')), false);
        assert.deepEqual(buttons.map(button => button.children[0]), options);
        const index = correct ? options.length - 1 : 0;
        buttons[index].click();
        assert.equal(d.quizChoice, options[index]);
        assert.ok(buttons.every(button => button.disabled));
        assert.equal(buttons[index].attributes['aria-pressed'], 'true');
        assert.equal(find(card, 'quiz-feedback'), undefined);
        assert.equal(find(card, 'correct'), buttons[options.length - 1]);
        assert.equal(Boolean(find(card, 'wrong')), !correct);
        buttons[(index + 1) % options.length].click();
        assert.equal(d.quizChoice, options[index]);
        const reopened = discoveryCard(d);
        assert.equal(find(reopened, 'quiz-feedback'), undefined);
        assert.ok(find(reopened, 'correct'));
        assert.ok(nodes(reopened, 'quiz-option').every(button => button.disabled));
      } finally { globalThis.document = previous; }
    });
  }
}
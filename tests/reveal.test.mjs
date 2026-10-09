import test from 'node:test';
import assert from 'node:assert/strict';
import { centuryLabel, isReveal } from '../js/interactions.js';

// Minimal DOM test double: exercise the actual renderer's handlers without
// installing a DOM library or depending on remote APIs.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {};
    this.listeners = {}; this.hidden = false; this.disabled = false;
    this.className = ''; this.textContent = '';
    this.classList = {
      toggle: (name, enabled) => {
        const names = new Set(this.className.split(' ').filter(Boolean));
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
      remove: name => this.classList.toggle(name, false),
      contains: name => this.className.split(' ').includes(name),
    };
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.textContent = ''; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, listener) { (this.listeners[name] ||= []).push(listener); }
  click() { if (!this.disabled) for (const listener of this.listeners.click || []) listener({ target: this }); }
  after(child) { child.parent = this.parent; this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, child); }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  querySelectorAll(selector) {
    const matches = [];
    const visit = node => {
      for (const child of node.children) {
        if (selector.startsWith('.') ? child.classList.contains(selector.slice(1)) : child.tag === selector) matches.push(child);
        visit(child);
      }
    };
    visit(this); return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  showModal() { this.open = true; }
  close() { this.open = false; }
}

const elements = Object.fromEntries(['mediaDialog', 'dialogContent', 'dialogClose'].map(id => [id, new Element()]));
const previousDocument = globalThis.document;
globalThis.document = { getElementById: id => elements[id], createElement: tag => new Element(tag) };
const { render } = await import('../js/ui.js');
test.after(() => { globalThis.document = previousDocument; });

function card() {
  const node = new Element('article');
  for (const name of ['card-title', 'card-body', 'card-copy', 'source-row']) {
    const child = new Element(); child.className = name; child.textContent = name === 'card-title' ? 'Guess From the Crop' : '';
    node.append(child);
  }
  return node;
}
const item = {
  id: 'met:1', title: 'Mystery Object', sourceId: 'met', sourceName: 'The Met',
  image: 'https://images.metmuseum.org/example.jpg', imageAlt: 'Mystery object',
  description: 'Secret Artist', facts: ['Secret Artist', '1889'], author: 'Secret Artist',
  sourceItemUrl: 'https://www.metmuseum.org/art/collection/search/1',
  interaction: { type: 'crop', answer: 'Secret Artist', details: 'Painted in 1889.' },
};

test('Reveal hides answer facts, author and Explore before the click', () => {
  const node = card(); render(node, item);
  const copy = node.querySelector('.card-copy');
  assert.equal(copy.querySelector('.item-title'), null);
  assert.equal(copy.querySelector('.item-facts'), null);
  assert.equal(node.querySelector('.source-author').hidden, true);
  assert.equal(node.querySelector('a').hidden, true);
  assert.equal(node.querySelector('.media-button').disabled, true);
});

test('source sits inside the visual stage for images and text, not in the footer', () => {
  for (const image of [item.image, null]) {
    const node = card(); render(node, { ...item, image });
    const stage = node.querySelector('.media-stage');
    assert.equal(stage.querySelector('.media-source').parent, stage);
    assert.equal(stage.querySelector('.source-chip').textContent, 'The Met');
    assert.equal(node.querySelector('.source-row').querySelector('.media-source'), null);
    render(node, { ...item, image });
    assert.equal(node.querySelectorAll('.media-source').length, 1);
  }
});

test('clicking Reveal shows answer, resets crop, unlocks image and is idempotent', () => {
  const node = card(); render(node, item);
  const button = node.querySelector('.reveal-btn');
  button.click();
  assert.equal(node.querySelector('.item-title').textContent, 'Secret Artist');
  assert.equal(node.querySelector('.item-description').textContent, 'Painted in 1889.');
  assert.equal(node.querySelector('.card-body').classList.contains('crop-question'), false);
  assert.equal(node.querySelector('.media-button').disabled, false);
  assert.equal(node.querySelector('.source-author').hidden, false);
  assert.equal(node.querySelector('a').hidden, false);
  assert.equal(button.attributes['aria-expanded'], 'true');
  assert.equal(button.disabled, true);
  assert.equal(node.querySelector('.reveal-btn'),null);
  button.click();
  assert.equal(node.querySelectorAll('.item-title').length, 1);
  render(node, item);
  assert.equal(node.querySelectorAll('.reveal-btn').length, 1);
  assert.equal(node.querySelector('.reveal-btn').disabled, false);
  assert.equal(node.dataset.revealed, 'false');
});

test('crop cannot open the full-image dialog before reveal', () => {
  const node = card(); render(node, item);
  elements.mediaDialog.open = false;
  node.querySelector('.media-button').click();
  assert.equal(elements.mediaDialog.open, false);
  node.querySelector('.reveal-btn').click();
  node.querySelector('.media-button').click();
  assert.equal(elements.mediaDialog.open, true);
});

test('missing answers do not create a misleading Reveal button', () => {
  const node = card(); render(node, { ...item, interaction: { type: 'reveal', answer: '' } });
  assert.equal(node.querySelector('.reveal-btn'), null);
  assert.equal(isReveal({ interaction: 'reveal' }), false);
});

test('cached quizzes omit Pick an answer but still show answer feedback', () => {
  const node = card();
  render(node, { ...item, image: null, title: 'Which material?', description: 'Pick an answer.',
    facts: [], interaction: { type: 'quiz', answer: 'Gold', options: ['Gold', 'Silver'] } });
  assert.equal(node.querySelector('.item-description'), null);
  assert.equal(node.querySelectorAll('.quiz-option').length, 2);
  node.querySelector('.quiz-option').click();
  assert.equal(node.querySelector('.text-frame').textContent, 'Correct! Gold');
  assert.ok(node.querySelectorAll('.quiz-option').every(button => button.disabled));
});

test('century answers handle CE, BCE, boundaries and missing dates', () => {
  assert.equal(centuryLabel(1900), '19th century');
  assert.equal(centuryLabel(1901), '20th century');
  assert.equal(centuryLabel(-450), '5th century BCE');
  assert.equal(centuryLabel(1100), '11th century');
  assert.equal(centuryLabel(0), null);
  assert.equal(centuryLabel(undefined), null);
});

test('text-only concepts, discoveries and current events display the actual content inside the frame', () => {
  for(const [formatId,title] of [['scientific-concept','Entropy'],['discovery','Penicillin'],['current-event','A current event headline']]){
    const node=card();
    render(node,{...item,formatId,title,image:null,interaction:null,facts:[],description:'A complete description.'});
    assert.equal(node.querySelector('.text-frame').textContent,title);
    assert.equal(node.querySelector('.card-copy').querySelector('.item-title'),null);
    assert.equal(node.querySelector('.item-description').textContent,'A complete description.');
  }
});

test('Anniversary displays the actual event inside its text frame',()=>{
  const node=card();
  render(node,{...item,formatId:'anniversary',image:null,interaction:null,title:'1900 · Anniversary',description:'An important event happened.',facts:['An important event happened.']});
  assert.equal(node.querySelector('.text-frame').textContent,'An important event happened.');
  assert.equal(node.querySelector('.item-description'),null);
});

test('quiz choices sit between the visual stage and Explore and do not duplicate on rerender',()=>{
  const node=card();
  const quiz={...item,image:null,interaction:{type:'quiz',answer:'Gold',options:['Gold','Silver']}};
  render(node,quiz);
  assert.equal(node.querySelector('.quiz-options').parent,node);
  assert.equal(node.querySelector('.card-body').querySelector('.quiz-options'),null);
  render(node,quiz);
  assert.equal(node.querySelectorAll('.quiz-options').length,1);
  node.querySelector('.quiz-option').click();
  assert.equal(node.querySelector('.text-frame').textContent,'Correct! Gold');
});

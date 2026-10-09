import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { shortDescription, entitySentence } from '../js/copy.js';
import { CORE_FORMATS } from '../js/registry.js';

test('category headings do not repeat of the Day',()=>{
  for(const id of ['person','gemstone','bird','fossil'])assert.doesNotMatch(CORE_FORMATS.find(f=>f.id===id).title,/of the Day/);
  assert.equal(CORE_FORMATS.length,100);
});
test('descriptions preserve complete sentences rather than cutting words',()=>{
  assert.equal(shortDescription('A green mineral. More context that is too long.',20),'A green mineral.');
  assert.equal(shortDescription('strategy board game.'),'Strategy board game.');
  assert.equal(entitySentence('Emerald','green variety of beryl'),'Emerald is described as “green variety of beryl”.');
});
test('renderer separates item name and description and removes Details button',async()=>{
  const code=await readFile(new URL('../js/ui.js',import.meta.url),'utf8');
  assert.match(code,/className = 'item-title'/);
  assert.match(code,/className = 'item-description'/);
  assert.doesNotMatch(code,/textContent='Details'/);
  const fallback=await readFile(new URL('../js/fallback.js',import.meta.url),'utf8');
  assert.doesNotMatch(fallback,/The source is temporarily unavailable|No unrelated content has been substituted/);
});

test('card labels, media source and homepage copy match the compact presentation',async()=>{
  const [ui,app,html,css]=await Promise.all([
    readFile(new URL('../js/ui.js',import.meta.url),'utf8'),
    readFile(new URL('../js/app.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../css/theme.css',import.meta.url),'utf8'),
  ]);
  assert.match(ui,/play: 'PLAY', see: 'SEE', know: 'KNOW', today: 'TODAY'/);
  assert.match(ui,/source\.replaceChildren\(credit\)/);
  assert.doesNotMatch(ui,/row\.append\(credit\)|row\.append\(label\)|row\.append\(retry\)/);
  assert.match(ui,/link\.textContent = 'Explore'/);
  assert.match(html,/100 things worth seeing and discovering\. One day at a time\./);
  assert.match(html,/NO DOOMSCROLLING/);
  assert.doesNotMatch(app,/API adapter/);
  assert.match(app,/centerLastCard\(\)/);
  assert.match(css,/\.single-desktop-tail \.last-visible \{ grid-column: 2;/);
  assert.match(css,/justify-self: center/);
  assert.match(css,/\.media-source \{ position: absolute; bottom: 9px; left: 9px;/);
  assert.match(ui,/stage\.append\(source\)/);
});
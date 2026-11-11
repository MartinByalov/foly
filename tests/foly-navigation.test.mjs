import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { information } from '../js/foly/locale.js';

const root = new URL('../', import.meta.url);
const [html, css, main, card] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('css/foly.css', root), 'utf8'),
  readFile(new URL('js/foly/main.js', root), 'utf8'),
  readFile(new URL('js/foly/card.js', root), 'utf8'),
]);

test('attribution is displayed on discoveries and archive thumbnails without cropped previews', () => {
  assert.match(main, /import \{ mediaCredit \} from '\.\/rights\.js'/);
  assert.equal(((main + card).match(/mediaCredit\(d\)/g) || []).length, 3);
  assert.match(card, /'Original image'/);
  assert.equal(((main + card).match(/'Source & notices'/g) || []).length, 3);
  assert.match(card, /d\.kind === 'chart'/);
  assert.match(card, /d\.rights\.metadataLicenseUrl/);
  assert.match(css, /\.archive-thumb\s*\{[^}]*object-fit: contain;/);
  assert.match(information.en.sources.join(' '), /CC BY-SA 4\.0/);
});

test('revealed image borders follow the image instead of a full-width black frame', () => {
  const frame = css.match(/\.find \.media\s*\{([^}]+)\}/)[1];
  const image = css.match(/\.find \.media img\s*\{([^}]+)\}/)[1];
  assert.match(frame, /width: fit-content; max-width: 100%; height: auto; border: 0; background: transparent;/);
  assert.match(image, /width: auto; height: auto; max-width: 100%; max-height: 420px;/);
  assert.match(image, /object-fit: contain; background: transparent; border: 2px solid #fff;/);
  assert.match(image, /border-radius: var\(--radius\)/);
});

test('revealed cards hide their scrollbar without disabling scrolling', () => {
  const discovery = css.match(/\.discovery\s*\{([^}]+)\}/)[1];
  assert.match(discovery, /overflow-y: auto;/);
  assert.match(discovery, /scrollbar-width: none;/);
  assert.match(css, /\.discovery::-webkit-scrollbar\s*\{ display: none; \}/);
  assert.doesNotMatch(discovery, /overflow(?:-y)?: hidden/);
});

test('Discoveries displays the concise clearing notice', () => {
  assert.match(html, /<div class="drawer-sub">CLEARED ON CLOSE<\/div>/);
  assert.doesNotMatch(html, /Cleared when you close/);
});

test('grid targets 140 percent of the previous square size on desktop and mobile', () => {
  assert.match(main, /import \{ gridGeometry \} from '\.\/layout\.js'/);
  assert.match(main, /gridGeometry\(width, root\.clientHeight\)/);
});

test('logo and the combined header controls each span exactly one grid square', () => {
  assert.match(css, /\.brand \{ flex: none; width: var\(--header-h\); \}/);
  assert.match(html, /class="brand"[^>]*aria-label="FOLY\."[\s\S]*?<svg viewBox="0 0 100 32"[\s\S]*?textLength="100" lengthAdjust="spacingAndGlyphs">FOLY\./);
  assert.match(css, /--control-gap: calc\(var\(--header-h\) \* \.1\)/);
  assert.match(css, /--control-size: calc\(\(var\(--header-h\) - var\(--control-gap\)\) \/ 2\)/);
  assert.match(css, /\.header-meta \{[^}]*width: var\(--header-h\); gap: var\(--control-gap\);/);
  assert.match(css, /\.icon-btn svg \{ display: block; width: calc\(var\(--control-height\) \* \.6\); height: 60%;/);
  assert.doesNotMatch(css, /\.header-meta \{ gap: 8px;/);
});

test('header height matches a grid square and resize recalculates the spacing', () => {
  assert.match(main, /root\.style\.setProperty\('--header-h', `\$\{headerHeight\}px`\)/);
  assert.match(main, /headerHeight \+ inset/);
  assert.match(main, /const \{ cols, cell, gap, height, gapY, inset, headerHeight, mobile \} = gridGeometry/);
  assert.match(main, /addEventListener\('resize', \(\) => \{ measure\(\); renderGrid\(true\); \}\)/);
  assert.doesNotMatch(main, /header\.offsetHeight/);
});

test('footer matches the header height and leaves one square of space below the grid', () => {
  assert.match(html, /<\/main>\s*<footer class="site-footer">/);
  const footer = css.match(/\.site-footer\s*\{([^}]+)\}/)[1];
  assert.match(footer, /position: fixed;/);
  assert.match(footer, /bottom: 0;/);
  assert.match(footer, /height: var\(--header-h\);/);
  assert.match(footer, /background: #000;/);
  assert.match(css, /bottom: var\(--field-bottom, calc\(var\(--header-h\) \+ var\(--margin, 64px\)\)\)/);
});

test('footer information has real content, an accessible dialog and a live source list', () => {
  for (const section of ['about', 'sources', 'privacy']) {
    assert.ok(html.includes(`data-info="${section}"`));
    assert.equal(html.includes(`<template id="info-${section}">`), false);
  }
  assert.match(html, /<nav class="footer-nav" aria-label="Information">/);
  assert.match(html, /id="infoDialog" aria-labelledby="infoTitle"/);
  assert.ok(html.includes('<template id="info-trivia">'));
  assert.match(main, /information\[language\]\[section\]\.map/);
  assert.match(main, /informationLinks\(section, language\)/);
  assert.match(main, /infoDialog.showModal\(\)/);
  assert.match(main, /\$\('infoClose'\).addEventListener\('click', \(\) => infoDialog.close\(\)\)/);
  const info = main.slice(main.indexOf('// ---- Footer information:'));
  assert.doesNotMatch(info, /session\.record|discover\(/);
});

test('opened discoveries reopen by click, not hover', () => {
  assert.doesNotMatch(main, /createDiscoveryHover|discoveryHover|hover\.js|pointerover|pointerout/);
  assert.match(main, /grid\.addEventListener\('click', event => \{\s*const cell = event.target.closest\('\.box'\);\s*if \(cell\) openBox\(Number\(cell.dataset.box\)\);/);
  assert.match(main, /if \(opened.has\(box\)\) return showDiscovery\(opened.get\(box\)\)/);
});

test('opening a box waits for the discovery without an intermediate loading dialog', () => {
  assert.doesNotMatch(main, /showLoading|loadingStatus|Opening…|Reaching into the internet/);
  const opening = main.slice(main.indexOf('async function openBox('), main.indexOf('function openDialog('));
  assert.match(opening, /opening\.add\(box\)/);
  assert.doesNotMatch(opening, /await wait\(/);
  assert.match(opening, /timeout: 6000/);
  assert.match(opening, /concurrency: 2/);
  assert.match(opening, /attempt < 2/);
  assert.match(opening, /if \(entry\) showDiscovery\(entry\);/);
  assert.doesNotMatch(main, /showConnectionStatus|connectionStatus/);
  assert.match(opening, /discoverWithFallback\(drawPool\(\), fallback/);
  assert.doesNotMatch(opening, /translateDiscovery/);
  assert.match(opening, /requestedLanguage !== language/);
});

test('all grid positions are real discoveries and loading has no demo square', () => {
  assert.match(main, /Math\.ceil\(TOTAL_BOXES \/ cols\)/);
  assert.match(main, /Math\.min\(TOTAL_BOXES,/);
  assert.match(main, /cell\.dataset\.box = position \+ 1;/);
  assert.match(main, /isOpening = opening\.has\(box\)/);
  assert.doesNotMatch(main, /GRID_BOXES|isPreview|loading-preview|Loading animation preview|box === 0/);
  assert.doesNotMatch(css, /loading-preview/);
  assert.match(main, /cell\.setAttribute\('aria-busy', String\(isOpening\)\)/);
});

test('loading uses a larger hollow square with clockwise quarter turns and respects reduced motion', () => {
  const loader = css.match(/\.box\.opening::after\s*\{([^}]+)\}/)[1];
  assert.match(loader, /width: calc\(var\(--dot\) \+ 4px\); height: calc\(var\(--dot\) \+ 4px\)/);
  assert.match(loader, /box-sizing: border-box; border: 2px solid #fff; background: transparent/);
  assert.match(loader, /animation: square-loading 2\.4s[^;]*infinite/);
  const animation = css.slice(css.indexOf('@keyframes square-loading'), css.indexOf('/* Opened:'));
  for (const [stop, angle] of [['0%, 10%', 0], ['25%, 35%', 90], ['50%, 60%', 180], ['75%, 85%', 270], ['100%', 360]]) {
    assert.ok(animation.includes(`${stop} { transform: rotate(${angle}deg); }`));
  }
  assert.doesNotMatch(animation, /scale|opacity/);
  assert.doesNotMatch(css, /scale\(12\)|@keyframes burst/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.box\.opening::after \{ animation: none;/);
});

test('Categories and Discoveries use square icon-only buttons with accessible labels', () => {
  for (const [id, label, panel] of [['categoriesBtn', 'Categories', 'categoryMenu']]) {
    const button = html.match(new RegExp(`<button\\b[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/button>`));
    assert.ok(button, id);
    assert.match(button[0], /class="ghost-btn icon-btn"/);
    assert.ok(button[0].includes(`aria-label="${label}"`));
    assert.ok(button[0].includes(`aria-controls="${panel}"`));
    assert.match(button[0], /aria-expanded="false"/);
    assert.match(button[1], /<svg[^>]*aria-hidden="true"[^>]*focusable="false"/);
    assert.equal(button[1].replace(/<[^>]+>/g, '').trim(), '');
  }
  assert.match(css, /\.ghost-btn\.icon-btn\s*\{[^}]*width: var\(--control-size\); height: var\(--control-height\); padding: 0;/);
});

test('Categories and Discoveries panels share the opened card background', () => {
  assert.match(css, /\.find\s*\{[^}]*background: var\(--card\)/);
  assert.match(css, /\.drawer, \.drawer-head\s*\{ background: var\(--card\); \}/);
  assert.match(css, /\.filter-panel\s*\{[^}]*background: var\(--card\)/);
});

test('navigation updates retain icons and keep counts in labels and the Discoveries panel', () => {
  assert.doesNotMatch(main, /menuButton\.textContent\s*=/);
  assert.match(main, /menuButton\.setAttribute\('aria-label', categoryLabel\)/);
  assert.match(main, /menuButton\.dataset\.filtered = String\(chosen\.size > 0\)/);
  assert.doesNotMatch(html, /id="historyBtn"/);
  assert.match(html, /class="drawer-title">Discoveries · <span id="historyCount">0<\/span>/);
  assert.doesNotMatch(html, /Session|Close session/);
});

test('language selector replaces the bookmark in the square header controls', () => {
  assert.match(html, /<select id="languageSelect" class="ghost-btn language-select icon-btn"/);
  assert.doesNotMatch(html, /id="historyBtn"/);
  assert.match(html, /class="drawer-close dialog-close"[^>]*aria-label="Close discoveries">×<\/button>/);
  assert.match(html, /class="dialog-close" id="dialogClose"[^>]*>×<\/button>/);
  assert.match(css, /\.drawer-close\.dialog-close\s*\{ width: auto; height: auto; border-radius: 0; \}/);
});

test('header language changes translate revealed entries without adding a card selector', () => {
  assert.doesNotMatch(main, /card-language-select|location\.assign/);
  assert.match(main, /languageSelect\.addEventListener\('change', \(\) => changeLanguage\(languageSelect\.value\)\)/);
  assert.match(main, /await translateEntry\(entry, next, revision\)/);
  assert.match(main, /entry\.discovery\.language !== language\) translateEntry/);
});

test('Categories replaces its icon with a centered count when categories are selected', () => {
  const button = html.match(/id="categoriesBtn"[^>]*>([\s\S]*?)<\/button>/)[1];
  assert.match(button, /<svg/);
  assert.match(button, /class="filter-count" id="categoryCount" aria-hidden="true" hidden/);
  assert.match(main, /\$\('categoryCount'\)\.textContent = chosen.size \? String\(chosen.size\) : ''/);
  assert.match(main, /\$\('categoryCount'\)\.hidden = chosen.size === 0/);
  assert.doesNotMatch(main, /if \(chosen.size === CATEGORIES.length\) chosen.clear\(\)/);
  assert.match(css, /\.filter-count\[hidden\] \{ display: none; \}/);
  assert.match(css, /\.icon-btn\[data-filtered="true"\] svg \{ display: none; \}/);
  const counter = css.match(/\.filter-count\s*\{([^}]+)\}/)[1];
  assert.match(counter, /color: inherit; font-size: calc\(var\(--control-height\) \* \.4\);/);
  assert.doesNotMatch(counter, /position: absolute|top:|right:|background:/);
});

test('category and subject separators are vertically centered in Discoveries and cards', () => {
  assert.match(css, /\.find \.card-label, \.archive-copy \.card-label\s*\{ display: block; line-height: 1\.4; \}/);
  const dot = css.match(/\.square-dot\s*\{([^}]+)\}/)[1];
  assert.match(dot, /display: inline-block; width: 5px; height: 5px;/);
  assert.match(dot, /margin: 0 8px;/);
  assert.match(dot, /vertical-align: calc\(\.35em - 2\.5px\); vertical-align: calc\(\.5cap - 2\.5px\);/);
});
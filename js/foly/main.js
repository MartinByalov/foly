import { h, discoveryCard } from './card.js';
import { loadImage } from './images.js';
import { mediaCredit } from './rights.js';
import { matchesCategory } from './categories.js';
import { TOTAL_BOXES, createSession } from './session.js';
import { discoveryCatalog, discoverWithFallback } from './catalog.js';
import { normalizeLanguage, information, t, LANGUAGES } from './locale.js';
import { createDiscoveryTranslator } from './translation.js';
import { informationLinks } from './information.js';
import { gridGeometry } from './layout.js';

let language = normalizeLanguage(new URL(location.href).searchParams.get('lang') || document.documentElement.lang);
const translateDiscovery = createDiscoveryTranslator();
let languageRevision = 0;
let displayedEntry = null;
document.documentElement.lang = language;
document.title = `FOLY. | ${t('pick')}`;
const languageSelect = document.getElementById('languageSelect');
languageSelect.replaceChildren(...Object.entries(LANGUAGES).map(([code, name]) => {
  const option = document.createElement('option');
  option.value = code;
  option.textContent = name;
  return option;
}));
languageSelect.value = language;
languageSelect.title = LANGUAGES[language];
// Native options retain full names. The overlay shows only the current code.
const languageCode = document.createElement('span');
languageCode.className = 'language-code';
languageCode.setAttribute('aria-hidden', 'true');
languageCode.textContent = language.toUpperCase();
languageSelect.parentElement.append(languageCode);
languageSelect.setAttribute('aria-label', t('language'));
languageSelect.addEventListener('change', () => changeLanguage(languageSelect.value));


let storage = null;
try { storage = window.sessionStorage; } catch { /* Archive stays in memory only. */ }
const session = createSession(storage);
const opened = new Map(session.history.map(entry => [entry.box, entry]));
const opening = new Set();

const $ = id => document.getElementById(id);
const grid = $('grid');
const field = $('field');
const dialog = $('discovery');
const dialogBody = $('discoveryBody');
const archive = $('archive');
const root = document.documentElement;

// ---- Discovery grid: 100 000 boxes in fixed places, only the visible rows exist in the DOM.

// The grid scrolls inside a window that keeps exactly one box of space on every side of the screen.
// Box size comes from the width; the vertical gaps stretch a little so whole rows fill the height.
const layout = { cols: 1, cell: 62, pitchX: 72, pitchY: 72, rows: 0, first: -1, last: -1, height: 0 };
function measure() {
  const width = root.clientWidth;
  const { cols, cell, gap, height, gapY, inset, headerHeight, mobile } = gridGeometry(width, innerHeight);
  const rows = Math.ceil(TOTAL_BOXES / cols);
  Object.assign(layout, { cols, cell, inset, pitchX: cell + gap, pitchY: cell + gapY, rows, height });
  root.style.setProperty('--margin', `${mobile ? 16 : cell}px`);
  root.style.setProperty('--grid-left', `${mobile ? 16 : cell}px`);
  root.style.setProperty('--grid-right', `${mobile ? 16 : width - (cell + (cols - 1) * (cell + gap) + cell)}px`);
  root.style.setProperty('--header-h', `${headerHeight}px`);
  root.style.setProperty('--field-top', `${mobile ? headerHeight : 2 * cell}px`);
  root.style.setProperty('--field-bottom', `${mobile ? headerHeight : 2 * cell}px`);
  grid.style.setProperty('--cell', `${cell}px`);
  grid.style.height = `${rows * layout.pitchY - gapY}px`;
}

function renderGrid(force = false) {
  const top = field.scrollTop;
  const first = Math.max(0, Math.floor(top / layout.pitchY) - 2);
  const last = Math.min(layout.rows - 1, Math.ceil((top + layout.height) / layout.pitchY) + 2);
  if (!force && first === layout.first && last === layout.last) return;
  Object.assign(layout, { first, last });
  const needed = Math.max(0, Math.min(TOTAL_BOXES, (last + 1) * layout.cols) - first * layout.cols);
  while (grid.children.length < needed) grid.append(h('button', { class: 'box', type: 'button' }));
  while (grid.children.length > needed) grid.lastChild.remove();
  for (let i = 0; i < needed; i++) {
    const position = first * layout.cols + i;
    const cell = grid.children[i];
    cell.dataset.box = position + 1;
    const x = layout.inset + (position % layout.cols) * layout.pitchX;
    const y = Math.floor(position / layout.cols) * layout.pitchY;
    cell.style.setProperty('--at', `translate(${x}px, ${y}px)`);
    paintCell(cell);
  }
}

// New discoveries are preloaded before opening; restored discoveries share the same loader.
const pictures = new Map();
function picture(url) {
  if (!url) return null;
  if (!pictures.has(url)) {
    pictures.set(url, 'loading');
    loadImage(url).then(() => { pictures.set(url, 'ok'); repaint(); }, () => pictures.set(url, 'broken'));
  }
  return pictures.get(url) === 'ok' ? url : null;
}

function paintCell(cell) {
  const box = Number(cell.dataset.box);
  const entry = opened.get(box), isOpening = opening.has(box);
  cell.setAttribute('aria-disabled', String(isOpening));
  cell.setAttribute('aria-busy', String(isOpening));
  const thumb = picture(entry?.discovery.thumb) || picture(entry?.discovery.image);
  if (cell.classList.contains('opening') !== isOpening) cell.classList.toggle('opening', isOpening);
  if (cell.classList.contains('opened') !== !!entry) cell.classList.toggle('opened', !!entry);
  cell.classList.toggle('pictured', !!thumb);
  let thumbnail = cell.querySelector('.box-image');
  if (thumb) {
    if (!thumbnail) {
      thumbnail = h('img', { class: 'box-image', crossorigin: 'anonymous', alt: '', decoding: 'async' });
      cell.append(thumbnail);
    }
    if (thumbnail.getAttribute('src') !== thumb) thumbnail.src = thumb;
  } else thumbnail?.remove();
  cell.setAttribute('aria-label', isOpening ? t('loading') : entry ? `${t('opened')}: ${entry.discovery.title}` : t('open'));
}
const repaint = () => { for (const cell of grid.children) paintCell(cell); };

let frame = 0;
const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; renderGrid(); }); };
field.addEventListener('scroll', schedule, { passive: true });
// When scrolling stops, settle on a whole row so the space above and below stays one box.
// (CSS scroll-snap only knows the rows currently in the DOM, so long jumps would snap back.)
let settle = 0;
const snapToRow = () => {
  const target = Math.round(field.scrollTop / layout.pitchY) * layout.pitchY;
  if (Math.abs(target - field.scrollTop) > 0.5) field.scrollTo({ top: target, behavior: 'smooth' });
};
field.addEventListener('scroll', () => { clearTimeout(settle); settle = setTimeout(snapToRow, 140); }, { passive: true });
addEventListener('resize', () => { measure(); renderGrid(true); });
grid.addEventListener('click', event => {
  const cell = event.target.closest('.box');
  if (cell) openBox(Number(cell.dataset.box));
});

// ---- Opening a box: the reveal square turns and pulses while a random source is asked.

let ticket = 0;
async function openBox(box) {
  if (opened.has(box)) return showDiscovery(opened.get(box));
  if (opening.size) return;
  const mine = ++ticket;
  const requestedLanguage = language;
  opening.add(box);
  repaint();
  let found;
  for (let attempt = 0; attempt < 2 && requestedLanguage === language; attempt++) {
    try {
      found = await discoverWithFallback(drawPool(), fallback, {
        language: requestedLanguage,
        concurrency: 2,
        timeout: 6000,
        imageLoader: async (url, options) => { await loadImage(url, options); pictures.set(url, 'ok'); },
      });
      break;
    } catch { /* One bounded automatic retry, without a connection-error banner. */ }
  }
  opening.delete(box);
  let entry = null;
  if (requestedLanguage !== language) {
    repaint();
    return openBox(box);
  }
  if (found && found.language === language && !found.machineTranslated) {
    entry = session.record(box, found);
    opened.set(box, entry);
    renderArchive(entry.n);
  }
  repaint();
  if (mine !== ticket) return;
  if (entry) showDiscovery(entry);
}

function openDialog(content) {
  dialogBody.removeAttribute('aria-busy');
  dialogBody.replaceChildren(content);
  if (!dialog.open) dialog.showModal();
  dialog.scrollTop = 0;
}
dialog.addEventListener('close', () => { ticket++; });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
$('dialogClose').addEventListener('click', () => dialog.close());

const label = (category, subject) => h('p', { class: 'card-label' },
  category, subject && h('span', { class: 'square-dot', 'aria-hidden': 'true' }), subject && h('span', { class: 'visually-hidden' }, ':'), subject);

function showDiscovery(entry) {
  displayedEntry = entry;
  openDialog(discoveryCard(entry.discovery));
  if (entry.discovery.language !== language) translateEntry(entry, language, languageRevision);
}

const translationAttempts = new WeakMap();
async function translateEntry(entry, target, revision) {
  const attempt = {};
  translationAttempts.set(entry, attempt);
  const current = () => revision === languageRevision && translationAttempts.get(entry) === attempt;
  if (dialog.open && displayedEntry === entry) dialogBody.querySelector('.translation-status')?.remove();
  if (dialog.open && displayedEntry === entry) dialogBody.setAttribute('aria-busy', 'true');
  try {
    const translated = await translateDiscovery(entry.discovery, target);
    if (!current()) return;
    entry.discovery = translated;
    if (dialog.open && displayedEntry === entry) openDialog(discoveryCard(translated));
    renderArchive();
    repaint();
  } catch {
    if (!current() || !dialog.open || displayedEntry !== entry) return;
    dialogBody.querySelector('.translation-status')?.remove();
    dialogBody.append(h('p', { class: 'translation-status', role: 'status' }, t('translationFailed'), ' ',
      h('button', { type: 'button', onclick: () => translateEntry(entry, language, languageRevision) }, t('retry'))));
  } finally {
    if (current() && displayedEntry === entry) dialogBody.removeAttribute('aria-busy');
  }
}

// ---- Session archive.

function renderArchive(fresh) {
  const entries = session.history.slice().reverse();
  $('historyCount').textContent = entries.length;
  $('archiveEmpty').hidden = entries.length > 0;
  $('archiveList').replaceChildren(...entries.map(entry => {
    const d = entry.discovery;
    return h('li', { class: entry.n === fresh ? 'fresh' : null },
      h('button', { class: 'archive-open', type: 'button', onclick: () => { showDrawer(archive, false); showDiscovery(entry); } },
        h('span', { class: 'archive-n' }, String(entry.n).padStart(2, '0')),
        d.thumb ? h('img', { class: 'archive-thumb', crossorigin: 'anonymous', src: d.thumb, alt: '', loading: 'lazy', decoding: 'async' })
          : h('span', { class: 'archive-thumb empty', 'aria-hidden': 'true' }),
        h('span', { class: 'archive-copy' },
          label(d.category, d.subject),
          h('span', { class: 'archive-title' }, d.title))),
      d.kind === 'fact' && h('p', { class: 'card-rights' }, d.rights.imageTitle, ' · ',
        d.rights.imageCreator || 'Wikimedia Commons', ' · ', d.rights.imageAttribution, ' ', d.rights.imageCredit, ' · ',
        h('a', { href: d.rights.mediaLicenseUrl, target: '_blank', rel: 'noopener noreferrer' }, d.rights.mediaLicense), ' · ',
        h('a', { href: d.rights.originalMediaUrl, target: '_blank', rel: 'noopener noreferrer' }, t('originalImage'))),
      d.kind !== 'fact' && d.rights?.originalMediaUrl && h('p', { class: 'card-rights' }, mediaCredit(d), ' · ',
        h('a', { href: d.rights.mediaLicenseUrl, target: '_blank', rel: 'noopener noreferrer' }, d.rights.license_name || d.rights.mediaLicense),
        ' · ', h('a', { href: d.sourcePageUrl || d.url, target: '_blank', rel: 'noopener noreferrer' }, 'Source & notices')));
  }));
}

// ---- Categories: a dropdown of filters. Within the chosen categories every source keeps an equal chance.

let { primary: active, fallback } = discoveryCatalog(language);
let CATEGORIES = [...new Set(active.map(source => source.category))].sort((a, b) => a.localeCompare(b));
let FILTER_KEY = `foly:fact-categories:v1:${language}`;
let chosen = new Set();
try { chosen = new Set(JSON.parse(storage?.getItem(FILTER_KEY)) || []); } catch { /* Start with everything. */ }
chosen = new Set([...chosen].filter(category => CATEGORIES.includes(category)));
const drawPool = () => chosen.size ? active.filter(source => chosen.has(source.category)) : active;

const menu = $('categoryMenu');
const menuButton = $('categoriesBtn');
const allBox = $('allCategories');
$('categoryList').replaceChildren(...CATEGORIES.map(category => h('label', { class: 'filter-option' },
  h('input', { type: 'checkbox', value: category }), h('span', {}, category))));

function searchCategories() {
  let visible = 0;
  for (const option of $('categoryList').children) {
    option.hidden = !matchesCategory(option.querySelector('input').value, $('categorySearch').value);
    if (!option.hidden) visible++;
  }
  $('categoryEmpty').hidden = visible > 0;
}
$('categorySearch').addEventListener('input', searchCategories);

function renderFilters() {
  for (const input of menu.querySelectorAll('#categoryList input')) input.checked = chosen.has(input.value);
  allBox.checked = chosen.size === 0;
  const categoryLabel = chosen.size ? `${t('categories')} · ${chosen.size} ${t('selected')}` : t('categories');
  menuButton.setAttribute('aria-label', categoryLabel);
  menuButton.setAttribute('title', categoryLabel);
  menuButton.dataset.filtered = String(chosen.size > 0);
  $('categoryCount').textContent = chosen.size ? String(chosen.size) : '';
  $('categoryCount').hidden = chosen.size === 0;
  try { storage?.setItem(FILTER_KEY, JSON.stringify([...chosen])); } catch { /* Filters reset next visit. */ }
}
menu.addEventListener('change', event => {
  const input = event.target;
  if (!input.matches('input[type="checkbox"]')) return;
  if (input === allBox) chosen.clear();
  else if (input.checked) chosen.add(input.value);
  else chosen.delete(input.value);
  renderFilters();
});
function showMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute('aria-expanded', String(open));
}
menuButton.addEventListener('click', () => showMenu(menu.hidden));
document.addEventListener('click', event => { if (!menu.hidden && !event.target.closest('.filter-menu')) showMenu(false); });

// ---- Session drawer.

const backdrop = $('drawerBackdrop');
function showDrawer(drawer, open) {
  archive.classList.toggle('open', open);
  archive.setAttribute('aria-hidden', String(!open));
  backdrop.classList.toggle('open', open);
}
document.querySelectorAll('.drawer-close').forEach(button => button.addEventListener('click', () => showDrawer(null, false)));
backdrop.addEventListener('click', () => showDrawer(null, false));
addEventListener('keydown', event => { if (event.key === 'Escape') { showDrawer(null, false); showMenu(false); } });

// ---- Footer information: separate from discoveries and never added to the archive.
const infoDialog = $('infoDialog');
let infoTitles = { about: t('about'), sources: t('sources'), privacy: t('privacy') };
document.querySelector('.footer-nav').addEventListener('click', event => {
  const button = event.target.closest('button[data-info]');
  if (!button) return;
  const section = button.dataset.info;
  if (!Object.hasOwn(infoTitles, section)) return;
  showMenu(false);
  showDrawer(null, false);
  $('infoTitle').textContent = infoTitles[section];
  $('infoBody').dir = language === 'ar' ? 'rtl' : 'ltr';
  $('infoDialog').lang = language;
  $('infoTitle').dir = language === 'ar' ? 'rtl' : 'ltr';
  $('infoBody').replaceChildren(...information[language][section].map(text => h('p', {}, text)));
  const links = informationLinks(section, language);
  if (links.length) $('infoBody').append(h('ul', { class: 'info-links' }, links.map(link =>
    h('li', {}, h('a', { href: link.href, target: '_blank', rel: 'noopener noreferrer' }, link.label)))));
  infoDialog.showModal();
  infoDialog.scrollTop = 0;
});
$('infoClose').addEventListener('click', () => infoDialog.close());
if (location.hash === '#about-trivia') {
  document.querySelector('[data-info="about"]').click();
  $('infoBody').append($('info-trivia').content.cloneNode(true));
  $('infoBody').querySelector('#about-trivia')?.scrollIntoView();
}
infoDialog.addEventListener('click', event => { if (event.target === infoDialog) infoDialog.close(); });

function updateInterfaceLanguage() {
document.title = `FOLY. | ${t('pick')}`;
document.querySelector('h1').textContent = `Foly: ${t('pick')}`;
document.querySelector('.footer-nav').setAttribute('aria-label', t('information'));
for (const button of document.querySelectorAll('[data-info]')) button.textContent = t(button.dataset.info);
for (const id of ['dialogClose', 'infoClose']) $(id).setAttribute('aria-label', t('close'));
document.querySelector('.drawer-close').setAttribute('aria-label', t('close'));
$('archive').setAttribute('aria-label', t('discoveries'));
$('discovery').setAttribute('aria-label', t('random'));
document.querySelector('.drawer-title').firstChild.textContent = `${t('discoveries')} · `;
document.querySelector('.drawer-sub').textContent = t('cleared');
$('archiveEmpty').textContent = t('empty');
$('categorySearch').placeholder = t('search');
$('categorySearch').setAttribute('aria-label', t('search'));
$('allCategories').nextElementSibling.textContent = t('all');
$('categoryEmpty').textContent = t('noCategories');
renderFilters();
}

async function changeLanguage(requestedLanguage) {
  const next = normalizeLanguage(requestedLanguage);
  if (next === language) return;
  const revision = ++languageRevision;
  const selectedIds = active.filter(source => chosen.has(source.category)).map(source => source.id);
  language = next;
  document.documentElement.lang = language;
  languageSelect.value = language;
  languageSelect.title = LANGUAGES[language];
  languageSelect.setAttribute('aria-label', t('language'));
  languageCode.textContent = language.toUpperCase();
  const url = new URL(location.href);
  url.searchParams.set('lang', language);
  history.replaceState(null, '', url);
  ({ primary: active, fallback } = discoveryCatalog(language));
  CATEGORIES = [...new Set(active.map(source => source.category))].sort((a, b) => a.localeCompare(b));
  FILTER_KEY = `foly:fact-categories:v1:${language}`;
  chosen = new Set(active.filter(source => selectedIds.includes(source.id)).map(source => source.category));
  $('categoryList').replaceChildren(...CATEGORIES.map(category => h('label', { class: 'filter-option' },
    h('input', { type: 'checkbox', value: category }), h('span', {}, category))));
  $('categorySearch').value = '';
  showMenu(false);
  infoTitles = { about: t('about'), sources: t('sources'), privacy: t('privacy') };
  if (infoDialog.open) infoDialog.close();
  updateInterfaceLanguage();
  repaint();
  const current = dialog.open ? displayedEntry : null;
  if (current) openDialog(discoveryCard(current.discovery));
  const entries = current ? [current, ...session.history.filter(entry => entry !== current)] : [...session.history];
  for (const entry of entries) {
    if (revision !== languageRevision) return;
    await translateEntry(entry, next, revision);
  }
  repaint();
}

updateInterfaceLanguage();
measure();
renderGrid(true);
renderArchive();

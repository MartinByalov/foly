import { dayKey, queueTasks, seed } from './engine.js';
import { CORE_FORMATS, editionFormats, SOURCE_REGISTRY } from './registry.js';
import { createResolutionContext, resolveGuaranteed } from './resolver.js';
import { RUNTIME_POOLS } from './runtime-pools.js';
import { loadLocalPools } from './local-pools.js';
import { createCard, render } from './ui.js';
import { frameQueue, pruneOldCache } from './performance.js';
import { freezeBackground } from './background.js';

freezeBackground(document.querySelector('.background-video'));

const today = new Date();
const todayKey = dayKey(today);
let formats = [];
const grid = document.getElementById('cards');
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
const cache = {get(key){try{return JSON.parse(storage.getItem(key));}catch{return null;}},set(key,item){try{storage.setItem(key,JSON.stringify(item));}catch{}}};
const localPools=loadLocalPools(async path=>{const response=await fetch(path);if(!response.ok)throw Error('Missing local pool');return response.json();}).catch(error=>{
  if(window.FOLY_DEBUG)console.debug('Local pools could not be loaded',error);
  return {};
});
const context=createResolutionContext({cache,sources:SOURCE_REGISTRY,loaders:RUNTIME_POOLS});
const queue = queueTasks(4);
const pending = new Map();
const cardFormats = new WeakMap();
const paint = frameQueue(render, callback => requestAnimationFrame(callback));
let cards = [];

document.getElementById('headerDate').textContent = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric',
}).format(today).replace(',', ' ·');
const edition = Math.floor((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
  Date.UTC(today.getFullYear(), 0, 1)) / 86400000) + 1;
document.getElementById('editionLabel').textContent = `Edition ${edition} · ${today.getFullYear()}`;

function countdown() {
  const now = new Date();
  if (dayKey(now) !== todayKey) { location.reload(); return; }
  const seconds = Math.max(0, Math.floor((new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)-now)/1000));
  document.getElementById('countdown').textContent = [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60]
    .map(value => String(value).padStart(2,'0')).join(':');
}
countdown();
setInterval(() => { if (!document.hidden) countdown(); }, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) countdown(); });
const idle = window.requestIdleCallback || (callback => setTimeout(callback, 100));
idle(() => pruneOldCache(storage, today));

function hydrate(card, format) {
  if (pending.has(format.id)) return pending.get(format.id);
  const promise = queue(async () => {
    context.localPools=await localPools.catch(()=>({}));
    return resolveGuaranteed(format,today,context);
  })
    .then(item => { paint(card, item); return item; })
    .catch(() => { card.querySelector('.card-body').textContent = 'Explore the collection again later.'; });
  pending.set(format.id, promise);
  return promise;
}

async function initEdition() {
  try {
    formats = editionFormats(today);
    const fragment = document.createDocumentFragment();
    cards = formats.map(format => {
      const card = createCard(format);
      cardFormats.set(card, format);
      fragment.append(card);
      return card;
    });
    grid.append(fragment);
    centerLastCard();
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          hydrate(entry.target, cardFormats.get(entry.target));
          observer.unobserve(entry.target);
        }
      }, { rootMargin: '650px' });
      cards.forEach(card => observer.observe(card));
    } else cards.forEach((card,index) => {
      hydrate(card,formats[index]);
    });
  } catch {
    grid.textContent = 'The collection is temporarily unavailable. Please try again later.';
  }
}
initEdition();
function centerLastCard() {
  cards.forEach(card => card.classList.remove('last-visible'));
  const visible = cards.filter(card => !card.classList.contains('hidden'));
  visible.at(-1)?.classList.add('last-visible');
  grid.classList.toggle('single-desktop-tail', visible.length % 3 === 1);
}

document.querySelectorAll('.filter-btn').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.filter-btn').forEach(other => {
    other.classList.toggle('active', button === other);
    other.setAttribute('aria-pressed', String(button === other));
  });
  cards.forEach((card, index) => {
    const visible = button.dataset.filter === 'all' || card.dataset.group === button.dataset.filter;
    card.classList.toggle('hidden', !visible);
  });
  centerLastCard();
}));

let surpriseCount = 0;
document.getElementById('randomBtn').addEventListener('click', () => {
  const visible = cards.filter(card => !card.classList.contains('hidden'));
  if (visible.length) visible[seed(`${todayKey}:surprise:${surpriseCount++}`)%visible.length]
    .scrollIntoView({ behavior: 'smooth', block: 'center' });
});

const catalog = document.getElementById('formatGrid');
let catalogBuilt = false;
function buildCatalog() {
if (catalogBuilt) return;
catalogBuilt = true;
const fragment = document.createDocumentFragment();
for (const format of CORE_FORMATS) {
  const entry = document.createElement('div'); entry.className = 'format-item';
  const title = document.createElement('div'); title.className = 'format-name'; title.textContent = format.title;
  const tag = document.createElement('div'); tag.className = 'format-tag';
  tag.textContent = format.group.toUpperCase();
  entry.append(title,tag); fragment.append(entry);
}
catalog.append(fragment);
}
const drawer = document.getElementById('drawer');
const backdrop = document.getElementById('drawerBackdrop');
function showDrawer(open) {
  if (open) buildCatalog();
  drawer.classList.toggle('open',open); backdrop.classList.toggle('open',open);
  drawer.setAttribute('aria-hidden',String(!open));
}
document.getElementById('formatsBtn').addEventListener('click',() => showDrawer(true));
document.getElementById('drawerClose').addEventListener('click',() => showDrawer(false));
backdrop.addEventListener('click',() => showDrawer(false));
document.addEventListener('keydown',event => { if(event.key === 'Escape') showDrawer(false); });
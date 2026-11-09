import { SOURCES } from './sources.js';
import { checkSource } from './checks.js';
import { h, discoveryCard } from './card.js';
import { sourceCategories } from './source-categories.js';
import { previewDirectory, runPreviewChecks } from './preview-model.js';
import { discoveryCatalog } from './catalog.js';
import { normalizeLanguage, LANGUAGES } from './locale.js';

const language = normalizeLanguage(new URL(location.href).searchParams.get('lang'));
document.documentElement.lang = language;
const { primary, fallback } = discoveryCatalog(language);
const languageSelect = h('select', { 'aria-label': 'Language', onchange: event => {
  const url = new URL(location.href); url.searchParams.set('lang', event.target.value); location.assign(url.href);
} }, Object.entries(LANGUAGES).map(([code, name]) => h('option', { value: code, selected: code === language }, name)));
document.querySelector('.preview-header').append(languageSelect);

const providers = document.getElementById('providers');
const summary = document.getElementById('summary');
const enabled = [...primary, ...SOURCES.filter(source => source.enabled).sort((a, b) => a.name.localeCompare(b.name))];
const directory = document.getElementById('api-directory');
const { apis, datasets } = previewDirectory(SOURCES);
const directoryList = (sources, type) => h('ul', { class: 'api-directory-list', 'data-kind': type },
  ...sources.map(source => h('li', {}, h('a', { href: `#provider-${source.id}` }, type === 'discovery' ? source.category : source.name))));
directory.replaceChildren(
  h('h2', {}, 'Homepage discovery APIs'),
  h('ul', {}, h('li', {}, `${language}.wikipedia.org · Action API · random articles, topic search and Commons image verification`),
    primary.some(source => source.id === 'wikipedia-today') && h('li', {}, 'Wikipedia REST feed · On This Day'),
    primary.some(source => source.id === 'wikipedia-dyk') && h('li', {}, 'Wikipedia Action API · published Did You Know hooks'),
    h('li', {}, 'Wikimedia Commons Action API · per-file image rights and credits')),
  h('h3', {}, 'Discovery categories'), directoryList(primary, 'discovery'),
    h('h2', { id: 'api-directory-title' }, `Visual APIs and IIIF services (${apis.length})`),
  h('p', { class: 'api-directory-note' }, `Homepage fallbacks verified for ${language}: ${fallback.length}. The visual catalogue below is available for individual testing; integrations without explicit support for the selected language are not homepage fallbacks. Select a name to jump to its card.`),
  directoryList(apis, 'api'),
  h('details', { class: 'api-directory-datasets' },
    h('summary', {}, `Local datasets (${datasets.length}), not included in the API count`),
    directoryList(datasets, 'dataset')));
const entries = enabled.map(source => {
  const select = h('select', { id: `category-${source.id}`, 'aria-label': `${source.name}: category`, disabled: true },
    h('option', { value: '' }, 'Loading categories…'));
  const mediaType = source.factCapable ? 'discovery' : source.visualType === 'chart' ? 'chart' : source.visualType === 'text' ? 'content' : 'image';
  const content = h('div', { class: 'provider-card', 'aria-live': 'polite' });
  const status = h('p', { class: 'provider-status', role: 'status', hidden: true });
  const button = h('button', { type: 'button', class: 'provider-reload' }, `Another ${mediaType}`);
  const node = h('section', { class: 'provider', id: `provider-${source.id}`, 'aria-labelledby': `name-${source.id}` },
    h('header', { class: 'provider-toolbar' }, h('h2', { id: `name-${source.id}`, class: 'provider-heading' }, source.name),
      h('label', { for: select.id }, h('span', { class: 'visually-hidden' }, 'Category'), select)),
    button, content, status);
  node.dataset.state = 'pending';
  let revision = 0;
  let initialized = false;
  let options = [];
  const load = async () => {
    const current = ++revision;
    const category = select.value;
    node.dataset.state = 'loading';
    node.setAttribute('aria-busy', 'true');
    button.disabled = true;
    status.hidden = false;
    status.textContent = `Loading ${mediaType}…`;
    content.replaceChildren();
    try {
      const result = await checkSource(source, { category });
      if (current !== revision) return;
      if (!result.ok) throw Error(result.error);
      const card = discoveryCard(result.discovery);
      content.replaceChildren(card);
      const image = card.querySelector('.media img');
      if (result.discovery.kind === 'chart') {
        if (image || card.querySelectorAll('.chart-bars .chart-row').length !== result.discovery.chart.length) {
          throw Error('Chart is not visible in the card');
        }
      } else if (result.discovery.kind === 'text') {
        if (image || !card.querySelector('.card-copy')?.textContent.trim() ||
          !card.querySelector('.find-actions a[href]')) throw Error('Content or source link is not visible in the card');
      } else {
        if (!image) throw Error('Provider returned no image');
        await image.decode();
        if (current !== revision) return;
        const box = image.getBoundingClientRect();
        if (!image.naturalWidth || !image.naturalHeight || box.width <= 4 || box.height <= 4) throw Error('Image is not visible in the card');
      }
      node.dataset.category = category;
      node.dataset.state = 'ok';
      status.hidden = true;
      button.textContent = `Another ${mediaType}`;
    } catch (error) {
      if (current !== revision) return;
      content.replaceChildren();
      node.dataset.state = 'error';
      const failureType = mediaType === 'image' ? 'an image' : mediaType === 'chart' ? 'a chart' : 'content';
      status.textContent = `Could not load ${failureType} from ${source.name}. ${error.message}`;
      button.textContent = 'Retry';
    } finally {
      if (current === revision) { button.disabled = false; node.setAttribute('aria-busy', 'false'); }
    }
  };
  const initialize = async () => {
    if (initialized) return load();
    button.disabled = true;
    try {
      options = source.factCapable ? [{ value: '', label: source.category }] : await sourceCategories(source);
      select.replaceChildren(...options.map(option => h('option', { value: option.value }, option.label)));
      select.disabled = options.length < 2;
      select.title = select.disabled ? 'Category filtering is not implemented for this integration; this does not mean the provider has only one category.' : 'Choose a provider category';
      initialized = true;
      await load();
    } catch (error) {
      node.dataset.state = 'error';
      select.replaceChildren(h('option', { value: '' }, 'Categories unavailable'));
      status.hidden = false;
      status.textContent = `Could not load categories. ${error.message}`;
      button.textContent = 'Retry';
      button.disabled = false;
    }
  };
  select.addEventListener('change', () => {
    if (options.some(option => option.value === select.value)) load();
  });
  button.addEventListener('click', initialize);
  providers.append(node);
  return { load: initialize };
});
await runPreviewChecks(entries);
providers.dataset.complete = 'true';
summary.textContent = '';
summary.hidden = true;

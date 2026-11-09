import { sourceSite } from './resolver.js';
import { mediaCredit, requiresCardCredit } from './rights.js';
import { t } from './locale.js';

const label = category => h('p', { class: 'card-label' }, category);

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter(child => child != null && child !== false));
  return node;
}

export function discoveryCard(d) {
  if (d.kind === 'fact' && !d.image) throw Error('Fact image required');
  const trivia = d.sourceId === 'opentdb';
  const sourceUrl = d.sourcePageUrl || d.url;
  const answer = d.reveal && h('p', { class: 'find-answer', hidden: true }, d.reveal);
  let quiz;
  if (d.kind === 'question' && d.options?.length) {
    const buttons = d.options.map(option => h('button', {
      class: 'quiz-option', type: 'button', 'aria-pressed': 'false',
      onclick: () => {
        if (d.quizChoice !== undefined) return;
        d.quizChoice = option;
        update();
      },
    }, option));
    const update = () => {
      if (!d.options.includes(d.quizChoice)) return;
      for (const [i, button] of buttons.entries()) {
        button.disabled = true;
        button.setAttribute('aria-pressed', String(d.options[i] === d.quizChoice));
        button.classList.toggle('correct', d.options[i] === d.reveal);
        button.classList.toggle('wrong', d.options[i] === d.quizChoice && d.quizChoice !== d.reveal);
      }
    };
    update();
    quiz = h('div', { class: 'quiz', role: 'group', 'aria-label': 'Choose an answer' },
      h('div', { class: 'quiz-options' }, buttons));
  }
  const vector = d.image && /(?:\.svg|\/svg)$/i.test(new URL(d.image).pathname);
  const image = d.image && h('div', { class: vector ? 'media media-vector' : 'media' },
    h('img', { crossorigin: 'anonymous', src: d.image, alt: d.title, decoding: 'async', onerror: event => event.target.closest('.find')?.remove() }));
  const chart = d.chart && h('ol', { class: 'chart-bars', 'aria-label': `${d.title} data chart` },
    d.chart.map((row, index) => h('li', { class: 'chart-row' },
      h('span', { class: 'chart-term' }, row.label),
      h('span', { class: 'chart-track', 'aria-hidden': 'true' },
        h('span', { class: 'chart-bar', style: `width:${Math.max(3, row.value / Math.max(...d.chart.map(item => item.value)) * 100)}%` })),
      h('span', { class: 'chart-value' }, new Intl.NumberFormat('en-US').format(row.value)))));

  return h('article', { class: 'find', 'data-kind': d.kind || 'image', lang: d.language, dir: d.language === 'ar' ? 'rtl' : 'ltr' },
    h('div', { class: 'card-head' },
      label(d.category),
      h('h2', { class: 'card-title' }, displayCopy(d.title))),
    h('div', { class: 'card-line' }),
    image,
    image && h('div', { class: 'card-line card-line-after-image', 'aria-hidden': 'true' }),
    chart,
    d.quote && h('div', { class: 'text-frame' }, d.quote),
    ((!trivia && d.subtitle) || d.description) && h('div', { class: 'card-copy' },
      !trivia && d.subtitle && h('strong', {}, displayCopy(d.subtitle)), d.description && h('span', {}, displayCopy(d.description))),
    quiz,
    !quiz && answer && h('button', { class: 'reveal-btn', type: 'button', onclick: event => { answer.hidden = false; event.target.remove(); } }, 'Reveal answer'),
    !quiz && answer,
    h('div', { class: 'find-actions' },
      trivia && h('a', { class: 'ghost-btn', href: new URL('../../index.html#about-trivia', import.meta.url).href,
        target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'About: trivia credits and licence' }, 'About'),
      sourceUrl ? h('a', { class: 'ghost-btn', href: sourceUrl, target: '_blank', rel: 'noopener noreferrer', title: d.credit || null }, sourceSite(d))
        : h('span', { class: 'ghost-btn', title: d.credit || null }, sourceSite(d))),
    d.kind === 'fact' && factCredit(d),
    !trivia && !['chart', 'fact'].includes(d.kind) && requiresCardCredit(d) && h('p', { class: 'card-rights' }, mediaCredit(d) || sourceSite(d), ' · ',
      h('a', { href: d.image ? d.rights.mediaLicenseUrl : d.rights.metadataLicenseUrl, target: '_blank', rel: 'noopener noreferrer' }, d.image ? d.rights.license_name || d.rights.mediaLicense : d.rights.metadataLicense),
      d.rights.originalMediaUrl && [' · ', h('a', { href: d.rights.originalMediaUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Original image')],
      ' · ', h('a', { href: sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Source & notices')),
    d.kind === 'chart' && h('p', { class: 'card-rights' }, mediaCredit(d) || sourceSite(d), ' · ',
      h('a', { href: d.rights.metadataLicenseUrl, target: '_blank', rel: 'noopener noreferrer' }, d.rights.license_name || d.rights.metadataLicense),
      ' · ', h('a', { href: sourceUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Source & notices')));
}

export function factCredit(d) {
  const r = d.rights;
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
  const notices = [...new Set([r.imageAttribution, r.imageCredit].filter(value => value &&
    !/^(?:own work|self[- ](?:made|photographed))\.?$/i.test(value.trim()) && value !== r.imageCreator))];
  return h('p', { class: 'card-rights' },
    link(r.historyUrl || d.url, 'Wikipedia contributors'), ' · ', link(r.metadataLicenseUrl, 'CC BY-SA 4.0'),
    r.textExcerpted !== false && [' · ', t('excerptShort', d.language)],
    d.machineTranslated && [' · ', t('machineTranslation', d.language)],
    r.mediaLicense?.startsWith('CC BY') && [' · ', link(r.originalMediaUrl, r.imageTitle.replace(/^File:/, '')), ' - ',
      r.imageCreator, notices.length ? ` · ${notices.join(' · ')}` : '', ' · ', link(r.mediaLicenseUrl, r.mediaLicense)]);
}

export function displayCopy(value) {
  return String(value).replace(/[–—]/g, '-').replace(/;\s*(\p{L})?/gu, (_, letter = '') => `. ${letter.toLocaleUpperCase()}`);
}

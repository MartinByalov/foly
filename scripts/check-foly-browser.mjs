// Real browser CORS, provider image decoding and rendering smoke test; separate from Node HTTP checks.
import http from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { providerHealthExitCode } from './foly-health-status.mjs';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = http.createServer(async (req, res) => {
  try {
    let file = path.resolve(root, `.${decodeURIComponent(req.url.split('?')[0])}`);
    if (['/preview', '/preview/'].includes(req.url.split('?')[0])) file = path.join(root, 'preview', 'index.html');
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Content-Type', (/\.m?js$/.test(file)) ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/json');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(path.join(os.tmpdir(), 'foly-source-browser-'));
const browser = spawn(process.env.FOLY_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { windowsHide: true, stdio: 'ignore' });
let socket;
const baseUrl = process.env.FOLY_BASE_URL || `http://127.0.0.1:${server.address().port}`;
const previewOnly = process.env.FOLY_PREVIEW_ONLY === '1';
const candidateChecks = process.env.FOLY_CANDIDATE_CHECKS === '1';
const requested = (process.env.FOLY_SOURCE_IDS || '').split(',').filter(Boolean);
const samples = Number(process.env.FOLY_BROWSER_SAMPLES || 1);
if (!Number.isInteger(samples) || samples < 1 || samples > 5) throw Error('FOLY_BROWSER_SAMPLES must be an integer from 1 to 5');
const reportName = `foly-${candidateChecks ? 'ready-media-candidates' : 'browser-health'}${requested.length ? '-selected' : ''}${process.env.FOLY_MOBILE === '1' ? '-mobile' : ''}.json`;
try {
  let port;
  for (let i = 0; i < 60; i++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await sleep(250); }
  }
  if (!port) throw Error('Browser did not expose debugging port');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const pageErrors = [];
  const networkFailures = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Network.loadingFailed') networkFailures.push(message.params);
    if (message.method === 'Runtime.exceptionThrown') pageErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      pageErrors.push(message.params.args.map(arg => arg.value || arg.description || '').join(' '));
    }
    if (!message.id) return;
    const task = pending.get(message.id); pending.delete(message.id);
    message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Network.enable');
  if (process.env.FOLY_MOBILE === '1') await send('Emulation.setDeviceMetricsOverride', {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  });
  await send('Page.navigate', { url: `${baseUrl}/data/foly-source-health.json` });
  await sleep(500);
  const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const { SOURCES: registry } = await import('/js/foly/sources.js');
    const SOURCES = registry;
    const { checkSource } = await import('/js/foly/checks.js');
    const { discoveryCard } = await import('/js/foly/card.js');
    await new Promise((resolve, reject) => {
      const style = document.createElement('link'); style.rel = 'stylesheet'; style.href = '/css/foly.css';
      style.onload = resolve; style.onerror = () => reject(Error('Card stylesheet failed')); document.head.append(style);
    });
    const reports = [];
    if (${candidateChecks}) {
      const { MEDIA_CANDIDATES, candidateMedia } = await import('/scripts/foly-media-candidates.mjs');
      return await Promise.all(MEDIA_CANDIDATES.map(async candidate => {
        const { id, endpoint, field } = candidate;
        const source = SOURCES.find(source => source.id === (candidate.registryId || id));
        const admission = { registryEnabled: source?.enabled === true, admissionChecked: false,
          field, note: 'Transport/decode evidence only; does not establish item rights or production admission.' };
        let imageUrl = null;
        try {
          const response = await fetch(endpoint, { signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw Error('API HTTP ' + response.status);
          const data = await response.json();
          imageUrl = candidateMedia(candidate, data);
          if (!imageUrl || new URL(imageUrl).protocol !== 'https:') throw Error('No ready HTTPS image');
          const image = new Image(); image.src = imageUrl;
          await Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(Error('Decode timeout')), 15000))]);
          if (!image.naturalWidth || !image.naturalHeight) throw Error('Empty decoded image');
          return { id, endpoint, image: imageUrl, ok: true, width: image.naturalWidth, height: image.naturalHeight,
            ...admission };
        } catch (error) { return { id, endpoint, image: imageUrl, ok: false, ...admission, error: error.message }; }
      }));
    }
    const requested = ${JSON.stringify(requested)};
    for (const id of requested) if (!SOURCES.some(s => s.enabled && s.id === id)) throw Error('Unknown or inactive provider: ' + id);
    for (const source of SOURCES.filter(s => s.enabled && ${!previewOnly} && (!requested.length || requested.includes(s.id)))) {
      for (let sample = 0; sample < ${samples}; sample++) {
      const started = performance.now();
      try {
        let dimensions = {};
        const result = await checkSource(source, { random: () => ${samples} === 1 ? .37 : [.05, .37, .87, .21, .69][sample], imageLoader: async url => {
          const image = new Image(); image.src = url;
          await Promise.race([image.decode(), new Promise((_, reject) => setTimeout(() => reject(Error('Decode timeout')), 15000))]);
          dimensions = { width: image.naturalWidth, height: image.naturalHeight };
        } });
        if (!result.ok) throw Error(result.error);
        if (!result.discovery.image || !dimensions.width || !dimensions.height) {
          throw Error('Provider returned no ready decoded image');
        }
        const card = discoveryCard(result.discovery); document.body.append(card);
        if (!card.querySelector('.card-title')?.textContent) throw Error('Empty rendered title');
        if (!card.querySelector('.media img')) throw Error('Missing rendered provider image');
        const destination = result.discovery.sourcePageUrl || result.discovery.url;
        const sourceLink = [...card.querySelectorAll('.find-actions a')].find(link => link.href === new URL(destination).href);
        if (!sourceLink) throw Error('Missing human-facing source page link');
        const { requiresCardCredit } = await import('/js/foly/rights.js');
        const credit = card.querySelector('.card-rights');
        if (Boolean(credit) !== requiresCardCredit(result.discovery)) throw Error('Incorrect conditional image credit');
        if (credit && (card.lastElementChild !== credit || getComputedStyle(credit).textAlign !== 'center')) throw Error('Credit is not at the bottom and centered');
        const { present } = await import('/js/foly/resolver.js');
        const reopened = discoveryCard(present(result.discovery, source));
        document.body.append(reopened);
        if (![...reopened.querySelectorAll('.find-actions a')].some(link => link.href === new URL(destination).href)) {
          throw Error('Reopened discovery lost its human-facing source page');
        }
        const reopenedImage = reopened.querySelector('.media img');
        if (!reopenedImage) throw Error('Reopened discovery has no provider image');
        await Promise.race([reopenedImage.decode(), new Promise((_, reject) => setTimeout(() => reject(Error('Reopened image decode timeout')), 15000))]);
        if (!reopenedImage.naturalWidth || !reopenedImage.naturalHeight) throw Error('Reopened image has no dimensions');
        const reopenedCredit = reopened.querySelector('.card-rights');
        if (Boolean(reopenedCredit) !== Boolean(credit) || reopenedCredit?.textContent !== credit?.textContent) throw Error('Reopened discovery lost image credits');
        if (reopenedCredit && (reopened.lastElementChild !== reopenedCredit || getComputedStyle(reopenedCredit).textAlign !== 'center')) throw Error('Reopened credit is not at the bottom and centered');
        const creditLinks = node => [...(node?.querySelectorAll('a') || [])].map(link => link.href);
        if (JSON.stringify(creditLinks(reopenedCredit)) !== JSON.stringify(creditLinks(credit))) throw Error('Reopened discovery lost credit links');
        reopened.remove();
        if (result.kind === 'text') {
          if (card.querySelector('img, .reveal-btn')) throw Error('Text card fabricated media or answer');
          const { requiresCardCredit } = await import('/js/foly/rights.js');
          if (Boolean(card.querySelector('.card-rights')) !== requiresCardCredit(result.discovery)) throw Error('Incorrect conditional text credit');
        }
        if (result.kind === 'question') {
          if (source.id === 'opentdb' && (card.querySelector('.card-copy strong, .card-rights') ||
            !card.querySelector('a[href$="#about-trivia"]'))) throw Error('Trivia credits or difficulty were not moved to About');
          const choices = [...card.querySelectorAll('.quiz-option')];
          if (choices.length !== result.discovery.options.length || ![2, 4].includes(choices.length)) throw Error('Missing answer buttons');
          if (card.querySelector('.reveal-btn, .quiz-feedback, .quiz-option.correct')) throw Error('Unexpected quiz feedback before choice');
          choices.find(button => button.textContent !== result.discovery.reveal).click();
          if (!choices.every(button => button.disabled) || !card.querySelector('.quiz-option.correct') ||
            card.querySelector('.quiz-feedback')) throw Error('Quiz button state failed');
        }
        card.remove();
        reports.push({ id: source.id, sample, elapsedMs: Math.round(performance.now() - started), ok: true,
          kind: result.discovery.kind, sourcePage: destination, image: result.discovery.image, rendered: true,
          ...dimensions });
      } catch (error) { reports.push({ id: source.id, sample, elapsedMs: Math.round(performance.now() - started), ok: false, error: error.message }); }
      }
    }
    return reports;
  })()` });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  const reports = result.result.value;
  if (!previewOnly) await writeFile(new URL('../data/' + reportName, import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n');
  await send('Page.navigate', { url: `${baseUrl}/index.html#about-trivia` });
  let about;
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(250);
    about = await send('Runtime.evaluate', { returnByValue: true, expression: `({ open: document.querySelector('#infoDialog')?.open, credit: document.querySelector('#infoBody #about-trivia')?.textContent, licence: document.querySelector('#infoBody a[href="https://creativecommons.org/licenses/by-sa/4.0/"]')?.textContent })` });
    if (about.result.value?.open && about.result.value?.credit && about.result.value?.licence) break;
  }
  if (!about.result.value?.open || !about.result.value?.credit || !about.result.value?.licence) throw Error('Trivia About attribution link failed');
  for (const route of ['/preview', '/preview/']) {
    pageErrors.length = 0;
    await send('Page.navigate', { url: `${baseUrl}${route}` });
    let preview;
    for (let attempt = 0; attempt < 40; attempt++) {
      await sleep(250);
      preview = await send('Runtime.evaluate', { returnByValue: true, expression: `({ providers: document.querySelectorAll('.provider').length, menus: document.querySelectorAll('.provider select').length, title: document.title, startupError: document.querySelector('#summary[role="alert"]')?.textContent })` });
      if (preview.result.value?.providers || pageErrors.length || preview.result.value?.startupError) break;
    }
    const value = preview.result.value;
    if (pageErrors.length || value?.startupError) throw Error(`Preview startup errors: ${JSON.stringify(pageErrors)} ${value?.startupError || ''}`);
    const expected = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const { SOURCES } = await import('/js/foly/sources.js');
      const { discoveryCatalog } = await import('/js/foly/catalog.js');
      const { previewSources } = await import('/js/foly/preview-model.js');
      const { primary } = discoveryCatalog(document.documentElement.lang);
      const active = previewSources(primary, SOURCES);
      return { providers: active.length, ids: active.map(source => 'provider-' + source.id) };
    })()` });
    if (expected.exceptionDetails) throw Error('Preview catalogue could not be evaluated');
    const providerIds = await send('Runtime.evaluate', { returnByValue: true, expression: `[...document.querySelectorAll('#providers .provider')].map(node => node.id)` });
    if (value?.providers !== expected.result.value?.providers || value?.menus !== expected.result.value?.providers ||
      JSON.stringify(providerIds.result.value) !== JSON.stringify(expected.result.value.ids)) {
      throw Error('Preview API cards or category menus failed to render completely: ' + JSON.stringify({ actual: value, expected: expected.result.value, ids: providerIds.result.value }));
    }
    const directory = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const { SOURCES } = await import('/js/foly/sources.js');
      const active = SOURCES.filter(source => source.enabled);
      const root = document.querySelector('#api-directory');
      if (!root || root.getBoundingClientRect().top >= document.querySelector('#providers').getBoundingClientRect().top) throw Error('API directory is not above gallery');
      for (const kind of ['api', 'dataset']) {
        const expected = active.filter(source => (source.rightsPolicy?.kind === 'dataset') === (kind === 'dataset')).sort((a, b) => a.name.localeCompare(b.name));
        const links = [...root.querySelectorAll('[data-kind="' + kind + '"] a')];
        if (links.length !== expected.length || links.some((link, index) => link.textContent !== expected[index].name || link.hash !== '#provider-' + expected[index].id || !document.querySelector(link.hash))) throw Error('Incorrect API directory links: ' + kind);
      }
      const link = root.querySelector('[data-kind="api"] a');
      link.click();
      if (location.hash !== link.hash || !document.querySelector(link.hash).matches(':target')) throw Error('API directory navigation failed');
      history.replaceState(null, '', location.pathname);
      scrollTo(0, 0);
      if (document.documentElement.scrollWidth > innerWidth) throw Error('API directory overflows viewport');
      return { apis: root.querySelectorAll('[data-kind="api"] a').length, datasets: root.querySelectorAll('[data-kind="dataset"] a').length, navigation: true };
    })()` });
    if (directory.exceptionDetails) throw Error('Preview directory failed: ' + (directory.exceptionDetails.exception?.description || directory.exceptionDetails.text));
    console.log('API directory:', JSON.stringify(directory.result.value));
    console.log('Preview:', route, JSON.stringify(value), 'JavaScript errors: 0');
    // Wait for actual cards, not merely registry boxes, and verify the user's default view.
    let gallery;
    for (let attempt = 0; attempt < 180; attempt++) {
      await sleep(500);
      gallery = await send('Runtime.evaluate', { returnByValue: true, expression: `({ cards: document.querySelectorAll('#providers .find').length, complete: document.querySelector('#providers').dataset.complete === 'true', allVisible: [...document.querySelectorAll('.provider')].every(n => !n.hidden && n.getClientRects().length > 0), total: document.querySelectorAll('.provider').length, errors: [...document.querySelectorAll('#providers .provider')].filter(n => n.dataset.state === 'error').length })` });
      if (gallery.result.value?.complete) break;
    }
    const state = gallery.result.value;
    if (!state?.complete || !state.cards || !state.allVisible || state.total !== expected.result.value.providers || state.cards + state.errors !== expected.result.value.providers) throw Error(`Unusable preview gallery: ${JSON.stringify(state)}`);
    const layout = await send('Runtime.evaluate', { returnByValue: true, expression: `({
      badImages: [...document.querySelectorAll('#providers .find')].filter(card => {
        if (card.dataset.kind === 'chart') return false;
        if (card.dataset.kind === 'text') return !card.querySelector('.card-copy')?.textContent.trim();
        const image = card.querySelector('.media img');
        return !image || !image.complete || !image.naturalWidth || !image.naturalHeight;
      }).length,
      badCredits: [...document.querySelectorAll('#providers .card-rights')].filter(credit =>
        credit.parentElement.lastElementChild !== credit || getComputedStyle(credit).textAlign !== 'center').length,
      overflow: document.documentElement.scrollWidth > innerWidth
    })` });
    if (layout.result.value.badImages || layout.result.value.badCredits || layout.result.value.overflow) throw Error('Preview image or credit layout failed: ' + JSON.stringify(layout.result.value));
    if (pageErrors.length) throw Error(`Preview runtime errors: ${JSON.stringify(pageErrors)}`);
    console.log('Rendered gallery:', JSON.stringify(state));
    const vectors = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const results = [];
      for (const id of ['twemoji', 'openmoji']) {
        const node = document.querySelector('#provider-' + id);
        if (node.dataset.state !== 'ok') throw Error(id + ' did not load: ' + node.textContent);
        const image = node.querySelector('.media img');
        if (!image) throw Error(id + ' has no image element');
        await image.decode();
        const box = image.getBoundingClientRect();
        const media = image.parentElement.getBoundingClientRect();
        const menu = node.querySelector('select');
        results.push({ id, width: box.width, height: box.height, mediaWidth: media.width, mediaHeight: media.height,
          naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, categoryLabel: menu.selectedOptions[0].textContent });
        if (box.width < 100 || box.height < 100 || media.width < box.width || media.height < box.height) throw Error('Collapsed or clipped SVG: ' + JSON.stringify(results.at(-1)));
        if (!menu.disabled || menu.options.length !== 1 || menu.selectedOptions[0].textContent !== 'No category filter') throw Error('Misleading unsupported category menu: ' + id);
      }
      const { SOURCES } = await import('/js/foly/sources.js');
      if (SOURCES.find(source => source.id === 'iconify')?.enabled) throw Error('Decorative icon provider is active');
      return results;
    })()` });
    if (vectors.exceptionDetails) throw Error('SVG presentation failed: ' + (vectors.exceptionDetails.exception?.description || vectors.exceptionDetails.text));
    console.log('Visible SVG images:', JSON.stringify(vectors.result.value));
    const selection = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const node = document.querySelector('#provider-inaturalist');
      const select = node.querySelector('select');
      const values = [...select.options].filter(option => option.value).map(option => option.value);
      if (select.disabled || values.length < 2) throw Error('Missing live source categories');
      const others = [...document.querySelectorAll('.provider')].filter(item => item !== node).map(item => item.querySelector('.media img')?.src);
      select.value = values[0]; select.dispatchEvent(new Event('change'));
      const loadingCleared = !node.querySelector('.find');
      select.value = values[1]; select.dispatchEvent(new Event('change'));
      for (let attempt = 0; attempt < 120 && node.getAttribute('aria-busy') === 'true'; attempt++) await new Promise(resolve => setTimeout(resolve, 250));
      if (node.dataset.state !== 'ok' || node.dataset.category !== values[1]) throw Error('Latest category did not win: ' + node.textContent);
      const image = node.querySelector('.media img'); await image.decode();
      const { SOURCES } = await import('/js/foly/sources.js');
      const { checkSource } = await import('/js/foly/checks.js');
      const source = SOURCES.find(item => item.id === 'inaturalist');
      const expected = await checkSource(source, { category: values[1], random: () => 0 });
      if (!expected.ok) throw Error('Selected native category has no valid result');
      const sameOthers = [...document.querySelectorAll('.provider')].filter(item => item !== node).every((item, index) => item.querySelector('.media img')?.src === others[index]);
      if (!loadingCleared || !sameOthers || !image.naturalWidth) throw Error('Category change affected other providers or retained stale content');
      if (document.documentElement.scrollWidth > innerWidth) throw Error('Category card overflows viewport');
      const originalFetch = source.fetch;
      try {
        source.fetch = async () => { throw Error('Controlled preview failure'); };
        node.querySelector('button.provider-reload').click();
        for (let attempt = 0; attempt < 40 && node.getAttribute('aria-busy') === 'true'; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
        if (node.dataset.state !== 'error' || node.querySelector('.find') || !node.textContent.includes('Controlled preview failure')) throw Error('Failed provider retained a card or substituted another API');
      } finally { source.fetch = originalFetch; }
      node.querySelector('button.provider-reload').click();
      for (let attempt = 0; attempt < 120 && node.getAttribute('aria-busy') === 'true'; attempt++) await new Promise(resolve => setTimeout(resolve, 250));
      if (node.dataset.state !== 'ok' || node.dataset.category !== values[1]) throw Error('Same-category retry did not recover');
      await node.querySelector('.media img').decode();
      return { provider: source.id, selected: values[1], decoded: true, isolated: sameOthers, latestWins: true, failureAndRetry: true };
    })()` });
    if (selection.exceptionDetails) throw Error('Preview category interaction failed: ' + (selection.exceptionDetails.exception?.description || selection.exceptionDetails.text));
    console.log('Category interaction:', JSON.stringify(selection.result.value));
    if (state.errors) {
      const failures = await send('Runtime.evaluate', { returnByValue: true, expression: `[...document.querySelectorAll('#providers .provider')].filter(n => n.dataset.state === 'error').map(n => ({ id: n.id, error: n.textContent }))` });
      console.log('Preview provider failures:', JSON.stringify(failures.result.value));
    }
  }
  if (previewOnly) {
    console.log('Actual-server preview startup and warm-cache navigation passed.');
  } else {
  await writeFile(new URL('../data/' + reportName, import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n');
  console.log(JSON.stringify(reports, null, 2));
  if (networkFailures.length) console.log('Network failures:', JSON.stringify(networkFailures));
  process.exitCode = providerHealthExitCode(reports);
  }
} finally {
  socket?.close(); browser.kill(); server.close();
  await sleep(500); await rm(profile, { recursive: true, force: true }).catch(() => {});
}
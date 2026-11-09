import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createDevServer } from './serve.mjs';
import { LANGUAGES } from '../js/foly/locale.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const server = createDevServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const profile = await mkdtemp(path.join(os.tmpdir(), 'foly-facts-'));
const browser = spawn(process.env.FOLY_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ['--headless=new', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let socket;
try {
  let port;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { port = (await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await sleep(250); }
  }
  assert.ok(port, 'Browser debugging port');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Fetch.requestPaused') {
      send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'image/svg+xml' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
        body: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="green"/></svg>').toString('base64') }).catch(error => errors.push(error.message));
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (!message.id) return;
    const entry = pending.get(message.id);
    pending.delete(message.id);
    message.error ? entry.reject(Error(message.error.message)) : entry.resolve(message.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://upload.wikimedia.org/*' }, { urlPattern: 'https://thumb.wikimedia.org/*' }] });
  const viewports = process.env.FOLY_LANDSCAPE_ONLY ? [[568, 320], [844, 390]] : [[1892, 844], [1280, 844], [390, 844], [320, 568], [568, 320], [844, 390]];
  for (const [width, height] of viewports) {
    const mobile = width <= 680 || height <= 480;
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    for (const language of Object.keys(LANGUAGES)) {
      await send('Page.navigate', { url: `${base}/?lang=${language}` });
      let ready = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        ready = await evaluate(`document.documentElement?.lang === '${language}' && !!document.querySelector('.box')`);
        if (ready) break;
        await sleep(100);
      }
      assert.ok(ready, `Startup ${language}: ${errors.join('; ')}`);
      assert.equal(await evaluate(`(async () => {
        const image=document.querySelector('.background-image');
        await image.decode();
        return image.naturalWidth===1280 && image.naturalHeight===720 &&
          new URL(image.currentSrc).origin===location.origin && !document.querySelector('video') &&
          !performance.getEntriesByType('resource').some(r=>r.name.includes('wixstatic.com'));
      })()`), true, 'Local background decodes without external video requests');
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
      await sleep(250);
      const alignment = await evaluate(`(() => {
        const rect = selector => document.querySelector(selector).getBoundingClientRect();
        const first = rect('.box');
        const last = [...document.querySelectorAll('.box')].map(box => box.getBoundingClientRect()).sort((a,b)=>b.right-a.right)[0];
        const language = rect('#languageSelect'); const categories = rect('#categoriesBtn');
        const footer = rect('.footer-nav'); const brand = rect('.footer-brand'); const logo = rect('.brand');
        const links = [...document.querySelectorAll('.footer-nav button')].map(button => button.getBoundingClientRect());
        const range = document.createRange(); range.selectNodeContents(document.querySelector('.footer-brand'));
        const languageStyle=getComputedStyle(document.querySelector('#languageSelect'));
        const categoriesStyle=getComputedStyle(document.querySelector('#categoriesBtn'));
        return { first:first.left, last:last.right, width:first.width, languageLeft:language.left, languageRight:language.right,
          languageWidth:language.width, categoriesWidth:categories.width, categoriesLeft:categories.left,
          square:Math.abs(categories.width-categories.height)<1 && Math.abs(language.width-language.height)<1,
          combined:categories.right-language.left, footerLeft:footer.left, lastLeft:last.left,
          stacked:language.right<=categories.left, categoriesRight:categories.right, footerRight:footer.right, brandLeft:brand.left, logoLeft:logo.left,
          footerText:getComputedStyle(document.querySelector('.footer-nav button')).textAlign,
          brandTextLeft:range.getBoundingClientRect().left,
          languageBorder:languageStyle.borderTopColor, categoryBorder:categoriesStyle.borderTopColor,
          borderWidth:languageStyle.borderTopWidth,
          languages:document.querySelector('#languageSelect').options.length,
          hindi:[...document.querySelector('#languageSelect').options].find(option=>option.value==='hi').textContent,
          vertical:links.every((link,index)=>!index||links[index-1].bottom<=link.top),
          appearance:getComputedStyle(document.querySelector('#languageSelect')).appearance, topics:document.querySelectorAll('#categoryList input').length };
      })()`);
      if (!mobile) {
        for (const value of [alignment.brandLeft, alignment.logoLeft]) assert.ok(Math.abs(value-alignment.first)<1, `Left grid alignment: ${JSON.stringify(alignment)}`);
        for (const value of [alignment.categoriesRight, alignment.footerRight]) assert.ok(Math.abs(value-alignment.last)<1, `Right grid alignment: ${JSON.stringify(alignment)}`);
      } else {
        assert.ok(Math.abs(alignment.first)<1 && Math.abs(alignment.last-width)<1, 'Mobile grid fills background width');
        assert.ok(Math.abs(alignment.logoLeft-(width-alignment.categoriesRight))<1, 'Equal header edge spacing');
      }
      if (mobile) {
        assert.ok(alignment.languageWidth >= 44 && alignment.categoriesWidth >= 44, 'Mobile controls have usable touch targets');
      } else assert.ok(Math.abs(alignment.combined-alignment.width)<1, 'Combined controls span one grid column');
      if (!mobile) assert.ok(Math.abs(alignment.footerLeft-alignment.lastLeft)<1, 'Footer starts at last column left edge');
      assert.equal(alignment.footerText, mobile && height > width ? 'center' : 'right');
      if (!mobile) assert.ok(Math.abs(alignment.brandTextLeft-alignment.first)<1, 'Visible copyright text follows first column');
      assert.equal(alignment.languageBorder, 'rgba(255, 255, 255, 0.28)');
      assert.equal(alignment.borderWidth, '1px');
      assert.equal(alignment.languages, Object.keys(LANGUAGES).length);
      assert.ok(alignment.hindi.includes('Hindi'));
      assert.ok(alignment.square);
      assert.ok(alignment.stacked);
      if (!(mobile && height > width)) assert.ok(alignment.vertical);
      if (mobile) assert.equal(await evaluate(`(() => {
        const field=document.getElementById('field').getBoundingClientRect();
        const header=document.querySelector('.site-header').getBoundingClientRect();
        const footer=document.querySelector('.site-footer').getBoundingClientRect();
        const links=[...document.querySelectorAll('.footer-nav button')].map(b=>b.getBoundingClientRect());
        const nav=document.querySelector('.footer-nav').getBoundingClientRect();
        return Math.abs(field.top-header.bottom)<1 && Math.abs(field.bottom-footer.top)<1 &&
          (innerHeight<innerWidth || (links.every(r=>Math.abs(r.top-links[0].top)<1) && Math.abs((nav.left+nav.right)/2-innerWidth/2)<1));
      })()`), true, 'Edge-to-edge field and centered portrait footer row');
      assert.equal(alignment.appearance, 'none');
      assert.ok(alignment.topics >= 15);
      assert.equal(await evaluate(`document.querySelectorAll('#categoryList small').length`), 0);
      assert.equal(await evaluate(`(() => {
        const field=document.getElementById('field').getBoundingClientRect();
        const box=document.querySelector('.box').getBoundingClientRect();
        return field.height >= box.height - 1 && field.top >= 0 && field.bottom <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth;
      })()`), true, 'A complete grid row fits without horizontal page overflow');
      for (const section of ['about', 'sources', 'privacy']) {
        const info = await evaluate(`(() => {
          document.querySelector('[data-info="${section}"]').click();
          const dialog=document.getElementById('infoDialog'), body=document.getElementById('infoBody');
          const result={open:dialog.open,lang:dialog.lang,dir:body.dir,
            paragraphs:body.querySelectorAll(':scope > p').length,links:body.querySelectorAll('.info-links a').length,
            overflow:dialog.scrollWidth>dialog.clientWidth,
            safeLinks:[...body.querySelectorAll('a')].every(a=>a.target==='_blank' && a.rel.includes('noopener'))};
          document.getElementById('infoClose').click();
          return result;
        })()`);
        assert.equal(info.open, true, section);
        assert.equal(info.lang, language, section);
        assert.equal(info.dir, language === 'ar' ? 'rtl' : 'ltr', section);
        assert.equal(info.paragraphs, section === 'privacy' ? 4 : 3, section);
        assert.equal(info.links, section === 'about' ? 0 : section === 'privacy' ? 2 : 3, section);
        assert.equal(info.overflow, false, section);
        assert.equal(info.safeLinks, true, section);
      }
      assert.equal(await evaluate(`(() => {
        document.getElementById('categoriesBtn').click();
        const r=document.getElementById('categoryMenu').getBoundingClientRect();
        const visible=r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;
        document.getElementById('categoriesBtn').click();
        return visible;
      })()`), true, 'Category menu stays inside the viewport');
      // Footer anchors must follow unrevealed, unhovered geometry, never scale(1.08).
      const hoverTarget = await evaluate(`(() => {
        const box=document.querySelector('.box'); const r=box.getBoundingClientRect();
        return {x:r.left+r.width/2,y:r.top+r.height/2};
      })()`);
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...hoverTarget });
      await sleep(250);
      const hovered = await evaluate(`(() => {
        const box=document.querySelector('.box'); const footer=document.querySelector('.footer-brand').getBoundingClientRect();
        return {width:box.getBoundingClientRect().width,left:footer.left,right:document.querySelector('.footer-nav').getBoundingClientRect().right};
      })()`);
      assert.ok(hovered.width > alignment.width, 'Hover actually enlarges a square');
      assert.ok(Math.abs(hovered.left-alignment.brandLeft)<1, 'Copyright stays in place during hover');
      assert.ok(Math.abs(hovered.right-alignment.footerRight)<1, 'Footer links stay in place during hover');
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0 });
      await sleep(250);
      // Fixture transport exercises the actual UI independently of upstream availability.
      await evaluate(`(async () => {
        window.originalFetch = window.fetch;
        window.discoveryRequests = [];
        window.translationRequests = [];
        window.fetch = async input => {
          const url = new URL(input);
          if (url.hostname === 'api.mymemory.translated.net') { window.translationRequests.push(url.href); return new Response(JSON.stringify({responseStatus:200,
            responseData:{translatedText:'Translated '+url.searchParams.get('langpair').split('|')[1]+': '+url.searchParams.get('q')}}),{headers:{'Content-Type':'application/json'}}); }
          if (url.hostname === 'commons.wikimedia.org') return new Response(JSON.stringify({query:{pages:[{title:'File:Tree.jpg',imageinfo:[{
            thumburl:'https://upload.wikimedia.org/foly-fixture.svg',descriptionurl:'https://commons.wikimedia.org/wiki/File:Tree.jpg',
            extmetadata:{LicenseUrl:{value:'https://creativecommons.org/licenses/by-sa/4.0/'},Artist:{value:'Fixture photographer'},AttributionRequired:{value:'true'}}
          }]}]}}),{headers:{'Content-Type':'application/json'}});
          if (!url.hostname.endsWith('wikipedia.org')) return window.originalFetch(input);
          window.discoveryRequests.push(url.hostname);
          const lang = document.documentElement.lang;
          return new Response(JSON.stringify({query:{rightsinfo:{url:'https://creativecommons.org/licenses/by-sa/4.0/'},pages:[{
            ns:0,pageid:101,title:'Fixture article '+lang,extract:'An encyclopedia introduction for browser regression testing.',
            fullurl:'https://'+lang+'.wikipedia.org/wiki/Fixture',revisions:[{revid:42}],pageimage:'Tree.jpg'
          }]}}),{headers:{'Content-Type':'application/json'}});
        };
        document.getElementById('categoriesBtn').click();
        const {t} = await import('/js/foly/locale.js');
        const option = [...document.querySelectorAll('#categoryList input')].find(input=>input.value===t('random')); option.click();
        document.getElementById('categoriesBtn').click();
        document.querySelector('.box').click();
      })()`);
      let card;
      for (let attempt = 0; attempt < 60; attempt++) {
        card = await evaluate(`(() => {
          const card = document.querySelector('#discovery[open] .find');
          if (!card || (card.dataset.kind === 'fact' && !card.querySelector('img')?.naturalWidth)) return null;
          return {kind:card.dataset.kind,lang:card.lang,text:card.textContent,credits:card.querySelectorAll('.card-rights a').length,
            source:card.querySelector('.find-actions a')?.href,overflow:document.documentElement.scrollWidth>innerWidth,
            image:!!card.querySelector('img')?.naturalWidth,label:card.querySelector('.card-label')?.textContent,
            separators:card.querySelector('.card-label')?.querySelectorAll('.square-dot').length};
        })()`);
        if (card) break;
        await sleep(100);
      }
      assert.equal(card?.kind, 'fact');
      assert.equal(await evaluate(`!!document.getElementById('connectionStatus')`), false);
      assert.equal(card.lang, language);
      assert.ok(card.text.includes(`Fixture article ${language}`));
      assert.equal(card.credits, 4);
      assert.equal(card.image, true);
      assert.equal(await evaluate(`!!document.querySelector('#discovery .media + .card-line-after-image + .card-copy')`), true);
      assert.equal(card.separators, 0);
      assert.ok(card.source.startsWith(`https://${language}.wikipedia.org/`));
      assert.equal(card.overflow, false);
      const reopened = await evaluate(`(() => {
        document.getElementById('dialogClose').click();
        document.querySelector('.box.opened').click();
        const result = {title:document.querySelector('#discovery .card-title').textContent,count:document.getElementById('historyCount').textContent};
        document.getElementById('dialogClose').click();
        document.querySelector('[data-info="about"]').click();
        result.about = document.getElementById('infoBody').textContent;
        return result;
      })()`);
      assert.equal(reopened.title, `Fixture article ${language}`);
      assert.equal(reopened.count, '1');
      assert.ok(reopened.about.length > 30);
      const targetLanguage = language === 'bg' ? 'en' : 'bg';
      await evaluate(`(() => {
        document.getElementById('infoClose').click();
        window.languageChangeMarker = true;
        window.revealedImage = document.querySelector('.box.opened .box-image')?.getAttribute('src');
        const select=document.querySelector('#languageSelect');
        select.value='${targetLanguage}'; select.dispatchEvent(new Event('change',{bubbles:true}));
        document.querySelector('.box.opened').click();
      })()`);
      let translated = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        translated = await evaluate(`document.querySelector('#discovery[open] .find')?.lang==='${targetLanguage}' && !document.getElementById('discoveryBody').hasAttribute('aria-busy')`);
        if (translated) break;
        await sleep(100);
      }
      assert.ok(translated, 'Revealed square translated after header language change without reload');
      const preserved = await evaluate(`({marker:window.languageChangeMarker,count:document.getElementById('historyCount').textContent,
        text:document.querySelector('#discovery .card-title').textContent,url:location.search,
        selectors:document.querySelectorAll('#discovery select').length,
        imageUnchanged:window.revealedImage===document.querySelector('.box.opened .box-image')?.getAttribute('src')})`);
      assert.equal(preserved.marker, true);
      assert.equal(preserved.count, '1');
      assert.equal(preserved.selectors, 0, 'No language control inside discovery card');
      assert.equal(preserved.imageUnchanged, true, 'Same revealed discovery image is retained');
      assert.ok(preserved.text.includes('Translated '+targetLanguage));
      assert.ok(preserved.url.includes('lang='+targetLanguage));
      if (width === 320 && language === 'en') {
        await evaluate(`(() => {
          window.workingFetch = window.fetch;
          window.failTranslation = true;
          window.fetch = async (...args) => {
            const url = new URL(args[0]);
            if (url.hostname === 'api.mymemory.translated.net' && window.failTranslation)
              return new Response(JSON.stringify({responseStatus:403,quotaFinished:true}),{headers:{'Content-Type':'application/json'}});
            return window.workingFetch(...args);
          };
          const select=document.querySelector('#languageSelect');
          select.value='it'; select.dispatchEvent(new Event('change',{bubbles:true}));
        })()`);
        let failure;
        for (let attempt = 0; attempt < 60; attempt++) {
          failure = await evaluate(`!!document.querySelector('.translation-status button') && !document.getElementById('discoveryBody').hasAttribute('aria-busy')`);
          if (failure) break;
          await sleep(100);
        }
        assert.ok(failure, 'Translation failure keeps card and exposes retry');
        assert.equal(await evaluate(`document.querySelector('#discovery .find').lang`), targetLanguage);
        await evaluate(`window.failTranslation=false; document.querySelector('.translation-status button').click()`);
        let recovered;
        for (let attempt = 0; attempt < 60; attempt++) {
          recovered = await evaluate(`document.querySelector('#discovery .find')?.lang==='it' && !document.querySelector('.translation-status') && !document.getElementById('discoveryBody').hasAttribute('aria-busy')`);
          if (recovered) break;
          await sleep(100);
        }
        assert.ok(recovered, 'Retry replaces card only after a complete successful translation');
        await evaluate(`(() => {
          const select=document.querySelector('#languageSelect');
          for (const lang of ['pl','tr','${targetLanguage}']) {
            select.value=lang; select.dispatchEvent(new Event('change',{bubbles:true}));
          }
        })()`);
        await sleep(500);
        assert.equal(await evaluate(`document.querySelector('#discovery .find').lang`), targetLanguage, 'Latest language wins');
        assert.equal(await evaluate(`document.getElementById('discoveryBody').hasAttribute('aria-busy')`), false);
      }
      await evaluate(`document.getElementById('dialogClose').click()`);
      await sleep(100);
      const requestsBefore = await evaluate(`({translation:window.translationRequests.length,discovery:window.discoveryRequests.length})`);
      await evaluate(`document.querySelector('.box:not(.opened)').click()`);
      let newLanguage;
      for (let attempt = 0; attempt < 80; attempt++) {
        newLanguage = await evaluate(`document.querySelector('#discovery[open] .find')?.lang`);
        if (newLanguage) break;
        await sleep(100);
      }
      assert.equal(newLanguage, targetLanguage, 'New discovery uses selected edition');
      const requestsAfter = await evaluate(`({translation:window.translationRequests.length,discovery:window.discoveryRequests.length,
        host:window.discoveryRequests.at(-1),machine:document.querySelector('#discovery .card-rights').textContent})`);
      assert.equal(requestsAfter.translation, requestsBefore.translation, 'New square never calls translation');
      assert.ok(requestsAfter.discovery > requestsBefore.discovery);
      assert.equal(requestsAfter.host, targetLanguage+'.wikipedia.org');
      assert.ok(!requestsAfter.machine.includes('Machine translation') && !requestsAfter.machine.includes('Машинен превод'));
      console.log(JSON.stringify({ type: 'fixture-ui', width, height, language, ok: true }));
    }
  }
  for (const language of ['en', 'bg']) {
    await send('Page.navigate', { url: `${base}/preview/?lang=${language}` });
    let preview;
    for (let attempt = 0; attempt < 80; attempt++) {
      preview = await evaluate(`({count:document.querySelectorAll('.provider').length,dyk:!!document.querySelector('#provider-wikipedia-dyk'),directory:document.querySelector('#api-directory')?.textContent})`);
      if (preview.count) break;
      await sleep(100);
    }
    assert.ok(preview.count > 37, 'Primary and fallback preview cards');
    assert.equal(preview.dyk, language === 'en');
    assert.ok(preview.directory.includes('Wikimedia Commons'));
    assert.ok(preview.directory.includes('not homepage fallbacks'));
    console.log(JSON.stringify({ type: 'preview-ui', language, providers: preview.count, ok: true }));
  }
  await send('Fetch.disable');
  const live = await evaluate(`(async () => {
    const {discoveryCatalog,discoverWithFallback} = await import('/js/foly/catalog.js');
    const reports=[];
    for(const language of ['en','bg','fr','hi']) {
      try {
        const {primary,fallback}=discoveryCatalog(language);
        const found=await discoverWithFallback([primary[0]],fallback,{language,imageLoader:async url=>{
          const img=new Image(); img.src=url; await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Image timeout')),8000))]);
        }});
        if(found.language!==language) throw Error('Wrong discovery language');
        reports.push({language,contentLanguage:found.language,ok:true,title:found.title,image:!!found.image});
      }catch(error){reports.push({language,ok:false,error:error.message});}
    }
    return reports;
  })()`);
  console.log(JSON.stringify({ type: 'live-cors', reports: live }));
  assert.deepEqual(errors, [], 'No uncaught browser exceptions');
  console.log('Browser UI regression checks passed. Live availability is reported separately.');
} finally {
  socket?.close();
  browser.kill();
  await new Promise(resolve => server.close(resolve));
  await sleep(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}
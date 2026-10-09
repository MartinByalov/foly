import { safeUrl } from './engine.js';
import { shortDescription } from './copy.js';
import { isReveal } from './interactions.js';
const labels = { play: 'PLAY', see: 'SEE', know: 'KNOW', today: 'TODAY' };
const dialog = document.getElementById('mediaDialog');
const dialogContent = document.getElementById('dialogContent');
document.getElementById('dialogClose').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => dialogContent.replaceChildren());

export function createCard(format) {
  const card = document.createElement('article');
  card.className = 'daily-card'; card.dataset.group = format.group; card.dataset.id = format.id;
  card.innerHTML = `<div class="card-head"><div class="card-label"></div><h2 class="card-title"></h2><div class="card-line"></div></div>
    <div class="card-body"><div class="text-frame loading-pulse">Finding today's pick…</div></div>
    <div class="card-copy"></div><div class="source-row"></div>`;
  card.querySelector('.card-label').textContent = labels[format.group];
  card.querySelector('.card-title').textContent = format.title;
  return card;
}

function textFrame(value) {
  const frame = document.createElement('div'); frame.className = 'text-frame';
  frame.textContent = value; return frame;
}

function setCopy(container, title, description, facts = []) {
  container.replaceChildren();
  if (title) {
    const heading = document.createElement('strong'); heading.className = 'item-title';
    heading.textContent = title; container.append(heading);
  }
  if (description) {
    const paragraph = document.createElement('p'); paragraph.className = 'item-description';
    paragraph.textContent = shortDescription(description); container.append(paragraph);
  }
  const unique = [...new Set(facts.filter(fact => fact && fact !== description))].slice(0, 3);
  if (unique.length) {
    const list = document.createElement('ul'); list.className = 'item-facts';
    for (const fact of unique) { const entry = document.createElement('li'); entry.textContent = fact; list.append(entry); }
    container.append(list);
  }
}

function showImage(item) {
  dialogContent.replaceChildren();
  const image = document.createElement('img'); image.alt = item.imageAlt || item.title;
  image.src = item.sourceId === 'met' ? item.image.replace('/web-thumb/', '/web-large/') : item.image;
  image.onerror = () => {
    if (image.src !== item.image) image.src = item.image;
    else { dialog.close(); }
  };
  dialogContent.append(image); dialog.showModal();
}

export function render(card, item) {
  if (!item) return;
  const reveal = isReveal(item);
  let revealed = false;
  card.dataset.revealed = 'false';
  card.querySelectorAll('.reveal-btn').forEach(button=>button.remove());
  card.querySelectorAll('.quiz-options').forEach(choices=>choices.remove());
  card.classList.toggle('quiz-card',item.interaction?.type==='quiz');
  const body = card.querySelector('.card-body'); body.replaceChildren();
  const stage = document.createElement('div'); stage.className = 'media-stage';
  body.append(stage);
  body.classList.toggle('crop-question',reveal && item.interaction.type==='crop');
  if(item.visual?.type==='meter' && Number.isFinite(item.visual.value)){
    const frame=textFrame(item.title);
    const meter=document.createElement('meter');meter.min=item.visual.min;meter.max=item.visual.max;meter.value=item.visual.value;
    meter.setAttribute('aria-label',item.visual.label);frame.append(meter);stage.append(frame);
  } else if (item.image) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'media media-button';
    button.setAttribute('aria-label', reveal ? 'Enlarge museum object' : `Enlarge ${item.imageAlt || item.title}`);
    const image = document.createElement('img'); image.src = item.image;
    image.alt = reveal ? 'Museum object to discover' : item.imageAlt || item.title; image.loading = 'lazy'; image.decoding = 'async';
    image.onerror = () => {
      if (!image.dataset.alternateTried && item.sourceId === 'met' && image.src.includes('/web-thumb/')) {
        image.dataset.alternateTried = 'true';
        image.src = image.src.replace('/web-thumb/', '/web-large/');
      } else if (!image.dataset.alternateTried && item.sourceId === 'met' && image.src.includes('/web-large/')) {
        image.dataset.alternateTried = 'true';
        image.src = image.src.replace('/web-large/', '/web-thumb/');
      } else button.replaceWith(textFrame(item.subtitle || item.title));
    };
    button.append(image);
    button.addEventListener('click', () => {
      if (reveal && !revealed && item.interaction.type === 'crop') return;
      showImage(reveal && !revealed ? { ...item, title: 'Museum object', imageAlt: 'Museum object to discover' } : item);
    });
    if (reveal && item.interaction.type === 'crop') {
      button.disabled = true;
      button.setAttribute('aria-label', 'Cropped object — reveal to see the full image');
    }
    stage.append(button);
  } else stage.append(textFrame(reveal ? card.querySelector('.card-title').textContent :
    item.formatId==='anniversary' ? item.description || item.title : item.title));
  const description = card.querySelector('.card-copy');
  description.setAttribute('aria-live', 'polite');
  description.id = `answer-${card.dataset.id || item.formatId || 'item'}`;
  setCopy(description, item.interaction || !item.image ? null : item.title,
    reveal ? (item.interaction.type === 'caption' ? 'Reveal the Foly caption.' : 'Look closely, then reveal the answer.') :
      item.formatId==='anniversary' && !item.image ? '' :
      item.interaction?.type === 'quiz' && item.description === 'Pick an answer.' ? '' : item.description,
    reveal || item.formatId==='anniversary' && !item.image ? [] : item.facts || []);
  let explore;
  let authorLabel;
  if (reveal) {
    const button = document.createElement('button'); button.className = 'reveal-btn';
    button.type = 'button'; button.textContent = 'Reveal';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', description.id);
    button.addEventListener('click', () => {
      revealed = true;
      card.dataset.revealed = 'true';
      setCopy(description, item.interaction.answer, item.interaction.details);
      body.classList.remove('crop-question');
      const mediaButton = body.querySelector('.media-button');
      if (mediaButton) { mediaButton.disabled = false; mediaButton.setAttribute('aria-label', 'Enlarge revealed object'); }
      if (explore) explore.hidden = false;
      if (authorLabel) authorLabel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.disabled = true;
      button.remove();
    }); description.after(button);
  }
  if (item.interaction?.type === 'quiz') {
    const choices = document.createElement('div'); choices.className = 'quiz-options';
    for (const option of item.interaction.options) {
      const button = document.createElement('button'); button.className = 'quiz-option';
      button.type = 'button'; button.textContent = option;
      button.addEventListener('click', () => {
        const feedback = `${option === item.interaction.answer ? 'Correct!' : 'Correct answer:'} ${item.interaction.answer}`;
        const frame = stage.querySelector('.text-frame');
        if (frame) { frame.setAttribute('aria-live','polite'); frame.textContent = feedback; }
        description.replaceChildren();
        choices.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.toggle('correct', b.textContent === item.interaction.answer); });
      }); choices.append(button);
    } description.after(choices);
  }
  const row = card.querySelector('.source-row'); row.replaceChildren();
  const credit = document.createElement('span'); credit.className = 'source-chip';
  credit.textContent = item.sourceName;
  const source = document.createElement('div'); source.className = 'media-source';
  source.replaceChildren(credit); stage.append(source);
  if (item.unavailable) {
    const retry=document.createElement('button');retry.type='button';retry.className='source-chip link';retry.textContent='Retry';
    retry.addEventListener('click',()=>card.dispatchEvent(new CustomEvent('retry-item',{bubbles:true})));
    body.append(retry);
  }
  // Required creator credits remain visible without a license/Details button.
  const author = item.rights?.attribution || item.mediaAttribution || item.author;
  if (author) { const label=document.createElement('span');label.className='source-author';label.textContent=author;label.hidden=reveal;authorLabel=label;source.append(label); }
  if (item.sourceItemUrl && (safeUrl(item.sourceItemUrl, ['metmuseum.org','wikipedia.org','wikimedia.org','wikidata.org','opentdb.com','usgs.gov','nasa.gov','clevelandart.org','artic.edu','gbif.org','inaturalist.org','si.edu','n2t.net']) || item.rights?.sourceItemUrl===item.sourceItemUrl && /^https:\/\//.test(item.sourceItemUrl))) {
    const link = document.createElement('a'); link.className = 'source-chip link';
    link.href = item.sourceItemUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.textContent = 'Explore'; row.append(link);
    link.hidden = reveal;
    explore = link;
  }
}
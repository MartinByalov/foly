import { source, pickOne, text, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const PDM = 'https://creativecommons.org/publicdomain/mark/1.0/';
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';
export const manuscriptProviders = [
  { id: 'austrianLibrary', name: 'Austrian National Library', category: 'History',
    pageUrl: evidence => `https://akon.onb.ac.at/?id=AKON_${new URL(evidence).pathname.split('/').filter(Boolean).at(-2)}`,
    manifests: ['AK076_113', 'AK114_093', 'AK114_094'].map(id => `https://iiif.onb.ac.at/presentation/AKON/${id}/manifest`),
    imageHosts: ['iiif.onb.ac.at'], credit: 'Österreichische Nationalbibliothek / Austrian National Library' },
  { id: 'mLeuven', name: 'M Leuven', category: 'Art',
    manifests: ['68a3dc5b-13f4-4b14-ba68-74f6116dc401', '12ba8f89-2be1-4ce9-9c6f-2acafd348678', '883fa0ca-21cf-4922-b26e-01d209671fd0']
      .map(id => `https://mleuven.resourcespace.com/iiif/${id}/manifest`),
    imageHosts: ['mleuven.resourcespace.com'], credit: 'M Leuven', creditField: '© Creditline EN', imageSize: '!800,800' },
  { id: 'nijl', name: 'National Institute of Japanese Literature', category: 'History',
    pageUrl: 'https://kokusho.nijl.ac.jp/biblio/200013970',
    manifests: ['https://kokusho.nijl.ac.jp/biblio/200013970/manifest'],
    imageHosts: ['kokusho.nijl.ac.jp'], credit: '国文学研究資料館 / National Institute of Japanese Literature' },
  { id: 'cataloniaMaps', name: 'Institut Cartogràfic i Geològic de Catalunya', category: 'Maps',
    pageUrl: evidence => {
      const id = new URL(evidence).pathname.match(/\/catalunya\/(\d+)\/manifest\.json$/)?.[1];
      if (!id) fail('Missing public Cartoteca record identifier');
      return `https://cartotecadigital.icgc.cat/digital/collection/catalunya/id/${id}/rec/1`;
    },
    manifests: [3363, 3364, 3365].map(id => `https://cartotecadigital.icgc.cat/iiif/info/catalunya/${id}/manifest.json`),
    imageHosts: ['cdm21055.contentdm.oclc.org'], credit: 'Institut Cartogràfic i Geològic de Catalunya / Cartoteca Digital' },
  { id: 'luxembourgEuropeana', name: 'National Library of Luxembourg via Europeana', category: 'History',
    pageUrl: 'https://www.europeana.eu/en/item/9200396/BibliographicResource_3000118436165',
    manifests: ['https://iiif.europeana.eu/presentation/9200396/BibliographicResource_3000118436165/manifest'],
    imageHosts: ['iiif.europeana.eu'], credit: 'Bibliothèque nationale de Luxembourg / Europeana' },
  { id: 'bremenLibrary', name: 'Bremen State and University Library', category: 'History',
    pageUrl: 'https://brema.suub.uni-bremen.de/content/titleinfo/2642703',
    manifests: ['https://brema.suub.uni-bremen.de/i3f/v20/2642703/manifest'],
    imageHosts: ['brema.suub.uni-bremen.de'], credit: 'Staats- und Universitätsbibliothek Bremen',
    reviewed: { sha256: '3a36c32baaece4d9ee07cbb51e55426679804842ebcfee7446eb2a4c9a2218a5', license: PDM,
      evidence: 'https://brema.suub.uni-bremen.de/oai?verb=GetRecord&metadataPrefix=mets&identifier=2642703' } },
  { id: 'karlsruheLibrary', name: 'Baden State Library', category: 'History',
    manifests: ['https://digital.blb-karlsruhe.de/i3f/v20/529580/manifest'],
    imageHosts: ['digital.blb-karlsruhe.de'], credit: 'Badische Landesbibliothek, Cod. Karlsruhe 3192',
    reviewed: { sha256: 'd9aa577c78429f01e0b7bc979d550cbbad3a5763d3207cb3f26ff44dfc914f11', license: PDM,
      evidence: 'https://digital.blb-karlsruhe.de/oai?verb=GetRecord&metadataPrefix=mets&identifier=529580' } },
  { id: 'bonnLibrary', name: 'Bonn University and State Library', category: 'History',
    pageUrl: 'https://digitale-sammlungen.ulb.uni-bonn.de/content/titleinfo/1472083',
    manifests: ['https://digitale-sammlungen.ulb.uni-bonn.de/i3f/v20/1472083/manifest'],
    imageHosts: ['digitale-sammlungen.ulb.uni-bonn.de'], credit: 'Universitäts- und Landesbibliothek Bonn, Kriegsbriefe 20 : 143',
    reviewed: { sha256: 'b1c1899af36f6c277c01aac14676a8682fc9379c802daa4749c4ca4a5d9bea3c', license: PDM,
      evidence: 'https://digitale-sammlungen.ulb.uni-bonn.de/oai?verb=GetRecord&metadataPrefix=mets&identifier=1472083' } },
  { id: 'paderbornLibrary', name: 'Paderborn University Library', category: 'History',
    manifests: ['https://digital.ub.uni-paderborn.de/i3f/v20/7991371/manifest'],
    imageHosts: ['digital.ub.uni-paderborn.de'], credit: 'Universitätsbibliothek Paderborn', attributed: true,
    creator: 'Erwin Quedenfeldt', mediaTitle: 'Einzelbilder vom Mittelrhein, volume 2 (1911)',
    reviewed: { sha256: '3b98cca6c23c2e2f0b614a1eddb26fe63e6fb4bf32e06dc139815878481eed7b', license: CC_BY,
      evidence: 'https://digital.ub.uni-paderborn.de/oai?verb=GetRecord&metadataPrefix=mets&identifier=7991371' } },
  { id: 'cardiffLibrary', name: 'Cardiff University Library', category: 'Art',
    manifests: ['https://librarysearch.cardiff.ac.uk/view/iiif/presentation/44WHELF_CAR/12204338230002420/manifest?iiifVersion=2'],
    imageHosts: ['eu-img02.ext.exlibrisgroup.com'], institution: '44WHELF_CAR',
    credit: 'Cardiff University Special Collections and Archives', attributed: true,
    creator: 'Shirley Jones', mediaTitle: 'Ellor-gāst (1986)',
    reviewed: { sha256: 'f2448f8affb1f4010e9af54179f8210f8666b51c4f3c0eb8cabb2559d6cee512', license: CC_BY,
      evidence: 'https://librarysearch.cardiff.ac.uk/view/iiif/presentation/44WHELF_CAR/12204338230002420/manifest?iiifVersion=2' } },
  { id: 'muzee', name: 'Mu.ZEE', category: 'Art',
    manifests: [6748, 6749, 6750, 6751].map(id => `https://resourcespace.muzee.be/iiif/3/${id}/manifest.json`),
    imageHosts: ['resourcespace.muzee.be'], credit: 'Mu.ZEE, Art Museum by the Sea' },
  { id: 'museaBrugge', name: 'Musea Brugge', category: 'Art',
    pageUrl: 'https://www.museabrugge.be/en/collection',
    manifests: [6726, 6728, 6735, 6736].map(id => `https://dam.museabrugge.be/iiif/3/${id}/manifest.json`),
    imageHosts: ['dam.museabrugge.be'], credit: 'Musea Brugge' },
  { id: 'kansaiUniversity', name: 'Kansai University KU-ORCAS', category: 'History',
    pageUrl: 'https://www.ku-orcas.kansai-u.ac.jp/',
    manifests: ['https://www.iiif.ku-orcas.kansai-u.ac.jp/iiif/books/200899741/manifest.json'],
    imageHosts: ['www.iiif.ku-orcas.kansai-u.ac.jp'], credit: '関西大学アジア・オープン・リサーチセンター[KU-ORCAS]' },
  { id: 'swedenLibrary', name: 'National Library of Sweden', category: 'History',
    pageUrl: 'https://www.manuscripta.se/ms/100200',
    manifests: ['https://www.manuscripta.se/iiif/100200/manifest.json'],
    imageHosts: ['iiif.manuscripta.se'], credit: 'National Library of Sweden' },
  { id: 'erara', name: 'e-rara', category: 'History',
    pageUrl: 'https://www.e-rara.ch/zut/content/titleinfo/7568336',
    manifests: ['https://www.e-rara.ch/i3f/v20/7568336/manifest'],
    imageHosts: ['www.e-rara.ch'], credit: 'e-rara, the platform for digitized rare books from Swiss institutions' },
  { id: 'toledoLibrary', name: 'Toledo Lucas County Public Library', category: 'History',
    pageUrl: evidence => {
      const id = new URL(evidence).pathname.match(/\/p16007coll31\/(\d+)\/manifest\.json$/)?.[1];
      if (!id) fail('Missing public Toledo record identifier');
      return `https://ohiomemory.org/digital/collection/p16007coll31/id/${id}/rec/1`;
    },
    manifests: [1206, 1207, 1208, 1209].map(id => `https://ohiomemory.org/iiif/info/p16007coll31/${id}/manifest.json`),
    imageHosts: ['cdm16007.contentdm.oclc.org'], credit: 'John Michael Dewees / Toledo Lucas County Public Library / Community Photo Album' },
  { id: 'clevelandLibrary', name: 'Cleveland Public Library', category: 'History',
    pageUrl: evidence => {
      const id = new URL(evidence).pathname.match(/\/p4014coll9\/(\d+)\/manifest\.json$/)?.[1];
      if (!id) fail('Missing public Cleveland record identifier');
      return `https://cplorg.contentdm.oclc.org/digital/collection/p4014coll9/id/${id}/`;
    },
    manifests: ['https://cplorg.contentdm.oclc.org/iiif/info/p4014coll9/10722/manifest.json'],
    imageHosts: ['cdm16014.contentdm.oclc.org'], credit: 'Cleveland Public Library Digital Gallery' },
  { id: 'bavarianLibrary', name: 'Bavarian State Library', category: 'History',
    pageUrl: evidence => `https://www.digitale-sammlungen.de/en/details/${new URL(evidence).pathname.split('/').filter(Boolean).at(-2)}`,
    manifests: ['https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb00012345/manifest'],
    imageHosts: ['api.digitale-sammlungen.de'], credit: 'Bayerische Staatsbibliothek' },
  { id: 'heidelbergLibrary', name: 'Heidelberg University Library', category: 'History',
    pageUrl: 'https://digi.ub.uni-heidelberg.de/diglit/cpg389',
    manifests: ['https://digi.ub.uni-heidelberg.de/diglit/iiif/cpg389/manifest.json'],
    imageHosts: ['digi.ub.uni-heidelberg.de'], credit: 'Universitätsbibliothek Heidelberg' },
  { id: 'stanfordLibrary', name: 'Stanford University Libraries', category: 'History',
    pageUrl: 'https://purl.stanford.edu/wy323vc0101',
    manifests: ['https://purl.stanford.edu/wy323vc0101/iiif/manifest'],
    imageHosts: ['stacks.stanford.edu'], credit: 'Stanford University Libraries' },
  { id: 'leidenLibrary', name: 'Leiden University Libraries', category: 'History',
    pageUrl: 'https://catalogue.leidenuniv.nl/nde/search?vid=31UKB_LEU%3AUBL_NDE',
    manifests: ['https://digitalcollections.universiteitleiden.nl/iiif_manifest/item:1606013/manifest'],
    imageHosts: ['eu-img02.ext.exlibrisgroup.com'], institution: '31UKB_LEU', credit: 'Leiden University Libraries' },
  { id: 'ghentLibrary', name: 'Ghent University Library', category: 'History',
    pageUrl: 'https://libcatalog.ugent.be/nde/home?vid=32RUG_INST%3A32RUG_INST&lang=en',
    manifests: ['https://adore.ugent.be/IIIF/manifests/archive.ugent.be%3AC98E436C-003C-11E7-AD2E-55C9D43445F2'],
    imageHosts: ['eu-img02.ext.exlibrisgroup.com'], institution: '32RUG_INST', credit: 'Ghent University Library' },
  { id: 'mskGent', name: 'Museum of Fine Arts Ghent', category: 'Art',
    pageUrl: 'https://www.mskgent.be/en/collection',
    manifests: [8092, 8093, 8095, 8096].map(id => `https://imagehub.mskgent.be/iiif/3/${id}/manifest.json`),
    imageHosts: ['imagehub.mskgent.be'], credit: 'Museum of Fine Arts Ghent' },
  { id: 'slubDresden', name: 'SLUB Dresden', category: 'Music',
    pageUrl: 'https://digital.slub-dresden.de/id1776160169',
    manifests: ['https://iiif.slub-dresden.de/iiif/2/1776160169/manifest.json'],
    imageHosts: ['images.iiif.slub-dresden.de'], credit: 'SLUB Dresden' },
  { id: 'leibnizLibrary', name: 'Gottfried Wilhelm Leibniz Library', category: 'History',
    pageUrl: 'https://digitale-sammlungen.gwlb.de/resolve?docid=00068782',
    manifests: ['https://digitale-sammlungen.gwlb.de/content/00068782/manifest.json'],
    imageHosts: ['digitale-sammlungen.gwlb.de'], credit: 'Gottfried Wilhelm Leibniz Bibliothek' },
  { id: 'parisMusees', name: 'Paris Musées', category: 'Art',
    pageUrl: (_evidence, manifest) => {
      const url = values(manifest.metadata?.find(row => values(row.label).includes('Catalogue des œuvres de Paris Musées'))?.value)
        .find(value => /^https:\/\/www\.parismuseescollections\.paris\.fr\//.test(value));
      if (!url) fail('Missing public Paris Musées item page');
      return url;
    },
    manifests: [160040796, 160040797, 160040798, 160040800].map(id => `https://apicollections.parismusees.paris.fr/iiif/${id}/manifest`),
    imageHosts: ['apicollections.parismusees.paris.fr'], credit: 'Paris Musées / Petit Palais, musée des Beaux-Arts de la Ville de Paris' },
  { id: 'nichibun', name: 'International Research Center for Japanese Studies', category: 'History',
    pageUrl: 'https://toshonin.nichibun.ac.jp/webopac/BB10097378',
    manifests: ['https://iiif.nichibun.ac.jp/IIIF/manifest/FZK/005160569.json'],
    imageHosts: ['iiif.nichibun.ac.jp'], credit: '国際日本文化研究センター, International Research Center for Japanese Studies' },
  { id: 'gilcrease', name: 'Gilcrease Museum', category: 'Art',
    pageUrl: evidence => `https://collections.gilcrease.org/object/${new URL(evidence).pathname.split('/').at(-1)}`,
    manifests: ['012312', '012311', '012310'].map(id => `https://collections.gilcrease.org/iiif/manifest/object/${id}`),
    imageHosts: ['gmcd-piction-live.s3.amazonaws.com'], credit: 'Gilcrease Museum Online Collections.' },
];

const values = value => typeof value === 'string' ? [value] : Array.isArray(value)
  ? value.flatMap(values) : value && typeof value === 'object'
    ? value['@value'] ? values(value['@value']) : Object.values(value).flatMap(values) : [];
const rightsUrl = (value, provider) => {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/^http:/, 'https:').replace(/\/deed\.[a-z]+$/, '/').replace(/\/{2}$/, '/');
  return [PDM, CC0, ...(provider?.attributed ? [CC_BY] : [])].includes(clean) ? clean : null;
};
const metadataRights = node => (node?.metadata || []).filter(row =>
  values(row.label).some(label => /^(Copyright|Rechteinformationen|Rights|Rights URI|Rights License|Lizenz|Drets)$/i.test(label)))
  .flatMap(row => values(row.value)).map(value => (value === 'Public Domain Mark 1.0' ? PDM : null) || rightsUrl(value) ||
    rightsUrl(value.match(/href=(?:"|\\")([^"\\]+)(?:"|\\")/)?.[1])).find(Boolean);
function mediaUrl(body, provider) {
  let service = body?.service;
  if (Array.isArray(service)) service = service[0];
  const base = service?.id || service?.['@id'];
  const original = body?.id || body?.['@id'];
  const candidate = base ? `${base.replace(/\/$/, '')}/full/${provider.imageSize || '800,'}/0/default.jpg` : original;
  if (typeof candidate !== 'string' || /[\\\s]|%(?:2e|2f|5c)/i.test(candidate.replace(/%2F/g, '')) ||
    candidate.split('/').includes('..')) return null;
  let url;
  try { url = new URL(candidate.replace(/^http:/, 'https:')); } catch { return null; }
  if (url.protocol !== 'https:' || !provider.imageHosts.includes(url.hostname) || url.username || url.password || url.port) return null;
  if (provider.institution) {
    try {
      const token = url.pathname.split('/')[3];
      const decoded = JSON.parse(atob(decodeURIComponent(token)));
      if (decoded.institution !== provider.institution) return null;
    } catch { return null; }
  }
  return url.href;
}

export function reviewedManifestPayload(manifest) {
  return JSON.stringify({ id: manifest.id || manifest['@id'],
    license: manifest.license || null, rights: manifest.rights || null,
    canvases: (manifest.sequences?.[0]?.canvases || manifest.items || []).map(canvas => {
      const body = canvas.images?.[0]?.resource || canvas.items?.[0]?.items?.[0]?.body;
      let service = body?.service;
      if (Array.isArray(service)) service = service[0];
      return { id: canvas.id || canvas['@id'], license: canvas.license || null, rights: canvas.rights || null,
        body: body?.id || body?.['@id'], bodyLicense: body?.license || null, bodyRights: body?.rights || null,
        service: service?.id || service?.['@id'] };
    }) });
}

export function manuscriptDiscovery(manifest, provider, evidence, random) {
  if (!provider.manifests.includes(evidence)) fail('Unreviewed manuscript manifest');
  const explicit = rightsUrl(manifest?.license || manifest?.rights, provider) || metadataRights(manifest);
  if ((manifest?.license || manifest?.rights) && !explicit) fail('Restricted manifest rights');
  const ghentDeclaration = provider.id === 'ghentLibrary' &&
    values(manifest?.requiredStatement?.value).some(value => value.startsWith('PUBLIC DOMAIN\r\n') &&
      value.includes('You may copy, modify, distribute and perform the work without asking permission, even for commercial purposes.'));
  const canvases = manifest?.sequences?.[0]?.canvases || manifest?.items;
  if (!Array.isArray(canvases)) fail('Missing manuscript canvases');
  const choices = canvases.slice(0, 500).flatMap(canvas => {
    const licence = rightsUrl(canvas.license || canvas.rights, provider) || metadataRights(canvas) || explicit || (ghentDeclaration ? PDM : null);
    // A restricted canvas cannot inherit permission from a less restrictive manifest.
    if ((canvas.license || canvas.rights) && !rightsUrl(canvas.license || canvas.rights, provider)) return [];
    const body = canvas.images?.[0]?.resource || canvas.items?.[0]?.items?.[0]?.body;
    const bodyLicence = body?.rights || body?.license;
    if (!licence || (bodyLicence && !rightsUrl(bodyLicence, provider))) return [];
    const image = mediaUrl(body, provider);
    return image ? [{ image, licence, canvas }] : [];
  });
  const chosen = pickOne(random, choices);
  if (!chosen) fail('No individually open manuscript image');
  const { image, licence } = chosen;
  const credit = provider.creditField ? values(manifest.metadata?.find(row =>
    values(row.label).includes(provider.creditField))?.value)[0] : provider.credit;
  if (!credit) fail('Missing original institution credit');
  const manifestTitle = values(manifest.label).map(text).find(value => value && value.length <= 200 &&
    !/^[a-z]{2,3}(?:-[a-z0-9]+)?$/i.test(value));
  // Use only the item's short catalogue label; do not copy catalogue descriptions.
  const fallbackTitle = provider.category === 'Art' ? `An artwork from ${provider.name}` :
    provider.category === 'Music' ? 'A page of historical music' : `A historical page from ${provider.name}`;
  const raw = { title: manifestTitle || fallbackTitle,
    subject: provider.category === 'Art' ? 'Collection image' : 'Digitized heritage', image, url: evidence,
    ...(provider.pageUrl ? { sourcePageUrl: typeof provider.pageUrl === 'function' ? provider.pageUrl(evidence, manifest) : provider.pageUrl } : {}),
    credit: `${credit}${provider.id === 'heidelbergLibrary' ? ` / Cod. Pal. germ. 389 / ${text(values(chosen.canvas.label)[0] || chosen.canvas['@id']?.split('/').at(-1) || 'Digitized page')}` : ''} · ${licence === CC0 ? 'CC0' : licence === CC_BY ? 'CC BY 4.0' : 'Public domain'}` };
  raw.rights = rightsEvidence({ ...raw, metadataLicense: 'CC0', metadataLicenseUrl: CC0,
    mediaLicense: licence === CC0 ? 'CC0' : licence === CC_BY ? 'CC_BY' : 'PDM', mediaLicenseUrl: licence, evidence,
    ...(licence === CC_BY ? { creator: provider.creator, mediaTitle: provider.mediaTitle, attribution: credit,
      originalMediaUrl: image, changes: 'No modifications by Foly; displayed at a scaled size.' } : {}) });
  raw.rights.metadataOrigin = 'Foly-authored display text. No provider catalogue prose reproduced.';
  raw.rights.creditRequired = true;
  if (!validateDiscoveryRights(raw).ok) fail('Incomplete manuscript rights');
  return raw;
}

export default manuscriptProviders.map(provider => source(provider.id, provider.name, provider.category, async ({ json, random }) => {
  const evidence = pickOne(random, provider.manifests);
  if (provider.id === 'heidelbergLibrary') {
    const dataset = await json(new URL('../../../data/foly-manuscripts.json', import.meta.url).href);
    const saved = dataset?.providers?.[provider.id];
    if (!saved || saved.evidence !== evidence || saved.sha256 !== 'd3fa5410dc8e4498c737777fadd7ac35b74dab9a381115f5e08b5235e8b21173') fail('Unreviewed manuscript snapshot');
    return manuscriptDiscovery(saved.manifest, provider, evidence, random);
  }
  const manifest = await json(evidence);
  if (provider.reviewed) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(reviewedManifestPayload(manifest)));
    const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
    if (hash !== provider.reviewed.sha256) fail('Reviewed manifest changed. New rights review required');
    const licensed = { ...manifest, license: provider.reviewed.license };
    const raw = manuscriptDiscovery(licensed, provider, evidence, random);
    raw.rights.verifiedBy = provider.reviewed.evidence;
    return raw;
  }
  return manuscriptDiscovery(manifest, provider, evidence, random);
}));
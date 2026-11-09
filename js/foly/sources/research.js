import { source, int, pickOne, join, once, text, fail } from './util.js';

const TOPICS = ['coral', 'volcano', 'memory', 'sleep', 'bees', 'glacier', 'language', 'music', 'robot', 'forest', 'moon', 'bread',
  'whale', 'dream', 'color', 'ocean', 'bacteria', 'bridge', 'laughter', 'origami'];

// Small MediaWiki sites answer `list=random` from the browser with origin=*.
const mediaWikiRandom = (id, name, category, host, subject, credit) => source(id, name, category, async ({ json }) => {
  const api = `https://${host}/w/api.php`;
  const title = (await json(`${api}?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*`)).query?.random?.[0]?.title;
  if (!title) fail('No page');
  const page = Object.values((await json(`${api}?action=query&prop=extracts&exintro=1&explaintext=1&exchars=700&titles=${encodeURIComponent(title)}&format=json&origin=*`)).query?.pages || {})[0];
  if (!page?.extract?.trim()) fail('Empty page');
  return { title, subject, description: page.extract, url: `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`, credit };
});

export default [
  mediaWikiRandom('rosettaCode', 'Rosetta Code', 'Code', 'rosettacode.org', 'Programming task', 'Rosetta Code · GNU FDL'),


  source('europePmc', 'Europe PMC', 'Science', async ({ json, random }) => {
    const topic = pickOne(random, TOPICS);
    const paper = (await json(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${topic}%20AND%20OPEN_ACCESS:y%20AND%20HAS_ABSTRACT:y&resultType=core&pageSize=1&format=json&cursorMark=*&sort=CITED%20desc&page=1&offset=${int(random, 200)}`)).resultList?.result?.[0];
    if (!paper?.title) fail('No paper');
    return { title: text(paper.title), subject: topic, subtitle: join(paper.authorString?.split(',').slice(0, 3).join(','), paper.pubYear),
      description: text(paper.abstractText).slice(0, 800), url: `https://europepmc.org/article/${paper.source}/${paper.id}`, credit: 'Europe PMC' };
  }),

  source('doaj', 'DOAJ', 'Science', async ({ json, random }) => {
    const topic = pickOne(random, TOPICS);
    const article = (await json(`https://doaj.org/api/search/articles/${topic}?pageSize=1&page=${1 + int(random, 100)}`)).results?.[0]?.bibjson;
    if (!article?.title) fail('No article');
    return { title: text(article.title), subject: article.journal?.title || topic, subtitle: join(article.author?.slice(0, 3).map(a => a.name), article.year),
      description: text(article.abstract).slice(0, 800), url: article.link?.[0]?.url, credit: 'Directory of Open Access Journals' };
  }),

  source('figshare', 'Figshare', 'Science', async ({ json, random }) => {
    const item = (await json(`https://api.figshare.com/v2/articles?page=${1 + int(random, 500)}&page_size=1&item_type=1`))[0];
    if (!item?.title) fail('No item');
    const detail = await json(`https://api.figshare.com/v2/articles/${item.id}`);
    return { title: text(detail.title), subject: detail.categories?.[0]?.title || 'Figure', subtitle: join(detail.authors?.slice(0, 2).map(a => a.full_name), detail.published_date?.slice(0, 10)),
      description: text(detail.description).slice(0, 600), image: detail.thumb || null, url: detail.url_public_html, credit: join(detail.license?.name, 'Figshare') };
  }),

  source('chembl', 'ChEMBL', 'Medicine', async ({ json, random }) => {
    const drug = (await json(`https://www.ebi.ac.uk/chembl/api/data/molecule.json?max_phase=4&molecule_type=Small%20molecule&limit=1&offset=${int(random, 3000)}`)).molecules?.[0];
    if (!drug?.pref_name) fail('No drug');
    return { title: drug.pref_name.toLowerCase().replace(/^\w/, c => c.toUpperCase()), subject: 'Approved drug',
      subtitle: join(drug.molecule_properties?.full_molformula, drug.first_approval && `approved ${drug.first_approval}`),
      description: join(drug.therapeutic_flag && 'Therapeutic', drug.oral && 'taken by mouth', drug.topical && 'applied to the skin'),
      image: `https://www.ebi.ac.uk/chembl/api/data/image/${drug.molecule_chembl_id}.svg`, url: `https://www.ebi.ac.uk/chembl/compound_report_card/${drug.molecule_chembl_id}/`, credit: 'ChEMBL · CC BY-SA 3.0' };
  }),

  source('emsc', 'EMSC Seismic Portal', 'Earth', async ({ json, random }) => {
    const quake = pickOne(random, (await json('https://www.seismicportal.eu/fdsnws/event/1/query?format=json&limit=100&minmag=3')).features)?.properties;
    if (!quake) fail('No quake');
    return { title: `M ${quake.mag.toFixed(1)} · ${quake.flynn_region}`, subject: 'Earthquake', subtitle: quake.time?.replace('T', ' ').slice(0, 19),
      description: `${quake.depth} km deep, located by the European-Mediterranean Seismological Centre.`, url: `https://www.seismicportal.eu/eventdetails.html?unid=${quake.unid}`, credit: 'EMSC' };
  }),

  source('ietf', 'IETF Datatracker', 'Internet', async ({ json, random }) => {
    const doc = (await json(`https://datatracker.ietf.org/api/v1/doc/document/?type=rfc&limit=1&offset=${int(random, 9500)}&format=json`)).objects?.[0];
    if (!doc?.title) fail('No RFC');
    return { title: doc.title, subject: 'RFC', subtitle: doc.name?.toUpperCase(), description: text(doc.abstract).slice(0, 700),
      url: `https://www.rfc-editor.org/rfc/${doc.name}`, credit: 'IETF Trust' };
  }),

  source('cdnjs', 'cdnjs', 'Code', async ({ json, random }) => {
    const lib = pickOne(random, (await once('cdnjs', () => json('https://api.cdnjs.com/libraries?fields=description,version,homepage'))).results);
    if (!lib?.name) fail('No library');
    return { title: lib.name, subject: 'JavaScript library', subtitle: `v${lib.version}`, description: lib.description,
      url: lib.homepage || `https://cdnjs.com/libraries/${lib.name}`, credit: 'cdnjs' };
  }),

  source('fontsource', 'Fontsource', 'Design', async ({ json, random }) => {
    const font = pickOne(random, await once('fonts', () => json('https://api.fontsource.org/v1/fonts')));
    if (!font?.family) fail('No font');
    return { title: font.family, subject: font.category, subtitle: join(font.type, `${font.weights?.length} weights`),
      description: `Supports ${font.subsets?.slice(0, 5).join(', ')}${font.subsets?.length > 5 ? '…' : ''}. License: ${font.license}.`,
      url: `https://fontsource.org/fonts/${font.id}`, credit: 'Fontsource' };
  }),

  source('iconify', 'Iconify', 'Design', async ({ json, random }) => {
    const sets = Object.entries(await once('iconify', () => json('https://api.iconify.design/collections'))).filter(([, s]) => !s.hidden && s.total > 50);
    const [prefix, set] = pickOne(random, sets) || [];
    if (!prefix) fail('No set');
    const icons = await json(`https://api.iconify.design/collection?prefix=${prefix}`);
    const name = pickOne(random, icons.uncategorized || Object.values(icons.categories || {}).flat());
    if (!name) fail('No icon');
    return { title: name.replace(/-/g, ' '), subject: set.name, subtitle: join(set.author?.name, set.license?.title),
      image: `https://api.iconify.design/${prefix}/${name}.svg?color=%23ffffff&width=400`, description: `One of ${set.total.toLocaleString('en-US')} icons in ${set.name}.`,
      url: `https://icon-sets.iconify.design/${prefix}/${name}/`, credit: join(set.author?.name, set.license?.title) };
  }),

  source('jsdelivr', 'jsDelivr', 'Code', async ({ json, random }) => {
    const pkg = pickOne(random, await once('jsdelivr', () => json('https://data.jsdelivr.com/v1/stats/packages?period=month&limit=100&type=npm')));
    if (!pkg?.name) fail('No package');
    return { title: pkg.name, subject: 'Most-used package', subtitle: `${(pkg.hits?.total ?? pkg.hits).toLocaleString('en-US')} requests last month`,
      description: 'One of the packages served most often by the jsDelivr CDN.', url: `https://www.jsdelivr.com/package/npm/${pkg.name}`, credit: 'jsDelivr' };
  }),

  source('crates', 'crates.io', 'Code', async ({ json, random }) => {
    const krate = (await json(`https://crates.io/api/v1/crates?page=${1 + int(random, 200)}&per_page=1&sort=downloads`)).crates?.[0];
    if (!krate?.name) fail('No crate');
    return { title: krate.name, subject: 'Rust crate', subtitle: `${krate.downloads.toLocaleString('en-US')} downloads`, description: krate.description,
      url: `https://crates.io/crates/${krate.name}`, credit: 'crates.io' };
  }),
];

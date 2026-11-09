import { mkdir, writeFile } from 'node:fs/promises';

const candidates = [
  ['wroclaw', 'https://bibliotekacyfrowa.pl/iiif-manifest/manifest/38354/PDF.json'],
  ['leuven', 'https://mleuven.resourcespace.com/iiif/68a3dc5b-13f4-4b14-ba68-74f6116dc401/manifest'],
  ['harvardArt', 'https://iiif.harvardartmuseums.org/manifests/object/133370'],
  ['tokyoMuseum', 'https://museumcollection.tokyo/iiif/6379100/manifest'],
  ['qatarLibrary', 'https://www.qdl.qa/en/iiif/qnlhc/2702/manifest'],
  ['edinburghBotanic', 'https://iiif.rbge.org.uk/herb/iiif/E00008781/manifest'],
  ['designGent', 'https://api.collectie.gent/iiif/presentation/v2/manifest/dmg:3075'],
  ['ucla', 'https://iiif.library.ucla.edu/ark%3A%2F21198%2Fzz0002hp4m/manifest'],
  ['oxford', 'https://iiif.bodleian.ox.ac.uk/iiif/manifest/faeff7fb-f8a7-44b5-95ed-cff9a9ffd198.json'],
  ['cambridge', 'https://cudl.lib.cam.ac.uk/iiif/MS-ADD-03996'],
  ['northwestern', 'https://api.dc.library.northwestern.edu/api/v2/works/4c0790f6-ae02-42cd-9efb-26f3dd508184?as=iiif'],
  ['northTexas', 'https://digital.library.unt.edu/ark:/67531/metadc1942141/manifest/'],
  ['bgbm', 'https://herbarium.bgbm.org/data/iiif/B200012401/manifest.json'],
  ['leipzig', 'https://iiif.ub.uni-leipzig.de/0000009864/manifest.json'],
  ['bremen', 'https://brema.suub.uni-bremen.de/i3f/v20/1569525/manifest'],
  ['jena', 'https://collections.thulb.uni-jena.de/api/iiif/presentation/v2/HisBest_derivate_00002711/manifest'],
  ['gottingen', 'https://manifests.sub.uni-goettingen.de/iiif/presentation/PPN235181684_0029/manifest'],
  ['radboud', 'https://bijzonderecollecties.ubn.ru.nl/iiif/2/Handschriften:41837/manifest.json'],
  ['utrecht', 'https://objects.library.uu.nl/manifest/iiif/v3/1874-9510'],
  ['trinity', 'https://digitalcollections.tcd.ie/concern/works/hm50tr726/manifest'],
];
const directory = new URL('../data/foly-live50-evidence/', import.meta.url);
await mkdir(directory, { recursive: true });
const reports = [];
for (let start = 0; start < candidates.length; start += 4) {
  await Promise.all(candidates.slice(start, start + 4).map(async ([id, url]) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Origin: 'http://localhost:8000' } });
      const content = await response.text();
      let data;
      try { data = JSON.parse(content); } catch { data = null; }
      if (data) await writeFile(new URL(`${id}.json`, directory), JSON.stringify(data, null, 2) + '\n');
      const canvases = data?.items || data?.sequences?.[0]?.canvases || [];
      const report = { id, url, status: response.status, cors: response.headers.get('access-control-allow-origin'),
        rights: data?.rights || data?.license, credit: data?.requiredStatement || data?.attribution,
        count: canvases.length, metadata: data?.metadata,
        body: canvases[0]?.images?.[0]?.resource || canvases[0]?.items?.[0]?.items?.[0]?.body };
      reports.push(report);
      console.log(JSON.stringify(report));
    } catch (error) { const report = { id, url, error: error.message }; reports.push(report); console.log(JSON.stringify(report)); }
  }));
}
await writeFile(new URL('../data/foly-live50-research.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n');
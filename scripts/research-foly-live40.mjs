import { mkdir, writeFile } from 'node:fs/promises';

export const candidates = [
  ['muzee', 'https://resourcespace.muzee.be/iiif/3/6748/manifest.json'],
  ['brugge', 'https://dam.museabrugge.be/iiif/3/6726/manifest.json'],
  ['ecodices', 'https://www.e-codices.unifr.ch/metadata/iiif/snm-AG002760/manifest.json'],
  ['swedenLibrary', 'https://www.manuscripta.se/iiif/100200/manifest.json'],
  ['leipzig', 'https://iiif.ub.uni-leipzig.de/0000001660/manifest.json'],
  ['gottingen', 'https://manifests.sub.uni-goettingen.de/iiif/presentation/PPN235181684_0029/manifest'],
  ['jena', 'https://collections.thulb.uni-jena.de/api/iiif/presentation/v2/HisBest_derivate_00002711/manifest'],
  ['radboud', 'https://bijzonderecollecties.ubn.ru.nl/iiif/2/Handschriften:41837/manifest.json'],
  ['wales', 'https://damsssl.llgc.org.uk/iiif/2.0/4398332/manifest.json'],
  ['geneva', 'https://iiif.unige.ch/manifest/IIIFManifest_1072068799.json'],
  ['huntington', 'https://hdl.huntington.org/iiif/2/p15150coll7:5145/manifest.json'],
  ['trinity', 'https://digitalcollections.tcd.ie/concern/works/hm50tr726/manifest'],
  ['huisBoek', 'https://access.ecodices.nl/iiif/presentation/MMW_10_A_12/manifest'],
  ['bruggeLibrary', 'https://sharedcanvas.be/IIIF/manifests/B_OB_MS615'],
  ['brown', 'https://repository.library.brown.edu/iiif/presentation/bdr:37024/manifest.json'],
  ['durham', 'https://iiif.durham.ac.uk/manifests/trifle/32150/t1/mv/t1/t1mvt150j86r/manifest'],
  ['folger', 'https://digitalcollections.folger.edu/node/50479/manifest'],
  ['princetonLibrary', 'https://figgy.princeton.edu/concern/scanned_resources/8d8b3997-d323-4b1c-aaca-1670a3181566/manifest'],
  ['emanuscripta', 'https://www.e-manuscripta.ch/i3f/v20/4602948/manifest'],
  ['erara', 'https://www.e-rara.ch/i3f/v20/7568336/manifest'],
];
const directory = new URL('../data/foly-live40-evidence/', import.meta.url);
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
        count: canvases.length, body: canvases[0]?.images?.[0]?.resource || canvases[0]?.items?.[0]?.items?.[0]?.body,
        rightsFields: content.match(/.{0,70}(?:creativecommons|[Rr]ights|[Ll]icen[sc]e).{0,180}/g)?.slice(0,12) };
      reports.push(report);
      console.log(JSON.stringify(report));
    } catch (error) { const report = { id, url, error: error.message }; reports.push(report); console.log(JSON.stringify(report)); }
  }));
}
await writeFile(new URL('../data/foly-live40-research.json', import.meta.url), JSON.stringify({ checkedAt: new Date().toISOString(), reports }, null, 2) + '\n');
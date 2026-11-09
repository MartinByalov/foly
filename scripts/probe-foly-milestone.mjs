import { writeFile } from 'node:fs/promises';

const urls = [
  'https://digi.ub.uni-heidelberg.de/diglit/iiif/cpg389/manifest.json',
  'https://www.e-rara.ch/zuz/i3f/v20/18877392/manifest',
  'https://adore.ugent.be/IIIF/manifests/archive.ugent.be%3AC98E436C-003C-11E7-AD2E-55C9D43445F2',
  'https://apicollections.parismusees.paris.fr/iiif/160040797/manifest',
  'https://museumcollection.tokyo/iiif/6379100/manifest',
  'https://www.qdl.qa/en/iiif/qnlhc/2702/manifest',
  'https://damsssl.llgc.org.uk/iiif/2/1497451/manifest.json',
  'https://iiif.rbge.org.uk/herb/iiif/E00008781/manifest',
  'https://digitalcollections.universiteitleiden.nl/iiif_manifest/item:1606013/manifest',
  'https://api.collectie.gent/iiif/presentation/v2/manifest/dmg:3075',
  'https://imagehub.mskgent.be/iiif/3/8092/manifest.json',
  'https://iiif.library.ucla.edu/ark%3A%2F21198%2Fzz0002hp4m/manifest',
  'https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb00012345/manifest',
  'https://content.staatsbibliothek-berlin.de/dc/PPN867445300/manifest',
  'https://iiif.bodleian.ox.ac.uk/iiif/manifest/faeff7fb-f8a7-44b5-95ed-cff9a9ffd198.json',
  'https://cudl.lib.cam.ac.uk/iiif/MS-ADD-03996',
  'https://purl.stanford.edu/wy323vc0101/iiif/manifest',
  'https://iiif.harvardartmuseums.org/manifests/object/133370',
  'https://api.bl.uk/metadata/iiif/ark:/81055/vdc_100104060212.0x000001/manifest.json',
  'https://objects.library.uu.nl/manifest/iiif/v3/1874-9510',
  'https://api.dc.library.northwestern.edu/api/v2/works/4c0790f6-ae02-42cd-9efb-26f3dd508184?as=iiif',
  'https://digital.library.unt.edu/ark:/67531/metadc1942141/manifest/',
  'https://herbarium.bgbm.org/data/iiif/B200012401/manifest.json',
  'https://portal.museumfuernaturkunde.berlin/api/v1/iiif/manifest/179377/manifest.json',
];
const reports = await Promise.all(urls.map(async url => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Origin: 'http://localhost:8000' } });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    const report = { url, status: response.status, cors: response.headers.get('access-control-allow-origin'),
      licence: data?.license || data?.rights, attribution: data?.attribution || data?.requiredStatement,
      label: data?.label, metadata: data?.metadata, keys: data ? Object.keys(data) : [],
      firstCanvas: data?.sequences?.[0]?.canvases?.[0] || data?.items?.[0],
      textExcerpt: data ? undefined : text.slice(0, 200) };
    console.log(JSON.stringify(report));
    return report;
  } catch (error) { const report = { url, error: error.message }; console.log(JSON.stringify(report)); return report; }
}));
await writeFile(new URL('../data/foly-milestone-probes.json', import.meta.url), JSON.stringify(reports, null, 2) + '\n');
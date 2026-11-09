import { source, pickOne, int, fail } from './util.js';
import { rightsEvidence, validateDiscoveryRights } from '../rights.js';

const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';
const BY = 'https://creativecommons.org/licenses/by/4.0/';
const PDM = 'https://creativecommons.org/publicdomain/mark/1.0/';
const ROBO_REVIEW = 'https://github.com/e1ven/Robohash/blob/52cb1525d83306652b79ac440e94cdd45e22a43a/README.md';
const MATERIAL_REVIEW = 'https://github.com/AntonPalmqvist/physically-based-api';
const changes = 'No modifications by Foly; displayed at a scaled size.';
const emojiChoices = [['1F600', 'A smiling face'], ['1F431', 'A cat face'], ['1F436', 'A dog face'],
  ['1F338', 'A blossom'], ['1F33B', 'A sunflower'], ['1F332', 'An evergreen tree'],
  ['1F333', 'A leafy tree'], ['1F331', 'A seedling'], ['1F30D', 'Earth'],
  ['1F308', 'A rainbow'], ['1F680', 'A rocket'], ['1F3A8', 'An artist palette']];

function emojiSource({ id, name, repo, revision, path, license, licenseUrl, creator, deliveryMode, retention }) {
  return source(id, name, 'Design', async ({ random }) => {
    // Original Foly captions, not copied annotations or descriptions from the emoji database.
    const [code, title] = pickOne(random, emojiChoices);
    const image = `https://raw.githubusercontent.com/${repo}/${revision}/${path}/${id === 'twemoji' ? code.toLowerCase() : code}.svg`;
    return licensed({ title, subject: 'Emoji illustration', image, url: `https://github.com/${repo}/blob/${revision}/README.md`,
      credit: `${creator} · ${license}` }, { evidence: `https://github.com/${repo}/blob/${revision}/${id === 'twemoji' ? 'LICENSE-GRAPHICS' : 'LICENSE.txt'}`,
      license, licenseUrl, creator, deliveryMode, retention,
      attribution: `${name} artwork by ${creator}. ${license === 'CC_BY_SA' ? 'CC BY-SA 4.0.' : 'CC BY 4.0.'}` });
  });
}

function licensed(raw, { evidence, license = 'CC0', licenseUrl = CC0, creator = '', attribution = '', deliveryMode, retention }) {
  const result = { ...raw, rights: rightsEvidence({ ...raw, metadataLicense: 'CC0', mediaLicense: license,
    mediaLicenseUrl: licenseUrl, evidence, creator, attribution, mediaTitle: raw.title,
    originalMediaUrl: raw.image, changes, deliveryMode, retention }) };
  if (!validateDiscoveryRights(result).ok) fail('Incomplete material image rights');
  return result;
}

export default [
  emojiSource({ id: 'openmoji', name: 'OpenMoji', repo: 'hfg-gmuend/openmoji',
    revision: '626bdc684b85738ebdba73ad83c499c2eb88c5dd', path: 'color/svg',
    license: 'CC_BY_SA', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', creator: 'OpenMoji contributors',
    deliveryMode: 'direct', retention: 'ephemeral' }),
  emojiSource({ id: 'twemoji', name: 'Twemoji', repo: 'jdecked/twemoji',
    revision: 'b6b55fef1e8636b540a6d016a4729ca8cdf2e60b', path: 'assets/svg',
    license: 'CC_BY', licenseUrl: BY, creator: 'Twitter, Inc. and other Twemoji contributors' }),
  source('robohash', 'RoboHash', 'Design', async ({ random }) => {
    // Only Revoy's reviewed CC BY 4.0 set. Never request any, backgrounds or Gravatar.
    const seed = `foly-${int(random, 1000000000)}`;
    const image = `https://robohash.org/${seed}.png?set=set4&size=320x320`;
    return licensed({ title: 'An illustrated cat', subject: 'Generative illustration', image, url: image,
      credit: 'David Revoy · RoboHash · CC BY 4.0' }, { evidence: ROBO_REVIEW, license: 'CC_BY', licenseUrl: BY,
      creator: 'David Revoy', attribution: 'Cat artwork by David Revoy, assembled and delivered by RoboHash. CC BY 4.0.' });
  }),
  source('flagpedia', 'Flagpedia', 'Geography', async ({ random }) => {
    // Foly's own factual captions. Flagpedia's website prose is separately copyrighted.
    const [code, title] = pickOne(random, [['bg', 'Bulgaria'], ['jp', 'Japan'], ['ca', 'Canada'],
      ['fr', 'France'], ['de', 'Germany'], ['it', 'Italy'], ['se', 'Sweden'], ['ch', 'Switzerland'],
      ['fi', 'Finland'], ['dk', 'Denmark'], ['no', 'Norway'], ['pl', 'Poland'], ['ua', 'Ukraine'],
      ['br', 'Brazil'], ['ar', 'Argentina'], ['za', 'South Africa'], ['au', 'Australia'], ['nz', 'New Zealand']]);
    return licensed({ title, subject: 'National flag', image: `https://flagcdn.com/w640/${code}.png`,
      url: 'https://flagpedia.net/download', credit: 'Flagpedia · Public domain' },
    { evidence: 'https://flagpedia.net/terms', license: 'PDM', licenseUrl: PDM });
  }),
  source('physicallyBased', 'Physically Based', 'Materials', async ({ json, random, category = '' }) => {
    const evidence = 'https://api.physicallybased.info/v2/materials';
    const data = await json(evidence);
    if (data.header?.origin !== evidence || data.header?.schemaVersion !== 2.2 ||
      data.header?.license !== 'CC0 1.0 Universal' || data.header?.deprecated !== false) fail('Unreviewed material schema or licence');
    const imageOf = row => row.images?.find(image => image.format === 'jpeg')?.['600'];
    const row = pickOne(random, data.data?.filter(row => typeof row.name === 'string' && row.name.trim() && (!category || row.category?.includes(category)) &&
      /^https:\/\/raw\.githubusercontent\.com\/AntonPalmqvist\/physically-based-api\/main\/images\/renders\/cycles\/600\/[a-z0-9_-]+\.jpeg$/.test(imageOf(row) || '')));
    if (!row) fail('No reviewed material render');
    return licensed({ title: row.name, subject: 'Material render', image: imageOf(row), url: MATERIAL_REVIEW,
      credit: 'Anton Palmqvist · ASWF USD Working Group · CC BY 4.0' },
    { evidence, license: 'CC_BY', licenseUrl: BY, creator: 'Anton Palmqvist and ASWF USD Working Group',
      attribution: 'Render by Anton Palmqvist. Standard Shader Ball by ASWF USD Working Group, CC BY 4.0.' });
  }),
  source('ambientcg', 'ambientCG', 'Textures', async ({ json, random }) => {
    // The official API has no browser CORS permission. Use the reproducible reviewed subset.
    const data = await json(new URL('../../../data/foly-ambientcg.json', import.meta.url).href);
    const row = pickOne(random, data.items?.filter(row => /^[A-Za-z]+\d{3}$/.test(row.id || '') &&
      row.metadataLicense === 'CC0' && row.mediaLicense === 'CC0' && row.provenance ===
        `https://ambientcg.com/api/v2/full_json?id=${row.id}&limit=1` &&
      row.image === `https://acg-media.struffelproductions.com/file/ambientCG-Web/media/thumbnail/512-JPG-FFFFFF/${row.id}.jpg`));
    if (!row) fail('No reviewed ambientCG preview');
    return licensed({ title: 'A material in detail', subject: 'Material preview', image: row.image,
      url: `https://ambientcg.com/a/${row.id}`, credit: 'ambientCG · CC0' }, { evidence: row.provenance });
  }),
];
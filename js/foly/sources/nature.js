import { source, int, pickOne, join, once, text, fail } from './util.js';

const title = name => name.replace(/(^|[\s-])\w/g, letter => letter.toUpperCase());

export default [
  source('inaturalist', 'iNaturalist', 'Nature', async ({ json, random }) => {
    const params = new URLSearchParams({ photos: 'true', quality_grade: 'research', photo_license: 'cc0,cc-by,cc-by-sa',
      per_page: '1', order_by: 'id', order: 'asc', id_above: String(int(random, 250_000_000)) });
    const record = (await json(`https://api.inaturalist.org/v1/observations?${params}`)).results?.[0];
    const photo = record?.photos?.[0];
    if (!record?.taxon?.name || !photo?.url) fail('No observation');
    return { title: record.taxon.preferred_common_name || record.taxon.name, subject: record.taxon.iconic_taxon_name || 'Life',
      subtitle: record.taxon.name, description: join(record.place_guess, record.observed_on),
      image: photo.url.replace('/square.', '/medium.'), thumb: photo.url.replace('/square.', '/small.'),
      url: `https://www.inaturalist.org/observations/${record.id}`, credit: photo.attribution };
  }),

  source('gbif', 'GBIF', 'Nature', async ({ json, random }) => {
    const data = await json(`https://api.gbif.org/v1/occurrence/search?mediaType=StillImage&license=CC0_1_0&license=CC_BY_4_0&limit=1&offset=${int(random, 99999)}`);
    const record = data.results?.[0];
    const media = record?.media?.find(m => /^https:/.test(m.identifier || ''));
    if (!record?.scientificName || !media) fail('No occurrence');
    return { title: record.vernacularName || record.species || record.scientificName, subject: record.kingdom || 'Life',
      subtitle: record.scientificName, description: join(record.locality, record.country, record.eventDate?.slice(0, 10)),
      image: media.identifier, url: `https://www.gbif.org/occurrence/${record.key}`, credit: join(media.rightsHolder || media.creator, media.license) };
  }),

  source('dogCeo', 'Dog CEO', 'Animals', async ({ json }) => {
    const image = (await json('https://dog.ceo/api/breeds/image/random')).message;
    const breed = image?.match(/breeds\/([^/]+)/)?.[1];
    if (!breed) fail('No dog');
    return { title: title(breed.split('-').reverse().join(' ')), subject: 'Dog breed', image, url: `https://dog.ceo/dog-api/breeds-list`, credit: 'Dog CEO · Stanford Dogs Dataset' };
  }),

  source('randomDog', 'random.dog', 'Animals', async ({ json }) => {
    const { url } = await json('https://random.dog/woof.json?filter=mp4,webm,gif');
    if (!/\.(jpe?g|png)$/i.test(url || '')) fail('Not a photo');
    return { title: 'A good dog', subject: 'Dog', image: url, url: 'https://random.dog/', credit: 'random.dog' };
  }),

  source('randomFox', 'RandomFox', 'Animals', async ({ json }) => {
    const fox = await json('https://randomfox.ca/floof/');
    if (!fox.image) fail('No fox');
    return { title: 'A fox', subject: 'Red fox', image: fox.image, url: fox.link, credit: 'randomfox.ca' };
  }),

  source('theCatApi', 'TheCatAPI', 'Animals', async ({ json }) => {
    const cat = (await json('https://api.thecatapi.com/v1/images/search?has_breeds=1'))[0];
    if (!cat?.url) fail('No cat');
    const breed = cat.breeds?.[0];
    return { title: breed?.name || 'A cat', subject: 'Cat breed', subtitle: join(breed?.origin, breed?.temperament),
      description: breed?.description, image: cat.url, url: breed?.wikipedia_url || 'https://thecatapi.com/', credit: 'TheCatAPI' };
  }),

  source('cataas', 'Cat as a Service', 'Animals', async ({ json }) => {
    const cat = await json('https://cataas.com/cat?json=true');
    const id = cat.id || cat._id;
    if (!id) fail('No cat');
    return { title: 'A cat', subject: cat.tags?.[0] || 'Cat', image: `https://cataas.com/cat/${id}`, url: `https://cataas.com/cat/${id}`, credit: 'Cataas' };
  }),

  source('catfacts', 'Cat Facts', 'Animals', async ({ json }) => {
    const data = await json('https://catfact.ninja/fact');
    if (!data.fact) fail('No fact');
    return { title: 'A fact about cats', subject: 'Cats', quote: data.fact, url: 'https://catfact.ninja/', credit: 'catfact.ninja' };
  }),

  source('meowfacts', 'Meow Facts', 'Animals', async ({ json }) => {
    const fact = (await json('https://meowfacts.herokuapp.com/')).data?.[0];
    if (!fact) fail('No fact');
    return { title: 'Meow fact', subject: 'Cats', quote: fact, url: 'https://github.com/wh-iterabb-it/meowfacts', credit: 'meowfacts' };
  }),

  source('dogFacts', 'Dog API', 'Animals', async ({ json }) => {
    const fact = (await json('https://dogapi.dog/api/v2/facts')).data?.[0]?.attributes?.body;
    if (!fact) fail('No fact');
    return { title: 'A fact about dogs', subject: 'Dogs', quote: fact, url: 'https://dogapi.dog/', credit: 'dogapi.dog' };
  }),

  source('dogBreeds', 'Dog API Breeds', 'Animals', async ({ json, random }) => {
    const breed = pickOne(random, (await json(`https://dogapi.dog/api/v2/breeds?page[number]=${1 + int(random, 29)}`)).data)?.attributes;
    if (!breed?.name) fail('No breed');
    return { title: breed.name, subject: 'Dog breed', description: breed.description,
      subtitle: join(breed.life && `Lives ${breed.life.min}–${breed.life.max} years`, breed.hypoallergenic && 'Hypoallergenic'),
      url: 'https://dogapi.dog/', credit: 'dogapi.dog' };
  }),

  source('obis', 'OBIS', 'Ocean', async ({ json, random }) => {
    const taxa = await once('obis', async () => (await json('https://api.obis.org/v3/checklist?size=500&taxonomicstatus=accepted&rank=species')).results);
    const taxon = pickOne(random, taxa);
    if (!taxon?.scientificName) fail('No species');
    return { title: taxon.scientificName, subject: taxon.class || taxon.phylum || 'Marine life',
      subtitle: join(taxon.family, taxon.order), description: `Recorded ${taxon.records.toLocaleString('en-US')} times in the world's ocean biodiversity database.`,
      url: `https://obis.org/taxon/${taxon.taxonID}`, credit: 'OBIS · CC BY 4.0' };
  }),

  source('inatPlants', 'iNaturalist', 'Plants', async ({ json, random }) => {
    const taxon = (await json(`https://api.inaturalist.org/v1/taxa?iconic_taxa=Plantae&rank=species&photos=true&is_active=true&per_page=1&page=${1 + int(random, 9999)}`)).results?.[0];
    if (!taxon?.default_photo?.medium_url) fail('No plant');
    return { title: taxon.preferred_common_name || taxon.name, subject: 'Plant', subtitle: taxon.name,
      description: `Observed ${taxon.observations_count.toLocaleString('en-US')} times on iNaturalist.`,
      image: taxon.default_photo.medium_url, thumb: taxon.default_photo.square_url, url: `https://www.inaturalist.org/taxa/${taxon.id}`,
      credit: text(taxon.default_photo.attribution) };
  }),
];

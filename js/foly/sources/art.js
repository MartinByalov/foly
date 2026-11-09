import { source, int, pickOne, join, once, text, fail, randomDate, isoDay } from './util.js';

const TERMS = ['flower', 'horse', 'gold', 'ship', 'mask', 'bird', 'moon', 'tea', 'dragon', 'portrait',
  'landscape', 'lion', 'vase', 'garden', 'music', 'river', 'cat', 'sun', 'tree', 'armor', 'map', 'clock', 'shell', 'dance'];

export default [
  source('met', 'The Met', 'Art', async ({ json, random }) => {
    const term = pickOne(random, TERMS);
    const search = await once(`met:${term}`, () => json(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?hasImages=true&q=${term}`));
    for (let attempt = 0; attempt < 3 && search.objectIDs?.length; attempt++) {
      const record = await json(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${pickOne(random, search.objectIDs)}`);
      if (!record.isPublicDomain || !record.primaryImageSmall || !record.title) continue;
      return { title: record.title, subject: record.classification || record.objectName || term,
        subtitle: join(record.artistDisplayName, record.objectDate), description: join(record.medium, record.culture),
        image: record.primaryImageSmall, url: record.objectURL, credit: 'The Metropolitan Museum of Art · CC0' };
    }
    fail('No public-domain object');
  }),

  source('artic', 'Art Institute of Chicago', 'Art', async ({ json, random }) => {
    const params = new URLSearchParams({ 'query[term][is_public_domain]': 'true', limit: '10', page: String(1 + int(random, 100)),
      fields: 'id,title,image_id,artist_display,date_display,medium_display,artwork_type_title' });
    const work = pickOne(random, (await json(`https://api.artic.edu/api/v1/artworks/search?${params}`)).data?.filter(r => r.image_id && r.title));
    if (!work) fail('No artwork');
    const iiif = `https://www.artic.edu/iiif/2/${encodeURIComponent(work.image_id)}/full`;
    return { title: work.title, subject: work.artwork_type_title || 'Artwork', subtitle: work.date_display,
      description: join(work.artist_display, work.medium_display), image: `${iiif}/843,/0/default.jpg`, thumb: `${iiif}/200,/0/default.jpg`,
      url: `https://www.artic.edu/artworks/${work.id}`, credit: 'Art Institute of Chicago · CC0' };
  }),

  source('cleveland', 'Cleveland Museum of Art', 'Art', async ({ json, random }) => {
    const work = (await json(`https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&limit=1&skip=${int(random, 30000)}`)).data?.[0];
    if (!work?.images?.web?.url || !work.title) fail('No artwork');
    return { title: work.title, subject: work.type || 'Artwork', subtitle: join(work.creators?.[0]?.description, work.creation_date),
      description: text(work.wall_description || work.description || work.tombstone), image: work.images.web.url,
      url: work.url, credit: 'Cleveland Museum of Art · CC0' };
  }),

  source('smk', 'SMK – National Gallery of Denmark', 'Art', async ({ json, random }) => {
    const data = await json(`https://api.smk.dk/api/v1/art/search/?keys=*&offset=${int(random, 20000)}&rows=1&filters=[has_image:true],[public_domain:true]&lang=en`);
    const work = data.items?.[0];
    if (!work?.image_thumbnail) fail('No artwork');
    return { title: work.titles?.[0]?.title || 'Untitled', subject: work.object_names?.[0]?.name || 'Artwork',
      subtitle: join(work.production?.[0]?.creator, work.production_date?.[0]?.period),
      image: work.image_thumbnail,
      description: join(work.techniques, work.materials),
      url: `https://open.smk.dk/artwork/image/${encodeURIComponent(work.object_number)}`, credit: 'SMK – Statens Museum for Kunst · Public domain' };
  }),

  source('vam', 'V&A', 'Design', async ({ json, random }) => {
    const term = pickOne(random, TERMS);
    const data = await json(`https://api.vam.ac.uk/v2/objects/search?q=${term}&images_exist=1&page_size=20&page=${1 + int(random, 10)}`);
    const work = pickOne(random, data.records?.filter(r => r._images?._iiif_image_base_url));
    if (!work) fail('No object');
    const base = work._images._iiif_image_base_url;
    return { title: work._primaryTitle || work.objectType, subject: work.objectType || 'Object',
      subtitle: join(work._primaryMaker?.name, work._primaryDate, work._primaryPlace), image: `${base}full/!800,800/0/default.jpg`,
      thumb: `${base}full/!200,200/0/default.jpg`, url: `https://collections.vam.ac.uk/item/${work.systemNumber}`, credit: '© Victoria and Albert Museum, London' };
  }),

  source('wellcome', 'Wellcome Collection', 'Medicine', async ({ json, random }) => {
    const term = pickOne(random, ['anatomy', 'botany', 'pharmacy', 'surgery', 'microscope', 'skeleton', 'herbal', 'astrology', 'hospital', 'teeth', 'brain', 'heart']);
    const data = await json(`https://api.wellcomecollection.org/catalogue/v2/images?query=${term}&pageSize=30&locations.license=cc0,pdm,cc-by`);
    const image = pickOne(random, data.results?.filter(r => r.thumbnail?.url && r.source?.title));
    if (!image) fail('No image');
    const iiif = image.thumbnail.url.replace(/\/info\.json$/, '');
    return { title: image.source.title, subject: term, image: `${iiif}/full/!800,800/0/default.jpg`, thumb: `${iiif}/full/!200,200/0/default.jpg`,
      url: `https://wellcomecollection.org/works/${image.source.id}`, credit: `Wellcome Collection · ${image.locations?.[0]?.license?.label || ''}` };
  }),

  source('internetArchive', 'Internet Archive', 'Photography', async ({ json, random }) => {
    const q = encodeURIComponent('collection:flickrcommons');
    const data = await json(`https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier&fl[]=title&fl[]=date&fl[]=description&rows=1&page=${1 + int(random, 830)}&output=json`);
    const doc = data.response?.docs?.[0];
    if (!doc?.identifier) fail('No item');
    return { title: doc.title || doc.identifier, subject: 'Flickr Commons', subtitle: doc.date?.slice(0, 10), description: text([].concat(doc.description ?? '')[0]),
      image: `https://archive.org/services/img/${doc.identifier}`, url: `https://archive.org/details/${doc.identifier}`, credit: 'Internet Archive · No known copyright restrictions' };
  }),

  source('commonsPotd', 'Wikimedia Commons', 'Photography', async ({ json, random }) => {
    const day = randomDate(random, new Date(Date.UTC(2016, 0, 1)));
    const image = (await json(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${isoDay(day)}`)).image;
    if (!image?.image?.source) fail('No picture');
    return { title: text(image.description?.text) || image.title.replace(/^File:|\.\w+$/g, ''), subject: 'Picture of the Day',
      subtitle: text(image.artist?.text), image: image.thumbnail?.source || image.image.source, thumb: image.thumbnail?.source,
      url: image.file_page, credit: join(text(image.artist?.text), image.license?.type) };
  }),

  source('picsum', 'Lorem Picsum', 'Photography', async ({ json, random }) => {
    const photo = (await json(`https://picsum.photos/v2/list?page=${1 + int(random, 990)}&limit=1`))[0];
    if (!photo?.id) fail('No photo');
    return { title: `Photograph by ${photo.author}`, subject: 'Unsplash', image: `https://picsum.photos/id/${photo.id}/1000/700`,
      thumb: `https://picsum.photos/id/${photo.id}/200/200`, description: `${photo.width} × ${photo.height}`, url: photo.url, credit: `${photo.author} · Unsplash License` };
  }),
];

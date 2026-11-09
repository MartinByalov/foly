import { source, int, pickOne, pad, join, once, text, fail, randomDate } from './util.js';

export default [
  source('apod', 'NASA APOD', 'Space', async ({ json, random }) => {
    const day = randomDate(random, new Date(Date.UTC(1995, 5, 20)));
    const code = `${String(day.getUTCFullYear()).slice(-2)}${pad(day.getUTCMonth() + 1)}${pad(day.getUTCDate())}`;
    const data = await json(`https://science.nasa.gov/wp-json/wp/v2/apod-basic/${code}`);
    const entry = Array.isArray(data) ? data[0] : data;
    if (!entry?.title) fail('No picture');
    const image = entry.media_type === 'image' && !entry.copyright ? entry.hdurl : null;
    return { title: entry.title, subject: 'Astronomy Picture of the Day', subtitle: entry.date,
      description: text(entry.explanation).replace(/^Explanation:\s*/, ''), image, thumb: image && `${image.split('?')[0]}?w=200`,
      url: `https://apod.nasa.gov/apod/ap${code}.html`, credit: image ? 'NASA · Public domain' : text(entry.credit || entry.copyright) };
  }),

  source('nasaImages', 'NASA Image Library', 'Space', async ({ json, random }) => {
    const term = pickOne(random, ['nebula', 'mars', 'apollo', 'saturn', 'galaxy', 'astronaut', 'jupiter', 'earth', 'moon', 'hubble', 'rocket', 'aurora', 'comet', 'shuttle']);
    const data = await json(`https://images-api.nasa.gov/search?media_type=image&page_size=50&page=${1 + int(random, 3)}&q=${term}`);
    const hit = pickOne(random, data.collection?.items?.filter(i => i.links?.[0]?.href && i.data?.[0]?.title));
    if (!hit) fail('No image');
    const meta = hit.data[0];
    return { title: meta.title, subject: term, subtitle: join(meta.center, meta.date_created?.slice(0, 10)),
      description: text(meta.description), image: hit.links[0].href,
      url: `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id)}`, credit: meta.secondary_creator || 'NASA' };
  }),

  source('epic', 'NASA EPIC', 'Space', async ({ json, random }) => {
    const dates = await once('epic:dates', () => json('https://epic.gsfc.nasa.gov/api/natural/all'));
    const date = pickOne(random, dates)?.date;
    if (!date) fail('No date');
    const shot = pickOne(random, await json(`https://epic.gsfc.nasa.gov/api/natural/date/${date}`));
    if (!shot?.image) fail('No image');
    const path = `https://epic.gsfc.nasa.gov/archive/natural/${date.replaceAll('-', '/')}`;
    return { title: 'The whole Earth, seen from a million miles away', subject: 'DSCOVR', subtitle: shot.date,
      description: shot.caption, image: `${path}/jpg/${shot.image}.jpg`, thumb: `${path}/thumbs/${shot.image}.jpg`,
      url: 'https://epic.gsfc.nasa.gov/', credit: 'NASA EPIC Team · Public domain' };
  }),

  source('spaceflightNews', 'Spaceflight News', 'Space', async ({ json, random }) => {
    const article = (await json(`https://api.spaceflightnewsapi.net/v4/articles/?limit=1&offset=${int(random, 9000)}`)).results?.[0];
    if (!article?.title) fail('No article');
    return { title: article.title, subject: article.news_site, subtitle: article.published_at?.slice(0, 10),
      description: article.summary, image: article.image_url, url: article.url, credit: article.news_site };
  }),

  source('launchLibrary', 'Launch Library 2', 'Space', async ({ json, random }) => {
    const launch = (await json(`https://ll.thespacedevs.com/2.2.0/launch/?limit=1&offset=${int(random, 7000)}&mode=list`)).results?.[0];
    if (!launch?.name) fail('No launch');
    return { title: launch.name, subject: 'Rocket launch', subtitle: join(launch.net?.slice(0, 10), launch.status?.name),
      description: join(launch.location, launch.pad), image: launch.image,
      url: `https://thespacedevs.com/launch/${launch.id}`, credit: 'The Space Devs' };
  }),

  source('iss', 'Where the ISS at?', 'Space', async ({ json }) => {
    const iss = await json('https://api.wheretheiss.at/v1/satellites/25544');
    if (!Number.isFinite(iss.latitude)) fail('No position');
    return { title: 'The International Space Station, right now', subject: 'Live position',
      subtitle: `${iss.latitude.toFixed(2)}°, ${iss.longitude.toFixed(2)}°`,
      description: `Flying ${Math.round(iss.altitude)} km above Earth at ${Math.round(iss.velocity).toLocaleString('en-US')} km/h, currently in ${iss.visibility}.`,
      url: `https://www.openstreetmap.org/?mlat=${iss.latitude}&mlon=${iss.longitude}#map=4/${iss.latitude}/${iss.longitude}`, credit: 'wheretheiss.at' };
  }),

  source('swpc', 'NOAA Space Weather', 'Space', async ({ json }) => {
    const latest = (await json('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json')).at(-1);
    if (!latest) fail('No reading');
    const kp = latest.estimated_kp ?? latest.kp_index;
    const mood = kp >= 5 ? 'a geomagnetic storm: auroras may reach far from the poles' : kp >= 4 ? 'unsettled; auroras are likely at high latitudes' : 'quiet';
    return { title: `Planetary K-index ${kp.toFixed(1)}`, subject: 'Geomagnetic activity', subtitle: latest.time_tag,
      description: `Earth's magnetic field is ${mood}.`, url: 'https://www.swpc.noaa.gov/products/planetary-k-index', credit: 'NOAA SWPC · Public domain' };
  }),

  source('nobel', 'Nobel Prize API', 'History', async ({ json, random }) => {
    const prize = (await json(`https://api.nobelprize.org/2.1/nobelPrizes?limit=1&offset=${int(random, 640)}`)).nobelPrizes?.[0];
    const laureate = pickOne(random, prize?.laureates);
    if (!laureate) fail('No laureate');
    return { title: laureate.knownName?.en || laureate.orgName?.en, subject: prize.category?.en, subtitle: `Nobel Prize ${prize.awardYear}`,
      description: laureate.motivation?.en && `“${laureate.motivation.en}”`, url: `https://www.nobelprize.org/prizes/${{ 'Physiology or Medicine': 'medicine', 'Economic Sciences': 'economic-sciences' }[prize.category?.en] || prize.category?.en?.toLowerCase()}/${prize.awardYear}/summary/`,
      credit: 'Nobel Prize Outreach · CC0' };
  }),
];

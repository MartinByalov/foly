import { source, int, pickOne, join, once, fail } from './util.js';

const WEATHER = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'rime fog', 51: 'light drizzle',
  53: 'drizzle', 55: 'dense drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow',
  77: 'snow grains', 80: 'rain showers', 81: 'rain showers', 82: 'violent rain showers', 85: 'snow showers', 86: 'heavy snow showers',
  95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with heavy hail' };

// A random populated place anywhere in the world, via Open-Meteo's geocoder.
async function randomPlace(json, random) {
  const prefix = pickOne(random, ['san', 'new', 'por', 'bel', 'mar', 'ber', 'kar', 'sal', 'mon', 'tor', 'lan', 'val', 'pal', 'bar',
    'cha', 'kan', 'man', 'sha', 'tan', 'ala', 'ros', 'lim', 'nag', 'osa', 'kum', 'dan', 'cam', 'har', 'bra', 'gra', 'vil', 'hel']);
  const place = pickOne(random, (await json(`https://geocoding-api.open-meteo.com/v1/search?name=${prefix}&count=50&language=en`)).results
    ?.filter(r => r.population > 20000));
  return place || fail('No place');
}

export default [
  source('usgs', 'USGS Earthquakes', 'Earth', async ({ json, random }) => {
    const feed = await json('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
    const quake = pickOne(random, feed.features?.filter(f => Number.isFinite(f.properties?.mag)));
    if (!quake) fail('No earthquake');
    const { mag, place, time, url } = quake.properties;
    return { title: `M ${mag.toFixed(1)} · ${place || 'Unknown location'}`, subject: 'Earthquake', subtitle: new Date(time).toUTCString(),
      description: `Recorded ${quake.geometry.coordinates[2].toFixed(0)} km below the surface, one of the quakes of the past seven days.`,
      url, credit: 'USGS · Public domain' };
  }),

  source('eonet', 'NASA EONET', 'Earth', async ({ json, random }) => {
    const event = pickOne(random, (await json('https://eonet.gsfc.nasa.gov/api/v3/events?limit=100&days=365')).events);
    if (!event?.title) fail('No event');
    const last = event.geometry?.at(-1);
    return { title: event.title, subject: event.categories?.[0]?.title || 'Natural event', subtitle: last?.date?.slice(0, 10),
      description: join(event.closed ? 'Ended' : 'Ongoing', last?.magnitudeValue && `${last.magnitudeValue} ${last.magnitudeUnit}`),
      url: event.sources?.[0]?.url || event.link, credit: 'NASA Earth Observatory Natural Event Tracker' };
  }),

  source('openMeteo', 'Open-Meteo', 'Weather', async ({ json, random }) => {
    const place = await randomPlace(json, random);
    const now = (await json(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto`)).current;
    if (!now) fail('No weather');
    return { title: `${Math.round(now.temperature_2m)}°C and ${WEATHER[now.weather_code] || 'changing'} in ${place.name}`,
      subject: 'Weather right now', subtitle: join(place.admin1, place.country),
      description: `Wind ${Math.round(now.wind_speed_10m)} km/h. It is ${now.is_day ? 'day' : 'night'} there at ${now.time.slice(11)} local time.`,
      url: `https://open-meteo.com/en/docs#latitude=${place.latitude}&longitude=${place.longitude}`, credit: 'Weather data by Open-Meteo.com · CC BY 4.0' };
  }),

  source('airQuality', 'Open-Meteo Air Quality', 'Weather', async ({ json, random }) => {
    const place = await randomPlace(json, random);
    const now = (await json(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.latitude}&longitude=${place.longitude}&current=european_aqi,pm2_5,uv_index`)).current;
    if (now?.european_aqi == null) fail('No reading');
    const aqi = now.european_aqi;
    const word = aqi <= 20 ? 'good' : aqi <= 40 ? 'fair' : aqi <= 60 ? 'moderate' : aqi <= 80 ? 'poor' : 'very poor';
    return { title: `The air in ${place.name} is ${word}`, subject: 'Air quality', subtitle: join(place.admin1, place.country),
      description: join(`European AQI ${aqi}`, now.pm2_5 != null && `PM2.5 ${now.pm2_5} µg/m³`, now.uv_index != null && `UV index ${now.uv_index}`),
      url: 'https://open-meteo.com/en/docs/air-quality-api', credit: 'Open-Meteo.com · CC BY 4.0' };
  }),

  source('nwsAlerts', 'US National Weather Service', 'Weather', async ({ json, random }) => {
    const alert = pickOne(random, (await json('https://api.weather.gov/alerts/active?status=actual&message_type=alert')).features)?.properties;
    if (!alert?.headline) fail('No alert');
    return { title: alert.event, subject: 'Weather alert', subtitle: alert.headline, description: alert.areaDesc,
      url: 'https://alerts.weather.gov/', credit: 'NOAA National Weather Service · Public domain' };
  }),

  source('carbonIntensity', 'Carbon Intensity API', 'Energy', async ({ json }) => {
    const data = (await json('https://api.carbonintensity.org.uk/generation')).data;
    const mix = data?.generationmix?.filter(f => f.perc > 0).sort((a, b) => b.perc - a.perc);
    if (!mix?.length) fail('No mix');
    return { title: `Right now, Great Britain runs mostly on ${mix[0].fuel}`, subject: 'Electricity mix',
      description: mix.slice(0, 5).map(f => `${f.fuel} ${f.perc.toFixed(0)}%`).join(' · '),
      url: 'https://carbonintensity.org.uk/', credit: 'National Energy System Operator · CC BY 4.0' };
  }),

  source('worldBank', 'World Bank', 'Geography', async ({ json, random }) => {
    const countries = await once('worldbank', async () => (await json('https://api.worldbank.org/v2/country?format=json&per_page=400'))[1]
      .filter(c => c.region?.value !== 'Aggregates' && c.capitalCity));
    const country = pickOne(random, countries);
    if (!country) fail('No country');
    let population = null;
    try { population = (await json(`https://api.worldbank.org/v2/country/${country.id}/indicator/SP.POP.TOTL?format=json&mrnev=1`))[1]?.[0]; }
    catch { /* The country is still worth showing. */ }
    return { title: country.name, subject: country.region.value, subtitle: `Capital: ${country.capitalCity}`,
      description: join(country.incomeLevel?.value, population?.value && `${population.value.toLocaleString('en-US')} people (${population.date})`),
      image: `https://flagcdn.com/w640/${country.iso2Code.toLowerCase()}.png`, thumb: `https://flagcdn.com/w160/${country.iso2Code.toLowerCase()}.png`,
      url: `https://data.worldbank.org/country/${country.iso2Code}`, credit: 'World Bank · CC BY 4.0' };
  }),

  source('nager', 'Nager.Date', 'Culture', async ({ json, random }) => {
    const holiday = pickOne(random, await json('https://date.nager.at/api/v3/NextPublicHolidaysWorldwide'));
    if (!holiday?.name) fail('No holiday');
    return { title: holiday.name, subject: 'Public holiday', subtitle: `${holiday.date} · ${holiday.countryCode}`,
      description: holiday.localName !== holiday.name ? `Known locally as “${holiday.localName}”.` : 'A public holiday coming up soon.',
      image: `https://flagcdn.com/w640/${holiday.countryCode.toLowerCase()}.png`, thumb: `https://flagcdn.com/w160/${holiday.countryCode.toLowerCase()}.png`,
      url: `https://date.nager.at/PublicHoliday/Country/${holiday.countryCode}`, credit: 'Nager.Date' };
  }),

  source('citybikes', 'CityBikes', 'Transport', async ({ json, random }) => {
    const networks = await once('citybikes', async () => (await json('https://api.citybik.es/v2/networks?fields=name,location,company,href')).networks);
    const network = pickOne(random, networks);
    if (!network?.name) fail('No network');
    return { title: network.name, subject: 'Bike sharing', subtitle: join(network.location?.city, network.location?.country),
      description: join([].concat(network.company ?? [])), url: `https://citybik.es/#${network.href?.split('/').pop()}`, credit: 'CityBikes' };
  }),

  source('tfl', 'Transport for London', 'Transport', async ({ json, random }) => {
    const line = pickOne(random, await json('https://api.tfl.gov.uk/Line/Mode/tube,overground,dlr,elizabeth-line/Status'));
    const status = line?.lineStatuses?.[0];
    if (!status) fail('No line');
    return { title: `${line.name}: ${status.statusSeverityDescription}`, subject: 'London transport', subtitle: 'Live status',
      description: status.reason || `Trains on the ${line.name} line are running with ${status.statusSeverityDescription.toLowerCase()}.`,
      url: `https://tfl.gov.uk/tube/route/${line.id}/`, credit: 'Powered by TfL Open Data' };
  }),
];

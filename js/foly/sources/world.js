import { source, int, pickOne, join, once, text, fail } from './util.js';

export default [
  source('flagpedia', 'Flagpedia', 'Flags', async ({ json, random }) => {
    const codes = Object.entries(await once('flags', () => json('https://flagcdn.com/en/codes.json'))).filter(([code]) => !code.includes('-'));
    const [code, name] = pickOne(random, codes) || [];
    if (!code) fail('No flag');
    return { title: name, subject: 'Flag', image: `https://flagcdn.com/w640/${code}.png`, thumb: `https://flagcdn.com/w160/${code}.png`,
      description: `The flag of ${name}.`, url: `https://flagpedia.net/${code}`, credit: 'Flagpedia.net · Public domain' };
  }),

  source('postcodes', 'Postcodes.io', 'Places', async ({ json }) => {
    const place = (await json('https://api.postcodes.io/random/postcodes')).result;
    if (!place?.postcode) fail('No postcode');
    return { title: place.postcode, subject: 'UK postcode', subtitle: join(place.admin_ward, place.admin_district, place.country),
      description: join(place.parliamentary_constituency && `Constituency: ${place.parliamentary_constituency}`, place.region),
      url: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=15/${place.latitude}/${place.longitude}`, credit: 'Postcodes.io · OGL' };
  }),

  source('zippopotam', 'Zippopotam.us', 'Places', async ({ json, random }) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const zip = String(int(random, 99950) + 1).padStart(5, '0');
      try {
        const data = await json(`https://api.zippopotam.us/us/${zip}`);
        const place = data.places?.[0];
        if (place) return { title: `${place['place name']}, ${place['state abbreviation']}`, subject: 'US ZIP code', subtitle: zip,
          description: `A place in ${place.state}, at ${place.latitude}°, ${place.longitude}°.`,
          url: `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=12/${place.latitude}/${place.longitude}`, credit: 'Zippopotam.us' };
      } catch { /* Not every number is a ZIP code. */ }
    }
    fail('No ZIP');
  }),

  source('sunriseSunset', 'Sunrise Sunset', 'Sky', async ({ json, random }) => {
    const lat = -60 + int(random, 125), lng = -180 + int(random, 360);
    const data = (await json(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`)).results;
    if (!data?.day_length && data?.day_length !== 0) fail('No data');
    const hours = Math.floor(data.day_length / 3600), minutes = Math.round(data.day_length % 3600 / 60);
    return { title: `${hours} h ${minutes} min of daylight at ${lat}°, ${lng}°`, subject: 'Day length', subtitle: 'Today',
      description: `Sunrise ${data.sunrise.slice(11, 16)} UTC, sunset ${data.sunset.slice(11, 16)} UTC.`,
      url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=4/${lat}/${lng}`, credit: 'SunriseSunset.org' };
  }),

  source('noaaTides', 'NOAA Tides & Currents', 'Ocean', async ({ json, random }) => {
    const station = pickOne(random, [['9414290', 'San Francisco'], ['8518750', 'The Battery, New York'], ['8443970', 'Boston'], ['9447130', 'Seattle'],
      ['8724580', 'Key West'], ['1612340', 'Honolulu'], ['9410170', 'San Diego'], ['8658120', 'Wilmington'], ['8771450', 'Galveston'], ['9455920', 'Anchorage']]);
    const reading = (await json(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?date=latest&station=${station[0]}&product=water_level&datum=MLLW&units=metric&time_zone=gmt&format=json`)).data?.[0];
    if (!reading) fail('No reading');
    return { title: `The sea at ${station[1]} is ${Number(reading.v).toFixed(2)} m above low water`, subject: 'Tide',
      subtitle: `${reading.t} UTC`, description: 'Measured just now by a NOAA tide gauge.', url: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${station[0]}`, credit: 'NOAA · Public domain' };
  }),

  source('usgsWater', 'USGS Water Data', 'Rivers', async ({ json, random }) => {
    const site = pickOne(random, ['09380000', '07010000', '01646500', '03612600', '14105700', '06934500', '08313000', '11447650', '05587450', '12472800']);
    const series = (await json(`https://waterservices.usgs.gov/nwis/iv/?format=json&sites=${site}&parameterCd=00060&siteStatus=active`)).value?.timeSeries?.[0];
    const value = series?.values?.[0]?.value?.at(-1);
    if (!value) fail('No reading');
    const cms = Number(value.value) * 0.0283168;
    return { title: `${series.sourceInfo.siteName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}`, subject: 'River flow',
      subtitle: value.dateTime.slice(0, 16).replace('T', ' '), description: `${Math.round(cms).toLocaleString('en-US')} cubic metres of water pass every second.`,
      url: `https://waterdata.usgs.gov/monitoring-location/${site}/`, credit: 'USGS · Public domain' };
  }),

  source('swissTransport', 'Swiss public transport', 'Transport', async ({ json, random }) => {
    const station = pickOne(random, ['Zürich HB', 'Bern', 'Genève', 'Luzern', 'Interlaken Ost', 'Zermatt', 'Lugano', 'Basel SBB', 'St. Moritz', 'Grindelwald']);
    const departure = pickOne(random, (await json(`https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(station)}&limit=10`)).stationboard);
    if (!departure?.to) fail('No departure');
    return { title: `${departure.category}${departure.number ?? ''} from ${station} to ${departure.to}`, subject: 'Next departure',
      subtitle: departure.stop?.departure?.slice(11, 16), description: join(departure.operator, departure.stop?.platform && `platform ${departure.stop.platform}`),
      url: 'https://www.sbb.ch/en', credit: 'transport.opendata.ch' };
  }),

  source('mbta', 'MBTA', 'Transport', async ({ json, random }) => {
    const vehicle = pickOne(random, (await json('https://api-v3.mbta.com/vehicles?filter[route_type]=0,1,2&include=route')).data);
    if (!vehicle) fail('No vehicle');
    const a = vehicle.attributes;
    return { title: `Boston ${vehicle.relationships?.route?.data?.id} train ${a.label}`, subject: 'Live vehicle',
      subtitle: a.current_status?.replace(/_/g, ' ').toLowerCase(), description: `At ${a.latitude.toFixed(4)}°, ${a.longitude.toFixed(4)}°${a.speed ? `, ${Math.round(a.speed * 3.6)} km/h` : ''}.`,
      url: `https://www.mbta.com/schedules/${vehicle.relationships?.route?.data?.id}`, credit: 'MBTA' };
  }),

  source('openLigaDb', 'OpenLigaDB', 'Sport', async ({ json, random }) => {
    const year = new Date().getMonth() >= 6 ? new Date().getFullYear() : new Date().getFullYear() - 1;
    const team = pickOne(random, await json(`https://api.openligadb.de/getbltable/bl1/${year}`));
    if (!team?.teamName) fail('No team');
    return { title: team.teamName, subject: 'Bundesliga', subtitle: `${team.points} points`, description: `${team.won} won, ${team.draw} drawn, ${team.lost} lost this season.`,
      image: team.teamIconUrl?.replace(/^http:/, 'https:'), url: 'https://www.openligadb.de/', credit: 'OpenLigaDB' };
  }),

  source('coinpaprika', 'CoinPaprika', 'Finance', async ({ json, random }) => {
    const coin = pickOne(random, (await once('paprika', () => json('https://api.coinpaprika.com/v1/coins'))).filter(c => c.is_active && c.rank > 0 && c.rank < 500));
    if (!coin) fail('No coin');
    return { title: coin.name, subject: 'Cryptocurrency', subtitle: join(coin.symbol, `rank ${coin.rank}`), description: `A ${coin.type} listed on CoinPaprika.`,
      url: `https://coinpaprika.com/coin/${coin.id}/`, credit: 'CoinPaprika' };
  }),

  source('erApi', 'ExchangeRate-API', 'Finance', async ({ json, random }) => {
    const data = await json('https://open.er-api.com/v6/latest/USD');
    const code = pickOne(random, Object.keys(data.rates || {}).filter(c => c !== 'USD'));
    if (!code) fail('No rate');
    return { title: `1 US dollar = ${data.rates[code]} ${code}`, subject: 'Exchange rate', subtitle: data.time_last_update_utc?.slice(0, 16),
      description: 'Updated once a day.', url: 'https://www.exchangerate-api.com', credit: 'Rates by Exchange Rate API' };
  }),

  source('mempool', 'mempool.space', 'Finance', async ({ json }) => {
    const block = (await json('https://mempool.space/api/v1/blocks'))[0];
    if (!block?.height) fail('No block');
    return { title: `Bitcoin block ${block.height.toLocaleString('en-US')}`, subject: 'Latest block',
      subtitle: new Date(block.timestamp * 1000).toUTCString(), description: `${block.tx_count.toLocaleString('en-US')} transactions, ${(block.size / 1e6).toFixed(2)} MB${block.extras?.pool?.name ? `, mined by ${block.extras.pool.name}` : ''}.`,
      url: `https://mempool.space/block/${block.id}`, credit: 'mempool.space' };
  }),

  source('hebcal', 'Hebcal', 'Calendars', async ({ json, random }) => {
    const day = new Date(Date.now() - int(random, 365 * 200) * 864e5);
    const data = await json(`https://www.hebcal.com/converter?cfg=json&gy=${day.getUTCFullYear()}&gm=${day.getUTCMonth() + 1}&gd=${day.getUTCDate()}&g2h=1`);
    if (!data.hebrew) fail('No date');
    return { title: data.hebrew, subject: 'Hebrew calendar', subtitle: `${data.hd} ${data.hm} ${data.hy}`,
      description: `${day.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}${data.events?.length ? ` · ${data.events.join(', ')}` : ''}.`,
      url: 'https://www.hebcal.com/converter', credit: 'Hebcal · CC BY 4.0' };
  }),

  source('agify', 'Nationalize.io', 'Names', async ({ json, random }) => {
    const name = pickOne(random, ['Mila', 'Kenji', 'Aisha', 'Lars', 'Diego', 'Ivan', 'Priya', 'Chloé', 'Mateo', 'Yuki', 'Olu', 'Nadia', 'Emre', 'Freya', 'Tariq', 'Elena', 'Sione', 'Bao']);
    const data = await json(`https://api.nationalize.io/?name=${name}`);
    const top = data.country?.[0];
    if (!top) fail('No guess');
    const country = new Intl.DisplayNames(['en'], { type: 'region' }).of(top.country_id);
    return { title: `Someone named ${name} is most likely from ${country}`, subject: 'Name origin', subtitle: `${Math.round(top.probability * 100)}% likely`,
      image: `https://flagcdn.com/w640/${top.country_id.toLowerCase()}.png`, thumb: `https://flagcdn.com/w160/${top.country_id.toLowerCase()}.png`,
      description: `A guess from ${data.count?.toLocaleString('en-US')} people with that name.`, url: 'https://nationalize.io/', credit: 'Nationalize.io' };
  }),
];

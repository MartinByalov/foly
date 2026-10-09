async function json(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function collection() {
  const records = await json('./data/collection.json');
  if (!Array.isArray(records) || records.length !== 100 ||
      new Set(records.map(record => record.id)).size !== 100 ||
      records.some(record => !record.title?.trim() ||
        !/^https:\/\/images\.metmuseum\.org\//.test(record.image) ||
        !/^https:\/\/images\.metmuseum\.org\//.test(record.fullImage) ||
        !/^https:\/\/(www\.)?metmuseum\.org\//.test(record.url))) {
    throw new Error('Collection integrity check failed');
  }
  return records;
}

export function museum(record) {
  return { kind: 'image', image: record.image, fullImage: record.fullImage,
    title: record.title, detail: record.detail, source: 'The Met', url: record.url };
}

export function skyline() {
  return { kind: 'video', video: './media/skyline.webm', title: 'City skyline',
    detail: 'San Francisco at night, captured in a time lapse.',
    source: 'Wikimedia Commons',
    url: 'https://commons.wikimedia.org/wiki/File:City_skyline_(time_lapse).webm' };
}

export async function earthquake() {
  const data = await json('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
  const event = (data.features || []).filter(item => Number.isFinite(item.properties?.mag) &&
    /^https:\/\/earthquake\.usgs\.gov\//.test(item.properties?.url || ''))
    .sort((a, b) => b.properties.mag - a.properties.mag)[0];
  if (!event) throw new Error('No events');
  return {
    kind: 'text', headline: `M ${event.properties.mag.toFixed(1)}`,
    title: event.properties.place || 'Location unavailable',
    detail: 'Strongest event in the USGS past-day feed at the time of loading.',
    source: 'USGS', url: event.properties.url,
  };
}

export function moon(date) {
  const synodic = 2551443;
  const phase = (((date.getTime() / 1000 - 947182440) % synodic) + synodic) % synodic / synodic;
  const names = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous',
    'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  return {
    kind: 'text', headline: `${Math.round((1 - Math.cos(2 * Math.PI * phase)) * 50)}%`,
    title: names[Math.floor(phase * 8 + 0.5) % 8],
    detail: 'Approximate lunar illumination, calculated locally.',
    source: 'Foly',
  };
}

export function load(format, date, fallback) {
  if (format.source === 'usgs') return earthquake().catch(() => museum(fallback));
  if (format.source === 'local') return Promise.resolve(moon(date));
  if (format.source === 'video') return Promise.resolve(skyline());
  return Promise.resolve(museum(format.record));
}

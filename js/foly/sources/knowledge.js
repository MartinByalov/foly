import { source, int, pickOne, join, text, fail, randomDate, isoDay, https } from './util.js';

// Any Wikimedia wiki with the REST API can hand out a random page summary.
const wikiRandom = (id, name, category, host, subject, credit) => source(id, name, category, async ({ json }) => {
  const page = await json(`https://${host}/api/rest_v1/page/random/summary`);
  if (page.type !== 'standard' || !page.extract) fail('Not an article');
  // Only free images live on Commons; local uploads may be non-free.
  const free = page.thumbnail?.source?.includes('/wikipedia/commons/');
  return { title: page.title, subject: page.description || subject, description: page.extract,
    image: free ? (page.originalimage?.width <= 2000 ? page.originalimage.source : page.thumbnail.source) : null,
    thumb: free ? page.thumbnail.source : null, url: page.content_urls?.desktop?.page, credit };
});

const SUBJECTS = ['adventure', 'science', 'poetry', 'history', 'philosophy', 'travel', 'cooking', 'mystery', 'astronomy', 'art',
  'music', 'gardening', 'mythology', 'architecture', 'animals', 'inventions', 'oceans', 'mathematics', 'fairy tales', 'photography'];

export default [
  wikiRandom('wikipedia', 'Wikipedia', 'Encyclopedia', 'en.wikipedia.org', 'Article', 'Wikipedia contributors · CC BY-SA 4.0'),
  wikiRandom('wikivoyage', 'Wikivoyage', 'Travel', 'en.wikivoyage.org', 'Destination', 'Wikivoyage contributors · CC BY-SA 4.0'),
  wikiRandom('wikinews', 'Wikinews', 'News', 'en.wikinews.org', 'News story', 'Wikinews contributors · CC BY 2.5'),

  source('wiktionary', 'Wiktionary', 'Words', async ({ json }) => {
    const word = (await json('https://en.wiktionary.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=1&format=json&origin=*')).query?.random?.[0]?.title;
    if (!word) fail('No word');
    const entry = await json(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
    const sense = Object.values(entry).flat().find(part => part?.definitions?.some(d => text(d.definition)));
    if (!sense) fail('No definition');
    const definitions = sense.definitions.map(d => text(d.definition)).filter(Boolean).slice(0, 3);
    return { title: word, subject: `${sense.language} ${sense.partOfSpeech}`.toLowerCase(),
      description: definitions.map((d, i) => `${i + 1}. ${d}`).join('\n'),
      url: `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`, credit: 'Wiktionary contributors · CC BY-SA 4.0' };
  }),

  source('onThisDay', 'Wikipedia On This Day', 'History', async ({ json, random }) => {
    const day = randomDate(random, new Date(Date.UTC(2024, 0, 1)));
    const event = pickOne(random, (await json(`https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/events/${isoDay(day).slice(5)}`)).events);
    if (!event?.text) fail('No event');
    const page = event.pages?.[0];
    const free = page?.thumbnail?.source?.includes('/wikipedia/commons/');
    return { title: `${day.toLocaleString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}, ${event.year}`, subject: 'On this day',
      description: event.text, image: free ? page.thumbnail.source : null, url: page?.content_urls?.desktop?.page,
      credit: 'Wikipedia contributors · CC BY-SA 4.0' };
  }),

  source('featuredArticle', 'Wikipedia Featured Article', 'Encyclopedia', async ({ json, random }) => {
    const article = (await json(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${isoDay(randomDate(random, new Date(Date.UTC(2016, 0, 1))))}`)).tfa;
    if (!article?.extract) fail('No article');
    const free = article.thumbnail?.source?.includes('/wikipedia/commons/');
    return { title: article.normalizedtitle || article.title, subject: 'Featured article', subtitle: article.description,
      description: article.extract, image: free ? article.thumbnail.source : null, url: article.content_urls?.desktop?.page,
      credit: 'Wikipedia contributors · CC BY-SA 4.0' };
  }),

  source('muffinHistory', 'Today in History', 'History', async ({ json, random }) => {
    const day = randomDate(random, new Date(Date.UTC(2024, 0, 1)));
    const data = await json(`https://history.muffinlabs.com/date/${day.getUTCMonth() + 1}/${day.getUTCDate()}`);
    const kind = pickOne(random, ['Events', 'Births', 'Deaths']);
    const item = pickOne(random, data.data?.[kind]);
    if (!item?.text) fail('No entry');
    return { title: `${data.date}, ${item.year}`, subject: kind === 'Events' ? 'Event' : kind === 'Births' ? 'Born' : 'Died',
      description: text(item.text), url: item.links?.[0]?.link || data.url, credit: 'muffinlabs · Wikipedia' };
  }),

  source('openlibrary', 'Open Library', 'Books', async ({ json, random }) => {
    const subject = pickOne(random, SUBJECTS);
    const book = (await json(`https://openlibrary.org/search.json?subject=${encodeURIComponent(subject)}&fields=key,title,author_name,first_publish_year,cover_i&limit=1&offset=${int(random, 500)}`)).docs?.[0];
    if (!book?.title) fail('No book');
    let description = '';
    try {
      const work = await json(`https://openlibrary.org${book.key}.json`);
      description = text(typeof work.description === 'string' ? work.description : work.description?.value);
    } catch { /* The book is still a valid discovery without its blurb. */ }
    const cover = book.cover_i && `https://covers.openlibrary.org/b/id/${book.cover_i}`;
    return { title: book.title, subject, subtitle: join(book.author_name?.slice(0, 2), book.first_publish_year),
      description: description || `First published in ${book.first_publish_year || 'an unknown year'}.`,
      image: cover && `${cover}-L.jpg`, thumb: cover && `${cover}-M.jpg`, url: `https://openlibrary.org${book.key}`, credit: 'Open Library' };
  }),

  source('googleBooks', 'Google Books', 'Books', async ({ json, random }) => {
    const subject = pickOne(random, SUBJECTS);
    const book = (await json(`https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(subject)}&startIndex=${int(random, 200)}&maxResults=1&printType=books&langRestrict=en`)).items?.[0]?.volumeInfo;
    if (!book?.title) fail('No book');
    const cover = https(book.imageLinks?.thumbnail);
    return { title: book.title, subject, subtitle: join(book.authors?.slice(0, 2), book.publishedDate?.slice(0, 4)),
      description: text(book.description) || book.subtitle, image: cover?.replace('zoom=1', 'zoom=2'), thumb: cover,
      url: https(book.infoLink), credit: 'Google Books' };
  }),

  source('poetrydb', 'PoetryDB', 'Poetry', async ({ json }) => {
    const poem = (await json('https://poetrydb.org/random'))[0];
    if (!poem?.lines?.length) fail('No poem');
    return { title: poem.title, subject: poem.author, quote: poem.lines.slice(0, 12).join('\n') + (poem.lines.length > 12 ? '\n…' : ''),
      url: `https://poetrydb.org/title/${encodeURIComponent(poem.title)}`, credit: 'PoetryDB · Public domain' };
  }),

  source('freeDictionary', 'Free Dictionary API', 'Words', async ({ json, random }) => {
    const letters = 'abcdefghijklmnoprstuvw';
    const words = await json(`https://api.datamuse.com/words?sp=${letters[int(random, letters.length)]}${'?'.repeat(4 + int(random, 5))}&md=f&max=200`);
    const word = pickOne(random, words.filter(w => Number(w.tags?.find(t => t.startsWith('f:'))?.slice(2)) > 1))?.word;
    if (!word) fail('No word');
    const entry = (await json(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`))[0];
    const meaning = entry?.meanings?.[0];
    if (!meaning) fail('No definition');
    return { title: entry.word, subject: meaning.partOfSpeech, subtitle: entry.phonetic,
      description: meaning.definitions.slice(0, 3).map((d, i) => `${i + 1}. ${d.definition}`).join('\n'),
      url: entry.sourceUrls?.[0] || `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`, credit: 'Free Dictionary API · Wiktionary CC BY-SA' };
  }),

  source('datamuse', 'Datamuse', 'Words', async ({ json, random }) => {
    const seed = pickOne(random, ['moon', 'river', 'light', 'dream', 'stone', 'cloud', 'fire', 'night', 'song', 'heart', 'ocean', 'star', 'time', 'rain']);
    const kind = pickOne(random, [['rel_rhy', 'Words that rhyme with'], ['rel_trg', 'Words that go with'], ['ml', 'Words that mean something like']]);
    const words = (await json(`https://api.datamuse.com/words?${kind[0]}=${seed}&max=12`)).map(w => w.word);
    if (words.length < 3) fail('Too few words');
    return { title: `${kind[1]} “${seed}”`, subject: 'Word play', quote: words.join(', '), url: 'https://www.datamuse.com/api/', credit: 'Datamuse' };
  }),
];

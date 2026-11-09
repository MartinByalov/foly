import { source, int, pickOne, join, text, fail } from './util.js';

const quote = (id, name, url, read, link) => source(id, name, 'Quotes', async ({ json }) => {
  const { said, by, subject } = read(await json(url)) || {};
  if (!said) fail('No quote');
  return { title: by || 'Anonymous', subject: subject || 'Quote', quote: `“${text(said)}”`, url: link, credit: name };
});

export default [
  quote('dummyQuotes', 'DummyJSON Quotes', 'https://dummyjson.com/quotes/random', q => ({ said: q.quote, by: q.author }), 'https://dummyjson.com/docs/quotes'),
  quote('kanye', 'kanye.rest', 'https://api.kanye.rest/', q => ({ said: q.quote, by: 'Kanye West', subject: 'Kanye' }), 'https://kanye.rest/'),
  quote('officeQuotes', 'The Office Quotes', 'https://officeapi.akashrajpurohit.com/quote/random',
    q => ({ said: q.quote, by: q.character, subject: 'The Office' }), 'https://officeapi.akashrajpurohit.com/'),
  quote('animechan', 'AnimeChan', 'https://api.animechan.io/v1/quotes/random',
    q => ({ said: q.data?.content, by: q.data?.character?.name, subject: q.data?.anime?.name }), 'https://animechan.io/'),

  source('jokeapi', 'JokeAPI', 'Jokes', async ({ json }) => {
    const joke = await json('https://v2.jokeapi.dev/joke/Programming,Misc,Pun,Spooky,Christmas?safe-mode');
    if (joke.error) fail('No joke');
    return joke.type === 'twopart'
      ? { title: joke.setup, subject: joke.category, reveal: joke.delivery, url: 'https://jokeapi.dev/', credit: 'JokeAPI' }
      : { title: 'A joke', subject: joke.category, quote: joke.joke, url: 'https://jokeapi.dev/', credit: 'JokeAPI' };
  }),

  source('dadJoke', 'icanhazdadjoke', 'Jokes', async ({ json }) => {
    const joke = await json('https://icanhazdadjoke.com/');
    if (!joke.joke) fail('No joke');
    return { title: 'A dad joke', subject: 'Dad jokes', quote: joke.joke, url: `https://icanhazdadjoke.com/j/${joke.id}`, credit: 'icanhazdadjoke' };
  }),

  source('officialJoke', 'Official Joke API', 'Jokes', async ({ json }) => {
    const joke = await json('https://official-joke-api.appspot.com/random_joke');
    if (!joke.setup) fail('No joke');
    return { title: joke.setup, subject: joke.type, reveal: joke.punchline, url: 'https://official-joke-api.appspot.com/', credit: 'Official Joke API' };
  }),

  source('chuckNorris', 'chucknorris.io', 'Jokes', async ({ json, random }) => {
    const category = pickOne(random, ['animal', 'career', 'dev', 'food', 'history', 'money', 'movie', 'music', 'science', 'sport', 'travel']);
    const joke = await json(`https://api.chucknorris.io/jokes/random?category=${category}`);
    if (!joke.value) fail('No joke');
    return { title: 'Chuck Norris fact', subject: category, quote: joke.value, url: joke.url, credit: 'chucknorris.io' };
  }),

  source('uselessFacts', 'Useless Facts', 'Facts', async ({ json }) => {
    const fact = await json('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en');
    if (!fact.text) fail('No fact');
    return { title: 'A useless fact', subject: 'Trivia', quote: fact.text, url: fact.source_url || fact.permalink, credit: fact.source || 'uselessfacts.jsph.pl' };
  }),

  source('adviceslip', 'Advice Slip', 'Advice', async ({ json }) => {
    const slip = (await json(`https://api.adviceslip.com/advice?t=${Date.now()}`)).slip;
    if (!slip?.advice) fail('No advice');
    return { title: `Advice #${slip.id}`, subject: 'Life', quote: slip.advice, url: 'https://api.adviceslip.com/', credit: 'Advice Slip API' };
  }),

  source('opentdb', 'Open Trivia DB', 'Trivia', async ({ json }) => {
    const data = await json('https://opentdb.com/api.php?amount=1&encode=url3986');
    const q = data.results?.[0];
    if (data.response_code !== 0 || !q) fail('No question');
    const d = decodeURIComponent;
    return { title: d(q.question), subject: d(q.category).replace(/^(Entertainment|Science): /, ''), subtitle: d(q.difficulty),
      description: q.type === 'boolean' ? 'True or false?' : [q.correct_answer, ...q.incorrect_answers].map(d).sort().join('  ·  '),
      reveal: d(q.correct_answer), url: 'https://opentdb.com/', credit: 'Open Trivia DB · CC BY-SA 4.0' };
  }),

  source('triviaApi', 'The Trivia API', 'Trivia', async ({ json }) => {
    const q = (await json('https://the-trivia-api.com/v2/questions?limit=1'))[0];
    if (!q?.question?.text) fail('No question');
    return { title: q.question.text, subject: q.category.replace(/_/g, ' '), subtitle: q.difficulty,
      description: [q.correctAnswer, ...q.incorrectAnswers].sort().join('  ·  '), reveal: q.correctAnswer,
      url: 'https://the-trivia-api.com/', credit: 'The Trivia API · CC BY-NC 4.0' };
  }),

  source('riddles', 'Riddles API', 'Riddles', async ({ json }) => {
    const riddle = await json('https://riddles-api.vercel.app/random');
    if (!riddle.riddle) fail('No riddle');
    return { title: riddle.riddle, subject: 'Riddle', reveal: riddle.answer, url: 'https://riddles-api.vercel.app/', credit: 'Riddles API' };
  }),

  source('deckOfCards', 'Deck of Cards', 'Games', async ({ json }) => {
    const card = (await json('https://deckofcardsapi.com/api/deck/new/draw/?count=1')).cards?.[0];
    if (!card) fail('No card');
    const name = `${card.value.toLowerCase()} of ${card.suit.toLowerCase()}`.replace(/^\w/, c => c.toUpperCase());
    return { title: `You drew the ${name}`, subject: 'Playing card', image: card.images?.png || card.image,
      description: 'One card from a freshly shuffled deck.', url: 'https://deckofcardsapi.com/', credit: 'Deck of Cards API' };
  }),

  source('tarot', 'Tarot API', 'Games', async ({ json }) => {
    const card = (await json('https://tarotapi.dev/api/v1/cards/random?n=1')).cards?.[0];
    if (!card?.name) fail('No card');
    return { title: card.name, subject: `${card.type} arcana`, description: card.desc, reveal: card.meaning_up,
      url: 'https://tarotapi.dev/', credit: 'Tarot API · A. E. Waite (public domain)' };
  }),

  source('emojiHub', 'EmojiHub', 'Symbols', async ({ json }) => {
    const emoji = await json('https://emojihub.yurace.pro/api/random');
    if (!emoji.name || !emoji.unicode?.length) fail('No emoji');
    const char = emoji.unicode.map(code => String.fromCodePoint(parseInt(code.replace('U+', ''), 16))).join('');
    return { title: emoji.name.replace(/^\w/, c => c.toUpperCase()), subject: emoji.category, subtitle: emoji.unicode.join(' '),
      quote: char, url: `https://emojipedia.org/search?q=${encodeURIComponent(emoji.name)}`, credit: 'EmojiHub' };
  }),

  source('colorApi', 'The Color API', 'Colors', async ({ json, random }) => {
    const hex = int(random, 0xffffff).toString(16).padStart(6, '0');
    const color = await json(`https://www.thecolorapi.com/id?hex=${hex}`);
    if (!color.name?.value) fail('No color');
    return { title: color.name.value, subject: 'Color', subtitle: join(color.hex.value, color.rgb.value, color.hsl.value),
      description: color.name.exact_match_name ? 'An exact named color.' : `The closest named color is ${color.name.closest_named_hex}.`,
      image: `https://www.thecolorapi.com/id?format=svg&named=false&hex=${hex}`, url: `https://www.thecolorapi.com/id?format=html&hex=${hex}`, credit: 'The Color API' };
  }),
];

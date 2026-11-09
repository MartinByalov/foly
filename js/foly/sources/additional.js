import { source, pickOne, join, once, fail } from './util.js';
import { isSuitable } from '../safety.js';

export default [
  source('coffee', 'Sample APIs Coffee', 'Coffee', async ({ json, random }) => {
    const drinks = await once('coffee:hot', () => json('https://api.sampleapis.com/coffee/hot'));
    const drink = pickOne(random, drinks.filter(d => d.title && d.image && isSuitable(d)));
    if (!drink) fail('No coffee photo');
    return { title: drink.title, subject: 'Coffee', description: drink.description,
      subtitle: join(drink.ingredients), image: drink.image,
      url: 'https://sampleapis.com/api-list/coffee', credit: 'Sample APIs · Coffee' };
  }),
  source('amiibo', 'Amiibo', 'Collectibles', async ({ json, random }) => {
    const figures = await once('amiibo:figures', async () => (await json('https://www.amiiboapi.org/api/amiibo/?type=figure')).amiibo);
    // Restrict the upstream catalogue to these family-oriented game series.
    const series = new Set(['Super Mario', 'Animal Crossing', 'Kirby', 'Yoshi', 'Splatoon', 'Pikmin']);
    const figure = pickOne(random, figures.filter(f => series.has(f.gameSeries) && f.image && isSuitable({ title: f.name })));
    if (!figure) fail('No collectible photo');
    return { title: figure.name, subject: figure.gameSeries, subtitle: figure.amiiboSeries, image: figure.image,
      description: 'An amiibo figure from the Nintendo collection.', url: 'https://amiiboapi.org/', credit: 'AmiiboAPI · Nintendo' };
  }),
  source('potterBooks', 'PotterAPI Books', 'Fantasy Books', async ({ json, random }) => {
    const books = await once('potter:books', () => json('https://potterapi-fedeperin.vercel.app/en/books'));
    const book = pickOne(random, books.filter(b => b.title && b.cover && isSuitable(b)));
    if (!book) fail('No book cover');
    return { title: book.title, subject: 'Harry Potter', subtitle: join(book.releaseDate, `${book.pages} pages`),
      description: book.description, image: book.cover,
      url: 'https://github.com/fedeperin/potterapi', credit: 'PotterAPI · Book covers © their respective rights holders' };
  }),
];
import { source, int, pickOne, join, once, text, fail } from './util.js';

const STATUS = [100, 101, 200, 201, 202, 204, 206, 301, 302, 304, 307, 308, 400, 401, 402, 403, 404, 405, 406, 408, 409, 410, 411,
  413, 414, 416, 417, 418, 421, 422, 423, 425, 426, 429, 431, 444, 450, 451, 497, 498, 499, 500, 501, 502, 503, 504, 506, 507, 508, 509, 510, 511, 521, 522, 523, 525, 599];

export default [
  // Food & drink
  source('mealdb', 'TheMealDB', 'Food', async ({ json }) => {
    const meal = (await json('https://www.themealdb.com/api/json/v1/1/random.php')).meals?.[0];
    if (!meal?.strMeal) fail('No meal');
    return { title: meal.strMeal, subject: meal.strCategory, subtitle: meal.strArea && `${meal.strArea} cuisine`,
      description: meal.strInstructions?.slice(0, 600), image: meal.strMealThumb, thumb: `${meal.strMealThumb}/preview`,
      url: meal.strSource || `https://www.themealdb.com/meal/${meal.idMeal}`, credit: 'TheMealDB' };
  }),

  source('cocktaildb', 'TheCocktailDB', 'Drinks', async ({ json }) => {
    const drink = (await json('https://www.thecocktaildb.com/api/json/v1/1/random.php')).drinks?.[0];
    if (!drink?.strDrink) fail('No drink');
    const ingredients = Array.from({ length: 15 }, (_, i) => drink[`strIngredient${i + 1}`]).filter(Boolean);
    return { title: drink.strDrink, subject: drink.strCategory, subtitle: join(drink.strAlcoholic, drink.strGlass),
      description: join(ingredients) + (drink.strInstructions ? `\n${drink.strInstructions}` : ''), image: drink.strDrinkThumb,
      thumb: `${drink.strDrinkThumb}/preview`, url: `https://www.thecocktaildb.com/drink/${drink.idDrink}`, credit: 'TheCocktailDB' };
  }),

  source('foodish', 'Foodish', 'Food', async ({ json }) => {
    const { image } = await json('https://foodish-api.com/api/');
    const dish = image?.match(/images\/([^/]+)\//)?.[1];
    if (!dish) fail('No food');
    return { title: dish.replace(/^\w/, c => c.toUpperCase()), subject: 'Food photo', image, url: 'https://foodish-api.com/', credit: 'Foodish' };
  }),

  source('brewery', 'Open Brewery DB', 'Drinks', async ({ json }) => {
    const brewery = (await json('https://api.openbrewerydb.org/v1/breweries/random'))[0];
    if (!brewery?.name) fail('No brewery');
    return { title: brewery.name, subject: `${brewery.brewery_type} brewery`, subtitle: join(brewery.city, brewery.state_province, brewery.country),
      description: join(brewery.street, brewery.phone && `☎ ${brewery.phone}`), url: brewery.website_url || 'https://www.openbrewerydb.org/', credit: 'Open Brewery DB' };
  }),

  // Tech & internet
  source('github', 'GitHub', 'Code', async ({ json, random }) => {
    const year = 2010 + int(random, new Date().getFullYear() - 2010);
    const month = String(1 + int(random, 12)).padStart(2, '0');
    const repo = (await json(`https://api.github.com/search/repositories?q=stars:%3E2000+created:${year}-${month}&per_page=1&page=${1 + int(random, 30)}`)).items?.[0];
    if (!repo?.full_name) fail('No repository');
    return { title: repo.full_name, subject: repo.language || 'Repository', subtitle: `★ ${repo.stargazers_count.toLocaleString('en-US')}`,
      description: repo.description, image: repo.owner?.avatar_url, url: repo.html_url, credit: 'GitHub' };
  }),

  source('hackerNews', 'Hacker News', 'Tech', async ({ json, random }) => {
    const ids = await once('hn', () => json('https://hacker-news.firebaseio.com/v0/beststories.json'));
    const story = await json(`https://hacker-news.firebaseio.com/v0/item/${pickOne(random, ids)}.json`);
    if (!story?.title) fail('No story');
    return { title: story.title, subject: 'Best of Hacker News', subtitle: join(`${story.score} points`, `${story.descendants ?? 0} comments`),
      description: story.url ? `Shared from ${new URL(story.url).hostname.replace(/^www\./, '')}.` : text(story.text),
      url: story.url || `https://news.ycombinator.com/item?id=${story.id}`, credit: 'Hacker News' };
  }),

  source('stackExchange', 'Stack Exchange', 'Questions', async ({ json, random }) => {
    const site = pickOne(random, ['stackoverflow', 'english', 'physics', 'cooking', 'travel', 'scifi', 'history', 'astronomy', 'linguistics', 'gardening', 'diy', 'music']);
    const q = (await json(`https://api.stackexchange.com/2.3/questions?order=desc&sort=votes&site=${site}&pagesize=1&page=${1 + int(random, 50)}&filter=withbody`)).items?.[0];
    if (!q?.title) fail('No question');
    return { title: text(q.title), subject: site, subtitle: join(`${q.score} votes`, `${q.answer_count} answers`),
      description: text(q.body).slice(0, 600), url: q.link, credit: join(q.owner?.display_name, 'Stack Exchange · CC BY-SA') };
  }),

  source('npm', 'npm', 'Code', async ({ json, random }) => {
    const keyword = pickOne(random, ['color', 'date', 'game', 'audio', 'emoji', 'canvas', 'math', 'music', 'animation', 'map', 'parser', 'cli']);
    const pkg = (await json(`https://registry.npmjs.org/-/v1/search?text=keywords:${keyword}&size=1&from=${int(random, 200)}&popularity=1.0`)).objects?.[0]?.package;
    if (!pkg?.name) fail('No package');
    return { title: pkg.name, subject: keyword, subtitle: join(`v${pkg.version}`, pkg.publisher?.username), description: pkg.description,
      url: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`, credit: 'npm' };
  }),

  source('devto', 'DEV Community', 'Tech', async ({ json, random }) => {
    const article = (await json(`https://dev.to/api/articles?per_page=1&page=${1 + int(random, 300)}&top=365`))[0];
    if (!article?.title) fail('No article');
    return { title: article.title, subject: article.tag_list?.[0] || 'Article', subtitle: join(article.user?.name, article.readable_publish_date),
      description: article.description, image: article.cover_image || article.social_image, url: article.url, credit: article.user?.name };
  }),

  source('httpCat', 'HTTP Cats', 'Internet', async ({ random }) => {
    const code = pickOne(random, STATUS);
    return { title: `HTTP ${code}`, subject: 'Status code', image: `https://http.cat/${code}.jpg`, url: `https://http.cat/${code}`, credit: 'http.cat' };
  }),

  source('httpDog', 'HTTP Status Dogs', 'Internet', async ({ random }) => {
    const code = pickOne(random, STATUS.filter(c => ![421, 450, 497, 509, 510, 525].includes(c)));
    return { title: `HTTP ${code}`, subject: 'Status code', image: `https://http.dog/${code}.jpg`, url: `https://http.dog/${code}`, credit: 'http.dog' };
  }),

  source('robohash', 'RoboHash', 'Internet', async ({ random }) => {
    const name = Math.floor(random() * 1e9).toString(36);
    const set = pickOne(random, [['set1', 'robot'], ['set2', 'monster'], ['set3', 'robot head'], ['set4', 'kitten']]);
    return { title: `A ${set[1]} called “${name}”`, subject: 'Generated', image: `https://robohash.org/${name}.png?set=${set[0]}&size=400x400`,
      description: 'Every name always makes the same face.', url: `https://robohash.org/${name}?set=${set[0]}`, credit: 'RoboHash · CC BY 3.0' };
  }),

  source('dicebear', 'DiceBear', 'Internet', async ({ random }) => {
    const style = pickOne(random, ['adventurer', 'avataaars', 'big-smile', 'bottts', 'croodles', 'fun-emoji', 'lorelei', 'micah', 'notionists', 'open-peeps', 'personas', 'pixel-art', 'thumbs']);
    const seed = Math.floor(random() * 1e9).toString(36);
    return { title: `${style.replace(/-/g, ' ')} avatar`, subject: 'Generated', image: `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`,
      description: `Drawn from the seed “${seed}”.`, url: `https://www.dicebear.com/styles/${style}/`, credit: 'DiceBear' };
  }),

  // Money, sport
  source('coingecko', 'CoinGecko', 'Finance', async ({ json, random }) => {
    const coin = pickOne(random, await once('coins', () => json('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=250&page=1')));
    if (!coin?.name) fail('No coin');
    return { title: coin.name, subject: 'Cryptocurrency', subtitle: join(coin.symbol.toUpperCase(), `#${coin.market_cap_rank}`),
      description: `$${coin.current_price.toLocaleString('en-US', { maximumFractionDigits: 6 })}, ${coin.price_change_percentage_24h?.toFixed(1)}% in 24h.`,
      image: coin.image, url: `https://www.coingecko.com/en/coins/${coin.id}`, credit: 'CoinGecko' };
  }),

  source('frankfurter', 'Frankfurter', 'Finance', async ({ json, random }) => {
    const [rates, names] = await Promise.all([json('https://api.frankfurter.dev/v1/latest'), once('currencies', () => json('https://api.frankfurter.dev/v1/currencies'))]);
    const code = pickOne(random, Object.keys(rates.rates || {}));
    if (!code) fail('No rate');
    return { title: `1 euro = ${rates.rates[code]} ${code}`, subject: 'Exchange rate', subtitle: names[code],
      description: `European Central Bank reference rate for ${rates.date}.`, url: 'https://www.frankfurter.app/', credit: 'Frankfurter · ECB' };
  }),

  source('treasury', 'US Treasury Fiscal Data', 'Finance', async ({ json }) => {
    const debt = (await json('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1')).data?.[0];
    if (!debt) fail('No data');
    return { title: `$${Number(debt.tot_pub_debt_out_amt).toLocaleString('en-US', { maximumFractionDigits: 0 })}`, subject: 'US national debt',
      subtitle: debt.record_date, description: 'Total public debt outstanding, to the penny.', url: 'https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/', credit: 'US Treasury · Public domain' };
  }),

  source('sportsdb', 'TheSportsDB', 'Sport', async ({ json, random }) => {
    const league = pickOne(random, [4328, 4335, 4331, 4332, 4334, 4387, 4391, 4424, 4380, 4346, 4344, 4337]);
    const team = pickOne(random, (await json(`https://www.thesportsdb.com/api/v1/json/123/lookup_all_teams.php?id=${league}`)).teams);
    if (!team?.strTeam) fail('No team');
    return { title: team.strTeam, subject: team.strSport, subtitle: join(team.strLeague, team.intFormedYear && `founded ${team.intFormedYear}`),
      description: team.strDescriptionEN?.slice(0, 600), image: team.strBadge || team.strLogo, url: team.strWebsite ? `https://${team.strWebsite.replace(/^https?:\/\//, '')}` : 'https://www.thesportsdb.com/',
      credit: 'TheSportsDB' };
  }),

  source('formula1', 'Jolpica F1', 'Sport', async ({ json, random }) => {
    const driver = (await json(`https://api.jolpi.ca/ergast/f1/drivers.json?limit=1&offset=${int(random, 860)}`)).MRData?.DriverTable?.Drivers?.[0];
    if (!driver) fail('No driver');
    return { title: `${driver.givenName} ${driver.familyName}`, subject: 'Formula 1 driver', subtitle: join(driver.nationality, driver.dateOfBirth),
      description: driver.permanentNumber ? `Raced with number ${driver.permanentNumber}.` : 'Formula 1 driver.', url: driver.url, credit: 'Jolpica F1 · Ergast' };
  }),

  source('mlb', 'MLB Stats API', 'Sport', async ({ json, random }) => {
    const team = pickOne(random, (await once('mlb', () => json('https://statsapi.mlb.com/api/v1/teams?sportId=1'))).teams);
    if (!team?.name) fail('No team');
    return { title: team.name, subject: 'Baseball', subtitle: join(team.league?.name, team.division?.name),
      description: join(team.venue?.name && `Plays at ${team.venue.name}`, team.firstYearOfPlay && `since ${team.firstYearOfPlay}`),
      image: `https://www.mlbstatic.com/team-logos/${team.id}.svg`, url: `https://www.mlb.com/${team.teamName.toLowerCase().replace(/ /g, '')}`, credit: 'MLB Advanced Media' };
  }),
];

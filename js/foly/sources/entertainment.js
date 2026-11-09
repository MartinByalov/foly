import { source, int, pickOne, join, once, text, fail, https } from './util.js';

const cap = value => String(value ?? '').replace(/(^|[\s-])\w/g, letter => letter.toUpperCase());
const TERMS = ['love', 'night', 'summer', 'river', 'dream', 'blue', 'fire', 'city', 'ocean', 'home', 'light', 'rain', 'gold', 'road'];

export default [
  source('pokeapi', 'PokéAPI', 'Games', async ({ json, random }) => {
    const id = 1 + int(random, 1025);
    const [pokemon, species] = await Promise.all([json(`https://pokeapi.co/api/v2/pokemon/${id}`), json(`https://pokeapi.co/api/v2/pokemon-species/${id}`)]);
    const name = species.names?.find(n => n.language.name === 'en')?.name || pokemon.name;
    return { title: name, subject: species.genera?.find(g => g.language.name === 'en')?.genus || 'Pokémon',
      subtitle: join(`#${id}`, pokemon.types?.map(t => t.type.name).join(' / ')),
      description: text(species.flavor_text_entries?.filter(f => f.language.name === 'en').at(-1)?.flavor_text),
      image: pokemon.sprites?.other?.['official-artwork']?.front_default, thumb: pokemon.sprites?.front_default,
      url: `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(name)}_(Pok%C3%A9mon)`, credit: 'PokéAPI' };
  }),

  source('rickAndMorty', 'The Rick and Morty API', 'TV', async ({ json, random }) => {
    const c = await json(`https://rickandmortyapi.com/api/character/${1 + int(random, 826)}`);
    if (!c.name) fail('No character');
    return { title: c.name, subject: 'Rick and Morty', subtitle: join(c.species, c.status), description: `From ${c.origin?.name}, last seen at ${c.location?.name}.`,
      image: c.image, url: `https://rickandmorty.fandom.com/wiki/${encodeURIComponent(c.name.replace(/ /g, '_'))}`, credit: 'The Rick and Morty API' };
  }),

  source('swapi', 'SWAPI', 'Film', async ({ json, random }) => {
    const person = (await json(`https://www.swapi.tech/api/people/${1 + int(random, 82)}`)).result?.properties;
    if (!person?.name) fail('No character');
    return { title: person.name, subject: 'Star Wars', subtitle: join(person.birth_year !== 'unknown' && `Born ${person.birth_year}`, person.gender !== 'n/a' && person.gender),
      description: join(person.height !== 'unknown' && `${person.height} cm tall`, person.eye_color !== 'unknown' && `${person.eye_color} eyes`, person.hair_color !== 'n/a' && `${person.hair_color} hair`),
      url: `https://starwars.fandom.com/wiki/${encodeURIComponent(person.name.replace(/ /g, '_'))}`, credit: 'SWAPI' };
  }),

  source('harryPotter', 'HP-API', 'Film', async ({ json, random }) => {
    const people = await once('hp', () => json('https://hp-api.onrender.com/api/characters'));
    const c = pickOne(random, people.filter(p => p.image));
    if (!c) fail('No character');
    return { title: c.name, subject: 'Harry Potter', subtitle: join(c.house, c.species !== 'human' && c.species),
      description: join(c.ancestry, c.patronus && `Patronus: ${c.patronus}`, c.actor && `Played by ${c.actor}`),
      image: https(c.image), url: `https://harrypotter.fandom.com/wiki/${encodeURIComponent(c.name.replace(/ /g, '_'))}`, credit: 'HP-API' };
  }),

  source('ghibli', 'Studio Ghibli API', 'Film', async ({ json, random }) => {
    const film = pickOne(random, await once('ghibli', () => json('https://ghibliapi.vercel.app/films')));
    if (!film?.title) fail('No film');
    return { title: film.title, subject: 'Studio Ghibli', subtitle: join(film.original_title, film.release_date, `directed by ${film.director}`),
      description: film.description, image: film.image, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(film.title.replace(/ /g, '_'))}`, credit: 'Studio Ghibli API' };
  }),

  source('disney', 'Disney API', 'Film', async ({ json, random }) => {
    const c = (await json(`https://api.disneyapi.dev/character?page=${1 + int(random, 7400)}&pageSize=1`)).data;
    const character = Array.isArray(c) ? c[0] : c;
    if (!character?.name || !character.imageUrl) fail('No character');
    return { title: character.name, subject: 'Disney', description: join(character.films?.slice(0, 3), character.tvShows?.slice(0, 2)) || 'A Disney character.',
      image: character.imageUrl, url: character.sourceUrl, credit: 'Disney API · Disney Wiki' };
  }),

  source('digimon', 'Digi-API', 'Games', async ({ json, random }) => {
    const d = await json(`https://digi-api.com/api/v1/digimon/${1 + int(random, 1400)}`);
    if (!d.name) fail('No digimon');
    return { title: d.name, subject: 'Digimon', subtitle: join(d.levels?.map(l => l.level), d.types?.map(t => t.type)),
      description: d.descriptions?.find(x => x.language === 'en_us')?.description, image: d.images?.[0]?.href,
      url: `https://digimon.fandom.com/wiki/${encodeURIComponent(d.name)}`, credit: 'Digi-API' };
  }),

  source('yugioh', 'YGOPRODeck', 'Games', async ({ json }) => {
    const data = await json('https://db.ygoprodeck.com/api/v7/randomcard.php');
    const card = data.data?.[0] || data;
    if (!card?.name) fail('No card');
    return { title: card.name, subject: card.type, subtitle: join(card.race, card.attribute, card.atk != null && `ATK ${card.atk}`),
      description: card.desc, image: card.card_images?.[0]?.image_url, thumb: card.card_images?.[0]?.image_url_small,
      url: card.ygoprodeck_url, credit: 'YGOPRODeck' };
  }),

  source('scryfall', 'Scryfall', 'Games', async ({ json }) => {
    const card = await json('https://api.scryfall.com/cards/random');
    const face = card.image_uris ? card : card.card_faces?.[0];
    if (!card.name) fail('No card');
    return { title: card.name, subject: 'Magic: The Gathering', subtitle: join(card.type_line, card.set_name),
      description: face?.oracle_text, image: face?.image_uris?.normal, thumb: face?.image_uris?.small,
      url: card.scryfall_uri, credit: join(card.artist && `Illustrated by ${card.artist}`, '© Wizards of the Coast') };
  }),

  source('pokemonTcg', 'Pokémon TCG API', 'Games', async ({ json, random }) => {
    const card = (await json(`https://api.pokemontcg.io/v2/cards?pageSize=1&page=${1 + int(random, 18000)}&select=name,supertype,set,images,rarity,artist,flavorText`)).data?.[0];
    if (!card?.name) fail('No card');
    return { title: card.name, subject: 'Pokémon card', subtitle: join(card.set?.name, card.rarity), description: card.flavorText,
      image: card.images?.large, thumb: card.images?.small, url: 'https://pokemontcg.io/', credit: join(card.artist, 'Pokémon TCG API') };
  }),

  source('dnd', 'D&D 5e API', 'Games', async ({ json, random }) => {
    const list = await once('dnd', () => json('https://www.dnd5eapi.co/api/2014/monsters'));
    const ref = pickOne(random, list.results);
    const m = ref && await json(`https://www.dnd5eapi.co${ref.url}`);
    if (!m?.name) fail('No monster');
    return { title: m.name, subject: 'D&D monster', subtitle: join(m.size, m.type, m.alignment, `CR ${m.challenge_rating}`),
      description: join(`${m.hit_points} hit points`, m.languages && `speaks ${m.languages}`, m.special_abilities?.[0]?.desc),
      image: m.image && `https://www.dnd5eapi.co${m.image}`, url: `https://www.dndbeyond.com/monsters?filter-search=${encodeURIComponent(m.name)}`, credit: 'D&D 5e SRD · CC BY 4.0' };
  }),

  source('open5e', 'Open5e', 'Games', async ({ json, random }) => {
    const spell = (await json(`https://api.open5e.com/v1/spells/?limit=1&page=${1 + int(random, 1400)}`)).results?.[0];
    if (!spell?.name) fail('No spell');
    return { title: spell.name, subject: 'Spell', subtitle: join(spell.level, spell.school, spell.dnd_class),
      description: text(spell.desc).slice(0, 700), url: `https://open5e.com/spells/${spell.slug}`, credit: join(spell.document__title, 'Open5e') };
  }),

  source('valorant', 'Valorant API', 'Games', async ({ json, random }) => {
    const agent = pickOne(random, (await once('valorant', () => json('https://valorant-api.com/v1/agents?isPlayableCharacter=true'))).data);
    if (!agent?.displayName) fail('No agent');
    return { title: agent.displayName, subject: 'Valorant agent', subtitle: agent.role?.displayName, description: agent.description,
      image: agent.fullPortrait || agent.displayIcon, thumb: agent.displayIcon, url: 'https://playvalorant.com/agents/', credit: 'valorant-api.com · © Riot Games' };
  }),

  source('leagueChampions', 'League of Legends Data Dragon', 'Games', async ({ json, random }) => {
    const version = (await once('ddragon:v', () => json('https://ddragon.leagueoflegends.com/api/versions.json')))[0];
    const champions = Object.values((await once('ddragon', () => json(`https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`))).data);
    const c = pickOne(random, champions);
    if (!c) fail('No champion');
    return { title: c.name, subject: 'League of Legends', subtitle: join(cap(c.title), c.tags), description: c.blurb,
      image: `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${c.id}_0.jpg`, thumb: `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${c.image.full}`,
      url: `https://www.leagueoflegends.com/en-us/champions/${c.id.toLowerCase()}/`, credit: '© Riot Games' };
  }),

  source('zelda', 'Zelda API', 'Games', async ({ json, random }) => {
    const game = pickOne(random, (await once('zelda', () => json('https://zelda.fanapis.com/api/games?limit=100'))).data);
    if (!game?.name) fail('No game');
    return { title: game.name, subject: 'The Legend of Zelda', subtitle: join(game.developer, game.released_date), description: game.description,
      url: `https://zelda.fandom.com/wiki/${encodeURIComponent(game.name.replace(/ /g, '_'))}`, credit: 'Zelda API' };
  }),

  source('superhero', 'Superhero API', 'Comics', async ({ json, random }) => {
    const hero = pickOne(random, await once('heroes', () => json('https://akabab.github.io/superhero-api/api/all.json')));
    if (!hero?.name) fail('No hero');
    return { title: hero.name, subject: hero.biography?.publisher || 'Comics', subtitle: hero.biography?.fullName,
      description: join(hero.biography?.alignment, hero.appearance?.race !== 'null' && hero.appearance?.race, hero.work?.occupation !== '-' && hero.work?.occupation),
      image: hero.images?.lg, thumb: hero.images?.sm, url: `https://www.superherodb.com/search/?q=${encodeURIComponent(hero.name)}`, credit: 'Superhero API' };
  }),

  source('futurama', 'Sample APIs', 'TV', async ({ json, random }) => {
    const show = pickOne(random, [['futurama/characters', 'Futurama'], ['avatar/characters', 'Avatar: The Last Airbender']]);
    const c = pickOne(random, await once(`sample:${show[0]}`, () => json(`https://api.sampleapis.com/${show[0]}`)));
    const name = typeof c?.name === 'string' ? c.name : join(c?.name?.first, c?.name?.middle, c?.name?.last).replace(/ · /g, ' ');
    if (!name) fail('No character');
    return { title: name, subject: show[1], subtitle: join(c.species, c.occupation, c.affiliation), description: [].concat(c.sayings ?? c.description ?? [])[0],
      image: c.images?.main || c.image, url: 'https://sampleapis.com/', credit: 'Sample APIs' };
  }),

  source('tvmaze', 'TVmaze', 'TV', async ({ json, random }) => {
    const shows = await json(`https://api.tvmaze.com/shows?page=${int(random, 300)}`);
    const show = pickOne(random, shows.filter(s => s.image?.medium && s.summary));
    if (!show) fail('No show');
    return { title: show.name, subject: show.genres?.[0] || show.type, subtitle: join(show.premiered?.slice(0, 4), show.network?.name || show.webChannel?.name),
      description: text(show.summary), image: show.image.original, thumb: show.image.medium, url: show.url, credit: 'TVmaze · CC BY-SA 4.0' };
  }),

  source('kitsu', 'Kitsu', 'Anime', async ({ json, random }) => {
    const anime = (await json(`https://kitsu.io/api/edge/anime?page[limit]=1&page[offset]=${int(random, 15000)}&filter[ageRating]=G,PG`, { accept: 'application/vnd.api+json' })).data?.[0]?.attributes;
    if (!anime?.canonicalTitle) fail('No anime');
    return { title: anime.canonicalTitle, subject: anime.subtype, subtitle: join(anime.startDate?.slice(0, 4), anime.episodeCount && `${anime.episodeCount} episodes`),
      description: anime.synopsis, image: anime.posterImage?.large, thumb: anime.posterImage?.small,
      url: `https://kitsu.app/anime/${anime.slug}`, credit: 'Kitsu' };
  }),

  source('itunes', 'iTunes Search', 'Music', async ({ json, random }) => {
    const term = pickOne(random, TERMS);
    const album = pickOne(random, (await json(`https://itunes.apple.com/search?term=${term}&entity=album&limit=50`)).results
      ?.filter(a => a.collectionExplicitness !== 'explicit'));
    if (!album) fail('No album');
    return { title: album.collectionName, subject: album.primaryGenreName, subtitle: join(album.artistName, album.releaseDate?.slice(0, 4)),
      description: `${album.trackCount} tracks.`, image: album.artworkUrl100?.replace('100x100', '600x600'), thumb: album.artworkUrl100,
      url: album.collectionViewUrl, credit: 'Apple Music' };
  }),

  source('musicbrainz', 'MusicBrainz', 'Music', async ({ json, random }) => {
    const term = pickOne(random, TERMS);
    const group = (await json(`https://musicbrainz.org/ws/2/release-group?query=${term}%20AND%20primarytype:album&fmt=json&limit=1&offset=${int(random, 300)}`))['release-groups']?.[0];
    if (!group?.title) fail('No release');
    return { title: group.title, subject: group['primary-type'] || 'Release', subtitle: join(group['artist-credit']?.map(a => a.name), group['first-release-date']?.slice(0, 4)),
      description: join(group.tags?.slice(0, 4).map(t => t.name)) || 'An album in the MusicBrainz open music encyclopedia.',
      image: `https://coverartarchive.org/release-group/${group.id}/front-500`, thumb: `https://coverartarchive.org/release-group/${group.id}/front-250`,
      url: `https://musicbrainz.org/release-group/${group.id}`, credit: 'MusicBrainz · CC0' };
  }),

  source('radioBrowser', 'Radio Browser', 'Music', async ({ json }) => {
    const station = (await json('https://de1.api.radio-browser.info/json/stations/search?limit=1&order=random&hidebroken=true&has_extended_info=true'))[0];
    if (!station?.name) fail('No station');
    return { title: station.name.trim(), subject: 'Radio station', subtitle: join(station.state, station.country),
      description: join(station.tags?.split(',').slice(0, 5), station.language),
      url: station.homepage || `https://www.radio-browser.info/history/${station.stationuuid}`, credit: 'Radio Browser' };
  }),

  source('chessPuzzle', 'Chess.com', 'Games', async ({ json }) => {
    const puzzle = await json('https://api.chess.com/pub/puzzle/random');
    if (!puzzle.title) fail('No puzzle');
    return { title: puzzle.title, subject: 'Chess puzzle', description: 'Find the best move.', image: puzzle.image, url: puzzle.url, credit: 'Chess.com' };
  }),
];

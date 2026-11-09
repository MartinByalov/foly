// Diagnostic field mappings, never production permission or substitute discoveries.
export const MEDIA_CANDIDATES = [
  { id: 'met', endpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/objects/436535',
    field: 'primaryImage', media: data => data.isPublicDomain === true ? data.primaryImage : null },
  { id: 'cleveland', endpoint: 'https://openaccess-api.clevelandart.org/api/artworks/?cc0&has_image=1&limit=1',
    field: 'data[].images.web.url', media: data => data.data?.find(item => item.share_license_status === 'CC0')?.images?.web?.url },
  { id: 'artic', endpoint: 'https://api.artic.edu/api/v1/artworks/27992?fields=id,title,image_id,is_public_domain',
    field: 'data.image_id + IIIF', media: data => data.data?.is_public_domain === true && data.data.image_id ?
      `https://www.artic.edu/iiif/2/${encodeURIComponent(data.data.image_id)}/full/400,/0/default.jpg` : null },
  { id: 'apod', endpoint: 'https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=2024-01-01',
    field: 'hdurl || url', media: data => data.media_type === 'image' ? data.hdurl || data.url : null },
  { id: 'spacex', endpoint: 'https://api.spacexdata.com/v4/rockets',
    field: '[].flickr_images[]', media: data => Array.isArray(data) ? data.find(item => item.flickr_images?.length)?.flickr_images[0] : null },
  { id: 'inaturalist', endpoint: 'https://api.inaturalist.org/v1/observations?photos=true&photo_license=cc0,cc-by&quality_grade=research&per_page=1',
    field: 'results[].photos[].url', media: data => data.results?.flatMap(item => item.photos || [])
      .find(photo => ['cc0', 'cc-by'].includes(photo.license_code))?.url },
  { id: 'mealdb', endpoint: 'https://www.themealdb.com/api/json/v1/1/lookup.php?i=52772',
    field: 'meals[].strMealThumb', media: data => data.meals?.[0]?.strMealThumb },
  { id: 'dogCeo', endpoint: 'https://dog.ceo/api/breeds/image/random',
    field: 'message', media: data => data.status === 'success' ? data.message : null },
  { id: 'pokeapi', endpoint: 'https://pokeapi.co/api/v2/pokemon/1',
    field: 'sprites.front_default', media: data => data.sprites?.front_default },
  { id: 'rickAndMorty', endpoint: 'https://rickandmortyapi.com/api/character/1',
    field: 'image', media: data => data.image },
  { id: 'apodWordPress', registryId: 'apod', endpoint: 'https://science.nasa.gov/wp-json/wp/v2/apod-basic',
    field: '[].hdurl', media: data => Array.isArray(data) ? data.find(item => item.media_type === 'image')?.hdurl : null },
  { id: 'spacexLaunch', registryId: 'spacex', endpoint: 'https://api.spacexdata.com/v4/launches/latest',
    field: 'links.flickr.original[]', media: data => data.links?.flickr?.original?.[0] },
  { id: 'cocktaildb', endpoint: 'https://www.thecocktaildb.com/api/json/v1/1/lookup.php?i=11007',
    field: 'drinks[].strDrinkThumb', media: data => data.drinks?.[0]?.strDrinkThumb },
  { id: 'randomDuck', endpoint: 'https://random-d.uk/api/v2/random',
    field: 'url', media: data => data.url },
];

export function candidateMedia(candidate, data) {
  const value = candidate.media(data);
  if (typeof value !== 'string') throw Error('No ready HTTPS image');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw Error('No ready HTTPS image');
  return url.href;
}
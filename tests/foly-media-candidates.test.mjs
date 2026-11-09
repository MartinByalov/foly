import test from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_CANDIDATES, candidateMedia } from '../scripts/foly-media-candidates.mjs';
import { SOURCES } from '../js/foly/sources.js';

const image = 'https://images.test/photo.jpg';
const cases = {
  met: [{ isPublicDomain: true, primaryImage: image }],
  cleveland: [{ data: [{ share_license_status: 'CC0', images: { web: { url: image } } }] }],
  artic: [{ data: { is_public_domain: true, image_id: 'abc' } }, 'https://www.artic.edu/iiif/2/abc/full/400,/0/default.jpg'],
  apod: [{ media_type: 'image', hdurl: image, url: 'https://images.test/small.jpg' }],
  spacex: [[{ flickr_images: [image] }]],
  inaturalist: [{ results: [{ photos: [{ license_code: 'cc-by', url: image }] }] }],
  mealdb: [{ meals: [{ strMealThumb: image }] }],
  dogCeo: [{ status: 'success', message: image }],
  pokeapi: [{ sprites: { front_default: image } }],
  rickAndMorty: [{ image }],
  apodWordPress: [[{ media_type: 'image', hdurl: image }]],
  spacexLaunch: [{ links: { flickr: { original: [image] } } }],
  cocktaildb: [{ drinks: [{ strDrinkThumb: image }] }],
  randomDuck: [{ url: image }],
};

test('candidate mappings cover all ten requested providers once, without changing production admission', () => {
  const requested = ['met', 'cleveland', 'artic', 'apod', 'spacex', 'inaturalist', 'mealdb', 'dogCeo', 'pokeapi', 'rickAndMorty'];
  for (const id of requested) {
    assert.equal(MEDIA_CANDIDATES.filter(candidate => candidate.id === id).length, 1, id);
    if (id === 'spacex') {
      assert.equal(SOURCES.some(source => source.id === id), false, 'SpaceX is a diagnostic candidate, not a verified registry entry');
      continue;
    }
    assert.equal(SOURCES.filter(source => source.id === id).length, 1, id);
    assert.equal(SOURCES.find(source => source.id === id).enabled, ['met', 'cleveland', 'inaturalist'].includes(id), id);
  }
});

for (const candidate of MEDIA_CANDIDATES) {
  test(`${candidate.id} reads its documented image field and rejects empty responses`, () => {
    const [data, expected = image] = cases[candidate.id];
    assert.equal(candidateMedia(candidate, data), expected);
    assert.throws(() => candidateMedia(candidate, {}));
  });
}

test('candidate diagnostic rejects credentials, insecure and fabricated URLs', () => {
  for (const value of [null, '', 'http://images.test/a.jpg', 'data:image/svg+xml,test',
    'javascript:alert(1)', 'https://user:pass@images.test/a.jpg', { image }]) {
    assert.throws(() => candidateMedia({ media: () => value }, {}));
  }
});

test('restricted museum, unlicensed observation and video output are not mistaken for approved photos', () => {
  for (const [id, data] of [
    ['met', { primaryImage: image, isPublicDomain: false }],
    ['cleveland', { data: [{ share_license_status: 'copyright', images: { web: { url: image } } }] }],
    ['artic', { data: { image_id: 'abc', is_public_domain: false } }],
    ['inaturalist', { results: [{ photos: [{ license_code: 'cc-by-nc', url: image }] }] }],
    ['apod', { media_type: 'video', url: image }],
    ['dogCeo', { status: 'error', message: image }],
  ]) assert.throws(() => candidateMedia(MEDIA_CANDIDATES.find(candidate => candidate.id === id), data), id);
});
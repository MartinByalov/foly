# Foly

Static HTML/CSS/JavaScript. Run `python -m http.server 8000` from the project directory; open `http://localhost:8000/`. No backend or private API key. Test with `node --test tests/*.test.mjs`.

## Actual format-based homepage

The homepage creates the **100 core format cards**, not ninety unrelated museum objects. `js/registry.js` separates `SOURCE_REGISTRY`, `CORE_FORMATS` (100) and `FORMAT_REGISTRY` (118 including extensions). Cards retain their format titles; item titles appear within the content. Extras such as Moon Phase, Photography and Caption This remain extensions, not extra homepage cards. Not all derived extensions are implemented.

`js/adapters.js` implements:

- The 50 Wikidata knowledge formats: `data/knowledge-pools.json` contains four verified entity IDs per category (200 candidates). Ten small grouped `wbgetentities` requests fetch current labels, descriptions and Wikipedia sitelinks. This avoids the SPARQL endpoint that returned HTTP 403. Candidate rotation is curated; it is not a limitless random search. Rebuild with `node scripts/build-knowledge.mjs`.
- Wikipedia featured/on-this-day feeds, The Met Open Access, Cleveland, Open Trivia DB, USGS, NASA APOD metadata, NASA Image Library metadata, GBIF occurrence/species metadata and individually licensed imagery.
- Smithsonian: `data/smithsonian.json` is a small static snapshot from the official Open Access EDAN distribution, containing individually checked CC0 metadata/media. Rebuild with `node scripts/build-smithsonian.mjs`; this is not an automatic weekly update. Some category pools are small (one aircraft, two tools).
- Crop/reveal museum interactions. Crop cards zoom the image until reveal. Some interactions (e.g. Weapon or Decoration) currently reveal object metadata rather than offering a complete verified binary quiz. Do not present these as finished quiz systems.

The daily seed is visitor-local. API calls are lazy-loaded 650px ahead of the viewport with four simultaneous card tasks. Shared requests reuse promises. `foly:v2:YYYY-MM-DD:source:format` cache invalidates the earlier filler-card cache; successful content is cached until local midnight. Temporary failures are not cached for the entire day. On API failure, the card reports its source as temporarily unavailable; it does not substitute an unrelated artwork. Different browsers may get different results from rolling or random feeds before caching.

## Media and rights

Wikimedia media requires a separate Commons `imageinfo/extmetadata` license check; unknown or restricted images are not shown. GBIF images require a specific CC0/CC BY/CC BY-SA media license (not merely the occurrence license). NASA items currently show metadata and links, not automatically presumed NASA-owned images. The Met requires public domain objects. Smithsonian requires CC0 metadata and media. Cards show source links and supplied author credits, without a Details button or repeated license text. License and provenance metadata remain in items/code. This does not waive upstream attribution/license obligations; review compliance before commercial publication.

The background is now a static image using the original TODAY. Wix poster. The homepage contains no background video, MP4 source, autoplay or pause control, so video playback/decoding does not occur. Ownership or licensing of the poster still needs confirmation before commercial publication. Historical video profiling results below predate this change.

## Verification and limitations

## Performance revision

Measured with `node scripts/profile-page.mjs` in Edge headless at 1280×800. A six-second scroll retained a 16.8ms p95 frame interval, with no intervals over 50ms in the normal pass; pausing video did not improve the observed result. Sequential diagnostic passes warm progressively and are not controlled GPU/FPS benchmarks. The report is saved in the OS temporary directory. Measurement identified an unnecessary legacy Unsplash download (removed), large GBIF publisher images, and layout shifts. Known Met/iNaturalist image URLs now use thumbnail/medium variants, including cached items. Unknown publisher URLs are not rewritten speculatively; an observed 5184×3888 Laji image still requires a verified thumbnail service. API loading delays and visible layout shifts remain possible; no claim that user-device lag is fully resolved is made.

The requested Wix background is unchanged. Wikipedia image names and Commons license lookups are coalesced into small multi-title batches. Shared API responses have a separate size-capped daily cache (`foly:responses:v1`), avoiding repeated pool downloads after refreshing and visiting additional cards. Old daily entries are cleaned during idle time; failed shared requests have a 30-second cooldown rather than failing forever. Final items still use the existing cache and media checks.

Card shells are inserted with one DocumentFragment, observer lookups use a WeakMap, and result rendering is limited to two cards per animation frame. The 100-format drawer is constructed on first opening instead of startup. The countdown does not update in hidden tabs. All 100 core format cards remain; there is no replacement with filler data. These are targeted reductions in requests/DOM work, not a measured FPS improvement or proof of the original lag's cause.

Tests cover registries, the 100 actual format cards, the requested Wix markup, media checks, caching and concurrency. `node scripts/check-content.mjs` exercises representative live adapters. Live checks have encountered timeouts and HTTP 429, so adapters are not guaranteed to return data on every load. Verify CORS, autoplay and external media on the published GitHub Pages domain and on mobile; a Node fetch is not a browser CORS test. No complete visual browser verification is claimed.

Legacy `js/catalog.js`, `js/sources.js`, `data/collection.json` and their tests remain as migration reference, but the homepage no longer uses the ninety-object filler edition.

## Copy and backup coverage

Reveal interactions now suppress answer-bearing facts and author/source links before activation, including for older cached items. Crop cards cannot open the full-image dialog before revealing. Activation shows the answer and details, resets the crop, enables Explore and marks the button Revealed. Renderer-handler tests use a lightweight DOM test double; this is not a full browser visual/accessibility audit. Century answers correctly distinguish BCE and CE.

Category headings no longer repeat "of the Day". Item names and descriptions are separate blocks; descriptions preserve complete source sentences instead of truncating words. `data/knowledge-backup.json` contains source-attributed text backups for 44 categories. Dinosaur, volcano, moon, galaxy, asteroid and comet backups could not be retrieved because of HTTP 429. Running `node scripts/build-knowledge.mjs` resumes missing coverage; `--full-backup` requests all candidates. Cleveland is a secondary source for noninteractive Met cards. If all matching sources fail, a concise Retry state remains, never fabricated content. No guarantee of 100 successful results during upstream outages is implied.
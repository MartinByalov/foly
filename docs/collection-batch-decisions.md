# Ten-provider visual admission review

Reviewed on November 4, 2026. This review covers the ten-provider batch, not every
historical research lead. Admission requires acceptable item rights, working media,
browser delivery and a public, browseable source destination. Transport failure
does not establish licensing incompatibility. No unsuccessful adapter is retained.

| Provider | Decision | Evidence and failing gate |
| --- | --- | --- |
| Smithsonian Open Access | Not admitted: access and media delivery | Search with the documented `DEMO_KEY` returned HTTP 429 `OVER_RATE_LIMIT`. Object pages returned HTTP 403. The public IDS manifest returned HTTP 200, but its `Metadata Usage: CC0` is metadata permission, not image permission; its licence links to general terms. The sampled IDS IIIF image failed `Image.decode()` on desktop and mobile. Removed the disabled keyed adapter and its route. This is not a rejection of Smithsonian CC0 licensing. |
| National Gallery of Art | Existing dataset retained | Existing 30-object subset validates individual open-access flags, rights and official provenance. Live browser card decoded at 640 by 474 on desktop. It remains a dataset, not a new live API. |
| Harvard Art Museums | Not admitted: API terms | Official `api-docs` README limits API use to non-commercial use. Public IIIF object 299843 returned HTTP 200 but no explicit media licence; image availability alone cannot clear it. |
| Brooklyn Museum | Not admitted: access | OpenCollection API and advanced-search pages returned HTTP 500 HTML, including the legacy `collection.search` request. The current website API/copyright routes returned HTTP 429 security checkpoints. No usable response with bound image rights was obtained. No claim of licensing incompatibility. |
| Science Museum Group | Not admitted: access | Official API documentation and GitHub wiki confirm JSON negotiation at collection object/search URLs. Both documented JSON object co34119 and search returned CloudFront HTTP 403, including `Accept: application/json`. Official terms require checking `source.legal.rights.usage` per image; a blanket claim that all imagery is noncommercial would be incorrect. |
| NYPL Digital Collections | Not admitted: authenticated access | Legacy API notice states retirement on August 1, 2026. The current OpenAPI schema is accessible and documents `x-nypl-collections-api-key`; `/search` and `/shuffle` actually returned HTTP 403 `Not authenticated`. The old notice does not mean no current API exists. |
| Biodiversity Heritage Library | Not admitted: source-page access | An alternative without credentials works: OpenURL identifies page 469006 as belonging to item 7353, and OAI-PMH explicitly declares that item public domain. `/pageimage/469006` returned an image and decoded on desktop and mobile. However page, item and bibliography destinations all returned HTTP 403, and a real browser navigation displayed a security challenge rather than the item. OAI/OpenURL responses do not provide browser CORS. A raw XML endpoint or an image is not substituted for a browseable item destination. Removed the disabled keyed adapter and its route. This is not a licensing rejection or a claim that credentials are the only available access. |
| Europeana | Existing integration retained | Search requires `reusability=open` and `media=true`, followed by individual-record CC0, media binding and destination checks. Live desktop card rendered and decoded at 400 by 284. |
| Openverse | Existing integration retained | Existing pinned CC0 botanical record remains unchanged. Desktop adapter probe exceeded its eight-second request timeout; subsequent mobile check passed and rendered the image at 1024 by 645. It is not a new admission. |
| Pixabay | Not admitted: licence policy | Current Content License is not CC0 or Public Domain and restricts standalone redistribution. The terms distinguish legacy CC0 content, so this is not a claim that every historical Pixabay file has the current licence. No individually verified legacy CC0 API resource was established for this batch. |

## Official evidence

- Smithsonian: `https://api.si.edu/openaccess/api/v1.0/search`,
  `https://ids.si.edu/ids/manifest/CHSDM-09EB24AA74522-000001`,
  `https://github.com/Smithsonian/OpenAccess`
- NGA: `https://github.com/NationalGalleryOfArt/opendata`
- Harvard: `https://github.com/harvardartmuseums/api-docs/blob/master/README.md`
- Brooklyn: `https://opencollection.brooklynmuseum.org/api`
- Science Museum: `https://www.sciencemuseumgroup.org.uk/about-us/collection/using-our-collection-api/`,
  `https://github.com/TheScienceMuseum/collectionsonline/wiki/Collections-Online-API`
- NYPL: `https://api.repo.nypl.org/`, `https://api-collections.nypl.org/openapi.json`
- BHL: `https://www.biodiversitylibrary.org/oai?verb=GetRecord&metadataPrefix=oai_dc&identifier=oai:biodiversitylibrary.org:item/7353`,
  `https://www.biodiversitylibrary.org/openurl?genre=book&title=Botanical%20magazine&date=1800&format=json`
- Europeana: `https://pro.europeana.eu/page/search`
- Openverse: `https://api.openverse.org/v1/images/f7da45f0-db49-4d45-9854-56ea68add8f5/`
- Pixabay: `https://pixabay.com/service/terms/`, `https://pixabay.com/service/license-summary/`

## Validation boundary

After removal, the directory still contains 32 enabled non-dataset visual integrations
and five datasets, 37 total; no new provider passed all gates in this continuation.
The desktop preview rendered 35/37 cards on its first navigation and 36/37 on its
second; e-rara timed out and the first Met request found no admissible object.
These are recorded failures, not a clean full-directory health result.

The first cleanup unit run exposed two tests assuming the removed Smithsonian
registration. Those assertions were updated to match removal. After transient tool
execution failures, the final `node --test` completed: 315 passed, zero failed,
zero skipped. The mobile browser check passed all four selected integrations
(Europeana, Openverse, Natural Earth and NGA), including image decoding, card
rendering and layout. Full mobile preview navigation still showed the independent
e-rara timeout and an intermittent Met failure; neither is concealed as a pass.
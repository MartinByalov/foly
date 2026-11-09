# Multilingual random discovery

## Updated controls, credits and fallbacks

The language selector occupies the former Discoveries control. Cards show compact text and image attribution without explanatory presentation prose. English includes published Wikipedia Did You Know hooks, with a rights-checked, decoded image from the main linked article; other languages do not receive English hooks.

If selected Wikipedia modes are exhausted, discovery may only try adapters explicitly supporting the selected language. The returned discovery must declare that same language. The current visual adapters have no verified language contract and therefore remain preview-only. A failed opening retries automatically once without a connection-error banner or empty modal. If both attempts fail, the square remains unopened and can be clicked again. Image and rights validation remain mandatory.

Preview includes primary modes for its `lang` parameter, their categories, Commons verification and the visual API directory, labelled separately from language-compatible homepage fallbacks. Per-provider preview checks never substitute a different provider.

Implemented November 5, 2026. The homepage prefers illustrated Wikipedia discoveries
and permits fallback only to providers explicitly supporting the selected language. Every successful card
requires an image. The developer preview lists primary sources and the separate visual catalogue.
The Wikipedia additions are discovery modes, not five or six new API providers.

## Behaviour

- Homepage openings race at most two selected-language providers and accept the
  first fully validated result, with no artificial reveal delay. Each attempt
  has a six-second deadline and four-second per-request/image limits; failure
  retries once automatically. Outstanding API requests are aborted when an
  attempt finishes. No unselected category is added to the race. Commons metadata is cached
  in memory for five minutes (at most 100 entries per language source set and
  transport), while article draws remain fresh. Rights and image checks remain
  mandatory; exhausted attempts leave the square unopened rather than showing an unchecked card.

- About, Sources and Privacy use one locally authored information module for all
  fourteen languages. Sources links to the selected Wikipedia edition, Commons
  and the text licence rather than listing every discovery mode as a provider.
  Privacy distinguishes in-memory discoveries/translations, per-language tab
  sessionStorage filters and URL language state, and discloses MyMemory
  requests. Anonymous CORS is not described as anonymous browsing. Legacy trivia
  credits remain accessible through the preview card's `#about-trivia` link.

- Revealed-card translation splits text at sentence or word boundaries within
  480 UTF-8 bytes, preserving boundary whitespace. Requests are serialized and
  identical concurrent requests share their cached promise. Transient transport
  failures retry once; quota errors and invalid provider responses do not.
  A failed card translation never commits partially translated fields. Retry
  retains the last complete card until success, and stale language results cannot
  overwrite the latest selection. Machine translation is not a linguistic review.

- `?lang=en`, `?lang=bg`, `?lang=fr` and `?lang=hi` select English, Bulgarian,
  French and Hindi interface copy and the corresponding Wikipedia edition.
- Spanish (`es`), Portuguese (`pt`), German (`de`), Chinese (`zh`), Arabic (`ar`)
  and Russian (`ru`) also have local controls, information copy and native
  Wikipedia topic queries. The language menu shows full language names, while
  the closed control shows its code. Arabic cards use right-to-left text.
- Italian (`it`), Dutch (`nl`), Polish (`pl`) and Turkish (`tr`) have localized
  controls, information and translation notices, and fourteen native topic
  categories each. New discoveries request their own Wikipedia editions; only
  already revealed discoveries use machine translation when switching languages.
- Unsupported language values use English. Language selection updates the URL
  without reloading. Existing discoveries are machine-translated with MyMemory,
  from the header selector. Reopening a revealed square shows its translated
  content, not a replacement discovery. There is no selector inside the card.
  Images, source links and original rights evidence are retained. Translations
  are labelled, cached in memory and always derived from the original text.
  Failed translations retain the original text with a retry notice on the visible
  card. New discoveries use the newly selected Wikipedia edition. Refreshing
  still clears the collection. Translation sends card text and language codes
  directly to MyMemory and is subject to provider availability and quotas.
- Only already revealed discoveries are translated. A new square requests the
  selected edition with search first, then direct category membership when a
  topic search fails or yields no usable illustrated article. Category fallback
  uses at most two batches and follows its continuation token; image decoding,
  safety and rights checks remain mandatory. This is a second query strategy,
  not an independent provider during a Wikipedia outage. API `ratelimited`,
  `maxlag` and `readonly` responses trigger the same one-minute cooldown as HTTP
  429/503, without retrying through category membership.
  A new square requests the
  selected Wikipedia edition directly and never uses the translation client.
  If the language changes during an outstanding new-discovery request, that
  result is discarded and the square is requested again in the current language.
- Category menu rows contain names without provider counts. Cards repeat the
  heading divider below the image before the description.
- The background is a local 1280 × 720 WebP image extracted from the previously
  paused frame at 0.1 seconds. There is no background video request or playback
  code. Historical provenance is retained in `media/background-provenance.md`.
- API requests omit credentials. External images, including grid thumbnails,
  use anonymous CORS so cross-origin cookies are not required.
  Providers without usable CORS image delivery are rejected by image validation.
- Random articles use Action API `generator=random`, namespace zero, and plain
  introductory TextExtracts. Disambiguations, empty extracts, repeated page IDs and
  metadata rejected by the existing safety filter are excluded. Up to three
  batches are examined. The metadata filter is not comprehensive moderation.
- Science, History, Space, Nature, Art, Architecture, Music, Literature,
  Geography, Technology, Mathematics, Animals, Plants and Sport use
  native-language `deepcat` search terms.
  They sample ten hits from one of five offsets. These are category-search samples,
  not a uniform random distribution over every page in a subject. Broad category
  trees may include loosely related articles. After the selected modes fail,
  only providers explicitly supporting the selected language can be tried.
- On This Day is available for the verified English and French feed editions.
  It uses the visitor's current local month and day, not a random historical date.
  Bulgarian and Hindi retain their random and topic modes without falling back to
  an English event. The source destination is the event's calendar page rather
  than an incidental first linked article.
- All cards reveal on opening a square. This first version does not invent quiz
  questions or call ordinary article excerpts editorially reviewed trivia.
  English also uses published Did You Know hooks. Unsupported hook markup is
  skipped; other languages do not advertise or substitute English hooks.
- Per-page duplicate tracking is shared by the article modes. HTTP 429/503 starts
  a 60-second shared cooldown so other topics do not amplify rate limiting.

## Rights and presentation

Article queries check the edition's `rightsinfo` for CC BY-SA 4.0. Each discovery
keeps the article source, revision where supplied, history URL, licence and an
excerpt/change note. The renderer displays text attribution even when an image
is present. It uses text nodes, not provider HTML. Introductions can be shortened
to 900 characters and are not independently verified facts.

Images are mandatory. A Commons filename from the article is resolved to its own
`imageinfo` and `extmetadata`. Exact CC0/PDM or unported CC BY/CC BY-SA 2.0, 3.0
and 4.0 URLs are accepted with no declared restrictions. Attribution licences also
require an artist. The card preserves the image title, artist, attribution/credit
notices, exact licence and file source, separate from text attribution. Presentation
notes remain in the rights metadata rather than appearing as explanatory card prose.
Images are delivered directly and discoveries remain in page memory.
Unsupported rights, missing metadata and decoding failure skip that article.
All candidates in each of up to three article batches can be examined. Events try
up to eight entries and up to three linked article images per event. Exhaustion
tries only language-compatible providers. If none succeed, a connection notice
offers retry, never a text-only discovery or unrelated stock image.
The renderer also refuses facts without images. Later display errors remove the
card rather than leaving its text without an image. The pre-existing visual
pipeline's CC BY/CC BY-SA behaviour is unchanged.

Official references:

- `https://www.mediawiki.org/wiki/Extension:TextExtracts`
- `https://www.mediawiki.org/wiki/API:Random`
- `https://www.mediawiki.org/wiki/Help:CirrusSearch`
- `https://www.mediawiki.org/wiki/API:Imageinfo`
- `https://foundation.wikimedia.org/wiki/Terms_of_Use`
- `https://attribution.wikimedia.org/attribution-signals/license.html`

## Verification

Run from the repository root:

```powershell
node --test
node scripts/check-foly-facts-browser.mjs
```

The browser check uses the existing Edge/CDP approach with no added dependencies.
It checks actual homepage rendering with deterministic API fixtures for all four
languages at 1280px and 390px, category selection, article/source language,
attribution links, archive reopening, About content and horizontal overflow.
It also checks the English and Bulgarian preview catalogues and separately reports
real browser requests through the primary/fallback pipeline. Those live samples
are not proof that a particular Wikipedia edition is available: an independent
language-compatible provider may have supplied the discovery. Provider availability and rate limiting
can vary; live outcomes are reported separately from deterministic UI regression
success. No guarantee of AdSense approval or legal clearance is made.
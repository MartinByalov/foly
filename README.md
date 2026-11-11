<div align="center">

# FOLY.

**A little less scrolling. A little more wonder.**

100 000 boxes. No previews. Pick one.

■

**INTERACTIVE EXPERIENCE · RANDOM DISCOVERY · DIGITAL DESIGN**

</div>

---

## The internet, behind a square.

Foly turns browsing into a small act of curiosity.

A field of black squares replaces the familiar feed. Each looks the same. None tells you what comes next. Open one to discover a random Wikipedia article, a historical event or a published English Did You Know hook. If the selected Wikipedia modes fail, only providers with explicit support for the selected language are eligible for fallback. Every discovery includes a related image with checked rights and successful decoding. Articles without a usable image are skipped.

The choice is yours. The discovery is a surprise.

## Less interface. More possibility.

The design begins with a single mark: a white square.

Repeated across the page, it becomes an invitation. In motion, it signals anticipation. Replaced by an image, it becomes the trace of something found.

| Element | Intention |
| :--- | :--- |
| **Black & white** | A quiet frame that lets each discovery bring the colour. |
| **One square, one measure** | The grid sets the rhythm, from the header and footer to the logo and controls. |
| **Typography without decoration** | Clear labels, direct titles and space for the story. |
| **Motion with a purpose** | A turning outline while something loads. The discovery appears when it is ready. |
| **Images in their own proportions** | A white border follows the picture, rather than forcing it into a fixed crop. |

## Pick. Reveal. Explore.

**01 — Pick a square**
Start anywhere. There is no correct first choice.

**02 — Meet something unexpected**
A box opens into a focused card: an article title, a short excerpt and a route to the original source, history and licence.

**03 — Follow your curiosity**
Use Categories to narrow the possibilities, or leave everything open to chance. English, Bulgarian, French, Hindi, Spanish, Portuguese, German, Chinese, Arabic, Russian, Italian, Dutch, Polish and Turkish draw from their own Wikipedia editions, not translations of the same article. The language menu shows full names rather than unexplained codes.

**04 — Revisit what you found**
Opened squares retain their discoveries. Select an opened square to revisit its card. The language selector sits beside Categories; there is no separate Discoveries control.

## A collection for this moment.

Not everything needs to become a permanent archive.

Your discoveries stay with the open page. Close or refresh it, and the collection begins again. No account to create. No collection to maintain.

**CLEARED ON CLOSE.**

## Automated checks

**Foly automatic checks** runs the complete unit and regression suite on every push and pull request, or manually. It does not run the live provider smoke checks. Run the same suite locally with `node --test tests/*.test.mjs`.

**Foly provider health** checks external APIs, rights, images and browser behaviour separately. It runs once daily at 06:23 UTC, or manually from GitHub Actions. It sets `FOLY_HEALTH_ADVISORY=1`: failed provider observations (including outages, rate limits, certificate errors and rejected media) produce warnings, not a failed workflow. The results retain `ok: false` and do not approve those providers. Checker crashes, failed browser interactions, missing/empty/malformed reports and infrastructure failures still fail the workflow. Code regression tests remain strict and independent.

Each health run removes the previous source and browser reports before checking, then uploads newly generated reports in the `foly-health` artifact. The summary validates the reports and lists provider errors. Neither workflow publishes the site; GitHub Pages deployment remains separate. Local smoke checks remain strict unless you explicitly set `FOLY_HEALTH_ADVISORY=1`.

Node reports retain nested transport error messages and codes, including certificate failures. Display-only images are decoded without requesting canvas access through CORS and omit the referrer; API metadata still requires readable CORS responses. Certificate verification, image decoding and rights validation remain mandatory. A successful monitoring workflow means the checks completed, not that all providers passed; use the provider counts and errors in the summary for actual health.

## Many worlds. One visual language.

Science beside history. Nature beside astronomy. A random article beside an event from this day in history.

Foly brings different subjects into the same restrained presentation, while keeping a link back to where each discovery came from. The interface stays familiar; what appears inside it keeps changing. The developer preview lists the language-specific Wikipedia modes and the visual-provider catalogue. Visual providers without explicit support for the selected language are preview-only, not homepage fallbacks. The current visual adapters do not declare that support. If every provider fails, a connection notice offers retry without opening an empty card.

---

<div align="center">

**FOLY.**

*You do not have to know what you are looking for.*

■

</div>

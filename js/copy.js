export function plainText(text) {
  return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Prefer complete source sentences. Never display a cut-off fragment as though
// it were a complete extract, and do not append invented facts.
export function shortDescription(text, max = 360) {
  const clean = plainText(text).replace(/\p{L}/u, letter => letter.toLocaleUpperCase('en'));
  if (!clean) return '';
  if (clean.length <= max) return /[.!?]$/.test(clean) ? clean : `${clean}.`;
  const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
  let result = '';
  for (const sentence of sentences) {
    if ((result + sentence).trim().length > max) break;
    result += sentence;
  }
  // Preserve the first complete sentence if it exceeds the target length.
  return result.trim() || sentences[0]?.trim() || clean;
}

export function entitySentence(title, description) {
  const text = plainText(description);
  if (!text) return '';
  // Wikidata descriptions are noun phrases. A colon introduces the supplied
  // description without guessing articles or grammatical number.
  return shortDescription(`${title} is described as “${text.replace(/[.!?]$/, '')}”.`);
}
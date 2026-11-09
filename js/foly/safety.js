// Conservative metadata gate, NOT an image classifier or a complete moderation system.
const EXPLICIT = /\b(?:nsfw|porn(?:ography|ographic)?|hentai|xxx|nude|nudity|naked|erotic|erotica|sexual|sexually|fuck(?:ing|ed)?|motherfucker|bullshit|shit|bitch|cunt|cock|dick|penis|vagina|genitals|gore|beheading)\b|порно|нецензур|голи\s+тела|сексуа|шибан|путк|курва|ебан/iu;

export function isSuitable(raw) {
  if (!raw || raw.nsfw === true || raw.adult === true || raw.explicit === true || raw.safe === false) return false;
  return !EXPLICIT.test(['title', 'subject', 'subtitle', 'description', 'quote', 'reveal', 'credit']
    .map(key => String(raw[key] ?? '')).concat(Array.isArray(raw.options) ? raw.options : [],
      Array.isArray(raw.chart) ? raw.chart.map(row => row?.label) : []).join(' ').normalize('NFKC'));
}
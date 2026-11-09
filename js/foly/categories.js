export function categorySummary(sources) {
  return [...new Set(sources.map(source => source.category))].sort((a, b) => a.localeCompare(b)).map(name => ({
    name, registered: sources.filter(source => source.category === name).length,
    enabled: sources.filter(source => source.category === name && source.enabled).length,
  }));
}

export function matchesCategory(category, query) {
  const normalize = value => String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
  const name = normalize(category);
  return normalize(query).split(/\s+/).every(term => name.includes(term));
}
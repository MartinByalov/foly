export function centuryLabel(year) {
  if (!Number.isInteger(year) || year === 0) return null;
  const century = Math.ceil(Math.abs(year) / 100);
  const suffix = [11, 12, 13].includes(century % 100) ? 'th' :
    ({ 1: 'st', 2: 'nd', 3: 'rd' }[century % 10] || 'th');
  return `${century}${suffix} century${year < 0 ? ' BCE' : ''}`;
}

export function isReveal(item) {
  return ['reveal', 'caption', 'crop'].includes(item.interaction?.type) &&
    typeof item.interaction.answer === 'string' && !!item.interaction.answer.trim();
}
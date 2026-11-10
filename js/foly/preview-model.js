// Keep production integrations separate from historical, unapproved adapter candidates.
export function previewSources(primary, sources) {
  return [...primary, ...sources.filter(source => source.enabled).sort((a, b) => a.name.localeCompare(b.name))];
}

export function previewDirectory(sources) {
  const active = sources.filter(source => source.enabled).sort((a, b) => a.name.localeCompare(b.name));
  return {
    apis: active.filter(source => source.rightsPolicy?.kind !== 'dataset'),
    datasets: active.filter(source => source.rightsPolicy?.kind === 'dataset'),
  };
}

export function previewGroups(sources) {
  const sort = rows => [...rows].sort((a, b) => a.name.localeCompare(b.name));
  const active = sort(sources.filter(source => source.enabled));
  const inactive = sort(sources.filter(source => !source.enabled));
  const statuses = { unfinished: [], textOnly: [], superseded: [], blocked: [] };
  for (const source of inactive) statuses[inactiveStatus(source, active)].push(source);
  return { active, inactive, statuses };
}

const replacementFor = (source, active) => active.find(candidate => candidate.name === source.name ||
  candidate.id.toLowerCase() === `${source.id}Reviewed`.toLowerCase());

export function inactiveStatus(source, active) {
  if (source.rightsPolicy?.available === false) return 'blocked';
  if (replacementFor(source, active)) return 'superseded';
  if (source.visualCapable === false && source.rightsPolicy) return 'textOnly';
  if (!source.rightsPolicy) return 'unfinished';
  return 'blocked';
}

export function inactiveReason(source, active) {
  if (source.rightsPolicy?.reason) return source.rightsPolicy.reason;
  const replacement = replacementFor(source, active);
  if (replacement) return `Legacy adapter, replaced by the active ${replacement.name} integration (${replacement.id}) above.`;
  if (source.visualCapable === false && source.rightsPolicy) return 'Excluded from the visual draw. No reviewed provider-supplied image implementation is available; raw-data charts and text do not qualify.';
  if (!source.rightsPolicy) return 'Historical candidate: no implemented rights-validation policy. Not an available integration.';
  return 'Excluded from the production draw by adapter or content-safety rules.';
}

export async function runPreviewChecks(entries, { concurrency = 3, onProgress = () => {} } = {}) {
  let next = 0, complete = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (next < entries.length) {
      const entry = entries[next++];
      await entry.load();
      onProgress(++complete, entries.length);
    }
  }));
}
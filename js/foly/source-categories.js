import { fetchJson } from './resolver.js';

// Provider-native filters, not Foly's broad lottery labels or arbitrary search words.
export const NATIVE_CATEGORIES = {
  met: { kind: 'departments' },
  inaturalist: { options: ['Actinopterygii', 'Amphibia', 'Arachnida', 'Aves', 'Insecta', 'Mammalia',
    'Mollusca', 'Plantae', 'Reptilia', 'Fungi'].map(value => ({ value, label: value })) },
  physicallyBased: { kind: 'materials' },
};

export async function sourceCategories(source, { json = fetchJson } = {}) {
  const spec = NATIVE_CATEGORIES[source.id];
  if (!spec) return [{ value: '', label: 'No category filter' }];
  let options;
  if (spec.kind === 'departments') {
    const data = await json('https://collectionapi.metmuseum.org/public/collection/v1/departments');
    options = data.departments?.filter(row => Number.isSafeInteger(row.departmentId) && row.departmentId > 0 &&
      typeof row.displayName === 'string' && row.displayName.trim()).map(row => ({ value: String(row.departmentId), label: row.displayName }));
  } else if (spec.kind === 'materials') {
    const data = await json('https://api.physicallybased.info/v2/materials');
    if (data.header?.origin !== 'https://api.physicallybased.info/v2/materials' || data.header?.schemaVersion !== 2.2 ||
      data.header?.license !== 'CC0 1.0 Universal' || data.header?.deprecated !== false) throw Error('Unreviewed material categories');
    options = [...new Set((data.data || []).flatMap(row => Array.isArray(row.category) ? row.category : [])
      .filter(value => typeof value === 'string' && value.trim()))].sort().map(value => ({ value, label: value }));
  } else options = spec.options;
  if (!options?.length) throw Error('No supported provider categories');
  return [{ value: '', label: 'All categories' }, ...options];
}
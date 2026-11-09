import { rightsEvidence } from '../../js/foly/rights.js';

// Synthetic CC0 fixtures only. Never used to licence real provider output.
export function withRights(raw) {
  const value = { url: 'https://images.test/item', ...raw };
  return { ...value, rights: rightsEvidence({ ...value, metadataLicense: 'CC0', mediaLicense: 'CC0',
    mediaLicenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', evidence: 'https://images.test/api/item' }) };
}
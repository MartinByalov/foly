// Provider observations are advisory in scheduled monitoring, but local checks stay strict.
export function providerHealthExitCode(reports, { advisory = process.env.FOLY_HEALTH_ADVISORY === '1', warn = console.warn } = {}) {
  if (!Array.isArray(reports) || !reports.length) throw Error('Missing or empty provider health results');
  for (const report of reports) {
    if (!report || typeof report.id !== 'string' || !report.id.trim() || typeof report.ok !== 'boolean' ||
        (!report.ok && (typeof report.error !== 'string' || !report.error.trim()))) {
      throw Error('Invalid provider health result');
    }
  }
  const failed = reports.filter(report => !report.ok);
  if (!failed.length) return 0;
  if (!advisory) return 1;
  // Only emit counts into workflow commands; untrusted provider text stays in the reports.
  warn(`::warning::${failed.length} of ${reports.length} provider checks failed. See the health summary and artifact; these providers are not approved.`);
  return 0;
}
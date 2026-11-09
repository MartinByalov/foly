import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ids = 'austrianLibrary,mLeuven,nijl,cataloniaMaps,luxembourgEuropeana,bremenLibrary,karlsruheLibrary,bonnLibrary,paderbornLibrary,cardiffLibrary';
for (const [name, script, mobile] of [
  ['browser', 'check-foly-browser.mjs', false],
  ['mobile', 'check-foly-browser.mjs', true],
  ['health', 'check-foly-sources.mjs', false],
]) {
  const result = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, encoding: 'utf8',
    env: { ...process.env, FOLY_SOURCE_IDS: ids, FOLY_BROWSER_SAMPLES: '3', FOLY_MOBILE: mobile ? '1' : '0' } });
  writeFileSync(new URL(`../live50-${name}.log`, import.meta.url), result.stdout || '');
  writeFileSync(new URL(`../live50-${name}-errors.log`, import.meta.url), result.stderr || '');
  if (result.error || result.status !== 0) throw result.error || Error(`${name} failed with status ${result.status}`);
  const input = name === 'health' ? 'foly-source-health-selected.json' : `foly-browser-health-selected${mobile ? '-mobile' : ''}.json`;
  const output = `foly-live50-${name === 'browser' ? 'desktop' : name}.json`;
  const report = JSON.parse(readFileSync(new URL(`../data/${input}`, import.meta.url)));
  if (report.reports.some(row => !row.ok) || report.reports.length !== (name === 'health' ? 10 : 30)) throw Error(`Incomplete ${name} report`);
  if (name !== 'health') for (const id of ids.split(',')) {
    if (new Set(report.reports.filter(row => row.id === id).map(row => row.image)).size !== 3) throw Error(`Non-distinct ${name} images for ${id}`);
  }
  copyFileSync(new URL(`../data/${input}`, import.meta.url), new URL(`../data/${output}`, import.meta.url));
  console.log(`${name}: ${report.reports.length}/${report.reports.length}`);
}
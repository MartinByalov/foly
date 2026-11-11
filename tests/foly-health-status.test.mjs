import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { providerHealthExitCode } from '../scripts/foly-health-status.mjs';

const healthy = { id: 'healthy', ok: true };
const failed = { id: 'external', ok: false, error: 'Request timed out', code: 'TIMEOUT' };

test('advisory monitoring warns about failed providers without failing execution or approving them', () => {
  const reports = [healthy, failed];
  const warnings = [];
  assert.equal(providerHealthExitCode(reports, { advisory: true, warn: message => warnings.push(message) }), 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /^::warning::1 of 2 provider checks failed/);
  assert.equal(failed.ok, false);
  assert.equal(failed.error, 'Request timed out');
  assert.equal(providerHealthExitCode([failed], { advisory: true, warn: () => {} }), 0);
});

test('strict smoke checks retain nonzero exits for failed provider observations', () => {
  assert.equal(providerHealthExitCode([healthy, failed], { advisory: false }), 1);
  for (const advisory of [true, false]) {
    assert.equal(providerHealthExitCode([healthy], { advisory, warn: () => assert.fail('Unexpected warning') }), 0);
  }
});

test('empty and malformed results fail even in advisory mode', () => {
  for (const reports of [undefined, null, {}, [], [null], [{}], [{ id: '', ok: true }],
    [{ id: 'provider', ok: 'false' }], [{ id: 'provider', ok: false }], [{ id: 'provider', ok: false, error: '' }]]) {
    assert.throws(() => providerHealthExitCode(reports, { advisory: true }), /health result/);
  }
});

test('untrusted provider text cannot inject workflow commands through advisory warnings', () => {
  const warnings = [];
  providerHealthExitCode([{ id: '\n::error::injected', ok: false, error: '\r\n::error::injected' }],
    { advisory: true, warn: message => warnings.push(message) });
  assert.doesNotMatch(warnings[0], /injected|[\r\n]/);
});

test('both live checkers apply advisory status only after writing actual reports', async () => {
  for (const name of ['sources', 'browser']) {
    const script = await readFile(new URL(`../scripts/check-foly-${name}.mjs`, import.meta.url), 'utf8');
    assert.match(script, /import \{ providerHealthExitCode \} from '\.\/foly-health-status\.mjs'/);
    assert.match(script, /process\.exitCode = providerHealthExitCode\(reports\)/);
    assert.ok(script.indexOf('await writeFile(') < script.indexOf('process.exitCode = providerHealthExitCode(reports)'));
  }
});
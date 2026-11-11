import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = name => readFile(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

test('code validation runs the full suite on changes without external health checks', async () => {
  const checks = await workflow('foly-checks.yml');
  assert.match(checks, /^  push:/m);
  assert.match(checks, /^  pull_request:/m);
  assert.match(checks, /^  workflow_dispatch:/m);
  assert.match(checks, /run: node --test tests\/\*\.test\.mjs/);
  assert.doesNotMatch(checks, /schedule:|check-foly-(?:sources|browser)\.mjs|continue-on-error/);
});

test('provider health runs daily or manually with advisory observations and strict checker execution', async () => {
  const health = await workflow('foly-health.yml');
  assert.match(health, /^  workflow_dispatch:/m);
  assert.match(health, /cron: '23 6 \* \* \*'/);
  assert.doesNotMatch(health, /^  (?:push|pull_request):/m);
  assert.doesNotMatch(health, /node --test|Start-Sleep|path: data\/foly-\*/);
  for (const script of ['sources', 'browser']) {
    assert.match(health, new RegExp(`run: node scripts/check-foly-${script}\\.mjs`));
  }
  assert.match(health, /Remove-Item -LiteralPath 'data\/foly-source-health\.json', 'data\/foly-browser-health\.json'/);
  assert.ok(health.indexOf('Remove previous health reports') < health.indexOf('id: live'));
  assert.match(health, /if: always\(\)\s+uses: actions\/upload-artifact@v6/);
  assert.match(health, /FOLY_HEALTH_ADVISORY: '1'/);
  assert.doesNotMatch(health, /continue-on-error|Fail when a live check failed|run: throw 'Provider health checks failed/);
  assert.match(health, /throw "Missing health report:/);
  assert.match(health, /throw "Invalid health result/);
  assert.match(health, /throw "Missing provider error/);
  assert.match(health, /GITHUB_STEP_SUMMARY/);
  assert.match(health, /\$report = Get-Content -Raw -LiteralPath \$file \| ConvertFrom-Json/);
  assert.match(health, /\$rows\.Count -eq 0/);
  assert.match(health, /HtmlEncode/);
  assert.match(health, /\$row\.id.*\$row\.error.*\$row\.code.*\$row\.cause/);
});

test('workflows use actions with native Node 24 runtimes', async () => {
  for (const name of ['foly-checks.yml', 'foly-health.yml']) {
    const content = await workflow(name);
    assert.match(content, /uses: actions\/checkout@v5/);
    assert.match(content, /uses: actions\/setup-node@v5/);
    assert.doesNotMatch(content, /uses: actions\/(?:checkout|setup-node|upload-artifact)@v4/);
  }
});
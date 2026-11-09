// Discovery queue only. A directory listing is NOT a rights audit or an adapter.
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const repository = 'public-apis/public-apis';
const response = await fetch(`https://api.github.com/repos/${repository}/commits/master`, {
  signal: AbortSignal.timeout(20000), headers: { Accept: 'application/vnd.github+json' },
});
// Anonymous GitHub API can be rate-limited. Preserve a content hash in either case.
const sha = response.ok ? (await response.json()).sha : null;
const url = `https://raw.githubusercontent.com/${repository}/${sha || 'master'}/README.md`;
const result = await fetch(url, { signal: AbortSignal.timeout(20000) });
if (!result.ok) throw new Error(`Directory download: HTTP ${result.status}`);
const markdown = await result.text();
const candidates = new Map();
let category = null;
for (const line of markdown.split('\n')) {
  if (/^### /.test(line)) category = line.slice(4).trim();
  if (!category || !line.startsWith('| [')) continue;
  const cells = line.split('|').map(cell => cell.trim()).slice(1, -1);
  // API sections have five columns; advertisements and MCP listings do not.
  if (cells.length !== 5) continue;
  const match = cells[0].match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
  if (!match) continue;
  const parsed = new URL(match[2]);
  parsed.hash = ''; parsed.search = '';
  const documentation = parsed.href.replace(/\/$/, '');
  if (candidates.has(documentation)) continue;
  candidates.set(documentation, {
    id: createHash('sha256').update(documentation).digest('hex').slice(0, 16),
    name: match[1], category, documentation,
    directoryClaims: { auth: cells[2], https: cells[3], cors: cells[4] },
    status: 'unreviewed', mediaRights: 'unknown', metadataRights: 'unknown',
    hasUsableImages: null, enabled: false,
  });
}
if (candidates.size < 1000) throw new Error(`Directory yielded only ${candidates.size} candidates; do not pad the count`);
const output = {
  researchedAt: new Date().toISOString(), source: url, revision: sha, contentSha256: createHash('sha256').update(markdown).digest('hex'),
  attribution: 'public-apis/public-apis contributors; MIT; https://github.com/public-apis/public-apis/blob/' + (sha || 'master') + '/LICENSE',
  warning: 'Unreviewed directory entries, NOT verified APIs. May include aliases, non-image services, keys, paid plans and restricted content. Do not count as active providers.',
  candidates: [...candidates.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
};
await writeFile(new URL('../data/foly-api-research.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ candidates: candidates.size, revision: sha, activeAdded: 0 }));
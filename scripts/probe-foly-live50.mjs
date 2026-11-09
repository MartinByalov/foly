import { mkdir, writeFile } from 'node:fs/promises';

const directory = new URL('../data/foly-live50-evidence/', import.meta.url);
await mkdir(directory, { recursive: true });
for (let start = 2; start < process.argv.length; start += 8) {
  const pairs = process.argv.slice(start, start + 8);
  await Promise.all(Array.from({ length: pairs.length / 2 }, async (_, index) => {
    const [id, url] = pairs.slice(index * 2, index * 2 + 2);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Origin: 'http://localhost:8000' } });
      const content = await response.text();
      let data;
      try { data = JSON.parse(content); } catch { data = null; }
      await writeFile(new URL(`${id}.${data ? 'json' : 'html'}`, directory), data ? JSON.stringify(data, null, 2) + '\n' : content);
      const canvases = data?.items || data?.sequences?.[0]?.canvases || [];
      console.log(JSON.stringify({ id, url, status: response.status, cors: response.headers.get('access-control-allow-origin'),
        rights: data?.rights || data?.license, credit: data?.attribution || data?.requiredStatement, count: canvases.length,
        body: canvases[0]?.images?.[0]?.resource || canvases[0]?.items?.[0]?.items?.[0]?.body,
        clues: content.match(/.{0,60}(?:creativecommons|manifest|[Ll]icen[sc]e|[Rr]ights).{0,140}/g)?.slice(0,12) }));
    } catch (error) { console.log(JSON.stringify({ id, url, error: error.message })); }
  }));
}
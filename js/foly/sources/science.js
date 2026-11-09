import { source, int, pickOne, join, once, text, fail } from './util.js';

// OpenAlex ships abstracts as { word: [positions] }.
const abstract = index => index && Object.entries(index).flatMap(([word, places]) => places.map(at => [at, word]))
  .sort((a, b) => a[0] - b[0]).map(([, word]) => word).join(' ');

export default [
  source('openalex', 'OpenAlex', 'Science', async ({ json }) => {
    const work = await json('https://api.openalex.org/works/random');
    if (!work?.display_name) fail('No work');
    return { title: text(work.display_name), subject: work.primary_topic?.field?.display_name || 'Research',
      subtitle: join(work.authorships?.slice(0, 3).map(a => a.author?.display_name), work.publication_year),
      description: abstract(work.abstract_inverted_index) || join(work.primary_location?.source?.display_name, `cited ${work.cited_by_count} times`),
      url: work.doi || work.id, credit: 'OpenAlex · CC0' };
  }),

  source('crossref', 'Crossref', 'Science', async ({ json }) => {
    const work = (await json('https://api.crossref.org/works?sample=1&filter=has-abstract:true,type:journal-article')).message?.items?.[0];
    if (!work?.title?.[0]) fail('No work');
    return { title: text(work.title[0]), subject: work['container-title']?.[0] || 'Journal article',
      subtitle: join(work.author?.slice(0, 3).map(a => join(a.given, a.family).replace(' · ', ' ')), work.issued?.['date-parts']?.[0]?.[0]),
      description: text(work.abstract).replace(/^Abstract\s*/i, ''), url: work.URL, credit: 'Crossref' };
  }),

  source('pubchem', 'PubChem', 'Chemistry', async ({ json, random }) => {
    const cid = 1 + int(random, 100000);
    const props = (await json(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/Title,MolecularFormula,MolecularWeight,IUPACName/JSON`))
      .PropertyTable?.Properties?.[0];
    if (!props?.Title) fail('No compound');
    return { title: props.Title, subject: 'Compound', subtitle: props.MolecularFormula,
      description: join(props.IUPACName, `${props.MolecularWeight} g/mol`),
      image: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=500x500`,
      thumb: `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=small`,
      url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, credit: 'PubChem · NCBI' };
  }),

  source('periodicTable', 'PubChem Periodic Table', 'Chemistry', async ({ json, random }) => {
    const table = await once('periodic', () => json('https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON'));
    const columns = table.Table?.Columns?.Column;
    const row = pickOne(random, table.Table?.Row)?.Cell;
    if (!columns || !row) fail('No element');
    const el = Object.fromEntries(columns.map((name, i) => [name, row[i]]));
    return { title: el.Name, subject: el.GroupBlock || 'Element', subtitle: `${el.Symbol} · atomic number ${el.AtomicNumber}`,
      description: join(el.StandardState && `${el.StandardState} at room temperature`, el.YearDiscovered && `discovered ${el.YearDiscovered}`,
        el.AtomicMass && `atomic mass ${el.AtomicMass}`),
      url: `https://pubchem.ncbi.nlm.nih.gov/element/${el.AtomicNumber}`, credit: 'PubChem · NCBI' };
  }),

  source('rcsb', 'RCSB Protein Data Bank', 'Biology', async ({ json, random }) => {
    const ids = await once('pdb', () => json('https://data.rcsb.org/rest/v1/holdings/current/entry_ids'));
    const id = pickOne(random, ids);
    const entry = await json(`https://data.rcsb.org/rest/v1/core/entry/${id}`);
    if (!entry?.struct?.title) fail('No structure');
    const lower = id.toLowerCase();
    return { title: entry.struct.title.toLowerCase().replace(/^\w/, c => c.toUpperCase()), subject: 'Molecular structure',
      subtitle: join(id, entry.exptl?.[0]?.method, entry.rcsb_accession_info?.initial_release_date?.slice(0, 4)),
      image: `https://cdn.rcsb.org/images/structures/${lower.slice(1, 3)}/${lower}/${lower}_assembly-1.jpeg`,
      url: `https://www.rcsb.org/structure/${id}`, credit: 'RCSB PDB · CC0' };
  }),
];

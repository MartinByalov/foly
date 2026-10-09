import { CORE_FORMATS } from '../js/registry.js';
import { RUNTIME_POOLS } from '../js/runtime-pools.js';
const rows=CORE_FORMATS.map(format=>({format:format.id,providers:[...new Set(format.providers.filter(p=>typeof RUNTIME_POOLS[p.adapter]==='function').map(p=>p.id))]}));
console.log(JSON.stringify({total:rows.length,multiple:rows.filter(r=>r.providers.length>=2).length,single:rows.filter(r=>r.providers.length<2),formats:rows},null,2));
if(process.argv.includes('--strict') && rows.some(r=>r.providers.length<2))process.exitCode=1;
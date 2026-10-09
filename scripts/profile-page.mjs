// Dependency-free Edge/CDP diagnostic. Does not change production content.
import http from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webm':'video/webm' };
const server = http.createServer(async (req, res) => {
  try {
    const relative = decodeURIComponent(req.url.split('?')[0]);
    const file = path.resolve(root, `.${relative === '/' ? '/index.html' : relative}`);
    if (!file.startsWith(path.resolve(root) + path.sep)) { res.writeHead(403); res.end(); return; }
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const profile = await mkdtemp(path.join(os.tmpdir(), 'foly-profile-'));
const browser = spawn(process.env.FOLY_BROWSER || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let port;
  for(let i=0;i<60;i++) {
    try { port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]; break; }
    catch { await sleep(250); }
  }
  if(!port)throw new Error('Edge did not expose its debugging port');
  const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0;const pending=new Map();const errors=[];
  socket.onmessage=event=>{
    const message=JSON.parse(event.data);
    if(message.id){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(Error(message.error.message)):task.resolve(message.result);}
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.text);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await send('Runtime.enable');await send('Page.enable');await send('Performance.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  for(let i=0;i<80;i++) {
    if(await evaluate('document.querySelectorAll(".daily-card").length === 100'))break;
    await sleep(250);
  }
  await evaluate(`window.__probe={long:[],shifts:[]};
    new PerformanceObserver(list=>__probe.long.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
    new PerformanceObserver(list=>__probe.shifts.push(...list.getEntries().filter(e=>!e.hadRecentInput).map(e=>({start:e.startTime,value:e.value})))).observe({type:'layout-shift',buffered:true});`);
  await sleep(10000);
  const results=[];
  for(const mode of ['normal','paused-video','no-hover','no-content-visibility']) {
    await evaluate(`document.querySelector('.video-bg video')?.${mode==='paused-video'?'pause()':'play().catch(()=>{})'};
      document.getElementById('probe-style')?.remove();
      ${mode==='no-hover' || mode==='no-content-visibility' ? `{let style=document.createElement('style');style.id='probe-style';style.textContent=${JSON.stringify(mode==='no-hover'?'.daily-card:hover,.daily-card:hover .media img{transform:none!important;transition:none!important}':'.daily-card{content-visibility:visible!important}')};document.head.append(style);}` : ''}
      window.scrollTo({top:0,behavior:'instant'});`);
    await sleep(500);
    const before=await send('Performance.getMetrics');
    const frames=await evaluate(`new Promise(resolve=>{
      const frames=[];let previous=performance.now();const start=previous;
      const height=document.documentElement.scrollHeight-innerHeight;
      function step(now){frames.push(now-previous);previous=now;
        window.scrollTo({top:Math.min(1,(now-start)/6000)*height,behavior:'instant'});
        if(now-start<6000)requestAnimationFrame(step);else resolve(frames);
      }requestAnimationFrame(step);
    })`);
    const after=await send('Performance.getMetrics');
    const values=new Map(before.metrics.map(m=>[m.name,m.value]));
    const delta=Object.fromEntries(after.metrics.filter(m=>['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].includes(m.name)).map(m=>[m.name,+(1000*(m.value-(values.get(m.name)||0))).toFixed(1)]));
    const sorted=frames.slice(1).sort((a,b)=>a-b);
    results.push({mode,frames:sorted.length,p95ms:+sorted[Math.floor(sorted.length*.95)].toFixed(1),over50ms:sorted.filter(ms=>ms>50).length,...delta});
  }
  const state=await evaluate(`({cards:document.querySelectorAll('.daily-card').length,
    loading:document.querySelectorAll('.loading-pulse').length,images:document.images.length,
    oversized:[...document.images].filter(i=>i.naturalWidth>1600).map(i=>({url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight})),
    video:document.querySelector('.video-bg video') ? {ready:document.querySelector('.video-bg video').readyState} : null,
    longtasks:__probe.long,shifts:__probe.shifts,
    resources:performance.getEntriesByType('resource').map(e=>({url:e.name,duration:Math.round(e.duration),bytes:e.transferSize}))})`);
  const report={measured:new Date().toISOString(),environment:'Edge headless, 1280x800; sequential passes warm progressively',results,state,errors};
  const destination=path.join(os.tmpdir(),'foly-performance-report.json');
  await writeFile(destination,JSON.stringify(report,null,2));
  console.log(JSON.stringify({results,cards:state.cards,loading:state.loading,oversized:state.oversized,longtasks:state.longtasks.length,shifts:state.shifts.length,errors,report:destination},null,2));
} finally {
  socket?.close();browser.kill();server.close();
  await sleep(500);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
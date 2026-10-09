import { queueTasks } from './engine.js';
const queue=queueTasks(4);
const checks=new Map();
// Use the same browser image loader as cards, not a CORS-dependent HEAD request.
export function imageAvailable(url) {
  if(!url)return Promise.resolve(false);
  if(typeof Image==='undefined')return Promise.resolve(true);
  if(checks.has(url))return checks.get(url);
  const result=queue(()=>new Promise(resolve=>{
    const image=new Image();
    const timer=setTimeout(()=>finish(false),7000);
    let settled=false;
    function finish(ok){if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;resolve(ok);}
    image.onload=async()=>{try{if(typeof image.decode==='function')await image.decode();finish(image.naturalWidth>0);}catch{finish(false);}};
    image.onerror=()=>finish(false);
    image.src=url;
  }));
  checks.set(url,result);
  return result;
}
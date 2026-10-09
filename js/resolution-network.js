const retryable=new Set([408,425,429,500,502,503,504]);
export const isInfrastructureFailure=error=>retryable.has(error?.status) || ['AbortError','TimeoutError'].includes(error?.name) || error instanceof TypeError;
export function circuitBreaker({threshold=3,cooldown=600000,now=Date.now}={}) {
  const entries=new Map();
  return {
    isOpen(id){const e=entries.get(id);return !!e && e.count>=threshold && now()-e.at<cooldown;},
    success(id){entries.delete(id);},
    failure(id,error){if(!isInfrastructureFailure(error))return;const e=entries.get(id);entries.set(id,{count:(e && now()-e.at<cooldown?e.count:0)+1,at:now()});},
  };
}
// One shared scheduler for legacy adapters and candidate-pool adapters.
export const scheduleRequest=requestQueue();
export async function withNetworkRetry(work,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),retries=2,jitter=0}={}) {
  for(let attempt=0;;attempt++){
    try{return await work();}catch(error){
      if(attempt>=Math.min(2,retries) || !isInfrastructureFailure(error))throw error;
      const header=error.retryAfter;
      const seconds=header==null?NaN:Number(header);
      const retryAfter=Number.isFinite(seconds)?seconds*1000:Date.parse(header)-Date.now();
      // Do not hold a card for a long Retry-After; advance to another provider.
      if(retryAfter>7000)throw error;
      await sleep(Math.max([250,700][attempt]+jitter,Number.isFinite(retryAfter)?retryAfter:0));
    }
  }
}
export function requestQueue({globalLimit=4,hostLimit=2}={}) {
  let active=0;const hosts=new Map(),waiting=[];
  const drain=()=>{
    for(let i=0;i<waiting.length && active<globalLimit;){
      const job=waiting[i];
      if((hosts.get(job.host)||0)>=hostLimit){i++;continue;}
      waiting.splice(i,1);active++;hosts.set(job.host,(hosts.get(job.host)||0)+1);
      Promise.resolve().then(job.work).then(job.resolve,job.reject).finally(()=>{active--;hosts.set(job.host,hosts.get(job.host)-1);drain();});
    }
  };
  return (url,work)=>new Promise((resolve,reject)=>{waiting.push({host:new URL(url).host,work,resolve,reject});drain();});
}
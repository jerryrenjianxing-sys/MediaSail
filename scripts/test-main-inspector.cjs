// Test-only observer for the app started by NSIS (which has no Playwright pipe).
// The caller must verify executable ownership before passing the PID.
const cp=require('node:child_process');
async function attachTestMain(pid){
  process._debugProcess(pid);
  let targets;
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){try{targets=await(await fetch('http://127.0.0.1:9229/json/list')).json();if(targets.length)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  const owner=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-NetTCPConnection -State Listen -LocalPort 9229 -ErrorAction Stop).OwningProcess | Select-Object -Unique`],{encoding:'utf8',windowsHide:true}).trim();
  if(owner!==String(pid))throw new Error('Inspector port is not owned by the expected test process');
  if(!targets?.length)throw new Error('Test inspector unavailable');
  const ws=new WebSocket(targets[0].webSocketDebuggerUrl),pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  ws.addEventListener('message',event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);if(message.error||message.result?.exceptionDetails)request.reject(new Error(JSON.stringify(message.error||message.result.exceptionDetails)));else request.resolve(message.result?.result?.value);}});
  return {
    evaluate(expression){return new Promise((resolve,reject)=>{const next=++id;const timer=setTimeout(()=>{pending.delete(next);reject(new Error('Test inspector evaluation timed out'));},15000);pending.set(next,{resolve,reject,timer});ws.send(JSON.stringify({id:next,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});},
    close(){ws.close();for(const request of pending.values()){clearTimeout(request.timer);request.reject(new Error('Test inspector closed'));}pending.clear();},
  };
}
module.exports={attachTestMain};

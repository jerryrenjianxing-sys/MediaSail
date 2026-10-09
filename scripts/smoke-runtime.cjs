const path=require('node:path'),fs=require('node:fs');
const {syncWorkspace}=require('../desktop/workspace.cjs');const {freePort,environment,startSupervisor,stopSupervisor,state}=require('../desktop/runtime.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data/运行测试 clean');
 const work=await syncWorkspace(path.join(root,'build/payload'),data);
 const port=await freePort(7860),gateway=await freePort(37289);
 const options=environment(path.join(root,'build'),data,work,port,gateway);
 const pids=[];const child=startSupervisor(root,options,event=>{console.log(JSON.stringify(event));if(event.pid)pids.push(event.pid);});
 try{
  let ready=false;
  for(let i=0;i<120;i++){
   if(child.exitCode!==null)throw new Error('Supervisor exited '+child.exitCode);
   try {const s=await state(`http://127.0.0.1:${port}`,options.env.EASEL_DESKTOP_TOKEN);const g=await fetch(`http://127.0.0.1:${gateway}/healthz`);if(s.ready&&g.ok){ready=true;console.log('WEB AND GATEWAY READY');break;}}catch{}
   await new Promise(r=>setTimeout(r,1000));
  }
  if(!ready)throw new Error('Startup timeout');
  const r=await fetch(`http://127.0.0.1:${port}/api/status`);const info=await r.json();console.log('API STATUS',r.status,JSON.stringify({gateway:info.gateway,skills:info.skills.length}));
  const home=await fetch(`http://127.0.0.1:${port}/`);if(!home.ok||!(await home.text()).includes('<div id="root">'))throw new Error('Original UI unavailable');
 }finally{await stopSupervisor(child);await new Promise(r=>setTimeout(r,1000));for(const pid of pids){try{process.kill(pid,0);throw new Error('Leaked child '+pid);}catch(e){if(e.code!=='ESRCH')throw e;}}}
 console.log('OWNED PROCESSES CLEANED UP');
})().catch(e=>{console.error(e);process.exitCode=1;});

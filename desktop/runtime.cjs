const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
async function freePort(preferred) {
  const listen = port => new Promise((resolve,reject) => {
    const server=net.createServer(); server.once('error',reject);
    server.listen(port,'127.0.0.1',()=>{const chosen=server.address().port;server.close(()=>resolve(chosen));});
  });
  try { return await listen(preferred); } catch (e) { if(e.code!=='EADDRINUSE') throw e; return listen(0); }
}
function environment(resources,data,work,port,gatewayPort) {
  const runtime=path.join(resources,'runtime');
  const pyRoot=path.join(runtime,'python','cpython-3.11.15-windows-x86_64-none');
  const node=path.join(runtime,'node');
  const home=path.join(data,'home'), state=path.join(home,'.openclaw-easel');
  const temp=path.join(data,'temp'), logs=path.join(data,'logs');
  for(const p of [home,state,temp,logs,path.join(home,'AppData/Local'),path.join(home,'AppData/Roaming')]) fs.mkdirSync(p,{recursive:true});
  const system=process.env.SystemRoot || 'C:\\Windows';
  // An explicit allowlist prevents inherited API keys and developer environments leaking in.
  const env={};
  for(const k of ['SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','SystemDrive','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','USERNAME','OS','PATHEXT','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy']) if(process.env[k]) env[k]=process.env[k];
  Object.assign(env,{
    PATH:[path.join(runtime,'launchers'),pyRoot,path.join(pyRoot,'Scripts'),node,path.join(runtime,'ffmpeg'),path.join(system,'System32'),system,path.join(system,'System32/WindowsPowerShell/v1.0')].join(path.delimiter),
    USERPROFILE:home,HOME:home,OPENCLAW_HOME:home,HOMEDRIVE:path.parse(home).root.slice(0,2),HOMEPATH:home.slice(2),
    APPDATA:path.join(home,'AppData/Roaming'),LOCALAPPDATA:path.join(home,'AppData/Local'),TEMP:temp,TMP:temp,
    PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8',PYTHONNOUSERSITE:'1',PYTHONPATH:work,
    NUMBA_CACHE_DIR:path.join(data,'cache/numba'),MPLCONFIGDIR:path.join(data,'cache/matplotlib'),
    PLAYWRIGHT_BROWSERS_PATH:path.join(runtime,'browsers'),
    EASEL_DESKTOP_WORKSPACE:work,EASEL_DESKTOP_LOGS:logs,EASEL_DESKTOP_NODE:path.join(node,'node.exe'),
    EASEL_OPENCLAW_STATE_DIR:state,OPENCLAW_STATE_DIR:state,OPENCLAW_CONFIG_PATH:path.join(state,'openclaw.json'),
    EASEL_OPENCLAW_WORKSPACE:path.join(state,'workspace'),EASEL_NPM_GLOBAL_PREFIX:node,
    EASEL_PORT:String(port),EASEL_GATEWAY_PORT:String(gatewayPort),OPENCLAW_GATEWAY_PORT:String(gatewayPort),
    EASEL_GATEWAY_HOST:'127.0.0.1',OPENCLAW_NO_RESPAWN:'1',
    EASEL_RAW_STREAM_PATH:path.join(temp,'easel-raw-stream.jsonl'),
    OPENCLAW_RAW_STREAM:'1',OPENCLAW_RAW_STREAM_PATH:path.join(temp,'easel-raw-stream.jsonl'),EASEL_ASKUSER_CARDS:'1',
    EASEL_DESKTOP_TOKEN:crypto.randomBytes(24).toString('hex'),
    NO_PROXY:'localhost,127.0.0.1,::1',no_proxy:'localhost,127.0.0.1,::1'
  });
  return {env,python:path.join(pyRoot,'python.exe'),logs};
}
function startSupervisor(resources,options,onEvent) {
  for(const filename of [options.python,options.env.EASEL_DESKTOP_NODE]) if(!fs.existsSync(filename)) throw new Error('运行环境不完整，请重新安装 MediaSail。');
  const err=fs.openSync(path.join(options.logs,'desktop-backend.log'),'a');
  const child=spawn(options.python,['-u',path.join(resources,'bridge/supervisor.py')],{
    cwd:options.env.EASEL_DESKTOP_WORKSPACE,env:options.env,windowsHide:true,stdio:['pipe','pipe',err]
  });
  fs.closeSync(err); let buffer='';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data',chunk=>{buffer+=chunk;let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{onEvent(JSON.parse(line));}catch{ /* non-protocol upstream output */ }}});
  child.on('error',e=>onEvent({event:'error',message:e.message}));
  return child;
}
async function stopSupervisor(child) {
  if(!child || child.exitCode!==null || child.signalCode!==null) return;
  await new Promise(resolve=>{
    let timer;
    const done=()=>{clearTimeout(timer);resolve();};child.once('exit',done);
    child.stdin.on('error',()=>{});child.stdin.end('shutdown\n');
    timer=setTimeout(()=>{child.kill();},4000);timer.unref();
  });
}
async function state(url,token) {
  const r=await fetch(url+'/_desktop/state',{headers:{'x-desktop-token':token},signal:AbortSignal.timeout(2500)});
  if(!r.ok) throw new Error(`服务状态异常（${r.status}）`);
  const data=await r.json(); if(data.instance!==token) throw new Error('服务身份校验失败');return data;
}
module.exports={freePort,environment,startSupervisor,stopSupervisor,state};

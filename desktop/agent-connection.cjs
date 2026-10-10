const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Public discovery metadata only. Never serialize the process environment or desktop token.
const PATH_ENV=['PATH','HOME','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PYTHONUTF8','PYTHONIOENCODING','PYTHONNOUSERSITE','PYTHONPATH','NUMBA_CACHE_DIR','MPLCONFIGDIR','PLAYWRIGHT_BROWSERS_PATH','OPENCLAW_HOME','OPENCLAW_STATE_DIR','OPENCLAW_CONFIG_PATH','EASEL_OPENCLAW_STATE_DIR','EASEL_OPENCLAW_WORKSPACE','EASEL_NPM_GLOBAL_PREFIX','EASEL_DESKTOP_WORKSPACE','EASEL_DESKTOP_NODE','EASEL_GATEWAY_PORT','OPENCLAW_GATEWAY_PORT','EASEL_GATEWAY_HOST','EASEL_PORT'];
class AgentConnection{
  constructor(data){this.file=path.join(data,'agent-connection.json');this.data=data;this.info=null;}
  begin({version,baseUrl,options,skillDir,executable}){
    const work=options.env.EASEL_DESKTOP_WORKSPACE;
    this.info={schema:1,product:'MediaSail',version,instanceId:crypto.randomUUID(),pid:process.pid,
      baseUrl,dataDir:this.data,connectionFile:this.file,workspace:work,skillDir,executable,
      python:options.python,node:options.env.EASEL_DESKTOP_NODE,
      profiles:path.join(work,'profiles'),outputs:path.join(work,'outputs'),tools:path.join(work,'skills'),
      environment:Object.fromEntries(PATH_ENV.filter(k=>options.env[k]!==undefined).map(k=>[k,options.env[k]]))};
    options.env.EASEL_AGENT_CONNECTION_JSON=JSON.stringify(this.info);
    this.write('starting');
  }
  write(status){
    if(!this.info)return;
    const value={...this.info,status,updatedAt:new Date().toISOString()};
    if(status==='stopped')value.baseUrl=null;
    fs.mkdirSync(this.data,{recursive:true});
    const tmp=this.file+'.'+process.pid+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n','utf8');fs.renameSync(tmp,this.file);
  }
  stop(){
    if(!this.info)return;
    try{const current=JSON.parse(fs.readFileSync(this.file,'utf8'));if(current.instanceId===this.info.instanceId)this.write('stopped');}catch{/* app shutdown must not fail because discovery metadata is unavailable */}
  }
}
module.exports={AgentConnection,PATH_ENV};

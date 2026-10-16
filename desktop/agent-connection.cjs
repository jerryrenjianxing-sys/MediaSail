const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Public discovery metadata only. Never serialize the process environment or desktop token.
const PATH_ENV=['PATH','HOME','USERPROFILE','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PYTHONUTF8','PYTHONIOENCODING','PYTHONNOUSERSITE','PYTHONDONTWRITEBYTECODE','PYTHONPATH','EASEL_DESKTOP_WORKSPACE','EASEL_HOST_LOCALAPPDATA','EASEL_BROWSER_EXECUTABLE','EASEL_AGENT_CONNECTION_FILE','EASEL_PORT'];
function writeDisconnectedDiscovery({file,version,executable,reason='library_not_selected'}){
  const value={schema:1,product:'MediaSail',version,status:'needs-library',reason,needsLibrarySelection:reason==='library_not_selected',
    instanceId:crypto.randomUUID(),pid:process.pid,executable,baseUrl:null,connectionFile:file,discoveryFile:file,
    libraryRoot:null,libraryId:null,dataDir:null,workspace:null,skillDir:null,python:null,node:null,profiles:null,outputs:null,tools:null,selectedProfile:null,environment:{},updatedAt:new Date().toISOString()};
  fs.mkdirSync(path.dirname(file),{recursive:true});const temporary=file+'.'+process.pid+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n','utf8');fs.renameSync(temporary,file);return value;
}
class AgentConnection{
  constructor(data){this.file=path.join(data,'agent-connection.json');this.data=data;this.info=null;}
  begin({version,baseUrl,options,skillDir,executable,selectedProfile=null,libraryRoot=null,libraryId=null,discoveryFile=null}){
    const work=options.env.EASEL_DESKTOP_WORKSPACE;
    this.discoveryFile=discoveryFile;
    this.info={schema:1,product:'MediaSail',version,instanceId:crypto.randomUUID(),pid:process.pid,
      baseUrl,dataDir:this.data,connectionFile:this.file,discoveryFile:discoveryFile||this.file,libraryRoot,libraryId,workspace:work,skillDir,executable,
      python:options.python,node:null,selectedProfile,
      profiles:path.join(work,'profiles'),outputs:path.join(work,'outputs'),tools:path.join(work,'skills'),
      environment:Object.fromEntries(PATH_ENV.filter(k=>options.env[k]!==undefined).map(k=>[k,options.env[k]]))};
    options.env.EASEL_AGENT_CONNECTION_JSON=JSON.stringify(this.info);
    this.write('starting');
  }
  selectProfile(value){if(!this.info)return;this.info.selectedProfile=typeof value==='string'&&value?value:null;this.write(this.status||'starting');}
  write(status){
    if(!this.info)return;
    this.status=status;
    const value={...this.info,status,updatedAt:new Date().toISOString()};
    if(status==='stopped')value.baseUrl=null;
    fs.mkdirSync(this.data,{recursive:true});
    for(const file of new Set([this.file,this.discoveryFile].filter(Boolean))){
      if(status==='stopped'&&file!==this.file){try{if(JSON.parse(fs.readFileSync(file,'utf8')).instanceId!==this.info.instanceId)continue;}catch{continue;}}
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const tmp=file+'.'+process.pid+'.tmp';
      fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n','utf8');fs.renameSync(tmp,file);
    }
  }
  stop(){
    if(!this.info)return;
    try{const current=JSON.parse(fs.readFileSync(this.file,'utf8'));if(current.instanceId===this.info.instanceId)this.write('stopped');}catch{/* app shutdown must not fail because discovery metadata is unavailable */}
  }
}
module.exports={AgentConnection,PATH_ENV,writeDisconnectedDiscovery};

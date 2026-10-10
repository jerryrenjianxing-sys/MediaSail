const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const KEYS=new Set(['easel_sessions','easel_active_session','easel_publish_draft','easel_theme','easel_onboarding_seen','easel_analytics','easel_whoami','easel_model_lists','easel_chat_reset_20260902']);
const LEGACY_KEYS=new Set([...KEYS,'easel-sessions',...['sessions','active_session','publish_draft','onboarding_seen'].map(s=>'postcraft_'+s)]);
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
function trustedStateSender(event,main,origin){
  if(!origin||event.sender!==main||event.senderFrame!==main?.mainFrame)return false;
  try{const u=new URL(event.senderFrame.url);return u.origin===origin&&u.pathname==='/'&&!u.search;}catch{return false;}
}
function validateValues(values){
  if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('界面数据格式无效。');
  for(const [key,value] of Object.entries(values))if(!KEYS.has(key)||typeof value!=='string'||Buffer.byteLength(value)>64*1024*1024)throw new Error('不支持的界面数据或内容过大。');
  if(Buffer.byteLength(JSON.stringify(values))>256*1024*1024)throw new Error('界面数据过大，未覆盖已保存内容。');
}
function mergeOrigins(origins){
  const values={},sessions=[],seen=new Map(),ids=new Set(),sources=[];
  let active=null,copies=0;
  // Sequence numbers belong to the same old LevelDB, so they order all origins.
  for(const source of [...origins].sort((a,b)=>b.sequence-a.sequence||a.origin.localeCompare(b.origin))){
    const v=source.values,normalized={};
    for(const key of KEYS){const previous='postcraft_'+key.replace(/^easel_/,'');const raw=v[key]??v[previous]??(key==='easel_sessions'?v['easel-sessions']:undefined);if(typeof raw==='string')normalized[key]=raw;}
    if(!Object.keys(normalized).length)continue;
    sources.push(source.origin);
    for(const [key,value] of Object.entries(normalized)){
      if(key in values||key==='easel_sessions')continue;
      if(key==='easel_theme'&&!['light','dark'].includes(value))continue;
      if(['easel_publish_draft','easel_analytics','easel_whoami','easel_model_lists'].includes(key)){
        try{const parsed=JSON.parse(value);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))continue;}catch{continue;}
      }
      values[key]=value;
    }
    let list=[];
    if(normalized.easel_sessions){try{list=JSON.parse(normalized.easel_sessions);if(!Array.isArray(list))throw Error();}catch{throw new Error('旧聊天记录无法解析，已保留备份，请重试或查看日志。');}}
    const sourceIds=new Map();
    for(const item of list){
      if(!item||typeof item.id!=='string'||!Array.isArray(item.messages))throw new Error('旧聊天记录格式不完整，未覆盖原始数据。');
      const fingerprint=canonical(item),identity=item.id+'\0'+fingerprint;
      if(seen.has(identity)){sourceIds.set(item.id,seen.get(identity));continue;}
      const copy=structuredClone(item);
      if(ids.has(copy.id)){
        copy.id='recovered-'+crypto.createHash('sha256').update(identity).digest('hex').slice(0,24);
        copy.title=(copy.title||'历史会话')+'（恢复副本）';copy.recoveredFrom=source.origin;
        delete copy.sessionKey;delete copy.pendingTurnId;copies++;
      }
      seen.set(identity,copy.id);ids.add(copy.id);sessions.push(copy);sourceIds.set(item.id,copy.id);
    }
    if(!active&&sourceIds.has(normalized.easel_active_session))active=sourceIds.get(normalized.easel_active_session);
  }
  values.easel_sessions=JSON.stringify(sessions);
  if(active)values.easel_active_session=active;else delete values.easel_active_session;
  values.easel_chat_reset_20260902='1';
  validateValues(values);
  return {schema:1,values,migration:{version:'0.3.3',completedAt:new Date().toISOString(),sources,sessions:sessions.length,copies}};
}
class UiStateStore{
  constructor(data){this.file=path.join(data,'ui-state.json');this.backup=this.file+'.previous';this.state=null;this.queue=Promise.resolve();this.failure=null;}
  async open(migrate){
    if(this.state)return;
    let raw;
    try{raw=await fs.readFile(this.file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
    if(raw!==undefined){
      try{this.state=this.decode(raw);}catch{
        let previous;try{previous=this.decode(await fs.readFile(this.backup,'utf8'));}catch{throw new Error('界面数据无法读取，原文件已保留。请查看日志并恢复备份。');}
        await fs.copyFile(this.file,this.file+'.damaged-'+Date.now());
        this.state=previous;await this.persist(false);
      }
    }else{
      // An interrupted first save may leave only a complete previous snapshot.
      try{this.state=this.decode(await fs.readFile(this.backup,'utf8'));await this.persist(false);}catch(e){if(e.code!=='ENOENT')throw e;}
      if(!this.state){this.state=await migrate();try{await this.persist(false);}catch(e){this.state=null;throw e;}}
    }
  }
  decode(raw){const s=JSON.parse(raw);if(s.schema!==1||s.migration?.version!=='0.3.3')throw new Error('不支持的界面数据版本。');validateValues(s.values);return s;}
  snapshot(){if(!this.state)throw new Error('界面数据尚未准备好。');return structuredClone(this.state);}
  async persist(keepPrevious=true){
    await fs.mkdir(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp';const h=await fs.open(temp,'w');
    try{await h.writeFile(JSON.stringify(this.state));await h.sync();}finally{await h.close();}
    if(keepPrevious){try{await fs.copyFile(this.file,this.backup+'.tmp');await fs.rename(this.backup+'.tmp',this.backup);}catch(e){if(e.code!=='ENOENT')throw e;}}
    await fs.rename(temp,this.file);
    if(!keepPrevious){await fs.copyFile(this.file,this.backup+'.tmp');await fs.rename(this.backup+'.tmp',this.backup);}
    this.failure=null;
  }
  change(key,value){
    if(!KEYS.has(key)||(value!==null&&typeof value!=='string'))return Promise.reject(new Error('不支持的界面数据。'));
    const task=this.queue.then(async()=>{
      if(!this.state)throw new Error('界面数据尚未准备好。');
      const next={...this.state.values};if(value===null)delete next[key];else next[key]=value;validateValues(next);
      this.state={...this.state,values:next};await this.persist();return true;
    });
    this.queue=task.catch(e=>{this.failure=e;});return task;
  }
  async flush(){await this.queue;if(this.failure)await this.persist();return true;}
}
module.exports={UiStateStore,mergeOrigins,trustedStateSender,KEYS,LEGACY_KEYS};

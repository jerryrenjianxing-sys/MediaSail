'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),crypto=require('node:crypto'),cp=require('node:child_process');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
async function atomic(file,value){await fs.mkdir(path.dirname(file),{recursive:true});const temporary=file+'.'+crypto.randomUUID()+'.tmp';const handle=await fs.open(temporary,'wx');try{await handle.writeFile(JSON.stringify(value)+'\n');await handle.sync();}finally{await handle.close();}await fs.rename(temporary,file);}
async function privateDirectory(directory){
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 if(process.platform==='win32'){
  const system=path.join(process.env.SystemRoot,'System32');
  const output=cp.execFileSync(path.join(system,'whoami.exe'),['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true});
  const sid=output.match(/S-1-\d+(?:-\d+)+/);if(!sid)throw Error('Cannot identify the current Windows user');
  cp.execFileSync(path.join(system,'icacls.exe'),[directory,'/inheritance:r','/grant:r','*'+sid[0]+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{windowsHide:true,stdio:'pipe'});
 }
}
class BrowserConnector{
 constructor({info,bootstrap,data,entry,available=()=>true}){this.info=info;this.data=data;this.entry=entry;this.available=available;this.privateRoot=path.join(bootstrap,'browser-connector-private');this.token=crypto.randomBytes(32).toString('hex');this.tasks=new Map();this.queue=Promise.resolve();this.execution=Promise.resolve();this.admissions=0;this.stopping=false;}
 async start(){
  await privateDirectory(this.privateRoot);
  const id=this.info.instanceId;if(!uuid(id))throw Error('Invalid desktop instance identity');
  this.credentialFile=path.join(this.privateRoot,id+'.json');
  this.pipe=process.platform==='win32'?'\\\\.\\pipe\\MediaSail-browser-'+id:path.join(os.tmpdir(),'mediasail-browser-'+id+'.sock');
  await atomic(this.credentialFile,{schema:1,token:this.token,instanceId:id,libraryId:this.info.libraryId});
  this.sockets=new Set();
  this.server=net.createServer({allowHalfOpen:true},socket=>{
   this.sockets.add(socket);socket.on('close',()=>this.sockets.delete(socket));socket.on('error',()=>{});socket.setTimeout(10000,()=>socket.destroy());
   let buffer=Buffer.alloc(0),handled=false;
   socket.on('data',chunk=>{if(handled)return;buffer=Buffer.concat([buffer,chunk]);if(buffer.length>65536){socket.destroy();return;}const end=buffer.indexOf(10);if(end<0)return;handled=true;
    Promise.resolve().then(()=>this.request(JSON.parse(buffer.subarray(0,end).toString('utf8')))).catch(()=>({ok:false,code:'invalid_request',error:'连接请求无效。'})).then(result=>{if(!socket.destroyed)socket.end(JSON.stringify(result)+'\n');});
   });
  });
  try{await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen({path:this.pipe,readableAll:false,writableAll:false},resolve);});}
  catch(error){await fs.unlink(this.credentialFile).catch(()=>{});throw error;}
  this.server.on('error',()=>{});this.server.unref();
  return {schema:1,transport:'named-pipe',pipe:this.pipe,credentialFile:this.credentialFile};
 }
 busy(){return this.admissions>0||this.tasks.size>0;}
 fail(code,error,requestId){return {ok:false,code,error,requestId};}
 recordFile(id){return path.join(this.data,'browser/connect-requests',id+'.json');}
 async request(input){
  if(!input||Array.isArray(input)||typeof input!=='object')return this.fail('invalid_request','连接请求无效。');
  if(typeof input.token!=='string'||!/^[a-f0-9]{64}$/.test(input.token)||!crypto.timingSafeEqual(Buffer.from(input.token),Buffer.from(this.token)))return this.fail('connector_unauthorized','无法确认本机连接权限。');
  if(input.instanceId!==this.info.instanceId)return this.fail('instance_mismatch','软件实例已变化，请重新读取连接资料。',input.requestId);
  if(input.libraryId!==this.info.libraryId)return this.fail('library_mismatch','资料库已变化，请重新读取连接资料。',input.requestId);
  const keys=new Set(['schema','token','instanceId','libraryId','requestId','action','name','url']);
  if(input.schema!==1||!uuid(input.requestId)||Object.keys(input).some(key=>!keys.has(key))||!['connect','status'].includes(input.action))return this.fail('invalid_request','连接请求无效。',input.requestId);
  let record;try{record=JSON.parse(await fs.readFile(this.recordFile(input.requestId),'utf8'));}catch(error){if(error.code!=='ENOENT')return this.fail('request_unreadable','原连接记录不可读，已保留。',input.requestId);}
  if(record&&record.libraryId!==this.info.libraryId)return this.fail('library_mismatch','连接记录不属于当前资料库。',input.requestId);
  if(input.action==='status')return record?this.result(record):this.fail('request_not_found','未找到该次连接请求。',input.requestId);
  const name=input.name===undefined?'MediaSail Agent':input.name,url=input.url===undefined?'':input.url;
  if(typeof name!=='string'||!name.trim()||name.length>256||typeof url!=='string'||url.length>4096)return this.fail('invalid_request','连接名称或网址无效。',input.requestId);
  if(url){try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error();}catch{return this.fail('invalid_request','初始网址必须是 HTTP(S) 页面地址。',input.requestId);}}
  const signature=crypto.createHash('sha256').update(JSON.stringify({name,url})).digest('hex');
  if(record){if(record.signature!==signature)return this.fail('request_conflict','该编号已有其他连接请求，请先核对原结果。',input.requestId);return this.result(record);}
  if(this.stopping||!this.available())return this.fail('desktop_busy','MediaSail 正在启动、退出或更换资料库，请稍后重试。',input.requestId);
  // Serialize request admission as well as native startup. A repeated request
  // cannot race the first durable pending record into a second browser session.
  this.admissions++;
  const admitted=this.queue.then(async()=>{
   try{const existing=JSON.parse(await fs.readFile(this.recordFile(input.requestId),'utf8'));return existing.signature===signature?this.result(existing):this.fail('request_conflict','该编号已有其他连接请求。',input.requestId);}catch(error){if(error.code!=='ENOENT')throw error;}
   if(this.stopping||!this.available())return this.fail('desktop_busy','MediaSail 正在退出或更换资料库，请稍后重试。',input.requestId);
   record={schema:1,requestId:input.requestId,libraryId:this.info.libraryId,instanceId:this.info.instanceId,signature,state:'pending',createdAt:new Date().toISOString()};
   await atomic(this.recordFile(input.requestId),record);
   const task=this.execution.then(()=>this.execute(record,{name,url}));this.execution=task.catch(()=>{});this.tasks.set(record.requestId,task);task.finally(()=>this.tasks.delete(record.requestId)).catch(()=>{});
   return this.result(record);
  });this.queue=admitted.catch(()=>{});return admitted.finally(()=>this.admissions--);
 }
 result(record){
  if(record.state==='pending'&&record.instanceId!==this.info.instanceId)return this.fail('connect_interrupted','软件已重启，原连接结果尚未确认，请先检查已有浏览器。',record.requestId);
  if(record.state==='pending'&&!this.tasks.has(record.requestId))return this.fail('connect_unknown','原连接已结束但结果未能保存，请先检查已有浏览器及本机连接记录。',record.requestId);
  return {ok:record.state==='pending'||record.state==='completed',requestId:record.requestId,state:record.state,...(record.receipt?{receipt:record.receipt}:{}),...(record.code?{code:record.code,error:record.error}:{})};
 }
 async execute(record,{name,url}){
  try{
   const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
   const args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',this.entry,'connect','--connection',this.info.connectionFile,'--desktop-owned','--name',name];if(url)args.push('--url',url);
   const result=await new Promise(resolve=>cp.execFile(ps,args,{env:{...process.env,MEDIASAIL_BROWSER_HOST_TOKEN:this.token},windowsHide:true,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024},(error,stdout,stderr)=>resolve({error,stdout,stderr})));
   let receipt;try{receipt=JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''));}catch{}
   if(result.error||!receipt?.ok){
    const diagnostic=path.join(this.privateRoot,record.requestId+'.log');await fs.writeFile(diagnostic,JSON.stringify({stdout:result.stdout,stderr:result.stderr,error:result.error?.message})+'\n');
    const unknown=Boolean(result.error?.killed)||(!receipt&&result.error);
    record.state=unknown?'unknown':'failed';record.code=unknown?'connect_unknown':'browser_start_failed';
    record.error=unknown?'连接结果尚未确认，请先核对原请求和已有浏览器。':/Job Object|breakaway|os error 5/i.test(receipt?.error||'')?'当前运行环境限制了后台浏览器启动，请从桌面正常打开 MediaSail 后重试。':String(receipt?.error||'浏览器未能建立连接，请查看本机诊断日志。').slice(0,500);
   }else{record.state='completed';record.receipt=receipt;}
  }catch{record.state='unknown';record.code='connect_unknown';record.error='连接结果尚未确认，请核对原请求和已有浏览器。';}
  record.finishedAt=new Date().toISOString();await atomic(this.recordFile(record.requestId),record);
 }
 async close(){this.stopping=true;await this.queue;await Promise.allSettled([...this.tasks.values()]);for(const socket of this.sockets||[])socket.destroy();if(this.server)await new Promise(resolve=>this.server.close(resolve));if(this.credentialFile)await fs.unlink(this.credentialFile).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
module.exports={BrowserConnector};

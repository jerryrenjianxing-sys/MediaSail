const fs=require('node:fs/promises'),path=require('node:path'),{execFile}=require('node:child_process');
const {LEGACY_KEYS,mergeOrigins}=require('./ui-state.cjs');
async function exists(file){try{await fs.access(file);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
async function migrateUiState({data,resources,bridgeResources,report=()=>{}}){
  const {BrowserWindow,session}=require('electron');
  const backup=path.join(data,'ui-state-migration-0.3.3');
  const snapshot=path.join(backup,'snapshot'),marker=path.join(backup,'snapshot-complete.json');
  await fs.mkdir(backup,{recursive:true});
  if(!await exists(marker)){
    if(!await exists(snapshot)){
      const staging=path.join(backup,'snapshot-pending-'+Date.now());await fs.mkdir(staging,{recursive:true});
      const local=path.join(data,'Local Storage');
      if(await exists(local))await fs.cp(local,path.join(staging,'Local Storage'),{recursive:true,filter:src=>path.basename(src)!=='LOCK'});
      await fs.rename(staging,snapshot);
    }
    await fs.writeFile(marker,JSON.stringify({at:new Date().toISOString()}));
  }
  const db=path.join(snapshot,'Local Storage/leveldb');
  if(!await exists(db))return mergeOrigins([]);
  report('正在恢复旧版聊天与界面设置…');
  const python=path.join(resources,'runtime/python/cpython-3.11.15-windows-x86_64-none/python.exe');
  const candidates=await new Promise((resolve,reject)=>execFile(python,['-I','-B',path.join(bridgeResources,'bridge/storage_origins.py'),db],{windowsHide:true,encoding:'utf8',timeout:90000,maxBuffer:1024*1024},(error,stdout)=>{if(error)return reject(new Error('旧版数据读取失败，备份已保留。请重试或查看日志。'));try{resolve(JSON.parse(stdout));}catch{reject(new Error('旧版存储列表无效。'));}}));
  // The copy is Chromium's only writable input. The backup and original are never opened by it.
  const reader=path.join(backup,'reader-'+Date.now());await fs.cp(snapshot,reader,{recursive:true});
  const sess=session.fromPath(reader,{cache:false});
  const allowed=new Set(candidates.map(c=>c.origin));
  await sess.protocol.handle('http',request=>{
    const u=new URL(request.url);
    if(!allowed.has(u.origin)||u.pathname!=='/'||request.method!=='GET')return new Response('',{status:403});
    return new Response('<!doctype html><title>MediaSail recovery reader</title>',{headers:{'content-type':'text/html','Content-Security-Policy':"default-src 'none'; connect-src 'none'"}});
  });
  await sess.protocol.handle('https',()=>new Response('',{status:403}));
  sess.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  const window=new BrowserWindow({show:false,webPreferences:{session:sess,sandbox:true,contextIsolation:true,nodeIntegration:false}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  const sources=[];
  try{
    for(const candidate of candidates){
      await window.loadURL(candidate.origin+'/');
      const values=await window.webContents.executeJavaScript(`Object.fromEntries(Object.entries(localStorage).filter(([key])=>${JSON.stringify([...LEGACY_KEYS])}.includes(key)))`);
      // A local origin without the app's own storage keys contributes nothing.
      if(Object.keys(values).length)sources.push({...candidate,values});
    }
    await fs.writeFile(path.join(backup,'live-values.json'),JSON.stringify(sources));
    return mergeOrigins(sources);
  }finally{window.destroy();sess.protocol.unhandle('http');sess.protocol.unhandle('https');}
}
module.exports={migrateUiState};

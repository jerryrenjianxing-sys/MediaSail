const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');

const MARKER='.mediasail-library.json';
const LOCATION='library-location.json';
const SELECTION='library-selection.ini';
const TRANSACTION='library-migration.json';
const BOOTSTRAP_FILES=new Set([LOCATION,LOCATION+'.previous',SELECTION,TRANSACTION,TRANSACTION+'.previous','library-migration-last.json','library-migration-last.json.previous','library-migration-deferred.json','agent-connection.json']);
const within=(root,file)=>{const r=path.relative(path.resolve(root),path.resolve(file));return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
function json(file,optional=true){try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}catch(e){if(optional&&e.code==='ENOENT')return null;throw new Error('资料库配置无法读取，原文件已保留：'+file+'。'+e.message);}}
function validateMarker(value){return value&&value.schema===1&&value.product==='MediaSail'&&typeof value.libraryId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(value.libraryId)&&value.state==='ready';}
function installerSeed(marker,root,requested){return marker?.schema===1&&marker.product==='MediaSail'&&marker.state==='initializing'&&marker.owner==='nsis'&&/^[a-zA-Z0-9-]{8,80}$/.test(marker.libraryId||'')&&requested&&path.resolve(root)===path.resolve(requested)&&marker.cache?.path==='runtime/update-cache/mediasail-updater/installer.exe'&&/^[a-f0-9]{64}$/.test(marker.cache.sha256||'');}
function readyDirectories(root){return ['workspace','runtime'].every(name=>{try{const stat=fs.lstatSync(path.join(root,name));return stat.isDirectory()&&!stat.isSymbolicLink();}catch(e){if(e.code==='ENOENT')return false;throw e;}});}
function layout(root,bootstrapRoot,id=null){root=path.resolve(root);return {mode:'library',libraryRoot:root,dataRoot:path.join(root,'runtime'),workspace:path.join(root,'workspace'),agentSkillRoot:path.join(root,'agent-skill','mediasail'),connectionFile:path.join(root,'runtime','agent-connection.json'),bootstrapRoot:path.resolve(bootstrapRoot),libraryId:id};}
function legacy(root){root=path.resolve(root);return {mode:'legacy',libraryRoot:null,dataRoot:root,workspace:path.join(root,'workspace'),agentSkillRoot:null,connectionFile:path.join(root,'agent-connection.json'),bootstrapRoot:root,libraryId:null,needsPreparation:false,legacyNeedsPrompt:false};}
function selection(bootstrapRoot){try{const text=fs.readFileSync(path.join(bootstrapRoot,SELECTION),'utf8').replace(/^\uFEFF/,'');const found=/^root=(.+)$/mi.exec(text);return found?.[1].trim()||null;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
function hasLegacy(bootstrapRoot){return ['workspace','home','Partitions','ui-state.json'].some(name=>fs.existsSync(path.join(bootstrapRoot,name)));}
function readLocation({bootstrapRoot,defaultLibraryRoot,explicitDataRoot}={}){
  if(explicitDataRoot)return legacy(explicitDataRoot);
  if(!bootstrapRoot||!defaultLibraryRoot)throw new Error('缺少资料库位置。');
  bootstrapRoot=path.resolve(bootstrapRoot);
  const stored=json(path.join(bootstrapRoot,LOCATION));
  if(stored&&(stored.schema!==1||stored.product!=='MediaSail'||!stored.libraryRoot))throw new Error('资料库位置配置无效，未创建空库。');
  const requested=selection(bootstrapRoot);
  const root=stored?.libraryRoot||requested||defaultLibraryRoot;
  const result=layout(root,bootstrapRoot,stored?.libraryId||null);
  const pending=json(path.join(bootstrapRoot,TRANSACTION));
  let marker;try{marker=json(path.join(result.libraryRoot,MARKER));}catch(e){if(!pending)throw e;marker=null;}
  if(stored?.state==='ready'&&(!validateMarker(marker)||!readyDirectories(result.libraryRoot))&&!pending)throw new Error('已选资料库暂不可用或标记缺失，未切换到空库。请检查磁盘和资料库位置。');
  if(marker&&!validateMarker(marker)&&!installerSeed(marker,result.libraryRoot,requested))throw new Error('资料库标记无效，未覆盖原内容。');
  if(stored?.libraryId&&marker&&stored.libraryId!==marker.libraryId)throw new Error('资料库身份发生变化，未自动载入其他资料。');
  if(marker)result.libraryId=marker.libraryId;
  result.hasCommittedLocation=stored?.state==='ready';
  result.needsPreparation=stored?.state!=='ready'||!marker||fs.existsSync(path.join(bootstrapRoot,TRANSACTION));
  result.legacyNeedsPrompt=!stored&&!requested&&!fs.existsSync(path.join(bootstrapRoot,TRANSACTION))&&hasLegacy(bootstrapRoot);
  return result;
}
async function atomic(file,value){
  await fsp.mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+process.pid+'.tmp',handle=await fsp.open(temp,'w');
  try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}
  try{await fsp.copyFile(file,file+'.previous');}catch(e){if(e.code!=='ENOENT')throw e;}
  await fsp.rename(temp,file);
}
async function assertPlainAncestors(root){
  let candidate=path.resolve(root);
  while(true){
    try{const stat=await fsp.lstat(candidate);if(stat.isSymbolicLink())throw new Error('资料库位置不能经过目录链接或联接点。');}
    catch(e){if(e.code!=='ENOENT')throw e;}
    const parent=path.dirname(candidate);if(parent===candidate)break;candidate=parent;
  }
}
async function validateTarget(targetRoot,{bootstrapRoot,installDirectory,sourceRoot}={}){
  if(typeof targetRoot!=='string'||!path.isAbsolute(targetRoot)||/[\r\n\0"]/.test(targetRoot))throw new Error('请选择完整的本地资料库路径。');
  const root=path.resolve(targetRoot);
  if(root===path.parse(root).root||root.startsWith('\\\\'))throw new Error('请选择本地磁盘内的专用资料库目录。');
  for(const forbidden of [bootstrapRoot,installDirectory,process.env.APPDATA,process.env.LOCALAPPDATA,process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.SystemRoot]){
    if(forbidden&&(within(forbidden,root)||within(root,forbidden)))throw new Error('资料库不能位于 AppData、程序或系统目录内，也不能包含这些目录。');
  }
  if(sourceRoot&&path.resolve(sourceRoot)!==root&&(within(sourceRoot,root)||within(root,sourceRoot)))throw new Error('新旧资料库不能互相包含。');
  await assertPlainAncestors(root);
  return root;
}
async function directoryEntries(root){try{return await fsp.readdir(root,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function digest(file){const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function scan(root,prefix='',files=[],directories=[],ignore=()=>false){
  for(const entry of (await directoryEntries(path.join(root,prefix))).sort((a,b)=>a.name.localeCompare(b.name))){
    const rel=prefix?prefix+'/'+entry.name:entry.name,full=path.join(root,rel);if(ignore(rel))continue;
    if(entry.isSymbolicLink())throw new Error('迁移源包含目录链接，已停止且保留原资料：'+full);
    if(entry.isDirectory()){directories.push(rel);await scan(root,rel,files,directories,ignore);}
    else if(entry.isFile()){const stat=await fsp.stat(full);files.push({source:rel,size:stat.size,hash:await digest(full)});}
  }
  return {files,directories};
}
function sourceTarget(rel,sourceMode){return sourceMode==='legacy'?(rel==='workspace'?'workspace':rel.startsWith('workspace/')?rel:'runtime/'+rel):rel;}
function ignoreLegacy(rel){const top=rel.split('/')[0];return BOOTSTRAP_FILES.has(top)||top==='migration-ui'||top.startsWith(TRANSACTION+'.')||top.startsWith(LOCATION+'.')||top.startsWith('Singleton')||top==='lockfile';}
async function makeTransaction({bootstrapRoot,current,targetRoot,mode,installDirectory}){
  if(current?.mode==='error'){
    const stored=json(path.join(bootstrapRoot,LOCATION));
    if(stored?.schema===1&&stored.product==='MediaSail'&&stored.state==='ready'&&stored.libraryRoot&&stored.libraryId)current={...layout(stored.libraryRoot,bootstrapRoot,stored.libraryId),hasCommittedLocation:true};
  }
  const fromLibrary=current?.mode==='library'&&current.libraryId&&current.hasCommittedLocation!==false;
  const sourceMode=fromLibrary?'library':hasLegacy(bootstrapRoot)?'legacy':'empty';
  const sourceRoot=sourceMode==='library'?current.libraryRoot:sourceMode==='legacy'?path.resolve(bootstrapRoot):null;
  const target=await validateTarget(targetRoot,{bootstrapRoot,installDirectory,sourceRoot});
  const targetMarker=json(path.join(target,MARKER));
  if(mode==='existing'){
    if(!validateMarker(targetMarker)||!readyDirectories(target))throw new Error('所选目录不是可识别的完整 MediaSail 资料库。');
  }else{
    const entries=await directoryEntries(target);
    if(entries.length){
      if(!installerSeed(targetMarker,target,selection(bootstrapRoot)))throw new Error('迁移目标不是空目录。请选择新目录，或使用“切换到已有资料库”。');
      const seeded=await scan(target),allowed=new Set([MARKER,MARKER+'.previous',targetMarker.cache.path]);
      if(seeded.files.some(file=>!allowed.has(file.source))||!seeded.files.some(file=>file.source===targetMarker.cache.path&&file.hash===targetMarker.cache.sha256))throw new Error('安装器准备的资料库缓存不完整或已变化，未覆盖任何资料。');
    }
  }
  return {schema:1,product:'MediaSail',id:crypto.randomUUID(),phase:'pending',mode,sourceMode,sourceRoot,targetRoot:target,libraryId:mode==='existing'?targetMarker.libraryId:current?.libraryId||crypto.randomUUID(),previousLibraryRoot:fromLibrary?current.libraryRoot:null,previousLibraryId:fromLibrary?current.libraryId:null,createdAt:new Date().toISOString(),files:null,directories:null};
}
async function queueLibraryChange({bootstrapRoot,current,targetRoot,mode='move',installDirectory,explicitDataRoot}={}){
  if(explicitDataRoot||current?.mode==='legacy'&&current.dataRoot!==path.resolve(bootstrapRoot))throw new Error('隔离测试目录不修改默认资料库选择。');
  if(!['move','existing'].includes(mode))throw new Error('不支持的资料库切换方式。');
  const pending=path.join(bootstrapRoot,TRANSACTION);
  if(fs.existsSync(pending))throw new Error('已有资料库迁移待完成，请先重启并完成该操作。');
  const txn=await makeTransaction({bootstrapRoot,current,targetRoot,mode,installDirectory});
  await atomic(pending,txn);return {ok:true,pending:true,targetRoot:txn.targetRoot,mode:txn.mode};
}
function safeRelative(rel){return typeof rel==='string'&&rel&&!path.isAbsolute(rel)&&!rel.split(/[\\/]/).some(part=>part==='..'||part==='.'||!part);}
function checkTransaction(txn){
  if(!txn||txn.schema!==1||txn.product!=='MediaSail'||!/^[a-zA-Z0-9-]{8,80}$/.test(txn.id||'')||!txn.targetRoot||!['move','existing'].includes(txn.mode)||!['empty','legacy','library'].includes(txn.sourceMode))throw new Error('资料库迁移记录无效，原资料已保留。');
  if(txn.files&&(!Array.isArray(txn.files)||txn.files.some(item=>!safeRelative(item.source)||!/^[a-f0-9]{64}$/.test(item.hash)||!Number.isSafeInteger(item.size)||item.size<0)))throw new Error('资料库迁移文件清单无效。');
  if(txn.directories&&(!Array.isArray(txn.directories)||txn.directories.some(rel=>!safeRelative(rel))))throw new Error('资料库迁移目录清单无效。');
  if(txn.sourceMode!=='empty'&&(!txn.sourceRoot||!path.isAbsolute(txn.sourceRoot)))throw new Error('资料库迁移来源无效。');
}
async function prepareLibrary({bootstrapRoot,defaultLibraryRoot,installDirectory,explicitDataRoot,onProgress=()=>{}}={}){
  if(explicitDataRoot)return legacy(explicitDataRoot);
  bootstrapRoot=path.resolve(bootstrapRoot);
  let current=readLocation({bootstrapRoot,defaultLibraryRoot});
  if(!current.needsPreparation)return current;
  const transactionFile=path.join(bootstrapRoot,TRANSACTION);
  let txn=json(transactionFile);
  if(!txn){
    const marker=json(path.join(current.libraryRoot,MARKER));
    txn=await makeTransaction({bootstrapRoot,current,targetRoot:current.libraryRoot,mode:validateMarker(marker)?'existing':'move',installDirectory});
    await atomic(transactionFile,txn);
  }
  checkTransaction(txn);
  await validateTarget(txn.targetRoot,{bootstrapRoot,installDirectory,sourceRoot:txn.sourceRoot});
  const destination=layout(txn.targetRoot,bootstrapRoot,txn.libraryId);
  const notify=value=>onProgress({phase:txn.phase,targetRoot:txn.targetRoot,files:0,totalFiles:0,bytes:0,totalBytes:0,...value});
  try{
    if(txn.mode==='move'){
      if(txn.sourceMode!=='empty'){
        let sourceStat;try{sourceStat=await fsp.lstat(txn.sourceRoot);}catch(e){throw new Error('源资料库暂不可用，未创建或切换到空库。请恢复原磁盘后重试。'+e.message);}
        if(!sourceStat.isDirectory()||sourceStat.isSymbolicLink())throw new Error('源资料库目录无法确认，未切换资料库。');
        if(txn.sourceMode==='library'){
          const sourceMarker=json(path.join(txn.sourceRoot,MARKER));
          if(!validateMarker(sourceMarker)||sourceMarker.libraryId!==txn.libraryId||!readyDirectories(txn.sourceRoot))throw new Error('源资料库暂不可用或身份变化，未切换到空库。');
        }else if(!hasLegacy(txn.sourceRoot))throw new Error('旧资料目录已变化，未创建或切换到空库。');
      }
      if(!txn.files){
        txn.phase='scanning';notify({});
        const snapshot=txn.sourceMode==='empty'?{files:[],directories:[]}:await scan(txn.sourceRoot,'',[],[],txn.sourceMode==='legacy'?ignoreLegacy:()=>false);
        txn.files=snapshot.files.filter(file=>!(txn.sourceMode==='legacy'&&ignoreLegacy(file.source))&&file.source!==MARKER&&file.source!==MARKER+'.previous');
        txn.directories=snapshot.directories.filter(rel=>!(txn.sourceMode==='legacy'&&ignoreLegacy(rel)));
        txn.phase='copying';await atomic(transactionFile,txn);
      }
      for(const rel of txn.directories){const target=path.join(destination.libraryRoot,sourceTarget(rel,txn.sourceMode));await assertPlainAncestors(target);await fsp.mkdir(target,{recursive:true});}
      const totalBytes=txn.files.reduce((sum,file)=>sum+file.size,0);let bytes=0,files=0;
      for(const item of txn.files){
        const source=path.join(txn.sourceRoot,item.source),target=path.join(destination.libraryRoot,sourceTarget(item.source,txn.sourceMode));
        if(!within(txn.sourceRoot,source)||!within(destination.libraryRoot,target))throw new Error('迁移清单路径无效。');
        await assertPlainAncestors(path.dirname(target));await fsp.mkdir(path.dirname(target),{recursive:true});
        const stat=await fsp.stat(source);
        if(stat.size!==item.size)throw new Error('迁移期间原文件发生变化，请停止外部写入后取消本次迁移、选择新目录重试：'+item.source);
        let valid=false;try{valid=(await fsp.stat(target)).size===item.size&&await digest(target)===item.hash;}catch(e){if(e.code!=='ENOENT')throw e;}
        if(!valid){const temp=target+'.mediasail-migration-'+txn.id;await fsp.copyFile(source,temp);if(await digest(temp)!==item.hash)throw new Error('迁移文件校验失败：'+item.source);await fsp.rename(temp,target);}
        await fsp.utimes(target,stat.atime,stat.mtime);
        bytes+=item.size;files++;notify({files,totalFiles:txn.files.length,bytes,totalBytes});
      }
      txn.phase='verifying';await atomic(transactionFile,txn);notify({files,totalFiles:txn.files.length,bytes,totalBytes});
      const finalScan=txn.sourceMode==='empty'?{files:[],directories:[]}:await scan(txn.sourceRoot,'',[],[],txn.sourceMode==='legacy'?ignoreLegacy:()=>false);
      const finalFiles=finalScan.files.filter(file=>file.source!==MARKER&&file.source!==MARKER+'.previous');
      const originalFiles=new Map(txn.files.map(item=>[item.source,item]));
      if(finalFiles.length!==txn.files.length||finalFiles.some(item=>!originalFiles.has(item.source)||originalFiles.get(item.source).hash!==item.hash)||JSON.stringify([...finalScan.directories].sort())!==JSON.stringify([...txn.directories].sort()))throw new Error('迁移完成前文件已变化，未切换资料库。请停止外部写入后，取消本次迁移并选择新目录重试。');
      for(const item of txn.files){const target=path.join(destination.libraryRoot,sourceTarget(item.source,txn.sourceMode));if(await digest(target)!==item.hash)throw new Error('迁移目标核验失败，未切换资料库：'+item.source);}
      for(const rel of [...txn.directories].sort((a,b)=>b.length-a.length)){const stat=await fsp.stat(path.join(txn.sourceRoot,rel));await fsp.utimes(path.join(destination.libraryRoot,sourceTarget(rel,txn.sourceMode)),stat.atime,stat.mtime);}
      for(const name of ['workspace','runtime','agent-skill'])await fsp.mkdir(path.join(destination.libraryRoot,name),{recursive:true});
      const marker={schema:1,product:'MediaSail',libraryId:txn.libraryId,state:'ready',createdAt:txn.createdAt,migratedFrom:txn.sourceRoot||null};
      await atomic(path.join(destination.libraryRoot,MARKER),marker);
    }else if(!validateMarker(json(path.join(destination.libraryRoot,MARKER)))||!readyDirectories(destination.libraryRoot))throw new Error('已有资料库身份无法确认。');
    txn.phase='committing';await atomic(transactionFile,txn);notify({});
    const record={schema:1,product:'MediaSail',state:'ready',libraryRoot:destination.libraryRoot,libraryId:destination.libraryId,previousLibraryRoot:txn.previousLibraryRoot||null,previousLibraryId:txn.previousLibraryId||null,previousDataRoot:txn.sourceRoot,updatedAt:new Date().toISOString()};
    await atomic(path.join(bootstrapRoot,LOCATION),record);
    txn.phase='complete';await atomic(transactionFile,txn);
    const archive=path.join(bootstrapRoot,'library-migration-last.json');await atomic(archive,{...txn,files:undefined,directories:undefined});
    await fsp.unlink(transactionFile);await fsp.unlink(transactionFile+'.previous').catch(e=>{if(e.code!=='ENOENT')throw e;});
    current=readLocation({bootstrapRoot,defaultLibraryRoot});notify({phase:'complete',files:txn.files?.length||0,totalFiles:txn.files?.length||0,bytes:txn.files?.reduce((s,f)=>s+f.size,0)||0,totalBytes:txn.files?.reduce((s,f)=>s+f.size,0)||0});return current;
  }catch(e){txn.error=e.message;await atomic(transactionFile,txn).catch(()=>{});throw e;}
}
function libraryStatus({bootstrapRoot,current}={}){const pending=json(path.join(bootstrapRoot,TRANSACTION));return {mode:current?.mode||'library',libraryRoot:current?.libraryRoot||null,dataRoot:current?.dataRoot,workspace:current?.workspace,libraryId:current?.libraryId||null,pending:pending?{targetRoot:pending.targetRoot,mode:pending.mode,phase:pending.phase,error:pending.error||null}:null};}
async function archivePending(bootstrapRoot,reason){const file=path.join(bootstrapRoot,TRANSACTION),pending=json(file);if(!pending)return null;const archive=path.join(bootstrapRoot,TRANSACTION+'.'+reason+'-'+Date.now()+'.json');await fsp.rename(file,archive);await fsp.unlink(file+'.previous').catch(e=>{if(e.code!=='ENOENT')throw e;});return archive;}
async function cancelPending({bootstrapRoot}={}){
  const pending=json(path.join(bootstrapRoot,TRANSACTION));if(!pending)return {ok:true,pending:false};
  const stored=json(path.join(bootstrapRoot,LOCATION));
  if(stored?.state==='ready'&&path.resolve(stored.libraryRoot)===path.resolve(pending.targetRoot))throw new Error('资料库位置已经提交，请使用回退到上一资料库；新旧文件均已保留。');
  const archive=await archivePending(bootstrapRoot,'cancelled');return {ok:true,pending:false,archive,preservedTarget:pending.targetRoot};
}
async function rollbackLocation({bootstrapRoot}={}){
  const file=path.join(bootstrapRoot,LOCATION),stored=json(file);
  if(!stored||stored.state!=='ready')throw new Error('没有已提交的资料库可以回退。');
  const backup=path.join(bootstrapRoot,'library-location-rollback-'+Date.now()+'.json');await atomic(backup,stored);
  if(stored.previousLibraryRoot){
    const marker=json(path.join(stored.previousLibraryRoot,MARKER));
    if(!validateMarker(marker)||!readyDirectories(stored.previousLibraryRoot)||stored.previousLibraryId&&marker.libraryId!==stored.previousLibraryId)throw new Error('上一资料库暂不可用或身份变化，未修改当前选择。');
    await atomic(file,{schema:1,product:'MediaSail',state:'ready',libraryRoot:path.resolve(stored.previousLibraryRoot),libraryId:marker.libraryId,updatedAt:new Date().toISOString(),rolledBackFrom:stored.libraryRoot});
    await archivePending(bootstrapRoot,'rolled-back');return {ok:true,mode:'library',libraryRoot:path.resolve(stored.previousLibraryRoot),preservedTarget:stored.libraryRoot};
  }
  if(stored.previousDataRoot&&path.resolve(stored.previousDataRoot)===path.resolve(bootstrapRoot)&&hasLegacy(bootstrapRoot)){
    await atomic(path.join(bootstrapRoot,'library-migration-deferred.json'),{schema:1,product:'MediaSail',deferredAt:new Date().toISOString(),reason:'rollback',preservedTarget:stored.libraryRoot});
    await fsp.unlink(file);await fsp.unlink(path.join(bootstrapRoot,SELECTION)).catch(e=>{if(e.code!=='ENOENT')throw e;});await archivePending(bootstrapRoot,'rolled-back');return {ok:true,mode:'legacy',dataRoot:path.resolve(bootstrapRoot),preservedTarget:stored.libraryRoot};
  }
  throw new Error('没有可核实的旧资料库，当前选择和全部文件已保留。');
}
module.exports={MARKER,LOCATION,SELECTION,TRANSACTION,readLocation,prepareLibrary,queueLibraryChange,libraryStatus,validateTarget,layout,cancelPending,rollbackLocation};

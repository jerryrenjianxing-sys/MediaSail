const fs=require('node:fs');
const fsp=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');

const MARKER='.mediasail-library.json';
const LOCATION='library-location.json';
// Old selection/migration records are retired metadata, never executable work.
const SELECTION='library-selection.ini';
const TRANSACTION='library-migration.json';
const SELECTION_POLICY='direct-v1';
const INITIALIZATION_OWNER='mediasail-direct-selection';
const choiceQueues=new Map();
const within=(root,file)=>{const rel=path.relative(path.resolve(root),path.resolve(file));return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};

function json(file,optional=true){
  try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));}
  catch(error){if(optional&&error.code==='ENOENT')return null;throw new Error('资料库配置无法读取，原文件已保留：'+file+'。'+error.message);}
}
function validIdentity(value){return value?.schema===1&&value.product==='MediaSail'&&/^[a-zA-Z0-9-]{8,80}$/.test(value.libraryId||'');}
function validateMarker(value){return validIdentity(value)&&value.state==='ready';}
function readMarker(root,optional=true){
  const file=path.join(root,MARKER);
  try{const stat=fs.lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('资料库标记不是普通文件，原内容已保留。');}catch(error){if(optional&&error.code==='ENOENT')return null;throw error;}
  return json(file,false);
}
function assertOptionalSkillDirectories(root){
  for(const relative of ['agent-skill',path.join('agent-skill','mediasail')]){
    const directory=path.join(root,relative);
    try{const stat=fs.lstatSync(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('资料库 Skill 位置必须是普通文件夹，原内容未改动：'+directory);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
}
function readyDirectories(root){
  assertOptionalSkillDirectories(root);
  return ['workspace','runtime'].every(name=>{try{const stat=fs.lstatSync(path.join(root,name));return stat.isDirectory()&&!stat.isSymbolicLink();}catch(error){if(error.code==='ENOENT')return false;throw error;}});
}
function assertPlainAncestorsSync(root){
  for(let candidate=path.resolve(root);;){
    try{if(fs.lstatSync(candidate).isSymbolicLink())throw new Error('资料库位置不能经过目录链接或联接点。');}catch(error){if(error.code!=='ENOENT')throw error;}
    const parent=path.dirname(candidate);if(parent===candidate)return;candidate=parent;
  }
}
function layout(root,bootstrapRoot,id=null){
  root=path.resolve(root);return {mode:'library',libraryRoot:root,dataRoot:path.join(root,'runtime'),workspace:path.join(root,'workspace'),agentSkillRoot:path.join(root,'agent-skill','mediasail'),connectionFile:path.join(root,'runtime','agent-connection.json'),bootstrapRoot:path.resolve(bootstrapRoot),libraryId:id,selectionPolicy:SELECTION_POLICY,needsSelection:false,needsPreparation:false,legacyNeedsPrompt:false,hasCommittedLocation:true};
}
function legacy(root){root=path.resolve(root);return {mode:'legacy',libraryRoot:null,dataRoot:root,workspace:path.join(root,'workspace'),agentSkillRoot:null,connectionFile:path.join(root,'agent-connection.json'),bootstrapRoot:root,libraryId:null,needsSelection:false,needsPreparation:false,legacyNeedsPrompt:false};}
function unselected(bootstrapRoot,defaultLibraryRoot,reason,selectionError=null){
  return {mode:'unselected',bootstrapRoot:path.resolve(bootstrapRoot),libraryRoot:null,dataRoot:null,workspace:null,agentSkillRoot:null,connectionFile:null,libraryId:null,defaultLibraryRoot:defaultLibraryRoot?path.resolve(defaultLibraryRoot):null,needsSelection:true,needsPreparation:false,legacyNeedsPrompt:false,hasCommittedLocation:false,reason,selectionError};
}
function readLocation({bootstrapRoot,defaultLibraryRoot,explicitDataRoot}={}){
  if(explicitDataRoot)return legacy(explicitDataRoot);
  if(!bootstrapRoot)throw new Error('缺少资料库选择记录的位置。');
  bootstrapRoot=path.resolve(bootstrapRoot);
  let stored;
  try{stored=json(path.join(bootstrapRoot,LOCATION));}
  catch(error){return unselected(bootstrapRoot,defaultLibraryRoot,'location-unreadable',error.message);}
  // Every upgrade from the old copying policy chooses once. Do not inspect the
  // previous library, its data, installer selection, or any pending transaction.
  if(!stored||stored.selectionPolicy!==SELECTION_POLICY)return unselected(bootstrapRoot,defaultLibraryRoot,stored?'selection-required-after-upgrade':'first-selection');
  if(!validIdentity(stored)||stored.state!=='ready'||typeof stored.libraryRoot!=='string'||!path.isAbsolute(stored.libraryRoot))throw new Error('已保存的资料库位置配置无效，请重新选择；未创建空库。');
  const root=path.resolve(stored.libraryRoot);
  try{
    assertPlainAncestorsSync(root);
    const marker=readMarker(root,false);
    if(!validateMarker(marker)||!readyDirectories(root))throw new Error('资料库标记或基础目录不完整。');
    if(marker.libraryId!==stored.libraryId)throw new Error('资料库身份发生变化。');
  }catch(error){throw new Error('已选资料库暂不可用，未创建或切换到空库。请检查磁盘，或重新选择有效资料库。'+error.message);}
  return layout(root,bootstrapRoot,stored.libraryId);
}
async function atomic(file,value){
  await fsp.mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+process.pid+'.'+crypto.randomUUID()+'.tmp';
  let handle;
  try{
    handle=await fsp.open(temp,'wx');await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();await handle.close();handle=null;
    try{await fsp.copyFile(file,file+'.previous');}catch(error){if(error.code!=='ENOENT')throw error;}
    await fsp.rename(temp,file);
  }finally{if(handle)await handle.close();await fsp.unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});}
}
async function validateTarget(targetRoot,{bootstrapRoot,installDirectory}={}){
  if(typeof targetRoot!=='string'||!path.isAbsolute(targetRoot)||/[\r\n\0"]/.test(targetRoot))throw new Error('请选择完整的本地资料库路径。');
  const root=path.resolve(targetRoot);
  if(root===path.parse(root).root||root.startsWith('\\\\'))throw new Error('请选择本地磁盘内的专用资料库文件夹。');
  for(const forbidden of [bootstrapRoot,installDirectory,process.env.APPDATA,process.env.LOCALAPPDATA,process.env.ProgramFiles,process.env['ProgramFiles(x86)'],process.env.SystemRoot]){
    if(forbidden&&(within(forbidden,root)||within(root,forbidden)))throw new Error('资料库不能位于 AppData、程序或系统目录内，也不能包含这些目录。');
  }
  assertPlainAncestorsSync(root);
  try{if(!fs.lstatSync(root).isDirectory())throw new Error('请选择资料库文件夹，不能选择文件。');}catch(error){if(error.code!=='ENOENT')throw error;}
  return root;
}
async function entries(root){try{return await fsp.readdir(root,{withFileTypes:true});}catch(error){if(error.code==='ENOENT')return [];throw error;}}
async function verifyWritableDirectories(root){
  const directories=[root,path.join(root,'runtime'),path.join(root,'workspace')];
  for(const relative of ['agent-skill',path.join('agent-skill','mediasail')]){
    const directory=path.join(root,relative);
    try{await fsp.lstat(directory);directories.push(directory);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  for(const directory of directories){
    const file=path.join(directory,'.mediasail-write-check-'+process.pid+'-'+crypto.randomUUID()+'.tmp');
    let handle,created=false,failure;
    try{handle=await fsp.open(file,'wx');created=true;await handle.writeFile('MediaSail library write check\n');await handle.sync();}
    catch(error){failure=error;}
    finally{
      if(handle)try{await handle.close();}catch(error){failure??=error;}
      // Remove only the exact random file this probe exclusively created. An
      // open failure (including EEXIST) never grants permission to unlink it.
      if(created)try{await fsp.unlink(file);}catch(error){failure??=error;}
    }
    if(failure)throw new Error('所选资料库无法写入或保存，未更改当前选择。请检查权限或选择其他文件夹：'+directory+'。'+failure.message);
  }
}
async function archiveLegacyMetadata({bootstrapRoot}={}){
  if(!bootstrapRoot)throw new Error('缺少资料库选择记录的位置。');
  const archived=[],warnings=[];
  for(const name of [TRANSACTION,TRANSACTION+'.previous',SELECTION,'library-migration-deferred.json']){
    const file=path.join(bootstrapRoot,name);let stat;
    try{stat=await fsp.lstat(file);}catch(error){if(error.code==='ENOENT')continue;warnings.push('旧记录未能归档，已忽略且保留原样：'+file+'。'+error.message);continue;}
    if(!stat.isFile()||stat.isSymbolicLink()){warnings.push('旧选库记录不是普通文件，已忽略且保留原样：'+file);continue;}
    const destination=file+'.retired-'+Date.now()+'-'+crypto.randomUUID();
    // Rename metadata itself; never parse source/target paths or traverse data.
    try{await fsp.rename(file,destination);archived.push({from:file,to:destination});}catch(error){warnings.push('旧记录未能归档，已忽略且保留原样：'+file+'。'+error.message);}
  }
  return {ok:true,archived,warnings};
}
async function initializeOrOpen(root){
  const marker=readMarker(root);
  if(validateMarker(marker)){
    if(!readyDirectories(root))throw new Error('所选资料库标记存在，但基础目录不完整；未创建空目录代替原资料。');
    return marker;
  }
  const contents=await entries(root);
  const resuming=validIdentity(marker)&&marker.state==='initializing'&&marker.owner===INITIALIZATION_OWNER;
  if(contents.length&&!resuming)throw new Error('所选文件夹不是空目录，也不是完整的 MediaSail 资料库。请选空文件夹或有效资料库；原内容未改动。');
  if(resuming){
    const allowed=new Set([MARKER,MARKER+'.previous','workspace','runtime','agent-skill']);
    if(contents.some(entry=>!allowed.has(entry.name)))throw new Error('未完成初始化的文件夹中出现其他内容，未覆盖；请选其他空文件夹。');
  }
  await fsp.mkdir(root,{recursive:true});
  const initializing=resuming?marker:{schema:1,product:'MediaSail',libraryId:crypto.randomUUID(),state:'initializing',owner:INITIALIZATION_OWNER,createdAt:new Date().toISOString()};
  if(!resuming)await atomic(path.join(root,MARKER),initializing);
  for(const name of ['workspace','runtime','agent-skill']){
    const directory=path.join(root,name);
    try{const stat=await fsp.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('基础目录不是普通文件夹，未修改：'+directory);}catch(error){if(error.code!=='ENOENT')throw error;}
    await fsp.mkdir(directory,{recursive:true});
  }
  assertOptionalSkillDirectories(root);
  const ready={schema:1,product:'MediaSail',libraryId:initializing.libraryId,state:'ready',createdAt:initializing.createdAt};
  await atomic(path.join(root,MARKER),ready);return ready;
}
async function chooseUnlocked({bootstrapRoot,targetRoot,installDirectory,explicitDataRoot}={}){
  if(explicitDataRoot)throw new Error('隔离测试目录不修改默认资料库选择。');
  if(!bootstrapRoot)throw new Error('缺少资料库选择记录的位置。');
  bootstrapRoot=path.resolve(bootstrapRoot);
  const root=await validateTarget(targetRoot,{bootstrapRoot,installDirectory});
  const marker=await initializeOrOpen(root);
  await verifyWritableDirectories(root);
  const retirement=await archiveLegacyMetadata({bootstrapRoot});
  const record={schema:1,product:'MediaSail',state:'ready',selectionPolicy:SELECTION_POLICY,libraryRoot:root,libraryId:marker.libraryId,selectedAt:new Date().toISOString()};
  // Commit only after a complete chosen library exists. No old source is read,
  // moved, copied, deleted, or consulted to populate the new library.
  await atomic(path.join(bootstrapRoot,LOCATION),record);
  return {...layout(root,bootstrapRoot,marker.libraryId),archivedMetadata:retirement.archived,metadataWarnings:retirement.warnings};
}
function chooseLibrary(options={}){
  const key=path.resolve(options.bootstrapRoot||'.'),previous=choiceQueues.get(key)||Promise.resolve();
  const result=previous.then(()=>chooseUnlocked(options));
  const settled=result.then(()=>{},()=>{});choiceQueues.set(key,settled);
  void settled.then(()=>{if(choiceQueues.get(key)===settled)choiceQueues.delete(key);});return result;
}
function libraryStatus({bootstrapRoot,current}={}){
  const value=current||readLocation({bootstrapRoot});
  return {mode:value.mode,needsSelection:Boolean(value.needsSelection),libraryRoot:value.libraryRoot||null,dataRoot:value.dataRoot||null,workspace:value.workspace||null,libraryId:value.libraryId||null,selectionPolicy:value.selectionPolicy||null,pending:null};
}
module.exports={MARKER,LOCATION,SELECTION,TRANSACTION,SELECTION_POLICY,readLocation,chooseLibrary,libraryStatus,validateTarget,layout,archiveLegacyMetadata};

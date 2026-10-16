// Adopt only the current installer's explicit baseline. Never discover a former
// library, parse old selections or sweep legacy updater caches.
const fs=require('node:fs/promises'),raw=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PUBLISHED=new Set(['13d2946e4e9bab7faa31d0714d73ad83401d44c3543c9c2aed5822138bc2f0d6','1f7d9b2dd9a51b04a3b6aeafa4087b717d8ae7a238f01201ef9becac28be55ed']);
async function plain(file){for(let part=path.resolve(file);;){try{if((await fs.lstat(part)).isSymbolicLink())throw Error('安装器缓存路径包含链接，保留原文件。');}catch(error){if(error.code!=='ENOENT')throw error;}const parent=path.dirname(part);if(parent===part)return;part=parent;}}
async function digest(file){const stat=await fs.lstat(file);if(!stat.isFile())throw Error('安装器缓存不是普通文件。');const hash=crypto.createHash('sha256');for await(const chunk of raw.createReadStream(file))hash.update(chunk);return {bytes:stat.size,sha256:hash.digest('hex')};}
async function adoptInstallerBaseline({updater,bootstrapRoot,version,report=()=>{}}){
 const result={adopted:false,matched:false,replacedManagedBaseline:false,stagingRemoved:false,skipped:null,error:null};let temporary,backup,mapBackup,target,record;
 try{
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('当前版本无效。');
  const source=path.join(bootstrapRoot,'installer-staging',version,'installer.exe'),metadata=path.join(path.dirname(source),'baseline.json');
  await plain(metadata);let stat;try{stat=await fs.lstat(metadata);}catch(error){if(error.code==='ENOENT'){result.skipped='没有本次安装器暂存';return result;}throw error;}
  if(!stat.isFile()||stat.size>65536)throw Error('本次安装器清单无效。');
  const info=JSON.parse(await fs.readFile(metadata,'utf8'));
  if(info.schema!==1||info.product!=='MediaSail'||info.version!==version||!Number.isSafeInteger(info.bytes)||info.bytes<=0||!/^[a-f0-9]{64}$/.test(info.sha256||''))throw Error('本次安装器身份无效。');
  await plain(source);const original=await digest(source);if(original.bytes!==info.bytes||original.sha256!==info.sha256)throw Error('本次安装器校验不符。');
  const helper=await updater.getOrCreateDownloadHelper();target=path.join(helper.cacheDir,'installer.exe');record=path.join(helper.cacheDir,'current-installer.json');await plain(target);await plain(record);
  let current;try{current=await digest(target);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(current?.sha256===info.sha256){result.matched=true;}
  else if(current){
   let managed=PUBLISHED.has(current.sha256);
   if(!managed)try{const previous=JSON.parse(await fs.readFile(record,'utf8'));managed=previous.schema===1&&previous.product==='MediaSail'&&previous.sha256===current.sha256&&previous.bytes===current.bytes;}catch(error){if(error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
   if(!managed){result.skipped='资料库已有无法确认归属的不同缓存，保留原文件；必要时全量下载';return result;}
  }
  await fs.mkdir(path.dirname(target),{recursive:true});temporary=target+'.installer-'+crypto.randomUUID();await fs.copyFile(source,temporary,raw.constants.COPYFILE_EXCL);
  if((await digest(temporary)).sha256!==info.sha256||(await digest(source)).sha256!==info.sha256)throw Error('本次安装器复制期间校验变化。');
  if(!result.matched){
   if(current){
    if((await digest(target)).sha256!==current.sha256)throw Error('资料库缓存已变化，未替换。');
    backup=target+'.prior-'+crypto.randomUUID();await fs.rename(target,backup);
    const map=path.join(helper.cacheDir,'current.blockmap');await plain(map);
    try{if(!(await fs.lstat(map)).isFile())throw Error('现有差量索引不是普通文件，未替换基线。');mapBackup=map+'.prior-'+crypto.randomUUID();await fs.rename(map,mapBackup);}catch(error){if(error.code!=='ENOENT')throw error;}
   }
   await fs.link(temporary,target);result.adopted=true;result.replacedManagedBaseline=Boolean(current);
  }
  if((await digest(target)).sha256!==info.sha256)throw Error('新基线未能核验。');
  const recordTemp=record+'.'+crypto.randomUUID()+'.tmp';await fs.writeFile(recordTemp,JSON.stringify(info,null,2)+'\n',{flag:'wx'});try{await fs.rename(recordTemp,record);}finally{await fs.unlink(recordTemp).catch(()=>{});}
  if(backup){await fs.unlink(backup);backup=null;}if(mapBackup){await fs.unlink(mapBackup);mapBackup=null;}
  // Only this version's two known staging files are removed, never a sweep.
  if((await digest(source)).sha256===info.sha256){await fs.unlink(source);await fs.unlink(metadata);result.stagingRemoved=true;await fs.rmdir(path.dirname(source)).catch(error=>{if(error.code!=='ENOTEMPTY'&&error.code!=='ENOENT')throw error;});}
  return result;
 }catch(error){result.error=error.message;return result;}
 finally{
  if(backup){try{try{if((await digest(target)).sha256===(await digest(temporary)).sha256)await fs.unlink(target);}catch(error){if(error.code!=='ENOENT')throw error;}await fs.link(backup,target);await fs.unlink(backup);if(mapBackup){await fs.rename(mapBackup,path.join(path.dirname(target),'current.blockmap'));mapBackup=null;}result.adopted=false;result.replacedManagedBaseline=false;}catch(error){result.error=(result.error||'')+'；原基线备份保留：'+error.message;}}
  if(temporary)await fs.unlink(temporary).catch(()=>{});report('本次安装器基线：'+JSON.stringify(result));
 }
}
module.exports={adoptInstallerBaseline};

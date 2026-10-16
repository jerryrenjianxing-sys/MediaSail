const fs=require('node:fs/promises'),path=require('node:path'),semver=require('semver');
const rawFs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib');
const MIGRATION_MARKER='mediasail-cache-migration.json';
const INSTALLER=/^MediaSail-(\d+\.\d+\.\d+)-win-x64-Setup\.exe$/;
// Independently checked published legacy installers. A baseline lacking updater
// metadata is only reusable when its full SHA matches one of these releases.
const LEGACY_INSTALLERS=new Set([
  '13d2946e4e9bab7faa31d0714d73ad83401d44c3543c9c2aed5822138bc2f0d6' // 0.5.0
]);
async function maybeStat(file){try{return await fs.lstat(file);}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function plainPath(file){
  let part=path.resolve(file);
  while(true){const stat=await maybeStat(part);if(stat?.isSymbolicLink())throw Error('缓存路径包含链接，保留原文件');const parent=path.dirname(part);if(parent===part)return;part=parent;}
}
async function fingerprint(file){
  await plainPath(file);const stat=await fs.lstat(file);
  if(!stat.isFile())throw Error('缓存项不是普通文件');
  const sha256=crypto.createHash('sha256'),sha512=crypto.createHash('sha512');
  for await(const chunk of rawFs.createReadStream(file)){sha256.update(chunk);sha512.update(chunk);}
  const after=await fs.lstat(file);
  if(after.size!==stat.size||after.mtimeMs!==stat.mtimeMs)throw Error('核验期间旧缓存发生变化');
  return {size:stat.size,sha256:sha256.digest('hex'),sha512:sha512.digest('base64')};
}
async function validBlockMap(file,installerSize){
  const stat=await maybeStat(file);if(!stat)return false;
  await plainPath(file);if(!stat.isFile()||stat.size>16*1024*1024)return false;
  let map;try{map=JSON.parse(zlib.gunzipSync(await fs.readFile(file),{maxOutputLength:32*1024*1024}).toString('utf8'));}catch{return false;}
  if(!['1','2'].includes(map?.version)||!Array.isArray(map.files)||map.files.length!==1)return false;
  const entry=map.files[0];
  return entry?.name==='file'&&entry.offset===0&&Array.isArray(entry.sizes)&&entry.sizes.length>0
    &&Array.isArray(entry.checksums)&&entry.checksums.length===entry.sizes.length
    &&entry.sizes.every(n=>Number.isSafeInteger(n)&&n>0)
    &&entry.sizes.reduce((sum,n)=>sum+n,0)===installerSize
    &&entry.checksums.every(value=>typeof value==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(value)&&Buffer.from(value,'base64').length===18);
}
async function migrateLegacyUpdateCache({updater,legacyBase,report=()=>{}}){
  const result={copied:[],matched:[],bytes:0,skipped:[],errors:[]};
  try{
    const helper=await updater.getOrCreateDownloadHelper(),target=path.resolve(helper.cacheDir);
    const config=await updater.configOnDisk?.value;
    const name=config?.updaterCacheDirName||path.basename(target);
    if(name!=='mediasail-updater'||path.basename(target)!==name||config&&(config.provider!=='github'||config.owner!=='jerryrenjianxing-sys'||config.repo!=='MediaSail'))throw Error('更新缓存不属于 MediaSail，未迁移');
    if(!legacyBase||!path.isAbsolute(legacyBase))throw Error('旧更新缓存位置无效');
    const source=path.resolve(legacyBase,name);
    if(source===target){result.skipped.push('缓存位置未改变');return result;}
    await plainPath(source);await plainPath(target);
    const original=await maybeStat(source);if(!original){result.skipped.push('没有旧缓存');return result;}
    if(!original.isDirectory())throw Error('旧更新缓存不是目录');
    const marker=path.join(target,MIGRATION_MARKER);
    if(await maybeStat(marker)){result.skipped.push('该资料库已处理旧缓存迁移');return result;}
    const plan=[];let pendingHash=null;
    const add=async relative=>{const hash=await fingerprint(path.join(source,relative));plan.push({relative,...hash});return hash;};
    const metadata=path.join(source,'pending','update-info.json');
    if(await maybeStat(metadata)){
      await plainPath(metadata);const metaStat=await fs.lstat(metadata);
      if(!metaStat.isFile()||metaStat.size>65536)throw Error('旧更新元数据无效');
      const metadataBytes=await fs.readFile(metadata);
      let info;try{info=JSON.parse(metadataBytes.toString('utf8'));}catch{throw Error('旧更新元数据无法读取');}
      const match=typeof info?.fileName==='string'&&INSTALLER.exec(info.fileName);
      if(!match||!semver.valid(match[1])||typeof info.sha512!=='string'||!/^[A-Za-z0-9+/]{86}==$/.test(info.sha512)
        ||typeof info.isAdminRightsRequired!=='boolean')throw Error('旧更新元数据不属于有效的 MediaSail 安装包');
      pendingHash=await fingerprint(path.join(source,'pending',info.fileName));
      if(pendingHash.sha512!==info.sha512)throw Error('旧待安装包 SHA512 与更新元数据不符');
      plan.push({relative:path.join('pending',info.fileName),...pendingHash});
      if(await validBlockMap(path.join(source,'pending','current.blockmap'),pendingHash.size))await add(path.join('pending','current.blockmap'));
      // Preserve the actual electron-updater metadata byte-for-byte; don't call
      // setDownloadedFile or manufacture an update-downloaded event.
      const metadataHash=await fingerprint(metadata);
      if(metadataHash.sha256!==crypto.createHash('sha256').update(metadataBytes).digest('hex'))throw Error('核验期间旧更新元数据发生变化');
      plan.push({relative:path.join('pending','update-info.json'),...metadataHash});
    }
    const installer=path.join(source,'installer.exe');
    if(await maybeStat(installer)){
      const hash=await fingerprint(installer);
      const owned=LEGACY_INSTALLERS.has(hash.sha256)||pendingHash?.sha512===hash.sha512;
      if(owned){
        // NSIS may replace only installer.exe. A missing or stale local map
        // must not discard a verified full installer: updater can fetch the
        // correct previous-release blockmap from GitHub itself.
        plan.unshift({relative:'installer.exe',...hash});
        let mapSource=null;
        if(await validBlockMap(path.join(source,'current.blockmap'),hash.size))mapSource='current.blockmap';
        else if(pendingHash?.sha512===hash.sha512&&await validBlockMap(path.join(source,'pending','current.blockmap'),hash.size))mapSource=path.join('pending','current.blockmap');
        if(mapSource)plan.splice(1,0,{relative:'current.blockmap',sourceRelative:mapSource,...await fingerprint(path.join(source,mapSource))});
        else result.skipped.push('旧 blockmap 缺失或不匹配，仅迁移已核验安装包，正确 blockmap 由更新器获取');
      }else result.skipped.push('旧差量基线未通过身份核验，保留原文件');
    }
    if(!plan.length){result.skipped.push('没有可核验的旧缓存');return result;}
    // Preflight the whole transaction. A real newer cache wins; never overwrite
    // a different destination installer or metadata to resurrect an older one.
    const planned=new Set(plan.map(entry=>entry.relative));
    for(const relative of ['', 'pending']){
      const directory=path.join(target,relative);await plainPath(directory);
      const stat=await maybeStat(directory);if(!stat)continue;
      if(!stat.isDirectory())throw Error('新更新缓存路径不是目录');
      for(const entry of await fs.readdir(directory,{withFileTypes:true})){
        const file=relative?path.join(relative,entry.name):entry.name;
        if((INSTALLER.test(entry.name)||['installer.exe','current.blockmap','update-info.json'].includes(entry.name))&&!planned.has(file)){
          result.skipped.push('新缓存已有其他受管理文件：'+file);return result;
        }
      }
    }
    for(const entry of plan){
      const destination=path.join(target,entry.relative);
      await plainPath(destination);
      if(await maybeStat(destination)){
        const current=await fingerprint(destination);
        if(current.sha256!==entry.sha256){result.skipped.push('新缓存已有不同文件：'+entry.relative);return result;}
      }
    }
    for(const entry of plan){
      const from=path.join(source,entry.sourceRelative||entry.relative),to=path.join(target,entry.relative);
      if(await maybeStat(to)){result.matched.push(entry.relative);continue;}
      await plainPath(path.dirname(to));await fs.mkdir(path.dirname(to),{recursive:true});await plainPath(path.dirname(to));
      const temporary=to+'.migration-'+crypto.randomUUID();
      try{
        await fs.copyFile(from,temporary,rawFs.constants.COPYFILE_EXCL);
        if((await fingerprint(temporary)).sha256!==entry.sha256||(await fingerprint(from)).sha256!==entry.sha256)throw Error('复制期间旧缓存发生变化');
        // Linking the complete private temporary file gives an atomic,
        // no-overwrite commit on the destination filesystem.
        await fs.link(temporary,to);result.copied.push(entry.relative);result.bytes+=entry.size;
      }finally{await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
    }
    const markerTemp=marker+'.migration-'+crypto.randomUUID();
    try{
      await fs.writeFile(markerTemp,JSON.stringify({schema:1,product:'MediaSail',source,completedAt:new Date().toISOString(),files:plan},null,2)+'\n',{flag:'wx'});
      await fs.link(markerTemp,marker);
    }finally{await fs.unlink(markerTemp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
  }catch(e){result.errors.push(e.message);}
  finally{report('旧更新缓存迁移：'+JSON.stringify(result));}
  return result;
}
// Only updater-owned, explicitly versioned obsolete assets are eligible. The
// current installer.exe/current.blockmap pair remains available for differential updates.
async function cleanupLegacyUpdates({updater,current,report=()=>{}}){
  const result={removed:[],bytes:0,errors:[]};
  try{
    const helper=await updater.getOrCreateDownloadHelper();const base=path.resolve(helper.cacheDir);
    const baseInfo=await fs.lstat(base).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(!baseInfo)return result;
    if(baseInfo.isSymbolicLink())throw Error('更新缓存是链接，保留原文件');
    const realBase=await fs.realpath(base);
    for(const dir of [base,path.join(base,'pending')]){
      const directory=await fs.lstat(dir).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
      if(!directory||directory.isSymbolicLink())continue;
      let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch(e){if(e.code==='ENOENT')continue;throw e;}
      for(const entry of entries){
        if(!entry.isFile()||entry.isSymbolicLink())continue;
        const match=/^(?:temp-)?MediaSail-(\d+\.\d+\.\d+)-win-x64-Setup\.exe(?:\.blockmap)?$/.exec(entry.name);
        if(!match||!semver.lt(match[1],current))continue;
        const file=path.resolve(dir,entry.name);if(!file.startsWith(base+path.sep))throw Error('更新缓存路径无效');
        try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())continue;if(!(await fs.realpath(file)).startsWith(realBase+path.sep))throw Error('缓存文件不在软件目录内');await fs.unlink(file);result.removed.push(file);result.bytes+=stat.size;}catch(e){result.errors.push({file,error:e.message});}
      }
    }
    report('旧更新缓存清理：'+JSON.stringify(result));
  }catch(e){result.errors.push({error:e.message});report('旧更新缓存未能清理：'+e.message);}
  return result;
}
module.exports={cleanupLegacyUpdates,migrateLegacyUpdateCache};

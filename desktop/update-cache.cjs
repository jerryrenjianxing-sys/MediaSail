const fs=require('node:fs/promises'),path=require('node:path'),semver=require('semver');
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
module.exports={cleanupLegacyUpdates};

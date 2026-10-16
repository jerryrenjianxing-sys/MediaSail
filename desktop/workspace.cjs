const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
const seed = p => /^(profiles|assets|outputs)\//.test(p) || p === '.env' || p === 'cookies.json' || /\/config\//.test(p);
function safe(root, relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(path.resolve(root) + path.sep) || path.isAbsolute(relative)) throw new Error('Invalid manifest path');
  return target;
}
async function atomic(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp=file+'.'+process.pid+'.'+crypto.randomBytes(5).toString('hex')+'.desktop-tmp';
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, file);
}
async function read(file) { try { return await fs.readFile(file); } catch (e) { if(e.code === 'ENOENT') return null; throw e; } }
async function preserve(file, bytes) {
  const previous=await read(file);
  if(previous&&digest(previous)===digest(bytes))return;
  if(previous)throw new Error('备份路径已有不同文件，未覆盖：'+file);
  await atomic(file,bytes);
}
// Compare the distributed baseline, local edits and the incoming version.
async function syncManaged({source,destination,stateFile,backupRoot,manifest,isSeed=()=>false}) {
  const oldBytes = await read(stateFile);
  const old = oldBytes ? JSON.parse(oldBytes) : { files: {} };
  const reportFile=stateFile+'.conflicts.json';
  let previous=[];try{previous=JSON.parse((await read(reportFile))||'{}').conflicts||[];}catch{}
  const conflicts=[];
  for (const [name, hash] of Object.entries(manifest.files)) {
    const dest = safe(destination, name);
    const current = await read(dest);
    if (current && (isSeed(name) || digest(current) === hash)) continue;
    const incoming = await fs.readFile(safe(source, name));
    if (digest(incoming) !== hash) throw new Error(`安装文件校验失败：${name}`);
    if (current && digest(current) !== old.files[name]) {
      if(hash!==old.files[name]||previous.some(x=>x.path===name&&x.incomingHash===hash)){
        const version=String(manifest.version).replace(/[^a-zA-Z0-9._-]/g,'_');
        const original=safe(path.join(backupRoot,version,'local-'+digest(current).slice(0,16)),name);
        const next=safe(path.join(backupRoot,version,'incoming-'+hash.slice(0,16)),name);
        await preserve(original,current);await preserve(next,incoming);
        conflicts.push({path:name,localHash:digest(current),incomingHash:hash,local:original,incoming:next});
      }
      continue;
    }
    const latest=await read(dest);
    if(digest(latest||Buffer.alloc(0))!==digest(current||Buffer.alloc(0)))throw new Error('文件正在被外部修改，已暂停升级：'+name);
    await atomic(dest, incoming);
  }
  for (const [name, hash] of Object.entries(old.files)) {
    if (manifest.files[name] || isSeed(name)) continue;
    const dest = safe(destination, name), bytes = await read(dest);
    if (bytes && digest(bytes) === hash) await fs.unlink(dest);
  }
  await atomic(stateFile,JSON.stringify(manifest));
  await atomic(reportFile,JSON.stringify({version:manifest.version,conflicts},null,2));
  return conflicts;
}
async function syncWorkspace(payload, data, {workspaceRoot}={}) {
  const manifest=JSON.parse(await fs.readFile(path.join(payload,'manifest.json'),'utf8'));
  const work=workspaceRoot||path.join(data,'workspace');
  for(const name of ['assets','outputs','profiles'])await fs.mkdir(path.join(work,name),{recursive:true});
  await syncManaged({source:path.join(payload,'easel'),destination:work,stateFile:path.join(data,'installed-manifest.json'),backupRoot:path.join(data,'upgrade-backups'),manifest,isSeed:seed});
  return work;
}
async function syncAgentSkill(source,destination,data,version){
  const files={};
  async function walk(dir,prefix=''){
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){
      if(entry.isSymbolicLink())throw new Error('Skill 原件包含链接');
      const rel=prefix?prefix+'/'+entry.name:entry.name;
      if(entry.isDirectory()){if(entry.name!=='__pycache__')await walk(path.join(dir,entry.name),rel);}
      else if(!rel.endsWith('.pyc'))files[rel]=digest(await fs.readFile(path.join(dir,entry.name)));
    }
  }
  await walk(source);
  return syncManaged({source,destination,stateFile:path.join(data,'agent-skill-manifest.json'),backupRoot:path.join(data,'upgrade-backups','agent-skill'),manifest:{version,files}});
}
module.exports = { syncWorkspace, syncAgentSkill, syncManaged, safe, digest, atomic };

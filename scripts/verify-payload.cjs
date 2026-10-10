const fs=require('node:fs/promises'),path=require('node:path');
const {safe,digest,syncWorkspace}=require('../desktop/workspace.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const payload=path.resolve(process.argv[2]||path.join(root,'../../outputs/MediaSail/win-unpacked/resources/payload'));
 const update=require('js-yaml').load(await fs.readFile(path.join(payload,'../app-update.yml'),'utf8'));
 if(update.provider!=='github'||update.owner!=='jerryrenjianxing-sys'||update.repo!=='MediaSail'||!update.updaterCacheDirName)throw new Error('Missing/invalid packaged updater configuration');
 const manifest=JSON.parse(await fs.readFile(path.join(payload,'manifest.json'),'utf8'));
 for(const relative of ['SKILL.md','scripts/mediasail.ps1','scripts/mediasail.py','references/api-schema.json']){
  await fs.access(path.join(payload,'../agent-skill/mediasail',relative));
 }
 for(const [name,hash]of Object.entries(manifest.files)){
  const bytes=await fs.readFile(safe(path.join(payload,'easel'),name));
  if(digest(bytes)!==hash)throw new Error(`Packaged file checksum mismatch: ${name}`);
 }
 const testRoot=path.join(root,'.test-data');await fs.mkdir(testRoot,{recursive:true});
 const data=await fs.mkdtemp(path.join(testRoot,'全新包校验 '));
 try{const work=await syncWorkspace(payload,data);for(const name of ['assets','outputs','profiles']){
  if(!(await fs.stat(path.join(work,name))).isDirectory())throw new Error(`Missing writable directory: ${name}`);
 }}finally{
  if(!path.resolve(data).startsWith(path.resolve(testRoot)+path.sep))throw new Error('Unsafe test cleanup');
  await fs.rm(data,{recursive:true,force:true});
 }
 console.log(`PACKAGED PAYLOAD VERIFIED: ${Object.keys(manifest.files).length} hashes; clean workspace initialization passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

const fs=require('node:fs/promises'),path=require('node:path');
const {safe,digest,syncWorkspace}=require('../desktop/workspace.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const payload=path.resolve(process.argv[2]||path.join(root,require('../package.json').build.directories.output,'win-unpacked/resources/payload'));
 const update=require('js-yaml').load(await fs.readFile(path.join(payload,'../app-update.yml'),'utf8'));
 if(update.provider!=='github'||update.owner!=='jerryrenjianxing-sys'||update.repo!=='MediaSail'||!update.updaterCacheDirName)throw new Error('Missing/invalid packaged updater configuration');
 const manifest=JSON.parse(await fs.readFile(path.join(payload,'manifest.json'),'utf8'));
 const browserRoot=path.resolve(payload,'../browser-tools');
 const browser=JSON.parse(await fs.readFile(path.join(browserRoot,'manifest.json'),'utf8'));
 const browserLock=require('../browser-tools.lock.json');
 if(browser.product!=='MediaSailBrowser'||browser.browser.sha256!==browserLock.browser.sha256||browser.bsk.build!==browserLock.bsk.build||browser.extension.extensionId!==browserLock.bsk.extensionId)throw new Error('Packaged browser identity differs from pinned build');
 for(const asset of [browser.browser,browser.extension,browser.bsk,...browser.runtimeHelpers]){
  const file=safe(browserRoot,asset.archive||asset.file);
  if(digest(await fs.readFile(file))!==asset.sha256)throw new Error('Packaged browser resource checksum mismatch: '+file);
 }
 if(browser.bsk.imports.some(name=>/^(VCRUNTIME|MSVCP)/i.test(name)))throw new Error('BrowserSkill requires an unbundled VC runtime');
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
 console.log(`PACKAGED PAYLOAD VERIFIED: ${Object.keys(manifest.files).length} business hashes and pinned browser assets; clean workspace initialization passed.`);
})().catch(e=>{console.error(e);process.exitCode=1;});

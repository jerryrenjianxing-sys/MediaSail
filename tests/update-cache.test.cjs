const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib');
const {migrateLegacyUpdateCache}=require('../desktop/update-cache.cjs');
const {DownloadedUpdateHelper}=require('electron-updater/out/DownloadedUpdateHelper');
const sha512=bytes=>crypto.createHash('sha512').update(bytes).digest('base64');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail 缓存 中文 '));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const legacyBase=path.join(root,'旧 AppData'),source=path.join(legacyBase,'mediasail-updater');
 const target=path.join(root,'资料库','runtime','update-cache','mediasail-updater');
 const bytes=Buffer.from('MZ MediaSail fixture installer, never executed');
 const name='MediaSail-0.5.0-win-x64-Setup.exe';
 const map=zlib.gzipSync(JSON.stringify({version:'2',files:[{name:'file',offset:0,sizes:[bytes.length],checksums:[Buffer.alloc(18,1).toString('base64')]}]}));
 await fs.mkdir(path.join(source,'pending'),{recursive:true});
 await fs.writeFile(path.join(source,'installer.exe'),bytes);await fs.writeFile(path.join(source,'current.blockmap'),map);
 await fs.writeFile(path.join(source,'pending',name),bytes);await fs.writeFile(path.join(source,'pending','current.blockmap'),map);
 const info={fileName:name,sha512:sha512(bytes),isAdminRightsRequired:false};
 const metadata=JSON.stringify(info,null,2)+'\n';await fs.writeFile(path.join(source,'pending','update-info.json'),metadata);
 const helper=new DownloadedUpdateHelper(target);
 const updater={getOrCreateDownloadHelper:async()=>helper,configOnDisk:{value:Promise.resolve({provider:'github',owner:'jerryrenjianxing-sys',repo:'MediaSail',updaterCacheDirName:'mediasail-updater'})}};
 const reports=[];return {root,source,target,legacyBase,bytes,name,map,info,metadata,helper,updater,options:{updater,legacyBase,report:value=>reports.push(value)},reports};
}
test('cache migration preserves authentic updater metadata and remains usable by its real helper',async t=>{
 const f=await fixture(t),result=await migrateLegacyUpdateCache(f.options);
 assert.deepEqual(result.errors,[]);assert.equal(result.copied.length,5);
 assert.equal(await fs.readFile(path.join(f.target,'pending','update-info.json'),'utf8'),f.metadata);
 assert.deepEqual(await fs.readFile(path.join(f.target,'installer.exe')),f.bytes);
 assert.deepEqual(await fs.readFile(path.join(f.source,'installer.exe')),f.bytes);
 const fileInfo={info:{sha512:f.info.sha512}},logger={info(){},warn(){}};
 const valid=await f.helper.getValidCachedUpdateFile(fileInfo,logger);
 assert.equal(valid,path.join(f.target,'pending',f.name));assert.equal(f.helper.downloadedFileInfo.fileName,f.name);
 const again=await migrateLegacyUpdateCache(f.options);assert.equal(again.copied.length,0);assert.ok(again.skipped.some(x=>x.includes('已处理')));
});
test('interrupted copy can resume identical completed files without overwriting or altering source',async t=>{
 const f=await fixture(t),original=fs.link;let calls=0;
 fs.link=async(...args)=>{if(++calls===2)throw Error('fixture interrupted');return original(...args);};
 let first;try{first=await migrateLegacyUpdateCache(f.options);}finally{fs.link=original;}
 assert.equal(first.copied.length,1);assert.ok(first.errors.some(x=>x.includes('interrupted')));
 await assert.rejects(fs.access(path.join(f.target,'mediasail-cache-migration.json')));
 const second=await migrateLegacyUpdateCache(f.options);assert.deepEqual(second.errors,[]);assert.ok(second.matched.includes('installer.exe'));
 assert.equal(second.copied.length,4);assert.deepEqual(await fs.readFile(path.join(f.source,'pending',f.name)),f.bytes);
});
test('mismatched pending hash does not migrate or change any old cache',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.source,'pending',f.name),'wrong');
 const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,0);assert.ok(result.errors.some(x=>x.includes('SHA512')));
 await assert.rejects(fs.access(f.target));assert.equal(await fs.readFile(path.join(f.source,'pending',f.name),'utf8'),'wrong');
});
test('another product, invalid package path and wrong feed are never accepted',async t=>{
 for(const mode of ['product','traversal','feed']){
  const f=await fixture(t);
  if(mode==='product'||mode==='traversal')await fs.writeFile(path.join(f.source,'pending','update-info.json'),JSON.stringify({...f.info,fileName:mode==='product'?'OtherApp-0.5.0.exe':'../'+f.name}));
  else f.updater.configOnDisk.value=Promise.resolve({provider:'github',owner:'other',repo:'OtherApp',updaterCacheDirName:'mediasail-updater'});
  const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,0);assert.ok(result.errors.length);await assert.rejects(fs.access(f.target));
 }
});
test('existing different target cache wins and source cache is retained',async t=>{
 const f=await fixture(t);await fs.mkdir(f.target,{recursive:true});await fs.writeFile(path.join(f.target,'installer.exe'),'newer cached package');
 const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,0);assert.ok(result.skipped.some(x=>x.includes('不同文件')));
 assert.equal(await fs.readFile(path.join(f.target,'installer.exe'),'utf8'),'newer cached package');
 await assert.rejects(fs.access(path.join(f.target,'pending')));assert.deepEqual(await fs.readFile(path.join(f.source,'installer.exe')),f.bytes);
});
test('existing other managed pending package is not mixed with the legacy cache',async t=>{
 const f=await fixture(t);await fs.mkdir(path.join(f.target,'pending'),{recursive:true});
 await fs.writeFile(path.join(f.target,'pending','MediaSail-0.5.2-win-x64-Setup.exe'),'new');
 const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,0);assert.ok(result.skipped.some(x=>x.includes('其他受管理文件')));
 await assert.rejects(fs.access(path.join(f.target,'installer.exe')));
});
test('unverified baseline is left in place while verified pending cache can migrate',async t=>{
 const f=await fixture(t);await fs.writeFile(path.join(f.source,'installer.exe'),'unknown older installer');
 const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,3);assert.ok(result.skipped.some(x=>x.includes('差量基线')));
 await assert.rejects(fs.access(path.join(f.target,'installer.exe')));assert.equal(await fs.readFile(path.join(f.source,'installer.exe'),'utf8'),'unknown older installer');
});
test('verified installer without a local blockmap is still preserved for updater reuse',async t=>{
 const f=await fixture(t);await fs.unlink(path.join(f.source,'current.blockmap'));await fs.unlink(path.join(f.source,'pending','current.blockmap'));
 const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,3);assert.deepEqual(result.errors,[]);
 assert.deepEqual(await fs.readFile(path.join(f.target,'installer.exe')),f.bytes);await assert.rejects(fs.access(path.join(f.target,'current.blockmap')));
});
test('mismatched blockmap is not migrated but verified installer is retained',async t=>{
 const f=await fixture(t);const wrong=zlib.gzipSync(JSON.stringify({version:'2',files:[{name:'file',offset:0,sizes:[f.bytes.length+1],checksums:[Buffer.alloc(18,1).toString('base64')]}]}));
 await fs.writeFile(path.join(f.source,'current.blockmap'),wrong);await fs.writeFile(path.join(f.source,'pending','current.blockmap'),'corrupt');
 const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,3);assert.ok(result.skipped.some(x=>x.includes('blockmap')));
 assert.deepEqual(await fs.readFile(path.join(f.target,'installer.exe')),f.bytes);await assert.rejects(fs.access(path.join(f.target,'current.blockmap')));
 assert.deepEqual(await fs.readFile(path.join(f.source,'current.blockmap')),wrong);
});
test('same-hash pending blockmap supplies a missing or stale current map',async t=>{
 for(const stale of [false,true]){
  const f=await fixture(t);
  if(stale)await fs.writeFile(path.join(f.source,'current.blockmap'),'stale blockmap');else await fs.unlink(path.join(f.source,'current.blockmap'));
  const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,5);assert.deepEqual(result.errors,[]);
  assert.deepEqual(await fs.readFile(path.join(f.target,'current.blockmap')),f.map);
  assert.deepEqual(await fs.readFile(path.join(f.source,'pending','current.blockmap')),f.map);
 }
});
test('source junction and target pending junction are rejected without following them',async t=>{
 for(const which of ['source','target']){
  const f=await fixture(t),outside=path.join(f.root,'outside');await fs.mkdir(outside);
  if(which==='source'){
   await fs.rename(f.source,path.join(outside,'owned-files'));
   await fs.symlink(path.join(outside,'owned-files'),f.source,process.platform==='win32'?'junction':'dir');
  }else{
   await fs.mkdir(f.target,{recursive:true});await fs.symlink(outside,path.join(f.target,'pending'),process.platform==='win32'?'junction':'dir');
  }
  const result=await migrateLegacyUpdateCache(f.options);assert.equal(result.copied.length,0);assert.ok(result.errors.some(x=>x.includes('链接')));
  await assert.rejects(fs.access(path.join(f.target,'installer.exe')));
 }
});

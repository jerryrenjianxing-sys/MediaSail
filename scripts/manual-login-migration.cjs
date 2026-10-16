// Reuse only the human-authorized isolated login library. Real identities remain
// in memory; public evidence contains booleans/status and never credentials.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),Module=require('node:module');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const index=process.argv.indexOf('--run');assert.ok(index>=0,'An explicit existing isolated --run is required');
const run=path.resolve(process.argv[index+1]),testBase=path.join(os.homedir(),'Documents','MediaSail 隔离验证');
const relative=path.relative(testBase,run);assert.ok(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative),'Refusing a non-test directory');
const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'),'Refusing daily installation');
const bootstrap=path.join(run,'独立 定位资料'),originalDefault=path.join(run,'独立 登录验收资料库');
const target=path.join(run,'扫码后迁移 中文 空格 '+Date.now());
const asar=path.join(path.dirname(executable),'resources/app.asar'),extract=require('@electron/asar').extractFile;
const packagedLibrary=new Module(path.join(root,'.test-data/frozen-library-migration.cjs'),module);
packagedLibrary.filename=packagedLibrary.id;
packagedLibrary._compile(extract(asar,'desktop/library.cjs').toString('utf8'),packagedLibrary.filename);
const library=packagedLibrary.exports;
const options={bootstrapRoot:bootstrap,defaultLibraryRoot:originalDefault,installDirectory:path.dirname(executable)};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let app,info,exitConfirmations=0;
async function json(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function api(suffix){const response=await fetch(info.baseUrl+suffix);assert.equal(response.status,200,'Local response status');return response.json();}
async function start(layout){
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立宿主 Local'),APPDATA:path.join(run,'独立宿主 Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});const page=await app.firstWindow();
 await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
 info=await json(layout.connectionFile);assert.equal(info.status,'ready');assert.equal(info.libraryRoot,layout.libraryRoot);
 assert.equal(await app.evaluate(({app})=>app.getPath('userData')),layout.dataRoot);
 // Only this owned QA process may confirm the ordinary active-task exit dialog.
 await app.evaluate(({dialog})=>{const original=dialog.showMessageBox.bind(dialog);globalThis.__qaExitConfirmations=0;dialog.showMessageBox=(...args)=>{const options=args.find(value=>value&&typeof value==='object'&&value.title==='退出 MediaSail');if(options&&options.buttons?.[1]==='退出程序'&&['还有任务正在进行，退出会中断任务。','暂时无法确认后台任务状态。'].includes(options.message)){globalThis.__qaExitConfirmations++;return Promise.resolve({response:1,checkboxChecked:false});}return original(...args);};});
}
async function verify(){
 let who=await api('/api/accounts/douyin/whoami?force=1');
 for(let attempt=0;String(who.errorCode||'').toLowerCase()==='profile_busy'&&attempt<6;attempt++){await sleep(2000);who=await api('/api/accounts/douyin/whoami?force=1');}
 if(who.verificationStatus!=='verified')console.log(JSON.stringify({phase:'verification_unavailable',verificationStatus:who.verificationStatus,errorCode:who.errorCode||null}));
 assert.equal(who.verificationStatus,'verified','Actual forced creator verification');assert.ok(who.accountId);assert.equal(who.cached,false);
 const analysis=await api('/api/analytics/douyin');assert.equal(analysis.verificationStatus,'verified');assert.equal(analysis.accountId,who.accountId,'Analysis identity must equal verified identity');
 return {accountId:who.accountId,safe:{verificationStatus:who.verificationStatus,cached:who.cached,accountIdentityPresent:!!who.accountId,analysisVerificationStatus:analysis.verificationStatus,analysisSameAccount:analysis.accountId===who.accountId,errorCode:who.errorCode||null,analysisErrorCode:analysis.errorCode||null}};
}
async function close(){if(!app)return;exitConfirmations+=await app.evaluate(()=>globalThis.__qaExitConfirmations||0);await app.close();app=null;}
async function snapshot(dir,prefix='',items=[]){for(const item of await fs.readdir(path.join(dir,prefix),{withFileTypes:true})){const relative=prefix?prefix+'/'+item.name:item.name;assert.ok(!item.isSymbolicLink(),'Unexpected linked profile file');if(item.isDirectory())await snapshot(dir,relative,items);else if(item.isFile())items.push({path:relative,size:(await fs.stat(path.join(dir,relative))).size});}return items.sort((a,b)=>a.path.localeCompare(b.path));}
(async()=>{
 const current=library.readLocation(options);assert.equal(current.mode,'library');assert.equal(current.libraryRoot,originalDefault,'Use only original authorized test library');
 const oldConnection=await json(current.connectionFile);assert.equal(oldConnection.status,'stopped','Close isolated test app before migration');
 await start(current);const before=await verify();await close();console.log('SOURCE_VERIFIED_AND_NORMALLY_CLOSED');
 const profileRelative=path.join('runtime/home/.easel-browser-profiles/DouyinProfile');
 const sourceProfile=path.join(current.libraryRoot,profileRelative);const originalFiles=await snapshot(sourceProfile);assert.ok(originalFiles.length>0);
 await library.queueLibraryChange({...options,current,targetRoot:target,mode:'move'});
 const next=await library.prepareLibrary(options);assert.equal(next.libraryRoot,target);assert.equal(next.libraryId,current.libraryId);
 // prepareLibrary hashes and verifies every copied file before committing.
 assert.deepEqual(await snapshot(sourceProfile),originalFiles,'Source platform files remain untouched');
 assert.deepEqual(await snapshot(path.join(target,profileRelative)),originalFiles,'Target platform files all copied');
 console.log('FROZEN_MODULE_MIGRATION_COPY_VERIFIED');
 await start(next);const after=await verify();assert.equal(after.accountId,before.accountId,'Same real account after migration');await close();
 const evidence={method:'final-packaged-library-module-queueLibraryChange-and-prepareLibrary-followed-by-final-EXE-launch',uiMigrationUsed:false,testedAtUtc:new Date().toISOString(),testedAppAsarSha256:crypto.createHash('sha256').update(await fs.readFile(asar)).digest('hex'),networkMocksUsed:false,publicationPerformed:false,dailyInstallationUsed:false,sourceAndTargetPlatformFilesMatchedBeforeLaunch:true,sourcePlatformFilesPreserved:true,oldLibraryPreserved:JSON.stringify(await snapshot(sourceProfile))===JSON.stringify(originalFiles),sameAccountAfterMigration:true,connectionUsesNewLibrary:true,normalExit:true,before:before.safe,after:after.safe};
 assert.equal(evidence.oldLibraryPreserved,true);
 const publicFile=path.join(root,'docs/evidence/manual-login-'+pkg.version+'.json'),previous=await json(publicFile);previous.migration=evidence;
 await fs.writeFile(publicFile,JSON.stringify(previous,null,2)+'\n');
 // Location and paths stay in the existing isolated test root, never public docs.
 await fs.writeFile(path.join(run,'manual-migration-status.json'),JSON.stringify({source:current.libraryRoot,target,bootstrap,sourcePreserved:true,passed:true},null,2)+'\n');
 console.log(JSON.stringify({passed:true,sameAccountAfterMigration:true,oldLibraryPreserved:true,sourceAndTargetPlatformFilesMatchedBeforeLaunch:true,testedAppAsarSha256:evidence.testedAppAsarSha256}));
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(close);

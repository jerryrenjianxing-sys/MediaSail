// Genuine registered upgrade; disposable Windows runner only. Historical defaults stay reproducible.
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),fss=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const {attachTestMain}=require('./test-main-inspector.cjs'),{selectLibraryFixture}=require('./select-library-fixture.cjs');
const from=process.env.MEDIASAIL_UPGRADE_FROM||'0.5.4',to=process.env.MEDIASAIL_UPGRADE_TO||'0.5.5',identity='f524de6d-ce52-54ca-a07e-a51e0d556196';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms)),list=value=>Array.isArray(value)?value:value?[value]:[];
function fixtureScope(env=process.env,platform=process.platform){
 assert.equal(platform,'win32','Hosted Windows only; never run on a user PC');
 assert.equal(env.GITHUB_ACTIONS,'true','Hosted Windows only; never run on a user PC');
 assert.equal(env.RUNNER_ENVIRONMENT,'github-hosted','Hosted Windows only; never run on a user PC');
 assert.equal(env.RUNNER_OS,'Windows');assert.match(env.GITHUB_RUN_ID||'',/^\d+$/);
 const root=path.resolve(__dirname,'..');assert.equal(root.toLowerCase(),path.resolve(env.GITHUB_WORKSPACE||'').toLowerCase());
 for(const key of ['RUNNER_TEMP','LOCALAPPDATA'])assert.ok(env[key]&&path.isAbsolute(env[key]),key);
 const relative=path.relative(path.resolve(env.LOCALAPPDATA),path.resolve(env.RUNNER_TEMP));
 assert.ok(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Fixture must stay outside AppData');
 const run=path.join(env.RUNNER_TEMP,'mediasail-content-upgrade-'+env.GITHUB_RUN_ID),target=path.join(run,'中文 原安装','MediaSail');
 return {root,run,target,exe:path.join(target,'MediaSail.exe'),libraryRoot:path.join(run,'共用 中文资料库'),bootstrap:path.join(env.LOCALAPPDATA,'ElectronEasel'),evidence:path.join(root,'installer-evidence','content-upgrade')};
}
async function until(fn,timeout,label){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const value=await fn();if(value)return value;}catch(error){last=error;}await delay(500);}throw Error('Timed out: '+label+(last?' '+last.message:''));}
async function hash(file){const h=crypto.createHash('sha256');for await(const bytes of fss.createReadStream(file))h.update(bytes);return h.digest('hex');}
function environment(){
 const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','SystemDrive','PATHEXT','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','USERNAME','OS','USERPROFILE','HOME','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PROGRAMFILES','PROGRAMFILES(X86)','ProgramFiles','ProgramFiles(x86)'])if(process.env[key])env[key]=process.env[key];
 const system=path.join(process.env.SystemRoot,'System32');env.PATH=[system,path.join(system,'Wbem'),path.join(system,'WindowsPowerShell','v1.0')].join(path.delimiter);env.PYTHONUTF8='1';env.PYTHONIOENCODING='utf-8';return env;
}
async function main(){
 const {root,run,target,exe,libraryRoot,bootstrap,evidence}=fixtureScope();
 assert.match(from,/^\d+\.\d+\.\d+$/);assert.match(to,/^\d+\.\d+\.\d+$/);assert.notEqual(from,to);
 const installers={baseline:path.join(root,'release-input','baseline',`MediaSail-${from}-win-x64-Setup.exe`),candidate:path.join(root,'release-input','candidate',`MediaSail-${to}-win-x64-Setup.exe`)};
 const ps=code=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);'+code],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
 const processes=()=>list(JSON.parse(ps("ConvertTo-Json -InputObject @(Get-CimInstance Win32_Process -Filter \"Name='MediaSail.exe'\"|Select-Object ProcessId,ExecutablePath,CommandLine) -Compress")||'[]'));
 const owned=()=>processes().filter(row=>row.ExecutablePath?.toLowerCase()===exe.toLowerCase());
 const registry=()=>list(JSON.parse(ps(`$rows=@();foreach($view in @('Registry64','Registry32')){$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::$view);try{foreach($name in @('Software\\${identity}','Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${identity}')){$key=$base.OpenSubKey($name);if($key){try{$rows+=@{location=$key.GetValue('InstallLocation');version=$key.GetValue('DisplayVersion')}}finally{$key.Dispose()}}}}finally{$base.Dispose()}};ConvertTo-Json -InputObject @($rows) -Compress`)||'[]'));
 const checkRegistry=version=>{const rows=registry();assert.ok(rows.length>=2);assert.ok(rows.some(row=>row.version===version));for(const row of rows){if(row.location)assert.equal(row.location.toLowerCase(),target.toLowerCase());if(row.version)assert.equal(row.version,version);}return rows;};
 const result={from,to,passed:false,startedAt:new Date().toISOString(),environment:'ephemeral GitHub-hosted Windows',transport:'genuine NSIS /S --updated --force-run, no /D update override',syntheticDataOnly:true,publications:0};
 let inspector,setupChild;
 const write=async(file,value)=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');};
 const persist=async()=>{await write(path.join(evidence,'result.json'),result);for(const [base,prefix]of [[bootstrap,'bootstrap'],[path.join(libraryRoot,'runtime'),'runtime']])for(const name of ['desktop.log','desktop-backend.log',`installer-${to}.ini`,`installer-${to}-copy.log`])await fs.copyFile(path.join(base,'logs',name),path.join(evidence,prefix+'-'+name)).catch(()=>{});};
 const phase=async name=>{result.phase=name;console.log('CONTENT UPGRADE '+name);await persist();};
 const localWindow="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'))";
 const render=code=>`(()=>{const w=${localWindow};return w.webContents.executeJavaScript(${JSON.stringify(code)});})()`;
 const waitConnection=version=>until(async()=>{const info=JSON.parse(await fs.readFile(path.join(bootstrap,'agent-connection.json'),'utf8'));if(info.status!=='ready'||info.version!==version||info.executable?.toLowerCase()!==exe.toLowerCase())return false;if(!owned().some(row=>row.ProcessId===info.pid&&!row.CommandLine?.includes('--type=')))return false;const live=await(await fetch(info.baseUrl+'/api/agent-info',{signal:AbortSignal.timeout(5000)})).json();return live.instanceId===info.instanceId&&live.libraryId===info.libraryId?info:false;},300000,version+' service ready');
 async function quit(){if(inspector){await inspector.evaluate(`(()=>{const {dialog}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs');if(!globalThis.__contentExitObserver){globalThis.__contentExitObserver=true;const original=dialog.showMessageBox;dialog.showMessageBox=function(...args){const options=args.at(-1);fs.appendFileSync(${JSON.stringify(path.join(evidence,'exit-dialogs.jsonl'))},JSON.stringify({at:new Date().toISOString(),title:options?.title,message:options?.message,buttons:options?.buttons})+'\\n');return original.apply(this,args);};}process.mainModule.require('electron').app.quit();return true;})()`).catch(()=>{});inspector.close();inspector=null;}await until(()=>owned().length===0,60000,'normal exit');}
 async function setup(file,args,observe=false){
  let done=false,exit,last=0;setupChild=cp.spawn(file,args,{windowsHide:false,windowsVerbatimArguments:true,stdio:'ignore',env:environment()});assert.ok(setupChild.pid);setupChild.once('exit',code=>{exit=code;done=true;});setupChild.once('error',error=>{exit=error.message;done=true;});
  const began=Date.now();
  await until(async()=>{if(!done&&Date.now()-last>=10000){last=Date.now();const output=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts/observe-installer.ps1'),'-InstallerPid',String(setupChild.pid),'-Screenshot',path.join(evidence,observe?'upgrade-progress.png':'baseline-progress.png')],{encoding:'utf8',windowsHide:true,timeout:20000});if(output.trim())result.lastInstallerWindows=JSON.parse(output);let installerState='';try{installerState=await fs.readFile(path.join(bootstrap,'logs',`installer-${observe?to:from}.ini`),'utf8');}catch{}console.log('NSIS '+JSON.stringify({elapsedMs:Date.now()-began,windows:result.lastInstallerWindows,installerState}));}return done;},900000,'installer exit');assert.equal(exit,0);
  console.log('ACTUAL NSIS EXIT '+JSON.stringify({name:path.basename(file),exit,observedMs:Date.now()-began}));
 }
 const originalFiles=new Map();async function remember(file,value){await write(file,value);originalFiles.set(file,await fs.readFile(file));}
 const checkOriginals=async()=>{for(const[file,bytes]of originalFiles)assert.deepEqual(await fs.readFile(file),bytes,'Changed existing data: '+file);};
 try{
  assert.equal(processes().length,0);assert.deepEqual(registry(),[]);for(const file of [bootstrap,run])assert.equal(fss.existsSync(file),false,'Fresh runner required: '+file);
  await fs.mkdir(evidence,{recursive:true});result.installers={};
  for(const [key,file]of Object.entries(installers)){const sha256=await hash(file),name=path.basename(file),bytes=(await fs.stat(file)).size;const lines=(await fs.readFile(path.join(path.dirname(file),'SHA256SUMS.txt'),'utf8')).split(/\r?\n/).filter(line=>line.trim().split(/\s+/).at(-1)===name);assert.equal(lines.length,1);assert.equal(lines[0].split(/\s+/)[0],sha256);if(key==='baseline'&&from==='0.5.4'){assert.equal(sha256,'06e22016e0d4253ea8d81bf78c2b3718b7805a1473b85b48d9f77ecfdba4cb2d');assert.equal(bytes,273973986);}if(key==='baseline'&&from==='0.5.5'){assert.equal(sha256,'67def2e003b3b02b5a5c0f3d0251be2eac320108da52b34d3383a039716392d9');assert.equal(bytes,262990773);}result.installers[key]={name,sha256,bytes};}
  await phase('baseline-install');await setup(installers.baseline,['/S','/D='+target]);checkRegistry(from);
  cp.spawn(exe,[],{windowsHide:false,stdio:'ignore',env:environment()});const initial=await until(()=>owned().find(row=>!row.CommandLine?.includes('--type=')),120000,'baseline app');inspector=await attachTestMain(initial.ProcessId);
  await selectLibraryFixture({inspector,pid:initial.ProcessId,exe,libraryRoot,evidence,cancelFirst:false});inspector.close();inspector=null;
  const old=await waitConnection(from);assert.equal(old.libraryRoot.toLowerCase(),libraryRoot.toLowerCase());inspector=await attachTestMain(old.pid);
  const cache=path.join(old.dataDir,'update-cache','mediasail-updater');assert.equal(await hash(path.join(cache,'installer.exe')),result.installers.baseline.sha256);assert.equal(JSON.parse(await fs.readFile(path.join(cache,'current-installer.json'),'utf8')).version,from);result.baselineCacheVerified=true;
  await until(()=>inspector.evaluate(render("Boolean(document.querySelector('.skill-home'))")),60000,'baseline home');
  await inspector.evaluate(render("(async()=>{await window.desktopUiState.call('set',{key:'mediasail_selected_profile',value:'合成画像'});await window.desktopUiState.call('set',{key:'easel_onboarding_seen',value:'1'});await window.desktopUiState.call('set',{key:'easel_theme',value:'dark'});await window.desktopUiState.call('flush');return true;})()"));
  if(process.env.MEDIASAIL_VERIFY_SKILL_FILENAME_UPGRADE==='1')await inspector.evaluate(render("(async()=>{await window.desktopUiState.call('set',{key:'mediasail_skill_filename',value:'旧版中文接入.md'});await window.desktopUiState.call('flush');return true;})()"));
  const oldPartition=await inspector.evaluate("(async()=>{const s=process.mainModule.require('electron').session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'content-upgrade-fixture',value:'synthetic-session',expirationDate:Math.floor(Date.now()/1000)+86400});await s.cookies.flushStore();return s.storagePath;})()");await quit();
  assert.ok(oldPartition&&oldPartition.toLowerCase().startsWith(old.dataDir.toLowerCase()+path.sep));
  let partitionFiles=0;async function rememberPartition(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const file=path.join(directory,entry.name);if(entry.isDirectory())await rememberPartition(file);else if(entry.isFile()){originalFiles.set(file,await fs.readFile(file));partitionFiles++;}else throw Error('Unexpected linked legacy partition');}}
  await rememberPartition(oldPartition);assert.ok(partitionFiles>0);result.legacyPartitionFiles=partitionFiles;
  const project='旧项目 中文 空格',directory=path.join(old.outputs,project),metadata={topic:project,title:'旧版合成报告',kind:'article',status:'ready',profile:'合成画像',platform:'抖音',deliverables:['报告.md'],cover:'封面.txt',steps:[{skill:'external-agent',layer:'general',outputs:['报告.md']}],custom:{keep:'原扩展字段'},created:'2026-10-01T00:00:00+08:00'};
  await remember(path.join(directory,'.easel.json'),metadata);await remember(path.join(directory,'报告.md'),'# 合成资料\n升级保留项目原路径。');await remember(path.join(directory,'assets','原始素材.txt'),'source fixture');await remember(path.join(directory,'封面.txt'),'cover fixture');
  await remember(path.join(old.profiles,'合成画像','identity.md'),'# 合成画像\n仅用于升级测试。');await remember(path.join(old.profiles,'合成画像','memory.md'),'合成运营经验');
  if(process.env.MEDIASAIL_VERIFY_CUSTOM_FILES==='1'){
   const method=path.join(old.workspace,'skills/shared/scripts/wordcount.py'),skill=path.join(old.skillDir,'references/context.md');
   await remember(method,(await fs.readFile(method,'utf8'))+'\n# synthetic user customization retained across upgrade\n');
   await remember(skill,(await fs.readFile(skill,'utf8'))+'\n合成用户维护的运营说明，升级后继续保留。\n');
   result.customFilesSeeded=true;
  }
  await remember(path.join(old.dataDir,'home','.easel-browser-profiles','DouyinProfile','fixture-only.json'),{synthetic:true});
  await remember(path.join(old.dataDir,'aitoearn/imports.json'),{version:1,compose:{title:'仅旧面板中的标题',body:'仅旧记录保存的正文，不可丢失',images:['乙.png','甲.png']},groups:{'fixture-user':'fixture-group'},jobs:[{id:'fixture-creating',status:'creating',content:{title:'待核对云端结果',body:'不能自动重试'},files:[]},{id:'fixture-uploading',status:'uploading',content:{title:'旧上传任务'},files:[]}]});
  originalFiles.set(path.join(bootstrap,'library-location.json'),await fs.readFile(path.join(bootstrap,'library-location.json')));originalFiles.set(path.join(libraryRoot,'.mediasail-library.json'),await fs.readFile(path.join(libraryRoot,'.mediasail-library.json')));
  await phase('candidate-install');const started=Date.now();await setup(installers.candidate,['/S','--updated','--force-run'],true);result.installMs=Date.now()-started;result.registrationAfter=checkRegistry(to);
  assert.equal(fss.existsSync(path.join(process.env.LOCALAPPDATA,'Programs/MediaSail/MediaSail.exe')),false,'No parallel default installation');
  const current=await waitConnection(to);assert.equal(current.libraryId,old.libraryId);assert.equal(current.libraryRoot.toLowerCase(),old.libraryRoot.toLowerCase());assert.equal(current.workspace.toLowerCase(),old.workspace.toLowerCase());await checkOriginals();result.originalFilesRetained=originalFiles.size;result.librarySelectionRetained=true;
  assert.equal(await hash(path.join(cache,'installer.exe')),result.installers.candidate.sha256);const cacheReceipt=JSON.parse(await fs.readFile(path.join(cache,'current-installer.json'),'utf8'));assert.equal(cacheReceipt.version,to);assert.equal(cacheReceipt.sha256,result.installers.candidate.sha256);assert.equal(cacheReceipt.bytes,result.installers.candidate.bytes);result.currentInstallerCacheVerified=true;
  inspector=await attachTestMain(current.pid);await until(()=>inspector.evaluate(render("Boolean(document.querySelector('.skill-home'))")),60000,'updated home');
  assert.equal(await inspector.evaluate("process.mainModule.require('electron').BrowserWindow.getAllWindows().some(w=>w.webContents.getURL().includes('startup.html'))"),false,'No repeat library selection');
  // Never create/read an AitoEarn session in the new app. Compare the closed
  // baseline partition bytes instead, including the real synthetic cookie DB.
  await checkOriginals();result.legacyAitoPartitionByteRetained=true;
  assert.equal(await inspector.evaluate(render("typeof window.desktopAito")),'undefined');
  assert.equal(await inspector.evaluate(render("typeof window.desktopActions.openAitoearn")),'function');
  assert.equal(await inspector.evaluate("process.mainModule.require('electron').webContents.getAllWebContents().some(w=>w.getURL().startsWith('https://aitoearn.cn/'))"),false);
  assert.equal(await inspector.evaluate("process.mainModule.require('node:fs').existsSync(process.mainModule.require('node:path').join(process.mainModule.require('electron').app.getAppPath(),'desktop/aitoearn/controller.cjs'))"),false);result.embeddedAitoRuntimeAbsent=true;
  const values=JSON.parse(await fs.readFile(path.join(current.dataDir,'ui-state.json'),'utf8')).values;assert.equal(values.easel_theme,'dark');assert.equal(values.mediasail_selected_profile,'合成画像');
  if(process.env.MEDIASAIL_VERIFY_SKILL_FILENAME_UPGRADE==='1'){assert.equal(values.mediasail_skill_filename,'旧版中文接入.md');result.skillFilePreferenceUpgradeRetained=true;}
  if(process.env.MEDIASAIL_EXPECT_PROFILE_REVISIONS==='1'){
   const profiles=await(await fetch(current.baseUrl+'/api/persona/'+encodeURIComponent('合成画像')+'/files')).json();
   const identityFile=profiles.files.find(file=>file.filename==='identity.md');assert.equal(identityFile.revision,await hash(path.join(current.profiles,'合成画像/identity.md')));
   assert.equal(identityFile.content,'# 合成画像\n仅用于升级测试。');result.profileRevisionVerified=true;
  }
  const endpoint=current.baseUrl+'/api/projects/'+encodeURIComponent(project)+'/metadata',before=await(await fetch(endpoint)).json();assert.deepEqual(before.metadata,metadata);
  const response=await fetch(endpoint,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:before.revision,changes:{category:'analysis',summary:'升级后仅补用途'}})});assert.equal(response.status,200);const updated=await response.json();assert.equal(updated.metadata.category,'analysis');assert.deepEqual(updated.metadata.custom,metadata.custom);assert.deepEqual(updated.metadata.steps,metadata.steps);
  originalFiles.delete(path.join(directory,'.easel.json'));await checkOriginals();
  const listed=await(await fetch(current.baseUrl+'/api/outputs')).json();assert.equal(listed.find(row=>row.name===project).meta.profile,'合成画像');assert.equal(listed.find(row=>row.name===project).meta.category,'analysis');
  // Deep-link straight to the local project. Visiting Dashboard would start its
  // real whoami checks, whose task reminder correctly needs user input on exit.
  await inspector.evaluate(render(`location.hash='#/outputs/'+encodeURIComponent(${JSON.stringify(project)});true`));
  await until(()=>inspector.evaluate(render("document.body.innerText.includes('旧版合成报告')&&document.body.innerText.includes('分析报告')")),30000,'updated content library');
  await inspector.evaluate("(()=>{const {shell}=process.mainModule.require('electron');globalThis.__upgradeOpened=[];shell.openPath=async value=>{globalThis.__upgradeOpened.push(value);return '';};return true;})()");
  await inspector.evaluate(render(`window.desktopActions.openProjectFolder(${JSON.stringify(project)}).then(()=>true)`));
  assert.deepEqual(await inspector.evaluate('globalThis.__upgradeOpened'),[directory]);result.projectFolderActionVerified=true;
  await inspector.evaluate(`(async()=>{const image=await ${localWindow}.webContents.capturePage();process.mainModule.require('node:fs').writeFileSync(${JSON.stringify(path.join(evidence,'upgraded-content-library.png'))},image.toPNG());return true;})()`);
  if(process.env.MEDIASAIL_VERIFY_SKILL_FILENAME==='1'){
   assert.equal(await inspector.evaluate(render("typeof window.desktopActions.copySkillFile")),'function');
   await inspector.evaluate(render("window.desktopUiState.call('set',{key:'mediasail_skill_filename',value:'升级验收接入.md'}).then(()=>true)"));
  }
  result.categoryPatchPreservedOtherMetadata=true;await phase('normal-restarts');await quit();
  for(let i=0;i<2;i++){cp.spawn(exe,[],{windowsHide:false,stdio:'ignore',env:environment()});const live=await waitConnection(to);assert.equal(live.libraryId,old.libraryId);inspector=await attachTestMain(live.pid);await quit();await checkOriginals();if(process.env.MEDIASAIL_VERIFY_SKILL_FILENAME==='1')assert.equal(JSON.parse(await fs.readFile(path.join(live.dataDir,'ui-state.json'),'utf8')).values.mediasail_skill_filename,'升级验收接入.md');}
  if(process.env.MEDIASAIL_VERIFY_SKILL_FILENAME==='1')result.skillFilePreferenceRetained=true;
  assert.equal(fss.existsSync(path.join(evidence,'exit-dialogs.jsonl')),false,'Idle local-content checks must not trigger a task confirmation');result.normalRestarts=2;result.dataAndSessionRetentionVerified=true;result.passed=true;await phase('passed');
 }catch(error){result.error=error.stack||String(error);await persist();throw error;}
 finally{inspector?.close();if(setupChild?.exitCode===null)cp.spawnSync('taskkill.exe',['/PID',String(setupChild.pid),'/T','/F'],{windowsHide:true});for(const row of owned().filter(row=>!row.CommandLine?.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(row.ProcessId),'/T','/F'],{windowsHide:true});result.finishedAt=new Date().toISOString();await persist();}
 console.log('REAL CONTENT UPGRADE PASSED '+JSON.stringify(result));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={fixtureScope};

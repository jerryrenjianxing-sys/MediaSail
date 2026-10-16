// Genuine installer/update acceptance. This file must never run on a user's PC.
'use strict';
const fs=require('node:fs/promises'),fss=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
assert.equal(process.platform,'win32','Windows runner required');
assert.equal(process.env.GITHUB_ACTIONS,'true','GitHub Actions only');
assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Ephemeral GitHub-hosted runner only');
assert.equal(process.env.RUNNER_OS,'Windows');
assert.match(process.env.GITHUB_RUN_ID||'',/^\d+$/);
assert.ok(process.env.RUNNER_TEMP&&process.env.GITHUB_WORKSPACE&&process.env.LOCALAPPDATA);
const root=path.resolve(__dirname,'..');
assert.equal(root.toLowerCase(),path.resolve(process.env.GITHUB_WORKSPACE).toLowerCase());
const mode=process.env.MEDIASAIL_UPGRADE_MODE||'candidate';
assert.ok(['candidate','published'].includes(mode),'Expected candidate or published mode');
const registration=process.env.MEDIASAIL_REGISTRATION||'missing';
assert.ok(['missing','registered'].includes(registration),'Expected missing or registered registration');
const failureMode=process.env.MEDIASAIL_FAILURE_MODE||'none';
assert.ok(['none','locked-old-node'].includes(failureMode),'Expected none or locked-old-node failure mode');
if(failureMode!=='none')assert.ok(mode==='candidate'&&registration==='missing','Failure injection requires candidate/missing mode');
const from='0.5.0',to=process.env.MEDIASAIL_TARGET_VERSION||'0.5.2';
assert.match(to,/^0\.5\.\d+$/,'Expected exact 0.5.x target version');
const run=path.join(process.env.RUNNER_TEMP,'mediasail-library-'+process.env.GITHUB_RUN_ID+'-'+mode+'-'+registration+'-'+failureMode);
const target=path.join(run,'用户 自选目录'),exe=path.join(target,'MediaSail.exe');
const defaultTarget=path.join(process.env.LOCALAPPDATA,'Programs','MediaSail'),defaultExe=path.join(defaultTarget,'MediaSail.exe');
const data=path.join(process.env.LOCALAPPDATA,'ElectronEasel');
const libraryRoot=path.join(run,'统一 资料库');
const oldNodeRelative='resources/runtime/python/cpython-3.11.15-windows-x86_64-none/Lib/site-packages/playwright/driver/node.exe';
const evidence=path.join(root,'installer-evidence','library-'+mode+'-'+registration+'-'+failureMode);
const baseline=path.join(root,'release-input','baseline',`MediaSail-${from}-win-x64-Setup.exe`);
const candidate=path.join(root,'release-input','candidate',`MediaSail-${to}-win-x64-Setup.exe`);
assert.ok(path.relative(process.env.RUNNER_TEMP,run)&&!path.relative(process.env.RUNNER_TEMP,run).startsWith('..'));
assert.ok(!target.toLowerCase().startsWith('d:\\mediasail'));
const {_electron:electron}=require('playwright'),{attachTestMain}=require('./test-main-inspector.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const result={from,to,mode,registration,failureMode,startedAt:new Date().toISOString(),environment:'ephemeral GitHub-hosted Windows',
 transport:mode==='published'?'unchanged 0.5.0 GitHub updater, real download and install':'verified draft installer, real NSIS /S --updated --force-run upgrade'};
const ps=script=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
 '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); '+script],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const list=value=>Array.isArray(value)?value:value?[value]:[];
const processes=()=>list(JSON.parse(ps("@(Get-CimInstance Win32_Process -Filter \"Name='MediaSail.exe'\" | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]'));
const owned=()=>processes().filter(item=>item.ExecutablePath?.toLowerCase()===exe.toLowerCase());
const defaultOwned=()=>processes().filter(item=>item.ExecutablePath?.toLowerCase()===defaultExe.toLowerCase());
const inside=(parent,file)=>{const rel=path.relative(parent,file);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
const quote=value=>"'"+value.replace(/'/g,"''")+"'";
// These identities come from the unchanged org.electroneasel.desktop appId and
// pinned electron-builder UUID namespace. No caller-supplied registry path is used.
const identity='f524de6d-ce52-54ca-a07e-a51e0d556196';
const registryKeys=[`Software\\${identity}`,`Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${identity}`];
function registrySnapshot(){
 return list(JSON.parse(ps(`$rows=@();foreach($hive in @('CurrentUser','LocalMachine')){foreach($view in @('Registry64','Registry32')){$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::$hive,[Microsoft.Win32.RegistryView]::$view);try{foreach($name in @(${registryKeys.map(quote).join(',')})){$key=$base.OpenSubKey($name);if($null -ne $key){try{$values=@{};foreach($v in $key.GetValueNames()){$values[$v]=@{kind=$key.GetValueKind($v).ToString();value=$key.GetValue($v,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}};$rows+=@{hive=$hive;view=$view;key=$name;values=$values;subkeys=@($key.GetSubKeyNames())}}finally{$key.Dispose()}}}}finally{$base.Dispose()}}};ConvertTo-Json -InputObject @($rows) -Depth 8 -Compress`)||'[]'));
}
function assertRegistration(rows,version){
 assert.ok(rows.length,'MediaSail installation registration missing');
 const installs=rows.filter(row=>row.key===registryKeys[0]),uninstalls=rows.filter(row=>row.key===registryKeys[1]);
 assert.ok(installs.length&&uninstalls.length,'Both installation and uninstall keys required');
 for(const row of rows){assert.equal(row.hive,'CurrentUser','No machine-wide MediaSail registration expected');assert.deepEqual(row.subkeys,[],'Unexpected registry children: do not mutate');}
 for(const row of installs)assert.equal(row.values.InstallLocation?.value?.toLowerCase(),target.toLowerCase(),'Registration points to wrong installation');
 for(const row of uninstalls){assert.equal(row.values.DisplayVersion?.value,version);assert.ok(row.values.UninstallString?.value?.toLowerCase().includes(path.join(target,'Uninstall MediaSail.exe').toLowerCase()),'Unexpected uninstaller identity');}
}
async function removeOnlyKnownRegistration(){
 const saved=registrySnapshot();assertRegistration(saved,from);
 await fs.writeFile(path.join(evidence,'baseline-installation-registration.json'),JSON.stringify(saved,null,2));
 // Confirm the exact keys were preserved in the evidence before deleting only
 // those HKCU keys. The disposable runner assertions above remain mandatory.
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(evidence,'baseline-installation-registration.json'),'utf8')),saved);
 ps(`foreach($view in @('Registry64','Registry32')){$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::$view);try{foreach($name in @(${registryKeys.map(quote).join(',')})){$base.DeleteSubKeyTree($name,$false)}}finally{$base.Dispose()}}`);
 assert.deepEqual(registrySnapshot(),[],'Known installation registration was not removed');
 result.missingRegistration={removedKeys:registryKeys,backup:'baseline-installation-registration.json',at:new Date().toISOString()};
}
async function shortcutTargets(inspector){
 const rows=list(JSON.parse(ps(`$shell=New-Object -ComObject WScript.Shell;$rows=@();foreach($directory in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('StartMenu'))){if(Test-Path -LiteralPath $directory){foreach($file in @(Get-ChildItem -LiteralPath $directory -Recurse -File -Filter 'MediaSail.lnk')){$shortcut=$shell.CreateShortcut($file.FullName);$rows+=@{path=$file.FullName;legacyComTarget=$shortcut.TargetPath}}}};ConvertTo-Json -InputObject @($rows) -Compress`)||'[]'));
 // WScript.Shell may expose the lossy ANSI LinkInfo field for Chinese paths.
 // Read the actual Unicode shell link through Electron as well, and retain both
 // values plus the raw .lnk evidence rather than treating ANSI loss as a side install.
 return inspector.evaluate(`(()=>{const {shell}=process.mainModule.require('electron');return ${JSON.stringify(rows)}.map(row=>({...row,target:shell.readShortcutLink(row.path).target}));})()`);
}
async function verifyInstaller(file,version){
 const name=path.basename(file),checks=await fs.readFile(path.join(path.dirname(file),'SHA256SUMS.txt'),'utf8');
 const line=checks.split(/\r?\n/).filter(line=>line.trim().split(/\s+/).at(-1)?.replace(/^\*/,'')===name);assert.equal(line.length,1,'Unambiguous installer checksum required');
 const expected=line[0].trim().split(/\s+/)[0].toLowerCase();assert.match(expected,/^[a-f0-9]{64}$/);
 const hash=crypto.createHash('sha256');for await(const chunk of fss.createReadStream(file))hash.update(chunk);const actual=hash.digest('hex');assert.equal(actual,expected,'Installer hash mismatch');
 if(version===from){assert.equal(actual,'13d2946e4e9bab7faa31d0714d73ad83401d44c3543c9c2aed5822138bc2f0d6');assert.equal((await fs.stat(file)).size,273780875);}
 return {name,sha256:actual,bytes:(await fs.stat(file)).size};
}
async function until(fn,timeout,label,interval=1000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await delay(interval);}throw Error('Timed out: '+label);}
async function directorySize(directory){let bytes=0,files=0;for(const entry of await fs.readdir(directory,{withFileTypes:true})){const item=path.join(directory,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory()){const child=await directorySize(item);bytes+=child.bytes;files+=child.files;}else if(entry.isFile()){bytes+=(await fs.stat(item)).size;files++;}}return {bytes,files};}
async function collectRuntimeFiles(directory,prefix=''){const files=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const rel=path.posix.join(prefix,entry.name);if(entry.isDirectory())files.push(...await collectRuntimeFiles(path.join(directory,entry.name),rel));else if(entry.isFile())files.push(rel);}return files;}
function setup(file,args,onSpawn=()=>{}){return new Promise((resolve,reject)=>{const child=cp.spawn(file,args,{windowsHide:false,windowsVerbatimArguments:true,stdio:'ignore'});if(child.pid)onSpawn(child.pid);const timer=setTimeout(()=>{cp.spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});reject(Error('Installer timed out'));},1800000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);if(code===0)resolve();else{const error=Error(path.basename(file)+' exited '+code);error.exitCode=code;reject(error);}});});}
function appEnvironment(){const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','SystemDrive','PATHEXT','PATH','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','USERNAME','OS','USERPROFILE','HOME','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PROGRAMFILES','PROGRAMFILES(X86)','ProgramFiles','ProgramFiles(x86)'])if(process.env[key])env[key]=process.env[key];env.PYTHONUTF8='1';env.PYTHONIOENCODING='utf-8';return env;}
async function persist(){await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify(result,null,2));for(const name of ['updates.log','desktop.log','desktop-backend.log',`installer-${to}.ini`,`installer-${to}-copy.log`,`installer-${to}-recovery.ini`]){await fs.copyFile(path.join(data,'logs',name),path.join(evidence,name)).catch(()=>{});await fs.copyFile(path.join(libraryRoot,'runtime','logs',name),path.join(evidence,'library-'+name)).catch(()=>{});}for(const name of ['library-location.json','library-migration-last.json'])await fs.copyFile(path.join(data,name),path.join(evidence,name)).catch(()=>{});}
async function installerStage(){try{const bytes=await fs.readFile(path.join(data,`logs/installer-${to}.ini`));return bytes[0]===255&&bytes[1]===254?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8');}catch{return 'not-started';}}
async function hashInstalledIdentity(){const rows={};for(const relative of ['MediaSail.exe','Uninstall MediaSail.exe','resources/app.asar',oldNodeRelative]){const file=path.join(target,relative),hash=crypto.createHash('sha256');for await(const chunk of fss.createReadStream(file))hash.update(chunk);rows[relative]={sha256:hash.digest('hex'),bytes:(await fs.stat(file)).size};}return rows;}
async function verifyLockedUninstallRollback(){
 assert.equal(registration,'missing');assert.deepEqual(registrySnapshot(),[]);assert.equal(owned().length,0);
 const before=await hashInstalledIdentity(),sizeBefore=await directorySize(target);
 const ready=path.join(run,'old-node-lock-ready'),release=path.join(run,'old-node-lock-release'),lockedFile=path.join(target,oldNodeRelative);
 // A real exclusive Windows file handle prevents the genuine old uninstaller
 // from renaming its Node runtime. The holder always releases after 15 minutes.
 const command=`$ErrorActionPreference='Stop';$handle=$null;try{$handle=[IO.File]::Open(${quote(lockedFile)},[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None);[IO.File]::WriteAllText(${quote(ready)},'ready');$deadline=[DateTime]::UtcNow.AddMinutes(15);while(-not [IO.File]::Exists(${quote(release)}) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 200}}finally{if($null -ne $handle){$handle.Dispose()}}`;
 const holder=cp.spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,stdio:'ignore'});let holderExited=false;holder.once('exit',()=>{holderExited=true;});
 let installerPid,finished=false,exitCode=null,installError;
 const fault={startedAt:new Date().toISOString(),lockedFile,actualInstallerExitCode:null,dialog:[]};result.uninstallFailure=fault;
 try{
  await until(()=>fss.existsSync(ready),15000,'exclusive old runtime lock ready');assert.equal(holderExited,false,'Lock holder exited unexpectedly');
  const installing=setup(candidate,['/S','--updated','--force-run'],pid=>{installerPid=pid;}).then(()=>{finished=true;exitCode=0;},error=>{finished=true;exitCode=error.exitCode;installError=String(error);});
  await until(async()=>{
   assert.equal(holderExited,false,'Exclusive lock must remain held until the installer stops');
   if(finished)return true;
   assert.equal(fss.existsSync(defaultExe),false,'Failing upgrade must not create a side installation');
   const output=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'confirm-installer-fixture-error.ps1'),'-InstallerPid',String(installerPid),'-ExpectedExecutable',candidate,'-Screenshot',path.join(evidence,'uninstall-failure-dialog.png')],{encoding:'utf8',windowsHide:true,timeout:20000});
   const observed=list(JSON.parse(output||'[]'));if(observed.length)fault.dialog.push(...observed);await persist();return finished;
  },720000,'real old-uninstaller failure and safe installer termination',2000);
  await installing;fault.actualInstallerExitCode=exitCode;fault.actualInstallerError=installError;
  assert.equal(exitCode,2,'Real candidate installer must return failure, not success');
  assert.ok(fault.dialog.some(dialog=>dialog.confirmed&&dialog.action==='confirm-uninstall-failed'),'Expected final uninstall failure dialog was not observed and confirmed');
  const stage=await installerStage();fault.installerLog=stage;assert.match(stage,/state=old-uninstall-failed/);assert.match(stage,/recoveryRollback=succeeded/);
  assert.deepEqual(registrySnapshot(),[],'Temporary registration was not rolled back to its originally missing state');
  assert.equal(owned().length,0,'A failed installation must not launch MediaSail');assert.equal(fss.existsSync(defaultExe),false);
  await fs.copyFile(path.join(data,`logs/installer-${to}.ini`),path.join(evidence,'failed-attempt-installer.ini'));
  const recoveryFiles=(await fs.readdir(path.join(data,'logs'))).filter(name=>name.startsWith(`installer-${to}-recovery-`)&&name.endsWith('.json'));
  assert.ok(recoveryFiles.length,'Real registry recovery journal missing');
  for(const name of recoveryFiles){const value=JSON.parse((await fs.readFile(path.join(data,'logs',name),'utf8')).replace(/^\uFEFF/,''));assert.equal(value.status,'rolled-back');await fs.copyFile(path.join(data,'logs',name),path.join(evidence,'failed-attempt-'+name));}
 }finally{
  if(installerPid&&!finished)cp.spawnSync('taskkill.exe',['/PID',String(installerPid),'/T','/F'],{windowsHide:true});
  await fs.writeFile(release,'release');await until(()=>holderExited,15000,'release exclusive runtime lock');
 }
 assert.deepEqual(await hashInstalledIdentity(),before,'Old official files must be restored unchanged after failed uninstall');
 assert.deepEqual(await directorySize(target),sizeBefore,'Failed uninstall must restore all old program files');
 fault.oldIdentityPreserved=before;fault.originalMissingRegistrationRestored=true;fault.lockReleased=true;fault.passed=true;fault.finishedAt=new Date().toISOString();
 result.phase='uninstall-failure-rollback-verified';await persist();
}
let app,inspector;
const main="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'))";
const render=code=>main+'.webContents.executeJavaScript('+JSON.stringify(code)+')';
const fixtures={
 'aitoearn/imports.json':JSON.stringify({version:1,compose:{project:'验收项目',title:'保留的 AitoEarn 待发送',body:'仅用于隔离验收',images:[]},groups:{'fixture-account':'fixture-group'},jobs:[{id:'fixture-draft',accountId:'fixture-account',accountName:'测试账号',fingerprint:'fixture-fingerprint',content:{title:'历史草稿',body:'隔离记录'},files:[],uploads:{},status:'done',message:'fixture only',progress:100,draftId:'fixture-cloud-draft',createdAt:1}]},null,2),
 'workspace/.env':'UPGRADE_FIXTURE=isolated-test-only\r\n',
 'workspace/profiles/验收 画像/identity.md':'# 身份定位\n自定义画像保留',
 'workspace/profiles/验收 画像/memory.md':'# 经验沉淀\n测试分析结论保留',
 'workspace/assets/验收 原件.txt':'用户素材原件保留',
 'workspace/outputs/验收项目/成品.md':'升级成品保留',
 'workspace/outputs/验收项目/.easel.json':JSON.stringify({title:'Agent 验收成品',deliverables:['成品.md'],status:'done'}),
 'workspace/outputs/_analytics/upgrade-fixture.json':JSON.stringify({platform:'bilibili',followers:123,source:'isolated-fixture'}),
 'workspace/outputs/_schedule.json':JSON.stringify([{id:'upgrade-calendar',title:'测试排期',date:'2026-10-15',status:'draft'}]),
 'home/.easel-browser-profiles/XiaohongshuProfile/Default/retention-fixture.txt':'平台浏览器资料保留（无真实账号）',
 'home/.openclaw-easel/agents/main/sessions/upgrade-fixture.jsonl':'{"type":"test-only","text":"旧后台会话归档"}\n',
};
async function seedPrelaunchHistory(){
 assert.equal(owned().length,0,'History is seeded only before the genuine baseline starts');
 assert.equal(fss.existsSync(path.join(data,'history-archive/0.5.0/manifest.json')),false,'No pre-existing archive may be edited');
 const chats=[{id:'upgrade-proof',title:'升级保留对话',created:1,messages:[{role:'user',content:'升级前的中文聊天'}]}];
 const state={schema:1,migration:{version:'0.3.3',completedAt:new Date().toISOString(),sources:[],sessions:1,copies:0},values:{easel_sessions:JSON.stringify(chats),easel_active_session:'upgrade-proof',easel_theme:'dark',easel_chat_reset_20260902:'1',easel_onboarding_seen:'1',easel_publish_draft:JSON.stringify({title:'保留的草稿',body:'待人工确认'})}};
 await fs.mkdir(data,{recursive:true});await fs.writeFile(path.join(data,'ui-state.json'),JSON.stringify(state));
 const relative='home/.openclaw-easel/agents/main/sessions/upgrade-fixture.jsonl',file=path.join(data,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,fixtures[relative]);
 await fs.mkdir(path.join(data,'aitoearn'),{recursive:true});await fs.writeFile(path.join(data,'aitoearn/imports.json'),fixtures['aitoearn/imports.json']);
}
async function seed(page){
 // A committed URL precedes React/storage initialization. Let the old UI's
 // initial empty-session/BroadcastChannel effects settle before injecting data.
 await page.locator('.skill-home').waitFor({state:'visible',timeout:60000});
 await page.waitForFunction(()=>typeof window.mediaSailPrepareClose==='function');
 await delay(700);
 const chats=[{id:'upgrade-proof',title:'升级保留对话',created:1,messages:[{role:'user',content:'升级前的中文聊天'}]}];
 await page.evaluate(async chats=>{for(const [key,value]of Object.entries({easel_sessions:JSON.stringify(chats),easel_active_session:'upgrade-proof',easel_theme:'dark',easel_onboarding_seen:'1',easel_publish_draft:JSON.stringify({title:'保留的草稿',body:'待人工确认'})})){const response=await window.desktopUiState.call('set',{key,value});if(response?.ok===false)throw Error(response.error);}await window.desktopUiState.call('flush');},chats);
 for(const [relative,content]of Object.entries(fixtures)){const file=path.join(data,relative);assert.ok(inside(data,file));await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,content);}
 await app.evaluate(async({session})=>{const store=session.fromPartition('persist:aitoearn-cn');await store.cookies.set({url:'https://aitoearn.cn',name:'installer-fixture',value:'keep',secure:true,expirationDate:Date.now()/1000+86400});await store.cookies.flushStore();});
 await page.reload();await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});
 await page.locator('.skill-home').waitFor({state:'visible',timeout:60000});
 await delay(700);
 const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
 await page.evaluate(()=>window.desktopUiState.call('flush'));
 const saved=await page.evaluate(()=>window.desktopUiState.call('load'));
 assert.ok(JSON.parse(saved.values.easel_sessions).some(item=>item.id==='upgrade-proof'&&item.messages[0]?.content==='升级前的中文聊天'),'Baseline renderer overwrote the seeded chat before upgrade');
 assert.equal(saved.values.easel_theme,'dark');
 assert.equal(JSON.parse(saved.values.easel_publish_draft).title,'保留的草稿');
}
async function observeInstall(oldPid,signal){
 let lastObservation=0,visible=false;
 return until(async()=>{
  if(signal?.aborted)throw Error('Installer observation stopped after installer completion/failure');
  const current=owned();
  assert.equal(fss.existsSync(defaultExe),false,'Upgrade created a parallel installation in the default folder');
  assert.equal(defaultOwned().length,0,'Upgrade launched the default-folder side installation');
  if(Date.now()-lastObservation>=2000){
   lastObservation=Date.now();
   const installers=list(JSON.parse(ps("@(Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*MediaSail*Setup*' -or $_.Name -eq 'installer.exe' } | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]'));
   const windows=[];
   for(const item of installers){
    const observed=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'observe-installer.ps1'),'-InstallerPid',String(item.ProcessId),'-Screenshot',path.join(evidence,'installer-progress.png')],{encoding:'utf8',windowsHide:true,timeout:20000});
    windows.push(...list(JSON.parse(observed||'[]')));
   }
   if(windows.some(w=>w.children?.some(c=>c.text?.startsWith('正在安装 MediaSail'))))visible=true;
   const observation={at:new Date().toISOString(),apps:current,installers,windows};
   result.observation=observation;result.visibleInstallObserved=visible;
   result.installStages??=[];
   const stage=await installerStage();
   if(result.installStages.at(-1)!==stage)result.installStages.push(stage);
   await persist();
   const texts=windows.flatMap(w=>w.children||[]).map(c=>c.text||'');
   if(texts.some(t=>/cannot be closed|文件复制失败|安装文件不完整|Uninstall.*failed|Failed to uninstall|无法确认旧版|无法恢复旧版|恢复安装登记.*未完成/i.test(t)))throw Error('Installer needs intervention: '+texts.join(' | '));
  }
  const launched=current.find(item=>item.ProcessId!==oldPid&&!item.CommandLine?.includes('--type=')&&item.CommandLine?.includes('--updated'));
  return launched||false;
 },1800000,'actual NSIS installation and automatic relaunch');
}
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const chunk of fss.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function completeMigration(launched){
 const initialPid=launched.ProcessId;inspector=await attachTestMain(initialPid);
 await until(()=>inspector.evaluate("Boolean(process.mainModule?.require&&process.mainModule.require('electron').app.isReady())"),30000,'migration UI main ready');
 await fs.mkdir(libraryRoot,{recursive:true});
 // Keep the actual first-start native confirmation. Only selecting the disposable
 // directory is supplied by the harness; copying, checks and process relaunch are real.
 await inspector.evaluate(`(()=>{const {dialog}=process.mainModule.require('electron'),original=dialog.showOpenDialog;dialog.showOpenDialog=async function(...args){const options=args.at(-1);if(options?.title==='选择统一资料库位置')return {canceled:false,filePaths:[${JSON.stringify(libraryRoot)}]};return original.apply(this,args);};return true;})()`);
 let confirmation;await until(async()=>{
  const observed=list(JSON.parse(cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'confirm-library-fixture.ps1'),'-ApplicationPid',String(initialPid),'-ExpectedExecutable',exe,'-Screenshot',path.join(evidence,'migration-confirmation.png')],{encoding:'utf8',windowsHide:true,timeout:20000})||'[]'));
  if(observed.length){confirmation=observed;return true;}return false;
 },120000,'actual first-start migration confirmation');
 result.migration={confirmation,startedAt:new Date().toISOString(),selectionMethod:'Actual native confirmation, isolated folder selection supplied by test dialog response; application migration is unchanged.'};
 await inspector.evaluate(`(async()=>{const fs=process.mainModule.require('node:fs'),{BrowserWindow}=process.mainModule.require('electron'),w=BrowserWindow.getAllWindows()[0];const image=await w.webContents.capturePage();fs.writeFileSync(${JSON.stringify(path.join(evidence,'migration-progress.png'))},image.toPNG());return true;})()`).catch(()=>{});
 inspector.close();inspector=null;
 await until(async()=>{try{const value=JSON.parse(await fs.readFile(path.join(data,'library-location.json'),'utf8'));return value.state==='ready'&&value.libraryRoot.toLowerCase()===libraryRoot.toLowerCase();}catch{return false;}},300000,'real source copied, verified and library committed');
 const next=await until(()=>owned().find(item=>item.ProcessId!==initialPid&&!item.CommandLine?.includes('--type=')),120000,'post-migration process relaunch');
 await until(()=>!owned().some(item=>item.ProcessId===initialPid),30000,'migration process releases inspector and sessions');
 result.migration.finishedAt=new Date().toISOString();result.migration.relaunchedPid=next.ProcessId;return next;
}
async function verifyNew(launched,start){
 result.installToRelaunchMs=Date.now()-start;
 inspector=await attachTestMain(launched.ProcessId);
 await until(()=>inspector.evaluate("Boolean(process.mainModule?.require&&process.mainModule.require('electron').app.isReady())"),30000,'new main ready');
 await until(()=>inspector.evaluate(`(async()=>{const w=${main};return w?await w.webContents.executeJavaScript("fetch('/api/status').then(r=>r.json()).then(s=>s.serviceReady===true).catch(()=>false)"):false;})()`),240000,'new local business serviceReady');
 result.installToReadyMs=Date.now()-start;
 result.retention=await inspector.evaluate(`(async()=>{const {app,session}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');const directory=app.getPath('userData'),state=JSON.parse(fs.readFileSync(path.join(directory,'ui-state.json'),'utf8'));return {version:app.getVersion(),exe:app.getPath('exe'),data:directory,theme:state.values.easel_theme,chat:JSON.parse(state.values.easel_sessions).some(s=>s.id==='upgrade-proof'&&s.messages[0]?.content==='升级前的中文聊天'),draft:JSON.parse(state.values.easel_publish_draft).title,cookie:(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'installer-fixture'}))[0]?.value};})()`);
 assert.equal(result.retention.version,to);assert.equal(result.retention.exe.toLowerCase(),exe.toLowerCase());assert.equal(result.retention.data.toLowerCase(),path.join(libraryRoot,'runtime').toLowerCase());
 result.registrationAfter=registrySnapshot();assertRegistration(result.registrationAfter,to);
 assert.equal(fss.existsSync(defaultExe),false,'Default-folder side installation remains');
 result.shortcuts=await shortcutTargets(inspector);assert.ok(result.shortcuts.length>=2,'Desktop and Start Menu shortcuts required');
 for(const [index,shortcut]of result.shortcuts.entries()){await fs.copyFile(shortcut.path,path.join(evidence,`installed-shortcut-${index}.lnk`));assert.equal(shortcut.target.toLowerCase(),exe.toLowerCase(),'Unicode shortcut points to side installation');}
 assert.equal(result.retention.chat,true);assert.equal(result.retention.theme,'dark');assert.equal(result.retention.draft,'保留的草稿');assert.equal(result.retention.cookie,'keep');
 const savedAito=await inspector.evaluate(render("window.desktopAito.call('status')"));assert.equal(savedAito.compose.title,'保留的 AitoEarn 待发送');assert.ok(savedAito.jobs.some(job=>job.id==='fixture-draft'&&job.status==='done'));
 for(const [relative,content]of Object.entries(fixtures)){assert.equal(await fs.readFile(path.join(data,relative),'utf8'),content,'original '+relative+' changed');const migrated=relative.startsWith('workspace/')?path.join(libraryRoot,relative):path.join(libraryRoot,'runtime',relative);assert.equal(await fs.readFile(migrated,'utf8'),content,'migrated '+relative+' changed');}
 const runtimeData=path.join(libraryRoot,'runtime');
 const archived=JSON.parse(await fs.readFile(path.join(runtimeData,'history-archive/0.5.0/manifest.json'),'utf8'));assert.equal(archived.complete,true);
 const archivedUi=JSON.parse(await fs.readFile(path.join(runtimeData,'history-archive/0.5.0/ui-state.json'),'utf8'));assert.ok(JSON.parse(archivedUi.values.easel_sessions).some(s=>s.id==='upgrade-proof'));
 assert.equal(await fs.readFile(path.join(runtimeData,'history-archive/0.5.0/sessions/main/upgrade-fixture.jsonl'),'utf8'),fixtures['home/.openclaw-easel/agents/main/sessions/upgrade-fixture.jsonl']);
 const connection=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(connection.version,to);assert.equal(connection.status,'ready');
 assert.equal(connection.libraryRoot.toLowerCase(),libraryRoot.toLowerCase());assert.equal(connection.workspace.toLowerCase(),path.join(libraryRoot,'workspace').toLowerCase());
 const canonical=JSON.parse(await fs.readFile(connection.connectionFile,'utf8'));assert.equal(canonical.instanceId,connection.instanceId);assert.equal(canonical.libraryId,connection.libraryId);
 const cacheFile=path.join(runtimeData,'update-cache','mediasail-updater','installer.exe');assert.equal(await hashFile(cacheFile),result.installers.candidate.sha256,'Current installer baseline must follow the library');
 const externalProject=path.join(connection.outputs,'外部 Agent 产物');await fs.mkdir(externalProject,{recursive:true});await fs.writeFile(path.join(externalProject,'report.md'),'共享资料库实测');await fs.writeFile(path.join(externalProject,'.easel.json'),JSON.stringify({title:'外部 Agent 产物',profile:'验收 画像',deliverables:['report.md']}));
 const visible=await(await fetch(connection.baseUrl+'/api/outputs')).json();assert.ok(visible.some(item=>item.meta?.title==='外部 Agent 产物'),'Direct Agent writes must be visible');const sharedReport=await(await fetch(connection.baseUrl+'/api/output/'+encodeURIComponent('外部 Agent 产物')+'/report.md')).json();assert.equal(sharedReport.content,'共享资料库实测');
 const api=await (await fetch(connection.baseUrl+'/api/status')).json();assert.equal(api.serviceReady,true);assert.equal(api.gateway,false);
 for(const endpoint of ['/api/chat','/api/skill'])assert.equal((await fetch(connection.baseUrl+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).status,410);
 const outputs=await(await fetch(connection.baseUrl+'/api/outputs')).json();assert.ok(outputs.some(p=>p.meta?.title==='Agent 验收成品'));
 const runtime=path.join(target,'resources','runtime');
 for(const relative of ['node','ffmpeg','browsers'])assert.equal(fss.existsSync(path.join(runtime,relative)),false,'Old bulky runtime remains: '+relative);
 const files=await collectRuntimeFiles(runtime);
 const privateDriver=files.filter(file=>/\/site-packages\/playwright\/driver\/node\.exe$/i.test('/'+file));assert.equal(privateDriver.length,1,'Keep Playwright private Node driver');
 const forbidden=files.filter(file=>(/(^|\/)(ffmpeg|ffprobe)\.exe$/i.test(file)||/(^|\/)node\.exe$/i.test(file))&&!privateDriver.includes(file));
 assert.deepEqual(forbidden,[],'Standalone creation runtime found');
 result.runtime={files:files.length,playwrightPrivateNode:privateDriver[0],removed:['runtime/node','runtime/ffmpeg','runtime/browsers']};
 result.afterProgram=await directorySize(target);
 result.userDataAfter=await directorySize(runtimeData);result.libraryAfter=await directorySize(libraryRoot);result.preservedLegacyData=await directorySize(data);
 result.startupObservedMs=result.installToReadyMs-result.installToRelaunchMs;
 result.reclaimedProgramBytes=result.beforeProgram.bytes-result.afterProgram.bytes;
 assert.equal(result.visibleInstallObserved,true,'Actual visible installation page was not observed');assert.ok(fss.existsSync(path.join(evidence,'installer-progress.png')),'Progress screenshot missing');
 const stage=await installerStage();assert.match(stage,/succeeded/);
 await delay(700);await inspector.evaluate(`(async()=>{const image=await ${main}.webContents.capturePage();process.mainModule.require('node:fs').writeFileSync(${JSON.stringify(path.join(evidence,'upgraded-agent-page.png'))},image.toPNG());})()`);
 await inspector.evaluate(render("window.desktopUiState.call('set',{key:'mediasail_selected_profile',value:'验收 画像'})"));
 const liveInfo=await(await fetch(connection.baseUrl+'/api/agent-info')).json();assert.equal(liveInfo.selectedProfile,'验收 画像');
 {
  await inspector.evaluate(render('window.desktopUpdates.openAndCheck()'));
  await until(async()=>{const state=await inspector.evaluate(render('window.desktopUpdates.status()'));if(state.phase==='error')throw Error(state.message);return state.phase==='current';},180000,'new version is current');
 }
 await verifyNormalRestarts();
 result.passed=true;result.phase='verified';await persist();
}
async function verifyNormalRestarts(){
 result.normalRestarts=[];
 for(let index=1;index<=2;index++){
  if(inspector){await inspector.evaluate("process.mainModule.require('electron').app.quit();true").catch(()=>{});inspector.close();inspector=null;}
  else if(app){await app.evaluate(({app})=>app.quit()).catch(()=>{});app=null;}
  await until(()=>owned().length===0,45000,'normal quit before restart '+index);
  app=await electron.launch({executablePath:exe,args:[],env:appEnvironment(),timeout:60000});const page=await app.firstWindow();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});await page.locator('.skill-home').waitFor({state:'visible',timeout:60000});
  const observed=await app.evaluate(async({app,session})=>{const fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path'),data=app.getPath('userData'),state=JSON.parse(fs.readFileSync(path.join(data,'ui-state.json'),'utf8'));return {version:app.getVersion(),exe:app.getPath('exe'),data,theme:state.values.easel_theme,profile:state.values.mediasail_selected_profile,cookie:(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'installer-fixture'}))[0]?.value};});
  assert.equal(observed.version,to);assert.equal(observed.exe.toLowerCase(),exe.toLowerCase());assert.equal(observed.data.toLowerCase(),path.join(libraryRoot,'runtime').toLowerCase());assert.equal(observed.theme,'dark');assert.equal(observed.profile,'验收 画像');assert.equal(observed.cookie,'keep');
  const connection=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal((await(await fetch(connection.baseUrl+'/api/status')).json()).serviceReady,true);const outputs=await(await fetch(connection.baseUrl+'/api/outputs')).json();assert.ok(outputs.some(item=>item.meta?.title==='外部 Agent 产物'));
  result.normalRestarts.push({index,method:'real app.quit then unchanged installed executable',...observed});await page.screenshot({path:path.join(evidence,'normal-restart-'+index+'.png'),animations:'disabled'});await persist();
 }
 await app.evaluate(({app})=>app.quit()).catch(()=>{});app=null;await until(()=>owned().length===0,45000,'final normal shutdown');
}
(async()=>{
 await fs.mkdir(evidence,{recursive:true});assert.equal(processes().length,0,'No pre-existing MediaSail process allowed');assert.equal(fss.existsSync(data),false,'Runner must have no existing user data');assert.equal(fss.existsSync(target),false);
 assert.equal(fss.existsSync(defaultExe),false,'Runner must have no default-folder MediaSail installation');assert.deepEqual(registrySnapshot(),[],'Runner must have no pre-existing MediaSail installation registration');
 assert.ok(Number(ps('(Get-PSDrive -Name C).Free'))>8*1024**3,'Need 8 GiB free for genuine light baseline');
 assert.ok(fss.existsSync(baseline));assert.ok(fss.existsSync(candidate));
 result.installers={baseline:await verifyInstaller(baseline,from),candidate:await verifyInstaller(candidate,to)};
 result.phase='baseline-install';await persist();
 try{
  await setup(baseline,['/S','/D='+target]);assert.ok(fss.existsSync(exe));result.beforeProgram=await directorySize(target);
  result.registrationBefore=registrySnapshot();assertRegistration(result.registrationBefore,from);
  result.baselineIdentity=await hashInstalledIdentity();await persist();
  assert.ok(fss.existsSync(path.join(target,oldNodeRelative)),'Genuine 0.5.0 Playwright private driver required');
  await seedPrelaunchHistory();
  app=await electron.launch({executablePath:exe,args:[],env:appEnvironment(),timeout:60000});const page=await app.firstWindow();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});assert.equal(await app.evaluate(({app})=>app.getVersion()),from);
  await seed(page);result.userDataBefore=await directorySize(data);result.baselineReadyAt=new Date().toISOString();result.phase='seeded';await persist();
  if(registration==='missing'){
   await app.close();app=null;await until(()=>owned().length===0,30000,'baseline clean shutdown before removing registration');
   await removeOnlyKnownRegistration();
   assert.ok(fss.existsSync(exe)&&fss.existsSync(path.join(target,'Uninstall MediaSail.exe')),'Original program and uninstaller must remain untouched');
   app=await electron.launch({executablePath:exe,args:[],env:appEnvironment(),timeout:60000});const reopened=await app.firstWindow();
   await reopened.waitForURL('http://127.0.0.1:*/',{timeout:240000});await reopened.locator('.skill-home').waitFor({state:'visible',timeout:60000});
   assert.equal(await app.evaluate(({app})=>app.getVersion()),from);
   const descriptor=await until(async()=>{try{const value=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));return value.version===from&&value.status==='ready'&&value.executable?.toLowerCase()===exe.toLowerCase()?value:false;}catch{return false;}},240000,'genuine old client connection descriptor');
   result.baselineConnection={version:descriptor.version,executable:descriptor.executable,status:descriptor.status};
   assert.deepEqual(registrySnapshot(),[],'Old client launch must not silently recreate registration');
   result.phase='missing-registration-reproduced';await persist();
  }
  const oldPid=app.process().pid,activePage=await app.firstWindow();let start,launched;
  if(mode==='candidate'){
   await app.close();app=null;await until(()=>owned().length===0,30000,'baseline clean shutdown');
   if(failureMode==='locked-old-node')await verifyLockedUninstallRollback();
   start=Date.now();result.phase='installing';await persist();
   // Deliberately omit /D. The unmodified old client supplied no install path;
   // the actual new installer must recover that path and invoke the old uninstaller.
   const observation=new AbortController();
   const install=setup(candidate,['/S','--updated','--force-run']);
   try{[launched]=await Promise.all([observeInstall(oldPid,observation.signal),install]);}
   finally{observation.abort();}
  }else{
   const event=app.waitForEvent('window',{predicate:window=>window!==activePage});await activePage.evaluate(()=>window.desktopUpdates.openAndCheck());const panel=await event;
   let state,lastCheck=Date.now();
   await until(async()=>{state=await activePage.evaluate(()=>window.desktopUpdates.status());if(state.phase==='available')return true;if(['current','error'].includes(state.phase)&&Date.now()-lastCheck>=30000){lastCheck=Date.now();await panel.evaluate(()=>window.mediaSailUpdate.call('check'));}return false;},300000,'published GitHub discovery');
   assert.equal(state.version,to);await panel.screenshot({path:path.join(evidence,`old-discovers-${to}.png`),animations:'disabled'});
   const download=Date.now();await panel.evaluate(()=>window.mediaSailUpdate.call('download'));
   await until(async()=>{state=await activePage.evaluate(()=>window.desktopUpdates.status());if(state.phase==='error')throw Error(state.message);return state.phase==='downloaded';},1200000,'genuine updater download and verification');
   result.downloadMs=Date.now()-download;result.updateSize=state.total;result.downloadTransferred=state.transferred;
   result.phase='installing';await persist();start=Date.now();
   await panel.evaluate(()=>{void window.mediaSailUpdate.call('install');});app=null;
   launched=await observeInstall(oldPid);
  }
  launched=await completeMigration(launched);
  await verifyNew(launched,start);console.log('REAL LIBRARY UPGRADE PASSED '+JSON.stringify(result));
 }catch(error){result.error=error.stack||String(error);await persist();throw error;
 }finally{
  inspector?.close();if(app)await Promise.race([app.close().catch(()=>{}),delay(10000)]);
  for(const item of owned().filter(item=>!item.CommandLine?.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(item.ProcessId),'/T','/F'],{windowsHide:true});
  for(const item of defaultOwned().filter(item=>!item.CommandLine?.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(item.ProcessId),'/T','/F'],{windowsHide:true});
  for(const item of result.observation?.installers||[])if(item.ExecutablePath&&(inside(run,item.ExecutablePath)||inside(path.join(root,'release-input'),item.ExecutablePath)))cp.spawnSync('taskkill.exe',['/PID',String(item.ProcessId),'/T','/F'],{windowsHide:true});
  const uninstaller=path.join(target,'Uninstall MediaSail.exe');
  if(fss.existsSync(uninstaller))try{await setup(uninstaller,['/S','/KEEP_APP_DATA','_?='+target]);}catch(error){result.cleanupError=String(error);}
  // A failing candidate may have reproduced the exact side-installation bug.
  // Clean only that fixed current-user path on this disposable runner as well.
  const sideUninstaller=path.join(defaultTarget,'Uninstall MediaSail.exe');
  if(fss.existsSync(sideUninstaller))try{await setup(sideUninstaller,['/S','/KEEP_APP_DATA','_?='+defaultTarget]);}catch(error){result.sideCleanupError=String(error);}
  result.cleanedUp=!fss.existsSync(exe);result.finishedAt=new Date().toISOString();await persist();
  result.sideInstallationCleanedUp=!fss.existsSync(defaultExe);await persist();
  if(!result.cleanedUp||!result.sideInstallationCleanedUp)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

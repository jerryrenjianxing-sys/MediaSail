// Genuine installer/update acceptance. This file must never run on a user's PC.
'use strict';
const fs=require('node:fs/promises'),fss=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
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
const from='0.4.3',to='0.5.0',run=path.join(process.env.RUNNER_TEMP,'mediasail-lite-'+process.env.GITHUB_RUN_ID+'-'+mode);
const target=path.join(run,'用户 自选目录'),exe=path.join(target,'MediaSail.exe');
const data=path.join(process.env.LOCALAPPDATA,'ElectronEasel');
const evidence=path.join(root,'installer-evidence','lite-'+mode);
const baseline=path.join(root,'release-input','baseline',`MediaSail-${from}-win-x64-Setup.exe`);
const candidate=path.join(root,'release-input','candidate',`MediaSail-${to}-win-x64-Setup.exe`);
assert.ok(path.relative(process.env.RUNNER_TEMP,run)&&!path.relative(process.env.RUNNER_TEMP,run).startsWith('..'));
assert.ok(!target.toLowerCase().startsWith('d:\\mediasail'));
const {_electron:electron}=require('playwright'),{attachTestMain}=require('./test-main-inspector.cjs');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const result={from,to,mode,startedAt:new Date().toISOString(),environment:'ephemeral GitHub-hosted Windows',
 transport:mode==='published'?'unchanged 0.4.3 GitHub updater, real download and install':'verified draft installer, real NSIS /S --updated --force-run upgrade'};
const ps=script=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
 '[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); '+script],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
const list=value=>Array.isArray(value)?value:value?[value]:[];
const processes=()=>list(JSON.parse(ps("@(Get-CimInstance Win32_Process -Filter \"Name='MediaSail.exe'\" | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]'));
const owned=()=>processes().filter(item=>item.ExecutablePath?.toLowerCase()===exe.toLowerCase());
const inside=(parent,file)=>{const rel=path.relative(parent,file);return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
async function until(fn,timeout,label,interval=1000){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await delay(interval);}throw Error('Timed out: '+label);}
async function directorySize(directory){let bytes=0,files=0;for(const entry of await fs.readdir(directory,{withFileTypes:true})){const item=path.join(directory,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory()){const child=await directorySize(item);bytes+=child.bytes;files+=child.files;}else if(entry.isFile()){bytes+=(await fs.stat(item)).size;files++;}}return {bytes,files};}
async function collectRuntimeFiles(directory,prefix=''){const files=[];for(const entry of await fs.readdir(directory,{withFileTypes:true})){const rel=path.posix.join(prefix,entry.name);if(entry.isDirectory())files.push(...await collectRuntimeFiles(path.join(directory,entry.name),rel));else if(entry.isFile())files.push(rel);}return files;}
function setup(file,args){return new Promise((resolve,reject)=>{const child=cp.spawn(file,args,{windowsHide:false,windowsVerbatimArguments:true,stdio:'ignore'});const timer=setTimeout(()=>{cp.spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});reject(Error('Installer timed out'));},1800000);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',code=>{clearTimeout(timer);code===0?resolve():reject(Error(path.basename(file)+' exited '+code));});});}
function appEnvironment(){const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','SystemDrive','PATHEXT','PATH','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','USERNAME','OS','USERPROFILE','HOME','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PROGRAMFILES','PROGRAMFILES(X86)','ProgramFiles','ProgramFiles(x86)'])if(process.env[key])env[key]=process.env[key];env.PYTHONUTF8='1';env.PYTHONIOENCODING='utf-8';return env;}
async function persist(){await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify(result,null,2));for(const name of ['updates.log','desktop.log','desktop-backend.log',`installer-${to}.ini`,`installer-${to}-copy.log`])await fs.copyFile(path.join(data,'logs',name),path.join(evidence,name)).catch(()=>{});}
async function installerStage(){try{const bytes=await fs.readFile(path.join(data,`logs/installer-${to}.ini`));return bytes[0]===255&&bytes[1]===254?bytes.subarray(2).toString('utf16le'):bytes.toString('utf8');}catch{return 'not-started';}}
let app,inspector;
const main="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'))";
const render=code=>main+'.webContents.executeJavaScript('+JSON.stringify(code)+')';
const fixtures={
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
   if(texts.some(t=>/cannot be closed|文件复制失败|安装文件不完整|Uninstall.*failed/i.test(t)))throw Error('Installer needs intervention: '+texts.join(' | '));
  }
  const launched=current.find(item=>item.ProcessId!==oldPid&&!item.CommandLine?.includes('--type=')&&item.CommandLine?.includes('--updated'));
  return launched||false;
 },1800000,'actual NSIS installation and automatic relaunch');
}
async function verifyNew(launched,start){
 result.installToRelaunchMs=Date.now()-start;
 inspector=await attachTestMain(launched.ProcessId);
 await until(()=>inspector.evaluate("Boolean(process.mainModule?.require&&process.mainModule.require('electron').app.isReady())"),30000,'new main ready');
 await until(()=>inspector.evaluate(`(async()=>{const w=${main};return w?await w.webContents.executeJavaScript("fetch('/api/status').then(r=>r.json()).then(s=>s.serviceReady===true).catch(()=>false)"):false;})()`),240000,'new local business serviceReady');
 result.installToReadyMs=Date.now()-start;
 result.retention=await inspector.evaluate(`(async()=>{const {app,session}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');const directory=app.getPath('userData'),state=JSON.parse(fs.readFileSync(path.join(directory,'ui-state.json'),'utf8'));return {version:app.getVersion(),exe:app.getPath('exe'),data:directory,theme:state.values.easel_theme,chat:JSON.parse(state.values.easel_sessions).some(s=>s.id==='upgrade-proof'&&s.messages[0]?.content==='升级前的中文聊天'),draft:JSON.parse(state.values.easel_publish_draft).title,cookie:(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'installer-fixture'}))[0]?.value};})()`);
 assert.equal(result.retention.version,to);assert.equal(result.retention.exe.toLowerCase(),exe.toLowerCase());assert.equal(result.retention.data.toLowerCase(),data.toLowerCase());
 assert.equal(result.retention.chat,true);assert.equal(result.retention.theme,'dark');assert.equal(result.retention.draft,'保留的草稿');assert.equal(result.retention.cookie,'keep');
 for(const [relative,content]of Object.entries(fixtures))assert.equal(await fs.readFile(path.join(data,relative),'utf8'),content,relative+' changed');
 const archived=JSON.parse(await fs.readFile(path.join(data,'history-archive/0.5.0/manifest.json'),'utf8'));assert.equal(archived.complete,true);
 const archivedUi=JSON.parse(await fs.readFile(path.join(data,'history-archive/0.5.0/ui-state.json'),'utf8'));assert.ok(JSON.parse(archivedUi.values.easel_sessions).some(s=>s.id==='upgrade-proof'));
 assert.equal(await fs.readFile(path.join(data,'history-archive/0.5.0/sessions/main/upgrade-fixture.jsonl'),'utf8'),fixtures['home/.openclaw-easel/agents/main/sessions/upgrade-fixture.jsonl']);
 const connection=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(connection.version,to);assert.equal(connection.status,'ready');
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
 result.afterProgram=await directorySize(target);assert.ok(result.afterProgram.bytes<result.beforeProgram.bytes,'New program should be smaller');
 result.reclaimedProgramBytes=result.beforeProgram.bytes-result.afterProgram.bytes;
 assert.equal(result.visibleInstallObserved,true,'Actual visible installation page was not observed');assert.ok(fss.existsSync(path.join(evidence,'installer-progress.png')),'Progress screenshot missing');
 const stage=await installerStage();assert.match(stage,/succeeded/);
 await delay(700);await inspector.evaluate(`(async()=>{const image=await ${main}.webContents.capturePage();process.mainModule.require('node:fs').writeFileSync(${JSON.stringify(path.join(evidence,'upgraded-agent-page.png'))},image.toPNG());})()`);
 await inspector.evaluate(render("window.desktopUiState.call('set',{key:'mediasail_selected_profile',value:'验收 画像'})"));
 const liveInfo=await(await fetch(connection.baseUrl+'/api/agent-info')).json();assert.equal(liveInfo.selectedProfile,'验收 画像');
 if(mode==='published'){
  await inspector.evaluate(render('window.desktopUpdates.openAndCheck()'));
  await until(async()=>{const state=await inspector.evaluate(render('window.desktopUpdates.status()'));if(state.phase==='error')throw Error(state.message);return state.phase==='current';},180000,'new version is current');
 }
 result.passed=true;result.phase='verified';await persist();
}
(async()=>{
 await fs.mkdir(evidence,{recursive:true});assert.equal(processes().length,0,'No pre-existing MediaSail process allowed');assert.equal(fss.existsSync(data),false,'Runner must have no existing user data');assert.equal(fss.existsSync(target),false);
 assert.ok(Number(ps('(Get-PSDrive -Name C).Free'))>28*1024**3,'Need 28 GiB free for genuine full baseline');
 assert.ok(fss.existsSync(baseline));assert.ok(fss.existsSync(candidate));
 result.phase='baseline-install';await persist();
 try{
  await setup(baseline,['/S','/D='+target]);assert.ok(fss.existsSync(exe));result.beforeProgram=await directorySize(target);
  assert.ok(fss.existsSync(path.join(target,'resources/runtime/node/node.exe')),'Genuine heavy 0.4.3 baseline required');
  app=await electron.launch({executablePath:exe,args:[],env:appEnvironment(),timeout:60000});const page=await app.firstWindow();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});assert.equal(await app.evaluate(({app})=>app.getVersion()),from);
  await seed(page);result.baselineReadyAt=new Date().toISOString();result.phase='seeded';await persist();
  const oldPid=app.process().pid;let start,launched;
  if(mode==='candidate'){
   await app.close();app=null;await until(()=>owned().length===0,30000,'baseline clean shutdown');
   start=Date.now();result.phase='installing';await persist();
   // The real NSIS handles its old registered uninstaller and /S compatibility.
   const observation=new AbortController();
   const install=setup(candidate,['/S','--updated','--force-run']);
   try{[launched]=await Promise.all([observeInstall(oldPid,observation.signal),install]);}
   finally{observation.abort();}
  }else{
   const event=app.waitForEvent('window',{predicate:window=>window!==page});await page.evaluate(()=>window.desktopUpdates.openAndCheck());const panel=await event;
   let state,lastCheck=Date.now();
   await until(async()=>{state=await page.evaluate(()=>window.desktopUpdates.status());if(state.phase==='available')return true;if(['current','error'].includes(state.phase)&&Date.now()-lastCheck>=30000){lastCheck=Date.now();await panel.evaluate(()=>window.mediaSailUpdate.call('check'));}return false;},300000,'published GitHub discovery');
   assert.equal(state.version,to);await panel.screenshot({path:path.join(evidence,'old-discovers-0.5.0.png'),animations:'disabled'});
   const download=Date.now();await panel.evaluate(()=>window.mediaSailUpdate.call('download'));
   await until(async()=>{state=await page.evaluate(()=>window.desktopUpdates.status());if(state.phase==='error')throw Error(state.message);return state.phase==='downloaded';},1200000,'genuine updater download and verification');
   result.downloadMs=Date.now()-download;result.updateSize=state.total;result.downloadTransferred=state.transferred;
   result.phase='installing';await persist();start=Date.now();
   await panel.evaluate(()=>{void window.mediaSailUpdate.call('install');});app=null;
   launched=await observeInstall(oldPid);
  }
  await verifyNew(launched,start);console.log('REAL LITE UPGRADE PASSED '+JSON.stringify(result));
 }catch(error){result.error=error.stack||String(error);await persist();throw error;
 }finally{
  inspector?.close();if(app)await Promise.race([app.close().catch(()=>{}),delay(10000)]);
  for(const item of owned().filter(item=>!item.CommandLine?.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(item.ProcessId),'/T','/F'],{windowsHide:true});
  for(const item of result.observation?.installers||[])if(item.ExecutablePath&&(inside(run,item.ExecutablePath)||inside(path.join(root,'release-input'),item.ExecutablePath)))cp.spawnSync('taskkill.exe',['/PID',String(item.ProcessId),'/T','/F'],{windowsHide:true});
  const uninstaller=path.join(target,'Uninstall MediaSail.exe');
  if(fss.existsSync(uninstaller))try{await setup(uninstaller,['/S','/KEEP_APP_DATA','_?='+target]);}catch(error){result.cleanupError=String(error);}
  result.cleanedUp=!fss.existsSync(exe);result.finishedAt=new Date().toISOString();await persist();
  if(!result.cleanedUp)process.exitCode=1;
 }
})().catch(error=>{console.error(error);process.exitCode=1;});

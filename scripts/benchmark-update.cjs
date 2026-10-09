// Real published 0.3.0 -> 0.3.1 update. No feed override, mocked installer, or new-version cache.
// Only run after publishing v0.3.1. All temporary replacements have a persistent recovery journal.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {_electron:electron}=require('playwright');
const {attachTestMain}=require('./test-main-inspector.cjs');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'../..'),out=path.join(workspace,'outputs/MediaSail');
const run=path.join(root,'.test-data/update-speed-v031'),target=path.join(workspace,'work/更新测速 临时 v031');
const data=path.join(process.env.LOCALAPPDATA,'ElectronEasel'),cache=path.join(process.env.LOCALAPPDATA,'mediasail-updater');
const journalFile=path.join(run,'recovery.json'),eventsFile=path.join(run,'events.jsonl'),resultFile=path.join(out,'MediaSail-0.3.1-update-benchmark.json');
const oldInstaller=path.join(out,'MediaSail-0.3.0-win-x64-Setup.exe'),exe=path.join(target,'MediaSail.exe');
const quote=s=>"'"+s.replace(/'/g,"''")+"'";
const powershell=command=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; $ErrorActionPreference='Stop'; "+command],{encoding:'utf8',windowsHide:true}).trim();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stamp=()=>new Date().toISOString();
let journal,app,inspector;
const result={from:'0.3.0',to:'0.3.1',startedAt:stamp(),feed:'https://github.com/jerryrenjianxing-sys/MediaSail/releases',temporaryInstallation:true};
function save(){fs.writeFileSync(journalFile,JSON.stringify(journal,null,2));}
function event(type,extra={}){fs.appendFileSync(eventsFile,JSON.stringify({type,at:Date.now(),...extra})+'\n');}
function phase(name){journal.phase=name;save();console.log(stamp()+' '+name);}
async function digest(file){const h=crypto.createHash('sha256');for await(const b of fs.createReadStream(file))h.update(b);return h.digest('hex');}
async function waitUntil(check,ms,label){const end=Date.now()+ms;while(Date.now()<end){const v=await check();if(v)return v;await sleep(500);}throw new Error('Timed out: '+label);}
function processes(){const value=JSON.parse(powershell("@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'MediaSail.exe' -or $_.Name -eq 'ElectronEasel.exe' } | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]');return Array.isArray(value)?value:[value];}
function ownedProcesses(){return processes().filter(p=>p.ExecutablePath?.toLowerCase()===exe.toLowerCase());}
function stopOwned(){for(const p of ownedProcesses().filter(p=>!p.CommandLine?.includes('--type='))){try{cp.execFileSync('taskkill.exe',['/PID',String(p.ProcessId),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}}}
async function setup(file){
  // NSIS _?= runs the uninstaller in place, so WaitForExit covers all cleanup.
  const args=path.basename(file).startsWith('Uninstall ')?['/S','/KEEP_APP_DATA','_?='+target]:['/S','/D='+target];
  await new Promise((resolve,reject)=>{const child=cp.spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',`$p=Start-Process -FilePath ${quote(file)} -ArgumentList @(${args.map(quote).join(',')}) -WindowStyle Hidden -PassThru; $p.WaitForExit(); exit $p.ExitCode`],{windowsHide:true,stdio:'inherit'});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Installer exit '+code)));});
}
async function prepare(){
  assert.equal(require('../package.json').version,'0.3.1');
  assert.ok(target.startsWith(workspace+path.sep));assert.ok(!fs.existsSync(target),'Test installation already exists');assert.ok(!fs.existsSync(journalFile),'Existing recovery journal: inspect/restore before repeating');
  assert.equal(processes().length,0,'Close existing MediaSail processes before the test');
  powershell(`. ${quote(path.join(__dirname,'assert-test-install.ps1'))}; Assert-TestInstallOwnership ${quote(target)}`);
  assert.equal(await digest(oldInstaller),'786d89d60038a8167d9fcee8eea71a4d0718dd328a6871433857a159466e79ba','Published baseline installer checksum');
  fs.mkdirSync(run,{recursive:true});fs.mkdirSync(out,{recursive:true});
  const links=JSON.parse(powershell("@([Environment]::GetFolderPath('DesktopDirectory'),[Environment]::GetFolderPath('Programs')) | ConvertTo-Json -Compress")).map(dir=>path.join(dir,'MediaSail.lnk'));
  journal={phase:'preparing',target,createdAt:stamp(),directories:[data,cache].map(original=>({original,backup:original+'.before-mediasail-speed-v031',existed:fs.existsSync(original),moved:false})),links:links.map((original,i)=>({original,backup:path.join(run,'shortcut-'+i+'.lnk'),existed:fs.existsSync(original)}))};save();
  for(const item of journal.directories){assert.ok(!fs.existsSync(item.backup),'Backup already exists');if(item.existed){fs.renameSync(item.original,item.backup);item.moved=true;save();}}
  for(const item of journal.links)if(item.existed)fs.copyFileSync(item.original,item.backup);
  phase('installing-published-0.3.0');await setup(oldInstaller);
  assert.equal(await digest(path.join(cache,'installer.exe')),await digest(oldInstaller));
  assert.ok(!fs.existsSync(path.join(cache,'pending')),'New release must not be cached');
}
async function launch(){
  const env={...process.env,PATH:`${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:exe,args:[],env,timeout:30000});
  return app;
}
async function readyPage(){const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();return page;}
async function observe(){
  await app.evaluate(({app},logfile)=>{
    const req=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json'),fs=req('node:fs');
    const updater=req('electron-updater').autoUpdater;
    const record=(type,extra={})=>fs.appendFileSync(logfile,JSON.stringify({type,at:Date.now(),...extra})+'\n');
    const executor=updater.httpExecutor,original=executor.createRequest,redirectKinds=new Map();let next=0;
    // Observe the existing response streams. No buffering, proxy, feed or transport change.
    executor.createRequest=function(options,callback){
      const request=original.call(this,options,callback),id=++next;
      const url=new URL((options.protocol||'https:')+'//'+(options.hostname||options.host)+(options.path||'/'));
      const kind=redirectKinds.get(url.href)||(url.pathname.endsWith('.blockmap')?'blockmap':url.pathname.endsWith('.exe')||options.headers?.Range?'installer':'metadata');
      record('http-start',{id,kind,url:url.origin+url.pathname});
      request.on('redirect',(_code,_method,destination)=>redirectKinds.set(destination,kind));
      request.on('response',response=>{
        let bytes=0;response.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);});
        const report=()=>record('http-bytes',{id,kind,bytes,status:response.statusCode});
        response.on('end',report);response.on('close',report);response.on('error',report);
      });
      request.on('error',error=>record('http-error',{id,kind,error:error.message}));return request;
    };
    for(const name of ['checking-for-update','update-available','update-not-available','download-progress','update-downloaded','error'])updater.on(name,value=>record(name,name==='error'?{error:value.message}:{value}));
  },eventsFile);
}
async function benchmark(){
  phase('launching-published-0.3.0');await launch();await observe();let page=await readyPage();
  assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.3.0');
  fs.mkdirSync(path.join(data,'workspace/outputs/升级测速'),{recursive:true});fs.writeFileSync(path.join(data,'workspace/outputs/升级测速/成品.txt'),'MediaSail 升级测速保留');
  fs.appendFileSync(path.join(data,'workspace/.env'),'\nMEDIASAIL_SPEED_FIXTURE=keep-v030\n');
  await page.evaluate(()=>localStorage.setItem('mediasail-speed-fixture','keep-v030'));
  await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'mediasail-speed-fixture',value:'keep-v030',expirationDate:Date.now()/1000+604800,secure:true});await s.cookies.flushStore();});
  const panelReady=app.waitForEvent('window',{predicate:p=>p!==page});await page.getByRole('button',{name:/软件更新|发现新版/}).click();const panel=await panelReady;await panel.locator('#headline').waitFor();
  async function checkRelease(){
    const existing=await page.evaluate(()=>window.desktopUpdates.status());
    if(existing.phase==='available')return existing;
    if(existing.phase!=='checking'){
      event('manual-check');await panel.locator('#check').click();
      // Wait for IPC dispatch so a previous terminal state cannot satisfy the poll.
      await panel.evaluate(()=>window.mediaSailUpdate.call('status'));
    }
    return waitUntil(async()=>{const s=await page.evaluate(()=>window.desktopUpdates.status());return ['available','error','current'].includes(s.phase)?s:false;},180000,'public release discovery');
  }
  phase('checking-real-github-release');const checkStart=Date.now();let state;
  for(let attempt=0;attempt<3;attempt++){state=await checkRelease();if(state.phase==='available')break;event('check-retry',{message:state.message});await sleep(3000);}
  assert.equal(state.phase,'available',state.message);
  assert.equal(state.version,'0.3.1');result.checkWaitFromOpeningPanelMs=Date.now()-checkStart;result.fullInstallerBytes=state.total;
  const checkEvents=fs.readFileSync(eventsFile,'utf8').trim().split('\n').map(line=>JSON.parse(line));
  const checkEvent=checkEvents.findLast(e=>e.type==='checking-for-update'),availableEvent=checkEvents.findLast(e=>e.type==='update-available');
  assert.ok(checkEvent&&availableEvent);result.checkMs=availableEvent.at-checkEvent.at;result.checkAttempts=checkEvents.filter(e=>e.type==='checking-for-update').length;
  result.checkMode=checkEvents.some(e=>e.type==='manual-check')?'manual':'automatic-on-startup';
  phase('downloading-real-github-update');const downloadStart=Date.now();
  let lastReport=0;
  for(let attempt=0;attempt<3;attempt++){
    result.downloadAttempts=attempt+1;event('manual-download');await panel.locator('#download').click();
    state=await waitUntil(async()=>{const s=await page.evaluate(()=>window.desktopUpdates.status());if(Date.now()-lastReport>30000){console.log(JSON.stringify({phase:s.phase,percent:s.percent,transferred:s.transferred,total:s.total}));lastReport=Date.now();}return ['downloaded','error'].includes(s.phase)?s:false;},3600000,'download and verification');
    if(state.phase==='downloaded')break;
    event('download-retry',{message:state.message});await sleep(3000);state=await checkRelease();assert.equal(state.phase,'available',state.message);
  }
  assert.equal(state.phase,'downloaded',state.message);
  result.downloadAndVerifyMs=Date.now()-downloadStart;event('verified-download');
  await panel.screenshot({path:path.join(out,'MediaSail-0.3.1-真实下载完成.png')});
  phase('installing-and-auto-relaunching');event('manual-install');const installStart=Date.now();
  await panel.locator('#install').click().catch(error=>{if(!/closed|destroyed/i.test(error.message))throw error;});
  await waitUntil(()=>ownedProcesses().length===0,60000,'old application exit');app=null;
  const newProcess=await waitUntil(()=>ownedProcesses().find(p=>!p.CommandLine?.includes('--type=')&&p.CommandLine?.includes('--updated')),1800000,'installer automatic relaunch');
  result.installToRelaunchMs=Date.now()-installStart;result.autoRelaunchPid=newProcess.ProcessId;event('automatic-relaunch',{pid:newProcess.ProcessId});
  inspector=await attachTestMain(newProcess.ProcessId);
  await waitUntil(()=>inspector.evaluate("Boolean(process.mainModule?.require && process.mainModule.require('electron').app.isReady())"),30000,'test app main context');
  const identity=await inspector.evaluate(`(()=>{const {app}=process.mainModule.require('electron');const fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');const data=app.getPath('userData');return {version:app.getVersion(),data,fixture:fs.existsSync(path.join(data,'workspace/outputs/升级测速/成品.txt'))};})()`);
  result.relaunchIdentity=identity;console.log('AUTOMATIC RELAUNCH '+JSON.stringify(identity));assert.equal(identity.version,'0.3.1');assert.equal(path.resolve(identity.data).toLowerCase(),data.toLowerCase());assert.equal(identity.fixture,true,'Automatic relaunch must use the seeded profile');
  await waitUntil(async()=>inspector.evaluate(`(async()=>{const {BrowserWindow}=process.mainModule.require('electron');const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));if(!w)return false;return w.webContents.executeJavaScript(${JSON.stringify("fetch('/api/status').then(r=>r.json()).then(s=>s.gateway===true&&!!document.querySelector('.settings-gear')).catch(()=>false)")});})()`),240000,'automatically relaunched app ready');
  result.installToReadyMs=Date.now()-installStart;result.relaunchToReadyMs=result.installToReadyMs-result.installToRelaunchMs;event('automatic-app-ready');
  const requests=new Map();for(const line of fs.readFileSync(eventsFile,'utf8').trim().split('\n')){const e=JSON.parse(line);if(e.type==='http-bytes'){const old=requests.get(e.id);if(!old||e.bytes>old.bytes)requests.set(e.id,e);}}
  result.transferredBodyBytes={installer:0,blockmap:0,metadata:0};for(const r of requests.values())result.transferredBodyBytes[r.kind]+=r.bytes;
  result.networkRequestCount=requests.size;result.downloadPhaseBytesPerSecond=result.transferredBodyBytes.installer/(result.downloadAndVerifyMs/1000);
  const updaterLog=fs.readFileSync(path.join(data,'logs/updates.log'),'utf8');
  result.differentialUsed=updaterLog.includes('Differential download:');result.fullDownloadFallback=updaterLog.includes('fallback to full download');
  result.method='HTTP response body bytes from the unchanged updater transport, including retries. Excludes HTTP/TLS overhead. Download phase includes local reconstruction and checksum validation. Install timing ends at actual automatic process launch; readiness is recorded separately.';
  result.network={proxyConfigured:Boolean(process.env.HTTPS_PROXY||process.env.HTTP_PROXY||process.env.ALL_PROXY),platform:process.platform,arch:process.arch};
  phase('verifying-installed-0.3.1');
  result.automaticProfileRetention=await inspector.evaluate(`(async()=>{const {app,BrowserWindow,session}=process.mainModule.require('electron');const fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path'),data=app.getPath('userData');const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));return {content:fs.readFileSync(path.join(data,'workspace/outputs/升级测速/成品.txt'),'utf8')==='MediaSail 升级测速保留',config:fs.readFileSync(path.join(data,'workspace/.env'),'utf8').includes('MEDIASAIL_SPEED_FIXTURE=keep-v030'),localStorage:await w.webContents.executeJavaScript("localStorage.getItem('mediasail-speed-fixture')==='keep-v030'"),cookie:(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'mediasail-speed-fixture'}))[0]?.value==='keep-v030'};})()`);
  assert.ok(Object.values(result.automaticProfileRetention).every(Boolean));
  await inspector.evaluate("setTimeout(()=>process.mainModule.require('electron').app.quit(),100);true");inspector.close();inspector=null;
  await waitUntil(()=>ownedProcesses().length===0,30000,'test process exit');await sleep(2000);
  await launch();page=await readyPage();assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.3.1');
  assert.equal(fs.readFileSync(path.join(data,'workspace/outputs/升级测速/成品.txt'),'utf8'),'MediaSail 升级测速保留');
  assert.match(fs.readFileSync(path.join(data,'workspace/.env'),'utf8'),/MEDIASAIL_SPEED_FIXTURE=keep-v030/);
  assert.equal(await page.evaluate(()=>localStorage.getItem('mediasail-speed-fixture')),'keep-v030');
  assert.equal(await app.evaluate(async({session})=>(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'mediasail-speed-fixture'}))[0]?.value),'keep-v030');
  await page.locator('.settings-gear').click();const settings=page.getByRole('dialog',{name:'设置',exact:true});await settings.getByRole('button',{name:'软件更新',exact:true}).click();
  assert.equal(await settings.getByTestId('update-current-version').innerText(),'0.3.1');
  const panelPromise=app.waitForEvent('window',{predicate:p=>p!==page});await settings.getByRole('button',{name:'检查更新',exact:true}).click();const latest=await panelPromise;
  await latest.getByRole('heading',{name:'已是最新版本'}).waitFor({timeout:180000});
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())if(w.webContents.getURL().endsWith('/updates.html'))w.hide();});
  await page.screenshot({path:path.join(out,'MediaSail-0.3.1-设置更新.png')});
  result.dataRetention={config:true,content:true,localStorage:true,nonAuthSessionCookie:true};result.installedSettingsCheck=true;
  await app.close();app=null;result.finishedAt=stamp();fs.writeFileSync(resultFile,JSON.stringify(result,null,2));
}
async function restore(){
  if(!journal)return;
  phase('restoring-pre-test-state');
  inspector?.close();inspector=null;
  if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close().catch(()=>{});app=null;}stopOwned();await sleep(2000);
  const uninstaller=path.join(target,'Uninstall MediaSail.exe');
  powershell(`. ${quote(path.join(__dirname,'assert-test-install.ps1'))}; Assert-TestInstallOwnership ${quote(target)}`);
  if(fs.existsSync(uninstaller))await setup(uninstaller);
  await waitUntil(()=>!fs.existsSync(exe),90000,'test uninstall');
  assert.ok(path.resolve(target).startsWith(workspace+path.sep));
  if(fs.existsSync(target))fs.rmSync(target,{recursive:true,force:true});
  for(const item of journal.directories){
    if(item.existed&&!item.moved)continue;
    if(item.moved)assert.ok(fs.existsSync(item.backup),'Original backup missing; preserve test state for recovery');
    const retained=path.join(run,path.basename(item.original)+'-after-test');
    if(fs.existsSync(item.original)){assert.ok(!fs.existsSync(retained));fs.renameSync(item.original,retained);}
    if(item.moved){fs.renameSync(item.backup,item.original);item.moved=false;item.restored=true;save();}
  }
  for(const item of journal.links){if(item.existed){assert.ok(fs.existsSync(item.backup));fs.copyFileSync(item.backup,item.original);}else if(fs.existsSync(item.original)){
    const destination=powershell(`$s=New-Object -ComObject WScript.Shell; $s.CreateShortcut(${quote(item.original)}).TargetPath`);
    assert.equal(destination.toLowerCase(),exe.toLowerCase(),'Refuse to remove an unrelated shortcut');fs.unlinkSync(item.original);
  }}
  powershell(`. ${quote(path.join(__dirname,'assert-test-install.ps1'))}; Assert-TestInstallOwnership ${quote(path.join(run,'no-installed-app'))}`);
  assert.equal(ownedProcesses().length,0);phase('restored');result.cleanupRestored=true;fs.writeFileSync(resultFile,JSON.stringify(result,null,2));
}
(async()=>{
  const prepareOnly=process.argv.includes('--prepare-only'),resume=process.argv.includes('--resume'),restoreOnly=process.argv.includes('--restore');
  let prepared=false;
  try{
    if(resume||restoreOnly){
      const saved=JSON.parse(fs.readFileSync(journalFile,'utf8'));assert.equal(saved.target,target);assert.equal(saved.directories.length,2);
      for(const [index,item] of saved.directories.entries()){assert.equal(item.original,[data,cache][index]);assert.equal(item.backup,item.original+'.before-mediasail-speed-v031');}
      assert.notEqual(saved.phase,'restored','Test already restored');journal=saved;
      if(resume)assert.equal(journal.phase,'baseline-ready','Only resume a prepared baseline');
    }else await prepare();
    if(prepareOnly){phase('baseline-ready');prepared=true;return;}
    if(!restoreOnly)await benchmark();
  }
  catch(error){result.error=error.stack;console.error(error);process.exitCode=1;}
  finally{if(!prepared){
    if(result.error&&process.argv.includes('--retain-on-failure')){inspector?.close();inspector=null;result.cleanupRestored=false;console.error('Diagnostic run retained. Complete recovery with --restore: '+journalFile);}
    else try{await restore();}catch(error){result.cleanupError=error.stack;console.error('RECOVERY REQUIRED: '+journalFile+'\n'+error.stack);process.exitCode=1;}
    fs.mkdirSync(out,{recursive:true});fs.writeFileSync(resultFile,JSON.stringify(result,null,2));
  }}
})().catch(error=>{console.error(error);process.exitCode=1;});

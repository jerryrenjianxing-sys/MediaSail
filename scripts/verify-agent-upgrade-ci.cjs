// Real NSIS upgrade on an ephemeral GitHub-hosted Windows runner only.
const fs=require('node:fs/promises'),fss=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {_electron:electron}=require('playwright'),{attachTestMain}=require('./test-main-inspector.cjs');
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');assert.equal(process.platform,'win32');
const root=path.resolve(__dirname,'..'),run=path.join(process.env.RUNNER_TEMP,'mediasail-agent-upgrade'),target=path.join(run,'用户 自选目录'),exe=path.join(target,'MediaSail.exe');
const artifacts=path.join(root,'installer-evidence'),data=path.join(process.env.LOCALAPPDATA,'ElectronEasel');
const baseline=path.join(root,'release-input/MediaSail-0.3.3-win-x64-Setup.exe');
const result={from:'0.3.3',to:'0.4.1',startedAt:new Date().toISOString(),environment:'ephemeral GitHub-hosted Windows',transport:'unchanged electron-updater GitHub feed'};
const ps=(script,args=[])=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive',...args,'-Command',"[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding; "+script],{encoding:'utf8',windowsHide:true}).trim();
const processes=()=>{const p=JSON.parse(ps("@(Get-CimInstance Win32_Process -Filter \"Name='MediaSail.exe'\" | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]');return Array.isArray(p)?p:[p];};
const owned=()=>processes().filter(p=>p.ExecutablePath?.toLowerCase()===exe.toLowerCase());
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms,label){const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await delay(1000);}throw Error('Timed out: '+label);}
// NSIS requires its trailing /D= and _?= paths verbatim, including spaces.
async function setup(file,args){await new Promise((r,j)=>{const p=cp.spawn(file,args,{windowsHide:true,windowsVerbatimArguments:true,stdio:'ignore'});const timer=setTimeout(()=>{cp.spawnSync('taskkill.exe',['/PID',String(p.pid),'/T','/F'],{windowsHide:true});j(Error('Installer timed out: '+path.basename(file)));},1800000);p.on('error',e=>{clearTimeout(timer);j(e);});p.on('exit',code=>{clearTimeout(timer);code===0?r():j(Error('Installer exit '+code));});});}
async function persist(){
 await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(result,null,2));
 for(const name of ['updates.log','desktop.log','installer-0.4.1.ini','installer-0.4.1-copy.log'])await fs.copyFile(path.join(data,'logs',name),path.join(artifacts,name)).catch(()=>{});
}
let app,inspector;
(async()=>{
 await fs.mkdir(artifacts,{recursive:true});assert.equal(processes().length,0);assert.equal(fss.existsSync(data),false,'Runner must start without user data');
 const free=Number(ps("(Get-PSDrive -Name C).Free"));assert.ok(free>28*1024**3,'Need 28 GiB free for actual runtime extraction');
 console.log('Installing genuine 0.3.3 baseline into a custom folder');await setup(baseline,['/S','/D='+target]);assert.ok(fss.existsSync(exe));result.baselineInstalledAt=new Date().toISOString();console.log('Baseline installed');await persist();
 try{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EASEL_DESKTOP_DATA;
  app=await electron.launch({executablePath:exe,args:[],env,timeout:30000});const page=await app.firstWindow();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});await page.locator('.sidebar-status').filter({hasText:'网关已连接'}).waitFor({timeout:240000});
  assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.3.3');
  const chats=[{id:'upgrade-proof',title:'升级保留对话',created:1,messages:[{role:'user',content:'升级前的中文聊天'}]}];
  await page.evaluate(async chats=>{
   for(const [key,value] of Object.entries({easel_sessions:JSON.stringify(chats),easel_active_session:'upgrade-proof',easel_theme:'dark',easel_onboarding_seen:'1'}))await window.desktopUiState.call('set',{key,value});
   await window.desktopUiState.call('flush');
  },chats);
  await fs.mkdir(path.join(data,'workspace/outputs/验收'),{recursive:true});await fs.writeFile(path.join(data,'workspace/outputs/验收/成品.txt'),'升级成品保留');
  await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'installer-fixture',value:'keep',secure:true,expirationDate:Date.now()/1000+86400});await s.cookies.flushStore();});

  // Seed a custom persona, then reload so final renderer flush retains the seeded chats.
  await fs.mkdir(path.join(data,'workspace/profiles/验收'),{recursive:true});await fs.writeFile(path.join(data,'workspace/profiles/验收/identity.md'),'自定义画像保留');
  await page.reload();await page.locator('.settings-gear').waitFor();
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  const panelEvent=app.waitForEvent('window',{predicate:p=>p!==page});await page.evaluate(()=>window.desktopUpdates.openAndCheck());const panel=await panelEvent;await panel.locator('#headline').waitFor();
  let state,lastCheck=Date.now();
  // Preparing the clean baseline may start while the new release is still a draft.
  // Recheck through the unchanged public updater, at most once every 30 seconds.
  await until(async()=>{
   state=await page.evaluate(()=>window.desktopUpdates.status());
   if(state.phase==='available')return true;
   if(['current','error'].includes(state.phase)&&Date.now()-lastCheck>=30000){
    lastCheck=Date.now();console.log('Waiting for published 0.4.1; rechecking the public GitHub feed');
    await panel.evaluate(()=>window.mediaSailUpdate.call('check'));
   }
   return false;
  },2700000,'real GitHub discovery');
  assert.equal(state.version,'0.4.1');await panel.screenshot({path:path.join(artifacts,'old-discovers-0.4.1.png'),animations:'disabled'});
  console.log('Old client discovered 0.4.1; downloading through unchanged GitHub updater');
  const downloadAt=Date.now();await panel.evaluate(()=>window.mediaSailUpdate.call('download'));
  await until(async()=>{state=await page.evaluate(()=>window.desktopUpdates.status());if(state.phase==='error')throw Error(state.message);return state.phase==='downloaded';},1200000,'verified download');
  result.downloadMs=Date.now()-downloadAt;result.updateSize=state.total;
  console.log('Verified download complete; starting actual upgrade');result.phase='installing';await persist();
  const oldPid=app.process().pid,start=Date.now();
  // Do not keep a Playwright evaluation waiting for a renderer that is closing.
  await panel.evaluate(()=>{void window.mediaSailUpdate.call('install');});
  app=null;let lastSample=0;
  const launched=await until(async()=>{
   const current=owned();
   if(Date.now()-lastSample>30000){
    lastSample=Date.now();
    const installers=JSON.parse(ps("@(Get-CimInstance Win32_Process | Where-Object { $_.Name -like '*MediaSail*Setup*' -or $_.Name -eq 'installer.exe' } | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]');
    result.observation={at:new Date().toISOString(),apps:current,installers:Array.isArray(installers)?installers:[installers],windows:[]};
    for(const p of result.observation.installers){
     const observed=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'observe-installer.ps1'),'-InstallerPid',String(p.ProcessId),'-Screenshot',path.join(artifacts,'installer-progress.png')],{encoding:'utf8',windowsHide:true,timeout:20000});
     result.observation.windows.push(...JSON.parse(observed||'[]'));
    }
    result.observation.disks=JSON.parse(ps("@(Get-PSDrive -PSProvider FileSystem | Select-Object Name,Free) | ConvertTo-Json -Compress")||'[]');
    result.observation.stage=await fs.readFile(path.join(data,'logs/installer-0.4.1.ini'),'utf8').catch(()=>'not-started');
    const texts=result.observation.windows.flatMap(w=>w.children.map(c=>c.text)).filter(Boolean);
    console.log('Install observation '+JSON.stringify({at:result.observation.at,stage:result.observation.stage,apps:current.length,progress:result.observation.windows.flatMap(w=>w.children.filter(c=>c.position!==null).map(c=>c.position)),disks:result.observation.disks}));await persist();
    if(texts.some(t=>t.includes('cannot be closed')||t.includes('文件复制失败')||t.includes('安装文件不完整')))throw Error('Installer stopped for user action: '+texts.join(' | '));
   }
   return current.find(p=>p.ProcessId!==oldPid&&!p.CommandLine.includes('--type=')&&p.CommandLine.includes('--updated'));
  },1800000,'NSIS install and automatic restart');
  result.installToRelaunchMs=Date.now()-start;app=null;
  inspector=await attachTestMain(launched.ProcessId);
  await until(()=>inspector.evaluate("Boolean(process.mainModule?.require && process.mainModule.require('electron').app.isReady())"),30000,'main context');
  await until(()=>inspector.evaluate(`(async()=>{const {BrowserWindow}=process.mainModule.require('electron');const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));return w?await w.webContents.executeJavaScript("fetch('/api/status').then(r=>r.json()).then(s=>s.gateway===true&&!!document.querySelector('.settings-gear')).catch(()=>false)"):false;})()`),240000,'real local gateway ready');
  result.installToReadyMs=Date.now()-start;
  result.retention=await inspector.evaluate(`(async()=>{const {app,session}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');const data=app.getPath('userData'),state=JSON.parse(fs.readFileSync(path.join(data,'ui-state.json'),'utf8'));return {version:app.getVersion(),exe:app.getPath('exe'),theme:state.values.easel_theme,chat:JSON.parse(state.values.easel_sessions).some(s=>s.id==='upgrade-proof'&&s.messages[0]?.content==='升级前的中文聊天'),content:fs.readFileSync(path.join(data,'workspace/outputs/验收/成品.txt'),'utf8'),cookie:(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'installer-fixture'}))[0]?.value};})()`);
  assert.equal(result.retention.version,'0.4.1');assert.equal(result.retention.exe.toLowerCase(),exe.toLowerCase());assert.equal(result.retention.chat,true);assert.equal(result.retention.theme,'dark');assert.equal(result.retention.cookie,'keep');assert.equal(result.retention.content,'升级成品保留');

  assert.equal(await fs.readFile(path.join(data,'workspace/profiles/验收/identity.md'),'utf8'),'自定义画像保留');
  const connection=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(connection.version,'0.4.1');
  const mainExpr="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'))";
  await inspector.evaluate(mainExpr+".webContents.executeJavaScript(\"[...document.querySelectorAll('.sidebar-nav button')].find(b=>b.textContent.includes('连接 Agent')).click()\")");
  await delay(500);
  await inspector.evaluate("(async()=>{const image=await "+mainExpr+".webContents.capturePage();process.mainModule.require('node:fs').writeFileSync("+JSON.stringify(path.join(artifacts,'upgraded-agent-page.png'))+",image.toPNG());})()");
  await inspector.evaluate(mainExpr+".webContents.executeJavaScript('window.desktopUpdates.openAndCheck()')");
  await until(()=>inspector.evaluate(mainExpr+".webContents.executeJavaScript(\"window.desktopUpdates.status().then(s=>s.phase==='current')\")"),180000,'new version is current');
  result.passed=true;result.phase='verified';await persist();console.log('REAL INSTALLATION PASSED '+JSON.stringify(result));
 }catch(error){result.error=error.stack||String(error);console.error(result.error);await persist();throw error;
 }finally{
  inspector?.close();if(app)await Promise.race([app.close().catch(()=>{}),delay(10000)]);
  await persist();console.log('Cleaning disposable installation');
  for(const p of result.observation?.installers||[])cp.spawnSync('taskkill.exe',['/PID',String(p.ProcessId),'/T','/F'],{windowsHide:true});
  for(const p of owned().filter(p=>!p.CommandLine.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(p.ProcessId),'/T','/F'],{windowsHide:true});
  const uninstaller=path.join(target,'Uninstall MediaSail.exe');if(fss.existsSync(uninstaller))await setup(uninstaller,['/S','/KEEP_APP_DATA','_?='+target]);
  result.cleanedUp=!fss.existsSync(exe);await persist();console.log('Cleanup complete: '+result.cleanedUp);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

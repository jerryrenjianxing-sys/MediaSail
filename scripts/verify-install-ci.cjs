// Real NSIS upgrade on an ephemeral GitHub-hosted Windows runner only.
const fs=require('node:fs/promises'),fss=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {_electron:electron}=require('playwright'),{attachTestMain}=require('./test-main-inspector.cjs');
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted');assert.equal(process.platform,'win32');
const root=path.resolve(__dirname,'..'),run=path.join(process.env.RUNNER_TEMP,'mediasail-installer-test'),target=path.join(run,'用户 自选目录'),exe=path.join(target,'MediaSail.exe');
const artifacts=path.join(root,'installer-evidence'),data=path.join(process.env.LOCALAPPDATA,'ElectronEasel');
const installer=path.join(root,'release-input/MediaSail-0.3.3-win-x64-Setup.exe'),baseline=path.join(root,'release-input/MediaSail-0.3.2-win-x64-Setup.exe');
const result={from:'0.3.2',to:'0.3.3',startedAt:new Date().toISOString(),environment:'ephemeral GitHub-hosted Windows',installerArgs:['--updated','/S','--force-run']};
const ps=(script,args=[])=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive',...args,'-Command',"[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding; "+script],{encoding:'utf8',windowsHide:true}).trim();
const processes=()=>{const p=JSON.parse(ps("@(Get-CimInstance Win32_Process -Filter \"Name='MediaSail.exe'\" | Select-Object ProcessId,ExecutablePath,CommandLine) | ConvertTo-Json -Compress")||'[]');return Array.isArray(p)?p:[p];};
const owned=()=>processes().filter(p=>p.ExecutablePath?.toLowerCase()===exe.toLowerCase());
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms,label){const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await delay(1000);}throw Error('Timed out: '+label);}
// NSIS requires its trailing /D= and _?= paths verbatim, including spaces.
async function setup(file,args){await new Promise((r,j)=>{const p=cp.spawn(file,args,{windowsHide:true,windowsVerbatimArguments:true,stdio:'ignore'});p.on('error',j);p.on('exit',code=>code===0?r():j(Error('Installer exit '+code)));});}
let app,inspector,installerProcess;
(async()=>{
 await fs.mkdir(artifacts,{recursive:true});assert.equal(processes().length,0);assert.equal(fss.existsSync(data),false,'Runner must start without user data');
 const free=Number(ps("(Get-PSDrive -Name C).Free"));assert.ok(free>28*1024**3,'Need 28 GiB free for actual runtime extraction');
 console.log('Installing genuine 0.3.2 baseline into a custom folder');await setup(baseline,['/S','/D='+target]);assert.ok(fss.existsSync(exe));
 try{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.EASEL_DESKTOP_DATA;
  app=await electron.launch({executablePath:exe,args:[],env,timeout:30000});const page=await app.firstWindow();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});await page.locator('.sidebar-status').filter({hasText:'网关已连接'}).waitFor({timeout:240000});
  assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.3.2');
  const chats=[{id:'upgrade-proof',title:'升级保留对话',created:1,messages:[{role:'user',content:'升级前的中文聊天'}]}];
  await page.evaluate(chats=>{localStorage.setItem('easel_sessions',JSON.stringify(chats));localStorage.setItem('easel_active_session','upgrade-proof');localStorage.setItem('easel_theme','dark');localStorage.setItem('easel_chat_reset_20260902','1');localStorage.setItem('easel_onboarding_seen','1');},chats);
  await fs.mkdir(path.join(data,'workspace/outputs/验收'),{recursive:true});await fs.writeFile(path.join(data,'workspace/outputs/验收/成品.txt'),'升级成品保留');
  await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'installer-fixture',value:'keep',secure:true,expirationDate:Date.now()/1000+86400});await s.cookies.flushStore();});
  await app.close();app=null;
  console.log('Starting final 0.3.3 installer with unchanged old-client arguments');const start=Date.now();
  // Visible window requested by the user. No GUI actions are automated here.
  installerProcess=cp.spawn(installer,result.installerArgs,{windowsHide:false,stdio:'ignore'});
  let exitCode;installerProcess.on('exit',code=>{exitCode=code;});
  let lastLog=0;const samples=[];
  const launched=await until(async()=>{
   if(exitCode!==undefined&&exitCode!==0)throw Error('Upgrade installer failed: '+exitCode);
   const windows=JSON.parse(cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-File',path.join(__dirname,'observe-installer.ps1'),'-InstallerPid',String(installerProcess.pid),'-Screenshot',path.join(artifacts,'installer-progress.png')],{encoding:'utf8',windowsHide:true})||'[]');
   if(windows.length)samples.push({at:Date.now(),windows});
   if(Date.now()-lastLog>30000){console.log('Installer running; visible samples: '+samples.length);lastLog=Date.now();await fs.writeFile(path.join(artifacts,'installer-windows.json'),JSON.stringify(samples,null,2));}
   return owned().find(p=>!p.CommandLine.includes('--type=')&&p.CommandLine.includes('--updated'));
  },1800000,'visible install and automatic relaunch');
  result.installToRelaunchMs=Date.now()-start;result.visibleSamples=samples.length;assert.ok(samples.some(s=>s.windows.some(w=>w.children.some(c=>c.class==='msctls_progress32')&&w.children.some(c=>c.text.startsWith('正在安装 MediaSail')))),'Real install page and progress control must be visible');
  assert.ok(fss.existsSync(path.join(artifacts,'installer-progress.png')),'Actual installation screenshot required');
  await fs.writeFile(path.join(artifacts,'installer-windows.json'),JSON.stringify(samples,null,2));
  inspector=await attachTestMain(launched.ProcessId);
  await until(()=>inspector.evaluate("Boolean(process.mainModule?.require && process.mainModule.require('electron').app.isReady())"),30000,'main context');
  await until(()=>inspector.evaluate(`(async()=>{const {BrowserWindow}=process.mainModule.require('electron');const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));return w?await w.webContents.executeJavaScript("fetch('/api/status').then(r=>r.json()).then(s=>s.gateway===true&&!!document.querySelector('.settings-gear')).catch(()=>false)"):false;})()`),240000,'real local gateway ready');
  result.installToReadyMs=Date.now()-start;
  result.retention=await inspector.evaluate(`(async()=>{const {app,session}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path');const data=app.getPath('userData'),state=JSON.parse(fs.readFileSync(path.join(data,'ui-state.json'),'utf8'));return {version:app.getVersion(),exe:app.getPath('exe'),theme:state.values.easel_theme,chat:JSON.parse(state.values.easel_sessions).some(s=>s.id==='upgrade-proof'&&s.messages[0]?.content==='升级前的中文聊天'),content:fs.readFileSync(path.join(data,'workspace/outputs/验收/成品.txt'),'utf8'),cookie:(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'installer-fixture'}))[0]?.value};})()`);
  assert.equal(result.retention.version,'0.3.3');assert.equal(result.retention.exe.toLowerCase(),exe.toLowerCase());assert.equal(result.retention.chat,true);assert.equal(result.retention.theme,'dark');assert.equal(result.retention.cookie,'keep');assert.equal(result.retention.content,'升级成品保留');
  result.passed=true;console.log('REAL INSTALLATION PASSED '+JSON.stringify(result));
 }finally{
  inspector?.close();if(app)await app.close().catch(()=>{});
  for(const p of owned().filter(p=>!p.CommandLine.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(p.ProcessId),'/T','/F'],{windowsHide:true});
  if(installerProcess?.exitCode===null)await until(()=>installerProcess.exitCode!==null,120000,'installer cleanup');
  const uninstaller=path.join(target,'Uninstall MediaSail.exe');if(fss.existsSync(uninstaller))await setup(uninstaller,['/S','/KEEP_APP_DATA','_?='+target]);
  result.cleanedUp=!fss.existsSync(exe);await fs.writeFile(path.join(artifacts,'result.json'),JSON.stringify(result,null,2));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

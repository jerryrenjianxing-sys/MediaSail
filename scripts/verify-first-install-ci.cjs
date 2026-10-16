// Actual visible first-install acceptance, never an installer for a user's PC.
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),fss=require('node:fs'),cp=require('node:child_process'),crypto=require('node:crypto');
const version='0.5.2',identity='f524de6d-ce52-54ca-a07e-a51e0d556196';
const inside=(parent,file)=>{const relative=path.relative(parent,file);return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);};
function assertHostedFixture({env=process.env,platform=process.platform,root=path.resolve(__dirname,'..')}={}){
 assert.equal(platform,'win32','Ephemeral GitHub-hosted Windows only; never run on a user PC');
 assert.equal(env.GITHUB_ACTIONS,'true','Ephemeral GitHub-hosted Windows only; never run on a user PC');
 assert.equal(env.RUNNER_ENVIRONMENT,'github-hosted','Ephemeral GitHub-hosted Windows only; never run on a user PC');
 assert.equal(env.RUNNER_OS,'Windows');assert.match(env.GITHUB_RUN_ID||'',/^\d+$/);
 for(const key of ['RUNNER_TEMP','GITHUB_WORKSPACE','LOCALAPPDATA'])assert.ok(env[key]&&path.isAbsolute(env[key]),'Absolute '+key+' required');
 assert.equal(root.toLowerCase(),path.resolve(env.GITHUB_WORKSPACE).toLowerCase(),'Checkout identity mismatch');
 const run=path.join(env.RUNNER_TEMP,'mediasail-first-install-'+env.GITHUB_RUN_ID);
 assert.ok(inside(path.resolve(env.RUNNER_TEMP),run),'Fixture must be a dedicated runner-temp child');
 assert.ok(!inside(env.LOCALAPPDATA,run),'Fixture library must be outside AppData');
 return {root,run,target:path.join(run,'中文 程序','MediaSail'),libraryRoot:path.join(run,'中文 资料库'),bootstrap:path.join(env.LOCALAPPDATA,'ElectronEasel'),evidence:path.join(root,'installer-evidence','first-install'),installer:path.join(root,'release-input','candidate',`MediaSail-${version}-win-x64-Setup.exe`)};
}
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const list=value=>Array.isArray(value)?value:value?[value]:[];
async function sha256(file){const hash=crypto.createHash('sha256');for await(const chunk of fss.createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function verifyInstaller(file,env=process.env){
 assert.match(env.MEDIASAIL_INSTALLER_SHA256||'',/^[a-f0-9]{64}$/,'GitHub asset digest required');
 assert.match(env.MEDIASAIL_INSTALLER_BYTES||'',/^\d+$/,'GitHub asset byte count required');
 assert.match(env.MEDIASAIL_INSTALLER_ASSET_ID||'',/^RA_[A-Za-z0-9_-]+$/,'GitHub asset identity required');
 const name=path.basename(file),lines=(await fs.readFile(path.join(path.dirname(file),'SHA256SUMS.txt'),'utf8')).split(/\r?\n/).filter(line=>line.trim().split(/\s+/).at(-1)?.replace(/^\*/,'')===name);
 assert.equal(lines.length,1,'Unambiguous checksum required');assert.equal(lines[0].trim().split(/\s+/)[0].toLowerCase(),env.MEDIASAIL_INSTALLER_SHA256);
 const actual=await sha256(file);assert.equal(actual,env.MEDIASAIL_INSTALLER_SHA256);assert.equal((await fs.stat(file)).size,Number(env.MEDIASAIL_INSTALLER_BYTES));
 return {version,name,sha256:actual,bytes:(await fs.stat(file)).size,assetId:env.MEDIASAIL_INSTALLER_ASSET_ID};
}
async function until(fn,timeout,label){const end=Date.now()+timeout;while(Date.now()<end){const value=await fn();if(value)return value;await delay(500);}throw Error('Timed out: '+label);}
function appEnvironment(){const env={};for(const key of ['SystemRoot','SYSTEMROOT','WINDIR','ComSpec','COMSPEC','SystemDrive','PATHEXT','PATH','PROCESSOR_ARCHITECTURE','NUMBER_OF_PROCESSORS','USERNAME','OS','USERPROFILE','HOME','HOMEDRIVE','HOMEPATH','APPDATA','LOCALAPPDATA','TEMP','TMP','PROGRAMFILES','PROGRAMFILES(X86)','ProgramFiles','ProgramFiles(x86)'])if(process.env[key])env[key]=process.env[key];env.PYTHONUTF8='1';env.PYTHONIOENCODING='utf-8';return env;}
async function main(){
 const scope=assertHostedFixture(),{root,run,target,libraryRoot,bootstrap,evidence,installer}=scope,exe=path.join(target,'MediaSail.exe');
 const {attachTestMain}=require('./test-main-inspector.cjs');
 const ps=script=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); '+script],{encoding:'utf8',windowsHide:true,timeout:30000}).trim();
 const processes=()=>list(JSON.parse(ps("ConvertTo-Json -InputObject @(Get-CimInstance Win32_Process -Filter \"Name='MediaSail.exe'\" | Select-Object ProcessId,ExecutablePath,CommandLine) -Compress")||'[]'));
 const owned=()=>processes().filter(row=>row.ExecutablePath?.toLowerCase()===exe.toLowerCase());
 const result={version,startedAt:new Date().toISOString(),environment:'fresh ephemeral GitHub-hosted Windows',method:'actual visible NSIS first-install wizard; paths entered into real Edit controls; no installer path arguments or registry pre-seeding',passed:false};
 let inspector,installerChild,driverChild;
 const persist=async()=>{await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'result.json'),JSON.stringify(result,null,2));for(const [base,prefix]of [[bootstrap,'bootstrap'],[path.join(libraryRoot,'runtime'),'runtime']])for(const name of ['desktop.log','desktop-backend.log',`installer-${version}.ini`,`installer-${version}-copy.log`])await fs.copyFile(path.join(base,'logs',name),path.join(evidence,prefix+'-'+name)).catch(()=>{});};
 const registryPaths=[['Software',identity],['Software','Microsoft','Windows','CurrentVersion','Uninstall',identity]].map(parts=>parts.join(path.win32.sep));
 const registration=()=>JSON.parse(ps(`$rows=@();foreach($hive in @('CurrentUser','LocalMachine')){foreach($view in @('Registry64','Registry32')){$base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::$hive,[Microsoft.Win32.RegistryView]::$view);try{foreach($name in @(${registryPaths.map(quote).join(',')})){$key=$base.OpenSubKey($name);if($key){try{$rows+=@{hive=$hive;view=$view;key=$name;location=$key.GetValue('InstallLocation');version=$key.GetValue('DisplayVersion')}}finally{$key.Dispose()}}}}finally{$base.Dispose()}}};ConvertTo-Json -InputObject @($rows) -Compress`)||'[]');
 const readyConnection=()=>until(async()=>{try{const value=JSON.parse(await fs.readFile(path.join(bootstrap,'agent-connection.json'),'utf8'));if(value.status!=='ready'||value.version!==version||value.executable?.toLowerCase()!==exe.toLowerCase())return false;const process=owned().find(row=>row.ProcessId===value.pid&&!row.CommandLine?.includes('--type='));if(!process)return false;const live=await(await fetch(value.baseUrl+'/api/agent-info',{signal:AbortSignal.timeout(5000)})).json();return live.instanceId===value.instanceId&&live.libraryId===value.libraryId?value:false;}catch{return false;}},300000,'installed app ready after genuine first-start preparation');
 const render=expression=>`(()=>{const {BrowserWindow}=process.mainModule.require('electron');const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));if(!w)throw Error('Local main window unavailable');return w.webContents.executeJavaScript(${JSON.stringify(expression)});})()`;
 const snapshot=()=>inspector.evaluate(`(async()=>{const {app,session,BrowserWindow}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs'),path=process.mainModule.require('node:path'),s=session.fromPartition('persist:aitoearn-cn'),w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));return {version:app.getVersion(),exe:app.getPath('exe'),userData:app.getPath('userData'),sessionData:app.getPath('sessionData'),partition:s.storagePath,url:w?.webContents.getURL(),theme:JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'ui-state.json'),'utf8')).values.easel_theme,cookie:(await s.cookies.get({name:'first-install-fixture'}))[0]?.value};})()`);
 async function quit(){if(inspector){await inspector.evaluate("process.mainModule.require('electron').app.quit();true").catch(()=>{});inspector.close();inspector=null;}await until(()=>owned().length===0,60000,'normal application quit');}
 try{
  assert.equal(processes().length,0,'Fresh runner must have no MediaSail process');assert.deepEqual(registration(),[],'Fresh runner must have no MediaSail registration');
  for(const entry of [bootstrap,run,path.join(process.env.LOCALAPPDATA,'Programs','MediaSail')])assert.equal(fss.existsSync(entry),false,'Fresh fixture path must not exist: '+entry);
  result.installer=await verifyInstaller(installer);assert.ok(Number(ps('(Get-PSDrive -Name C).Free'))>5*1024**3,'Need 5 GiB free for the real installation');await persist();
  const started=Date.now();installerChild=cp.spawn(installer,[],{windowsHide:false,stdio:'ignore'});assert.ok(installerChild.pid);let installerExit;installerChild.once('exit',code=>{installerExit=code;});
  driverChild=cp.spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'scripts','drive-first-install-fixture.ps1'),'-InstallerPid',String(installerChild.pid),'-ExpectedExecutable',installer,'-ProgramDirectory',target,'-LibraryRoot',libraryRoot,'-EvidenceDirectory',evidence],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  let driverOutput='';for(const stream of [driverChild.stdout,driverChild.stderr])stream.on('data',chunk=>{driverOutput+=chunk.toString('utf8');});
  const driverExit=await new Promise((resolve,reject)=>{driverChild.once('error',reject);driverChild.once('exit',resolve);});await fs.writeFile(path.join(evidence,'wizard-driver.log'),driverOutput);assert.equal(driverExit,0,'Real NSIS wizard driver failed; inspect wizard.json and screenshots');
  await until(()=>installerExit!==undefined,30000,'NSIS process exit');assert.equal(installerExit,0,'Actual NSIS install must succeed');
  result.installMs=Date.now()-started;result.wizard=JSON.parse(await fs.readFile(path.join(evidence,'wizard.json'),'utf8'));
  for(const key of ['passed','programPageObserved','libraryPageObserved','programInputMatched','libraryInputMatched','finishObserved'])assert.equal(result.wizard[key],true,'Missing real GUI proof: '+key);
  assert.ok(fss.existsSync(exe));const selected=await fs.readFile(path.join(bootstrap,'library-selection.ini'),'utf8');assert.equal(/^root=(.+)$/m.exec(selected)?.[1].trim(),libraryRoot,'Real wizard library input was not committed');
  const markerBefore=JSON.parse(await fs.readFile(path.join(libraryRoot,'.mediasail-library.json'),'utf8'));assert.equal(markerBefore.owner,'nsis');assert.equal(markerBefore.state,'initializing');
  const cached=path.join(libraryRoot,'runtime','update-cache','mediasail-updater','installer.exe');assert.equal(await sha256(cached),result.installer.sha256,'Actual NSIS cache must use the selected library before first launch');result.cacheVerifiedBeforeLaunch=true;result.wizardSelectionCommitted=true;await persist();
  assert.equal(owned().length,0,'runAfterFinish=false: first launch must be explicit');const appStarted=Date.now(),firstLaunch=cp.spawn(exe,[],{windowsHide:false,stdio:'ignore',env:appEnvironment()});assert.ok(firstLaunch.pid);result.firstLaunchPid=firstLaunch.pid;
  const connection=await readyConnection();assert.notEqual(connection.pid,firstLaunch.pid,'Actual first-start preparation must relaunch the app');result.preparationRelaunched=true;result.readyPid=connection.pid;inspector=await attachTestMain(connection.pid);result.installToReadyMs=Date.now()-started;result.appToReadyMs=Date.now()-appStarted;
  const location=JSON.parse(await fs.readFile(path.join(bootstrap,'library-location.json'),'utf8')),canonical=JSON.parse(await fs.readFile(connection.connectionFile,'utf8')),marker=JSON.parse(await fs.readFile(path.join(libraryRoot,'.mediasail-library.json'),'utf8'));
  for(const info of [location,connection,canonical])assert.equal(info.libraryRoot?.toLowerCase(),libraryRoot.toLowerCase());assert.equal(location.state,'ready');assert.equal(marker.state,'ready');assert.equal(location.libraryId,marker.libraryId);assert.equal(canonical.instanceId,connection.instanceId);assert.equal(canonical.libraryId,connection.libraryId);assert.equal(connection.connectionFile.toLowerCase(),path.join(libraryRoot,'runtime','agent-connection.json').toLowerCase());assert.equal(connection.discoveryFile.toLowerCase(),path.join(bootstrap,'agent-connection.json').toLowerCase());
  assert.equal(connection.workspace.toLowerCase(),path.join(libraryRoot,'workspace').toLowerCase());assert.equal(connection.dataDir.toLowerCase(),path.join(libraryRoot,'runtime').toLowerCase());
  for(const relative of ['workspace/profiles','workspace/outputs','workspace/skills','runtime','agent-skill/mediasail/SKILL.md'])assert.ok(fss.existsSync(path.join(libraryRoot,relative)),'Missing selected library resource: '+relative);
  const status=await(await fetch(connection.baseUrl+'/api/status')).json();assert.equal(status.serviceReady,true);assert.equal(status.gateway,false);
  assert.equal(await inspector.evaluate(render("Boolean(document.querySelector('.skill-home'))")),true,'Actual Agent homepage required');
  await inspector.evaluate(render("window.desktopUiState.call('set',{key:'easel_theme',value:'dark'}).then(()=>window.desktopUiState.call('flush'))"));
  await inspector.evaluate("(async()=>{const s=process.mainModule.require('electron').session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'first-install-fixture',value:'synthetic-only',expirationDate:Math.floor(Date.now()/1000)+86400});await s.cookies.flushStore();return true;})()");
  result.firstLaunch=await snapshot();const runtime=path.join(libraryRoot,'runtime');for(const key of ['userData','sessionData'])assert.equal(result.firstLaunch[key].toLowerCase(),runtime.toLowerCase());assert.ok(inside(runtime,result.firstLaunch.partition));assert.equal(result.firstLaunch.cookie,'synthetic-only');
  await inspector.evaluate(`(async()=>{const {BrowserWindow}=process.mainModule.require('electron'),fs=process.mainModule.require('node:fs'),w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));const image=await w.webContents.capturePage();fs.writeFileSync(${JSON.stringify(path.join(evidence,'installed-agent-home.png'))},image.toPNG());return true;})()`);
  const registered=list(registration());assert.ok(registered.length>=2);for(const row of registered){assert.equal(row.hive,'CurrentUser');if(row.location)assert.equal(row.location.toLowerCase(),target.toLowerCase());if(row.version)assert.equal(row.version,version);}result.registration=registered;
  await quit();cp.spawn(exe,[],{windowsHide:false,stdio:'ignore',env:appEnvironment()});const restarted=await readyConnection();inspector=await attachTestMain(restarted.pid);result.normalRestart=await snapshot();assert.equal(result.normalRestart.theme,'dark');assert.equal(result.normalRestart.cookie,'synthetic-only');assert.equal(result.normalRestart.userData.toLowerCase(),runtime.toLowerCase());assert.equal(await sha256(cached),result.installer.sha256);await quit();
  const stopped=JSON.parse(await fs.readFile(path.join(bootstrap,'agent-connection.json'),'utf8'));assert.equal(stopped.status,'stopped');result.normalExit=true;result.bootstrapCanonicalMatched=true;result.selectedLibraryLayoutVerified=true;result.sessionRetainedAcrossNormalRestart=true;result.passed=true;await persist();
 }catch(error){result.error=error.stack||String(error);await persist();throw error;}finally{
  inspector?.close();for(const child of [driverChild,installerChild])if(child?.exitCode===null&&child.pid)cp.spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});
  // Failed acceptance must not leave a background fixture app. Scope remains the
  // exact selected executable on the disposable runner; no user installation.
  for(const row of owned().filter(row=>!row.CommandLine?.includes('--type=')))cp.spawnSync('taskkill.exe',['/PID',String(row.ProcessId),'/T','/F'],{windowsHide:true});
  result.finishedAt=new Date().toISOString();await persist();
 }
 console.log('REAL FIRST INSTALL GUI PASSED '+JSON.stringify({version,sha256:result.installer.sha256,bytes:result.installer.bytes,installMs:result.installMs,appToReadyMs:result.appToReadyMs,installToReadyMs:result.installToReadyMs,libraryPageObserved:result.wizard.libraryPageObserved,normalExit:result.normalExit}));
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={assertHostedFixture,verifyInstaller};

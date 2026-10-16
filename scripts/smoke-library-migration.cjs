// Real process restarts and shared-directory reads. Only synthetic Documents data.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {attachTestMain}=require('./test-main-inspector.cjs');
const library=require('../desktop/library.cjs');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','真实切库 '+pkg.version+' '+Date.now());
const bootstrap=path.join(run,'独立定位'),first=path.join(run,'原始 共用资料库'),second=path.join(run,'迁移 中文 空格资料库'),third=path.join(run,'另一份已有库');
const connection=path.join(bootstrap,'agent-connection.json');
const evidence=path.join(root,'docs/images',pkg.version,'library-migration-result.json');
const checks=[],errors=[];let observer,browser,info,child,debugPort;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const quote=text=>"'"+text.replace(/'/g,"''")+"'";
const ps=script=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); '+script],{encoding:'utf8',windowsHide:true,timeout:20000}).trim();
async function until(test,label,timeout=180000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{const result=await test();if(result)return result;}catch(e){last=e;}await sleep(250);}throw Error(label+(last?': '+last.message:''));}
async function json(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n','utf8');}
function record(label){checks.push(label);console.log('MIGRATION: '+label);}
function verifyProcess(pid){const rows=JSON.parse(ps(`Get-CimInstance Win32_Process -Filter ${quote('ProcessId='+Number(pid))} | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`)||'null');assert.equal(rows?.ExecutablePath?.toLowerCase(),executable.toLowerCase(),'Only packaged test executable may be inspected');}
async function ready(expected,previousPid){info=await until(async()=>{const current=await json(connection);return current.status==='ready'&&current.libraryRoot===expected&&current.pid!==previousPid&&current;},'New process ready at selected library');verifyProcess(info.pid);return info;}
async function attach(){await browser?.close().catch(()=>{});observer?.close();verifyProcess(info.pid);observer=await attachTestMain(info.pid);const port=await observer.evaluate("Number(process.mainModule.require('electron').app.commandLine.getSwitchValue('remote-debugging-port'))");assert.ok(port);browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);const page=await until(()=>browser.contexts()[0]?.pages().find(p=>p.url()===info.baseUrl+'/'),'Local main page');await page.locator('.skill-home').waitFor();return page;}
async function stop(){if(!info)return;verifyProcess(info.pid);if(!observer)observer=await attachTestMain(info.pid);await browser?.close().catch(()=>{});browser=null;await observer.evaluate("setTimeout(()=>process.mainModule.require('electron').app.quit(),100);true");observer.close();observer=null;await until(async()=>{try{process.kill(info.pid,0);return false;}catch(e){return e.code==='ESRCH';}},'Normal test shutdown',45000);}
const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立LocalAppData'),APPDATA:path.join(run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
async function launch(){debugPort=await require('../desktop/runtime.cjs').freePort(0);child=cp.spawn(executable,['--remote-debugging-port='+debugPort],{env,windowsHide:true,stdio:['ignore','ignore','ignore']});child.on('error',error=>errors.push(error.message));}
(async()=>{
  assert.ok(executable.startsWith(path.resolve(root,pkg.build.directories.output)+path.sep));await fs.access(executable);
  const prepared=await library.prepareLibrary({bootstrapRoot:bootstrap,defaultLibraryRoot:first,installDirectory:path.dirname(executable)});
  await write(path.join(first,'runtime/ui-state.json'),{schema:1,migration:{version:'0.3.3',sessions:0,copies:0,sources:[]},values:{easel_sessions:'[]',easel_theme:'dark',easel_onboarding_seen:'1'}});
  const project='同机 Agent 物理文件验证',relative=path.join('workspace/outputs',project,'报告.md');
  await write(path.join(first,relative),'# 外部 Agent 创建\n不包含真实用户数据。');
  await write(path.join(first,'workspace/profiles/共享测试画像/identity.md'),'# 合成初始画像');
  await launch();await ready(first);let page=await attach();
  assert.equal(await observer.evaluate("process.mainModule.require('electron').app.getPath('userData')"),path.join(first,'runtime'));
  const original=await(await fetch(info.baseUrl+'/api/output/'+encodeURIComponent(project)+'/'+encodeURIComponent('报告.md'))).json();assert.match(original.content,/外部 Agent 创建/);
  await fetch(info.baseUrl+'/api/persona/'+encodeURIComponent('共享测试画像')+'/file',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'identity.md',content:'# 原生业务服务写入\n合成画像'})}).then(async response=>{assert.ok(response.ok,await response.text());});
  assert.match(await fs.readFile(path.join(first,'workspace/profiles/共享测试画像/identity.md'),'utf8'),/原生业务服务写入/);
  record('File writer and packaged business API read/write the same ordinary Documents directory');
  const method=path.join('workspace/skills/shared/scripts/manifest.py');await fs.appendFile(path.join(first,method),'\n# 用户自定义：切库与重启应保留\n');
  const customSkill=path.join(first,'agent-skill/mediasail/SKILL.md');await fs.appendFile(customSkill,'\n用户自定义接入说明。\n');
  const before=info.pid;
  await page.evaluate(targetRoot=>{void window.desktopLibrary.call('change',{mode:'move',targetRoot}).catch(()=>{});},second);
  await browser.close().catch(()=>{});browser=null;observer.close();observer=null;
  await ready(second,before);page=await attach();assert.equal(info.libraryId,prepared.libraryId);
  assert.equal(await fs.readFile(path.join(second,relative),'utf8'),await fs.readFile(path.join(first,relative),'utf8'));
  assert.match(await fs.readFile(path.join(second,method),'utf8'),/用户自定义/);assert.match(await fs.readFile(path.join(second,'agent-skill/mediasail/SKILL.md'),'utf8'),/用户自定义接入/);
  assert.equal((await json(path.join(second,'runtime/ui-state.json'))).values.easel_theme,'dark');
  assert.equal(await observer.evaluate("process.mainModule.require('electron').app.getPath('sessionData')"),path.join(second,'runtime'));
  record('Settings IPC closes owned services, migrates verified files, and actually relaunches at new runtime/session directory');
  assert.equal((await json(path.join(bootstrap,'library-location.json'))).libraryRoot,second);await assert.rejects(fs.access(path.join(bootstrap,'library-migration.json')),{code:'ENOENT'});
  for(const entry of [connection,path.join(first,'runtime/agent-connection.json')]){
    const helper=cp.spawnSync(info.python,[path.join(info.skillDir,'scripts/mediasail.py'),'--connection',entry,'check'],{env:{...process.env,PYTHONUTF8:'1'},encoding:'utf8',windowsHide:true});assert.equal(helper.status,0,helper.stdout+helper.stderr);const found=JSON.parse(helper.stdout);assert.equal(found.connected,true);assert.equal(found.paths.outputs,path.join(second,'workspace/outputs'));
  }
  const oldWrapper=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(first,'agent-skill/mediasail/scripts/mediasail.ps1'),'check','--data-dir',path.join(first,'runtime')],{encoding:'utf8',windowsHide:true});assert.equal(oldWrapper.status,0,oldWrapper.stdout+oldWrapper.stderr);assert.equal(JSON.parse(oldWrapper.stdout).paths.outputs,path.join(second,'workspace/outputs'));
  record('Old discovery address resolves current library after port and process change');
  const otherBootstrap=path.join(run,'临时另库定位');const other=await library.prepareLibrary({bootstrapRoot:otherBootstrap,defaultLibraryRoot:third,installDirectory:path.dirname(executable)});
  await write(path.join(third,'workspace/outputs/另一库的报告/不同.md'),'独立库，不得与原库合并。');
  const previous=info.pid;await page.evaluate(targetRoot=>{void window.desktopLibrary.call('change',{mode:'existing',targetRoot}).catch(()=>{});},third);
  await browser.close().catch(()=>{});browser=null;observer.close();observer=null;
  await ready(third,previous);page=await attach();assert.equal(info.libraryId,other.libraryId);await assert.rejects(fs.access(path.join(third,relative)),{code:'ENOENT'});assert.match(await fs.readFile(path.join(second,relative),'utf8'),/外部 Agent/);
  record('Open-existing performs a real restart without merging or deleting the previous library');
  const last=info.pid;await stop();await launch();await ready(third,last);await attach();await stop();
  record('Selected library persists through an additional normal exit and restart');
  await write(evidence,{passed:true,version:pkg.version,testedAt:new Date().toISOString(),realPackagedApplication:true,realProcessRelaunch:true,realAccountUsed:false,publications:false,run,checks,errors,scope:'Local packaged process and physical Documents paths; NSIS upgrade is verified separately on Windows runner.'});
  console.log('MIGRATION PASSED '+evidence);
})().catch(async error=>{errors.push(error.stack);await write(evidence,{passed:false,run,checks,errors}).catch(()=>{});console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close().catch(()=>{});observer?.close();if(process.exitCode&&info){try{verifyProcess(info.pid);cp.spawnSync('taskkill.exe',['/PID',String(info.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}}});

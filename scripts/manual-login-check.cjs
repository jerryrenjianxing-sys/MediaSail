// Human-assisted Douyin login in a newly created, independent Documents library.
// No platform response mocks, credential reads, publication or daily installation.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);return index<0?null:args[index+1];};
const phase=value('--phase')||'prepare';
const testBase=path.join(os.homedir(),'Documents','MediaSail 隔离验证');
const run=path.resolve(value('--run')||path.join(testBase,'手动扫码 '+version+' '+Date.now()));
const executable=path.resolve(process.env.EASEL_TEST_EXE||path.join(root,require('../package.json').build.directories.output,'win-unpacked/MediaSail.exe'));
const development=path.basename(executable).toLowerCase()==='electron.exe';
const bootstrap=path.join(run,'独立 定位资料'),defaultLibraryRoot=path.join(run,'独立 登录验收资料库');
let libraryRoot=defaultLibraryRoot,data=path.join(libraryRoot,'runtime');
const control=path.join(run,'control.json'),result=path.join(run,'manual-login-status.json');
function inside(base,file){const relative=path.relative(base,file);return relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
assert.ok(inside(testBase,run),'Only a dedicated Documents test directory is allowed');
for(const forbidden of ['D:\\mediasail',path.join(process.env.LOCALAPPDATA||os.tmpdir(),'Programs/MediaSail')])assert.ok(!inside(path.resolve(forbidden),executable)&&path.resolve(forbidden).toLowerCase()!==executable.toLowerCase(),'Refusing daily installation');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let app,page,info;
async function write(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n','utf8');}
async function status(extra){const data={version,run,libraryRoot,connectionFile:path.join(libraryRoot,'runtime/agent-connection.json'),controlFile:control,updatedAt:new Date().toISOString(),...extra};await write(result,data);console.log(JSON.stringify(data));}
async function api(suffix,options){const response=await fetch(info.baseUrl+suffix,options);if(!response.ok)throw Error('Local operation '+suffix+' returned '+response.status);return response.json();}
async function until(test,message,timeout=180000){const deadline=Date.now()+timeout;let last;do{try{if(await test())return;}catch(e){last=e;}await sleep(300);}while(Date.now()<deadline);throw Error(message+(last?': '+last.message:''));}
async function startQr(){
  const close=page.locator('.modal').getByRole('button',{name:/^(关闭|完成)$/});if(await close.count())await close.click();
  const card=page.locator('.account-card').filter({has:page.locator('.account-card-name',{hasText:'抖音'})});
  await card.getByRole('button',{name:'登录',exact:true}).click();
  let current;
  await until(async()=>{current=await api('/api/login/douyin/status');return ['qr_ready','sms_required','success','error','expired'].includes(current.state);},'Douyin QR preparation did not finish');
  if(current.state==='qr_ready')await page.getByRole('img',{name:'登录二维码',exact:true}).waitFor({timeout:20000});
  await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'));if(window){window.setTitle('MediaSail · 独立抖音扫码验收');window.show();window.focus();}});
  await status({phase:'waiting_for_human',loginState:current.state,qrReady:current.state==='qr_ready',verificationStatus:current.verificationStatus||'unknown',errorCode:current.errorCode||null});
}
async function verify(){
  let login;
  await until(async()=>{login=await api('/api/login/douyin/status');return ['success','error','expired'].includes(login.state);},'Login is still waiting for human action',45000);
  let identity=await api('/api/accounts/douyin/whoami?force=1');
  for(let attempt=0;String(identity.errorCode||'').toLowerCase()==='profile_busy'&&attempt<6;attempt++){await sleep(2000);identity=await api('/api/accounts/douyin/whoami?force=1');}
  const safe={phase:'verified',reopened:phase==='reopen',finalized:phase==='finalize',entry:development?'repository-electron':'packaged',loginState:login.state,verificationStatus:identity.verificationStatus,
    checkedAt:identity.checkedAt,accountIdentityPresent:Boolean(identity.accountId),errorCode:identity.errorCode||null,cached:identity.cached};
  if(identity.verificationStatus==='verified'){
    const analysis=await api('/api/analytics/douyin');
    safe.analysis={verificationStatus:analysis.verificationStatus,accountIdentityPresent:Boolean(analysis.accountId),
      sameVerifiedAccount:Boolean(identity.accountId&&identity.accountId===analysis.accountId),source:analysis.source||null,
      followerMetricPresent:analysis.followers!=null,likeMetricPresent:analysis.likes!=null,postMetricPresent:analysis.posts!=null,
      fetchedAt:analysis.fetched_at,errorCode:analysis.errorCode||null};
  }
  await status(safe);
  if(identity.verificationStatus!=='verified'||!safe.analysis?.sameVerifiedAccount)throw Error('登录验收尚未通过：'+(identity.errorCode||identity.verificationStatus));
}
(async()=>{
  if(!['prepare','reopen','finalize'].includes(phase)){
    assert.ok(['verify','retry','stop'].includes(phase),'Phase supports prepare, verify, retry, stop');
    await fs.access(result);await write(control,{action:phase,requestedAt:new Date().toISOString()});console.log(JSON.stringify({queued:true,phase,run}));return;
  }
  await fs.access(executable);const layout=await require('../desktop/library.cjs').prepareLibrary({bootstrapRoot:bootstrap,defaultLibraryRoot,installDirectory:path.dirname(executable)});
  libraryRoot=layout.libraryRoot;data=layout.dataRoot;
  if(phase==='prepare')await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3',sessions:0,copies:0,sources:[]},values:{easel_sessions:'[]',easel_theme:'light',easel_onboarding_seen:'1'}});
  const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立宿主 Local'),APPDATA:path.join(run,'独立宿主 Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:development?[root]:[],env,timeout:60000});page=await app.firstWindow();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
  info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));
  assert.equal(info.libraryRoot,libraryRoot);assert.equal(info.environment.HOME,path.join(data,'home'));
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
  // A read-only reopen does not need to mount the accounts page, whose automatic
  // background checks could compete with the explicit verification of this profile.
  if(phase==='finalize')await api('/api/login/douyin',{method:'POST'});
  if(phase==='reopen'||phase==='finalize'){await verify();await app.close();app=null;return;}
  await page.getByRole('button',{name:'控制台',exact:true}).click();await page.locator('.sidebar-nav').getByRole('button',{name:'账号',exact:true}).click();
  await page.locator('.account-card-name').filter({hasText:'抖音'}).waitFor();
  await startQr();
  const deadline=Date.now()+2*60*60*1000;
  while(Date.now()<deadline&&app){
    let command;try{command=JSON.parse(await fs.readFile(control,'utf8'));await fs.rename(control,control+'.processed-'+Date.now());}catch(e){if(e.code!=='ENOENT')throw e;}
    if(command){
      if(command.action==='stop'){await app.close();app=null;await status({phase:'stopped'});break;}
      try{if(command.action==='verify')await verify();else if(command.action==='retry')await startQr();}
      catch(e){await status({phase:'operation_failed',action:command.action,error:e.message});}
    }
    await sleep(1000);
  }
})().catch(async error=>{await status({phase:'prepare_failed',error:error.message}).catch(()=>{});console.error(error);process.exitCode=1;}).finally(async()=>{if(process.exitCode&&app)await app.close();});

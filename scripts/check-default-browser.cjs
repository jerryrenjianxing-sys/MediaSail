// One real OS browser launch from the final packaged application. This script
// only observes the launcher; a separate browser/UI observation must complete
// the evidence before anyone marks the end-to-end browser check as passed.
'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),version=pkg.version;
const expectedUrl='https://aitoearn.cn/zh-CN';
const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','真实 默认浏览器 '+version+' '+Date.now());
const bootstrap=path.join(run,'独立 定位'),libraryRoot=path.join(run,'合成 中文 空格资料库'),data=path.join(libraryRoot,'runtime');
const project='默认浏览器 合成项目',title='默认浏览器验收 · 合成项目';
const evidence=path.join(root,'docs/evidence','default-browser-'+version+'.json');
const screenshot=path.join(root,'docs/images',version,'default-browser-launcher.png');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let app,page,normalExitCompleted=false,clickCount=0;
const result={schema:1,version,passed:false,launcherAccepted:false,browserObservationPending:true,expectedUrl,startedAt:new Date().toISOString(),realPackagedApplication:true,realSystemDefaultBrowser:true,shellOpenExternalStubbed:false,syntheticDataOnly:true,realAccountUsed:false,downloadRequested:false,installRequested:false,uploadRequested:false,publicationPerformed:false,clickCount:0,executable,libraryRoot,run,errors:[]};
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');}
async function until(fn,label,timeout=30000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await fn())return;}catch(error){last=error;}await delay(150);}throw Error(label+(last?': '+last.message:''));}
function defaultHttpsAssociation(){
  const key='HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice';
  try{const output=cp.execFileSync('reg.exe',['query',key,'/v','ProgId'],{encoding:'utf8',windowsHide:true,timeout:10000});const match=output.match(/ProgId\s+REG_SZ\s+([^\r\n]+)/i);return {readOnly:true,registryKey:key,progId:match?match[1].trim():null};}
  catch(error){return {readOnly:true,registryKey:key,progId:null,error:'Unable to read the HTTPS UserChoice ProgId: '+(error.code||error.status||'unknown')};}
}
async function inspectElectron(){
  return app.evaluate(({webContents,BrowserWindow})=>({
    contents:webContents.getAllWebContents().map(wc=>({id:wc.id,type:wc.getType(),url:wc.getURL()})),
    windows:BrowserWindow.getAllWindows().map(window=>({id:window.id,url:window.webContents.getURL()}))
  }));
}
function noEmbeddedWebsite(snapshot){assert.ok(!snapshot.contents.some(wc=>/^https?:\/\/(?:[^/]+\.)?aitoearn\.cn(?:[/:]|$)/i.test(wc.url)),'No AitoEarn webContents may exist inside Electron');assert.ok(!snapshot.contents.some(wc=>['webview','browserView'].includes(wc.type)),'No embedded browser webContents may exist');}
async function normalExit(){
  if(!app)return;
  const owned=app,closed=owned.waitForEvent('close',{timeout:60000});
  // Do not replace native dialogs, bypass task checks, kill processes, or use a
  // different installation. The empty isolated instance must quit normally.
  await owned.evaluate(({app})=>{app.quit();return true;}).catch(error=>{if(!/closed|Target page, context or browser has been closed/i.test(error.message))throw error;});
  await closed;app=null;normalExitCompleted=true;
}
(async()=>{
  assert.equal(process.platform,'win32','This is a real Windows default-browser check');
  assert.equal(version,'0.5.5','This one-shot acceptance targets the 0.5.5 candidate');
  const expectedDirectory=path.resolve(root,'../../outputs/MediaSail/release-0.5.5/win-unpacked');
  assert.equal(path.dirname(executable).toLowerCase(),expectedDirectory.toLowerCase(),'Only the isolated packaged output is permitted');
  assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'),'Refusing the daily installed application');
  await fs.access(executable);
  result.testedAppAsarSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(expectedDirectory,'resources/app.asar'))).digest('hex');
  result.defaultHttpsAssociation=defaultHttpsAssociation();
  const selected=await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:expectedDirectory});
  const projectRoot=path.join(selected.workspace,'outputs',project),manifest=JSON.stringify({title,category:'creation',kind:'article',status:'draft',summary:'仅用于真实默认浏览器打开验收，无账号、无上传。',deliverables:['正文.md']},null,2);
  await write(path.join(projectRoot,'.easel.json'),manifest);await write(path.join(projectRoot,'正文.md'),'# 合成文案\n只验证默认浏览器打开，不登录、不上传、不发布。');
  await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_sessions:'[]',easel_theme:'light',easel_onboarding_seen:'1'}});
  const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立Local'),APPDATA:path.join(run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();
  page.on('pageerror',error=>result.errors.push(error.message));
  const localEffects=[];page.on('request',request=>{const url=request.url();if(/\/api\/(?:publish(?:\/|\?)|upload(?:\/|\?)|login(?:\/|\?))/.test(url))localEffects.push({method:request.method(),url});});
  // No account check should be needed to open a project. If an unrelated page
  // requests one, keep it synthetic and record the event for diagnosis.
  const syntheticAccountRequests=[];
  await page.route('**/api/accounts/*/whoami*',route=>{syntheticAccountRequests.push(route.request().url());return route.fulfill({json:{loggedIn:false,verificationStatus:'unknown',accountId:null,name:'',avatar:'',checkedAt:0,errorCode:'SYNTHETIC',message:'真实浏览器打开验收，不使用平台账号'}});});
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
  assert.equal(await app.evaluate(({app})=>app.getVersion()),version);assert.equal((await app.evaluate(({app})=>app.getPath('exe'))).toLowerCase(),executable.toLowerCase());
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
  const info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(info.libraryRoot,libraryRoot);assert.equal(info.version,version);
  await page.evaluate(name=>{location.hash='#/outputs/'+encodeURIComponent(name);},project);
  await page.getByTestId('content-library').waitFor();await until(async()=>(await page.locator('.gallery-head h1').innerText()).includes(title),'Project breadcrumb includes the manifest title');await page.getByText('正文.md',{exact:true}).waitFor();
  const before={url:page.url(),heading:await page.locator('.gallery-head h1').innerText(),contents:await inspectElectron()};noEmbeddedWebsite(before.contents);
  result.before={url:before.url,heading:before.heading,electron:before.contents};
  const link=page.locator('.sidebar-nav').getByRole('link',{name:'AI 发布 ↗',exact:true});assert.equal(await link.getAttribute('href'),expectedUrl);
  result.clickedAt=new Date().toISOString();clickCount++;await link.click();
  await page.getByRole('status').filter({hasText:'已交给默认浏览器打开 AitoEarn。'}).waitFor({timeout:30000});
  result.launcherAccepted=true;result.launcherAcceptedAt=new Date().toISOString();
  await until(async()=>await page.locator('.gallery-head h1').innerText()===before.heading,'The same synthetic project stays mounted');
  assert.equal(page.url(),before.url);assert.equal(await page.getByTestId('content-library').count(),1);assert.equal(await page.locator('.gallery-head h1').innerText(),before.heading);
  const after=await inspectElectron();noEmbeddedWebsite(after);assert.equal(after.windows.length,before.contents.windows.length);
  assert.equal(await fs.readFile(path.join(projectRoot,'.easel.json'),'utf8'),manifest);assert.deepEqual(localEffects,[]);assert.deepEqual(result.errors,[]);assert.deepEqual(syntheticAccountRequests,[]);
  const updateState=await page.evaluate(()=>window.desktopUpdates?.status());assert.ok(!['downloading','downloaded','installing'].includes(updateState?.phase));assert.equal(Number(updateState?.transferred||0),0);
  await fs.mkdir(path.dirname(screenshot),{recursive:true});await page.screenshot({path:screenshot,animations:'disabled'});
  result.after={url:page.url(),heading:await page.locator('.gallery-head h1').innerText(),electron:after};result.localEffects=localEffects;result.syntheticAccountRequests=syntheticAccountRequests;result.currentProjectPreserved=true;result.noEmbeddedAitoEarn=true;result.updatePhase=updateState?.phase||null;result.screenshot=path.relative(root,screenshot).split(path.sep).join('/');
  await normalExit();
  console.log('OS accepted the fixed browser URL once; browser-page observation is still required.');
})().catch(error=>{result.error=error.stack||error.message;console.error(error);process.exitCode=1;}).finally(async()=>{
  if(app)try{await normalExit();}catch(error){result.cleanupError=error.stack||error.message;console.error(error);process.exitCode=1;}
  result.clickCount=clickCount;result.normalExitCompleted=normalExitCompleted;result.finishedAt=new Date().toISOString();
  // A launcher success is deliberately not an end-to-end website success.
  result.passed=false;result.browserObservationPending=true;await write(evidence,result);console.log('BROWSER LAUNCHER EVIDENCE '+evidence);
});

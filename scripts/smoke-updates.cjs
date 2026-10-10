// Actual Electron + electron-updater HTTP download/checksum/cache/UI integration.
// The fixture is inert bytes, never an executable. Installation is intercepted.
const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data/软件 更新 '+Date.now());
const executable=process.env.EASEL_TEST_EXE||path.resolve(root,'../../outputs/MediaSail/win-unpacked/MediaSail.exe');
const currentVersion=require('../package.json').version,targetVersion='0.4.1';
const bytes=crypto.randomBytes(3*1024*1024),hash=crypto.createHash('sha512').update(bytes).digest('base64');
let offline=true,badHash=false,requests=0,hold=false,releaseDownload;
const server=http.createServer(async(req,res)=>{
 if(req.url.startsWith('/latest.yml')){if(offline){res.writeHead(503);res.end('fixture offline');return;}res.setHeader('Content-Type','text/yaml');res.end(`version: ${targetVersion}\nfiles:\n  - url: MediaSail-${targetVersion}-win-x64-Setup.exe\n    sha512: ${badHash?Buffer.alloc(64).toString('base64'):hash}\n    size: ${bytes.length}\npath: MediaSail-${targetVersion}-win-x64-Setup.exe\nsha512: ${hash}\nreleaseDate: '2026-10-09T00:00:00.000Z'\n`);return;}
 if(req.url.includes('Setup.exe')){requests++;res.writeHead(200,{'Content-Length':bytes.length,'Content-Type':'application/octet-stream'});res.write(bytes.subarray(0,1024));if(hold)await new Promise(r=>{releaseDownload=r;});res.end(bytes.subarray(1024));return;}
 res.writeHead(404);res.end();
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const feed=`http://127.0.0.1:${server.address().port}`;
 const env={...process.env,EASEL_DESKTOP_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 let app;
 async function launch(){
  app=await electron.launch({executablePath:executable,args:[],env,timeout:30000});
  await app.evaluate(({app},options)=>{
   const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
   const path=require('node:path'),fs=require('node:fs');
   const updater=require(path.join(app.getAppPath(),'node_modules/electron-updater')).autoUpdater;
   // Keep fixture downloads inside the disposable test data, never the real update cache.
   Object.defineProperty(updater.app,'baseCachePath',{get:()=>options.data});
   const config=path.join(options.data,'fixture-update.yml');fs.mkdirSync(options.data,{recursive:true});fs.writeFileSync(config,'updaterCacheDirName: fixture-cache\n');
   updater.updateConfigPath=config;updater.setFeedURL({provider:'generic',url:options.feed});updater.disableDifferentialDownload=true;
   globalThis.updateFixture={installs:0};updater.quitAndInstall=()=>{globalThis.updateFixture.installs++;updater.emit('error',new Error('fixture installer failure'));};
  },{data,feed});
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  await page.locator('.settings-gear').click();
  const settings=page.getByRole('dialog',{name:'设置',exact:true});
  await settings.getByText('＋ 添加供应商', {exact:false}).click();
  const name=settings.getByPlaceholder('名称').last();await name.fill('unsaved-update-fixture');
  await settings.getByRole('button',{name:'软件更新',exact:true}).click();
  await settings.getByTestId('update-current-version').filter({hasText:currentVersion}).waitFor();
  assert.equal(await settings.getByTestId('update-current-version').innerText(),currentVersion);
  const panelReady=app.waitForEvent('window',{predicate:p=>p!==page,timeout:10000});
  // The settings action starts a check itself; no second click in the child window.
  await settings.getByRole('button',{name:'检查更新',exact:true}).click();
  const panel=await panelReady;
  await panel.locator('#headline').waitFor();
  await settings.getByRole('button',{name:/模型配置/}).click();
  assert.equal(await settings.getByPlaceholder('名称').last().inputValue(),'unsaved-update-fixture');
  await settings.getByRole('button',{name:'软件更新',exact:true}).click();
  return {page,panel};
 }
 const phase=(p,v)=>p.waitForFunction(v=>document.querySelector('#headline').textContent.includes(v),v,{timeout:30000});
 try{
  let {page,panel}=await launch();
  await phase(panel,'更新暂未完成');
  assert.match(await page.getByRole('dialog',{name:'设置',exact:true}).getByRole('status').innerText(),/更新未完成/);
  await page.screenshot({path:path.resolve(root,'../../outputs/MediaSail/MediaSail-0.3.1-设置更新.png')});
  offline=false;badHash=true;await panel.getByRole('button',{name:'重新检查'}).click();await phase(panel,'新版本 '+targetVersion);
  await panel.getByRole('button',{name:'下载新版'}).click();await phase(panel,'更新暂未完成');assert.match(await panel.locator('#message').innerText(),/校验/);
  badHash=false;hold=true;await panel.getByRole('button',{name:'重新检查'}).click();await phase(panel,'新版本 '+targetVersion);await panel.getByRole('button',{name:'下载新版'}).click();
  await phase(panel,'正在下载');await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:')).close());
  await new Promise(r=>setTimeout(r,600));assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:')).isVisible()),false);
  while(!releaseDownload)await new Promise(r=>setTimeout(r,50));releaseDownload();hold=false;
  await app.evaluate(({BrowserWindow})=>{for(const w of BrowserWindow.getAllWindows())w.show();});await phase(panel,'可以安装');
  assert.equal(await app.evaluate(()=>globalThis.updateFixture.installs),0);
  console.log('REAL HTTP: OFFLINE RETRY, INVALID SHA512 REJECTION, TRAY DOWNLOAD, NO AUTO INSTALL PASSED');
  // Restart and request the same update: electron-updater must reuse its verified cache.
  await app.close();app=null;const before=requests;({page,panel}=await launch());
  if(await panel.locator('#check').isVisible())await panel.locator('#check').click();await phase(panel,'新版本');await panel.getByRole('button',{name:'下载新版'}).click();await phase(panel,'可以安装');assert.equal(requests,before);
  const pending=path.join(data,'workspace/outputs/_publish/update-fixture.json');fs.mkdirSync(path.dirname(pending),{recursive:true});fs.writeFileSync(pending,JSON.stringify({state:'starting'}));
  await app.evaluate(({dialog})=>{globalThis.updateFixture.prompts=0;globalThis.originalDialog=dialog.showMessageBox;dialog.showMessageBox=async()=>{globalThis.updateFixture.prompts++;return {response:0};};});
  await panel.getByRole('button',{name:'重启并安装'}).click();await page.waitForTimeout(600);assert.equal(await app.evaluate(()=>globalThis.updateFixture.prompts),1);assert.equal(await app.evaluate(()=>globalThis.updateFixture.installs),0);
  fs.unlinkSync(pending);await app.evaluate(({dialog})=>{dialog.showMessageBox=globalThis.originalDialog;});
  await panel.getByRole('button',{name:'重启并安装'}).click();await phase(panel,'更新暂未完成');assert.equal(await app.evaluate(()=>globalThis.updateFixture.installs),1);
  const recoveryDeadline=Date.now()+180000;let recovered=false;
  while(Date.now()<recoveryDeadline){
   recovered=await page.evaluate(async()=>{try{return(await(await fetch('/api/status')).json()).gateway===true;}catch{return false;}}).catch(()=>false);
   if(recovered)break;await new Promise(r=>setTimeout(r,300));
  }
  assert.equal(recovered,true,'Local gateway must really recover after the simulated installer failure');
  assert.equal((await page.evaluate(()=>window.desktopAito.call('status'))).busy,false);
  await panel.screenshot({path:path.resolve(root,'../../outputs/MediaSail/更新-失败恢复验证.png')});
  console.log('CACHE REUSE AFTER RESTART, BUSY INSTALL CANCELLATION, INSTALL FAILURE SERVICE RECOVERY PASSED');
 }finally{releaseDownload?.();if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.closeAllConnections();server.close();});

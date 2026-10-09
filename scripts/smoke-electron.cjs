const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const cp=require('node:child_process');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const executable=process.env.EASEL_TEST_EXE || path.join(root,'node_modules/electron/dist/electron.exe');
 const env={...process.env,EASEL_DESKTOP_DATA:process.env.EASEL_TEST_DATA||path.join(root,'.test-data/桌面验证')};delete env.ELECTRON_RUN_AS_NODE;
 if(process.env.EASEL_TEST_CLEAN_PATH==='1')env.PATH=`${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`;
 const app=await electron.launch({executablePath:executable,args:process.env.EASEL_TEST_EXE?[]:[root],env,timeout:30000});
 try{
  const page=await app.firstWindow();page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.waitForLoadState('domcontentloaded');
  await page.locator('#root').waitFor();await page.waitForTimeout(2500);
  const text=await page.locator('body').innerText();console.log('ORIGINAL UI',text.slice(0,2200));
  const status=await page.evaluate(async()=>await(await fetch('/api/status')).json());console.log('STATUS',JSON.stringify({gateway:status.gateway,skills:status.skills.length,personas:status.personas.length}));
  assert.ok(status.skills.length>=100);assert.equal(status.gateway,true);
  await page.waitForFunction(()=>!document.body.innerText.includes('网关未连接'),{timeout:30000});
  const welcome=page.getByRole('button',{name:'先用通用模式'});
  if(await welcome.isVisible())await welcome.click();
  await page.screenshot({path:path.resolve(root,'../../outputs/ElectronEasel/原版界面.png'),fullPage:true});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);console.log('CLOSE HIDES WINDOW');
  assert.equal(await page.evaluate(async()=>(await fetch('/api/personas')).status),200);
  const second=cp.spawn(executable,process.env.EASEL_TEST_EXE?[]:[root],{env,windowsHide:true,stdio:'ignore'});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{second.kill();reject(new Error('Second instance did not exit'));},15000);second.once('exit',()=>{clearTimeout(timer);resolve();});});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);console.log('SECOND INSTANCE REOPENS ORIGINAL WINDOW');
  const pending=path.join(env.EASEL_DESKTOP_DATA,'workspace/outputs/_publish');fs.mkdirSync(pending,{recursive:true});fs.writeFileSync(path.join(pending,'desktop-test.json'),JSON.stringify({state:'starting'}));
  await app.evaluate(({dialog,app})=>{globalThis.testPrompts=0;globalThis.realMessageBox=dialog.showMessageBox;dialog.showMessageBox=async()=>{globalThis.testPrompts++;return {response:0};};app.quit();});
  await page.waitForTimeout(1000);assert.equal(await app.evaluate(()=>globalThis.testPrompts),1);assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isDestroyed()),false);
  fs.unlinkSync(path.join(pending,'desktop-test.json'));await app.evaluate(({dialog})=>{dialog.showMessageBox=globalThis.realMessageBox;});console.log('BUSY EXIT CONFIRMATION CAN CANCEL');
 }finally{
  const pendingFile=path.join(env.EASEL_DESKTOP_DATA,'workspace/outputs/_publish/desktop-test.json');
  if(fs.existsSync(pendingFile))fs.unlinkSync(pendingFile);
  await app.evaluate(({dialog})=>{if(globalThis.realMessageBox)dialog.showMessageBox=globalThis.realMessageBox;}).catch(()=>{});
  await app.close();
 }
 console.log('ELECTRON SMOKE PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});

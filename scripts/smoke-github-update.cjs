// Read-only check of the published GitHub feed. Does not download/install updates.
const {_electron:electron}=require('playwright');
const path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),env={...process.env,EASEL_DESKTOP_DATA:path.join(root,'.test-data/GitHub 版本检查')};delete env.ELECTRON_RUN_AS_NODE;
 const executable=path.resolve(root,'../../outputs/MediaSail/win-unpacked/MediaSail.exe');
 const app=await electron.launch({executablePath:executable,args:[],env,timeout:30000});
 try{
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  const panelReady=app.waitForEvent('window',{predicate:p=>p!==page});await page.getByRole('button',{name:/软件更新/}).click();const panel=await panelReady;
  await panel.locator('#check').waitFor();let state;
  for(let attempt=0;attempt<3;attempt++){
   // Await the IPC dispatch and poll immutable snapshots. Startup's automatic
   // check may run between UI frames, so do not assert against stale DOM text.
   await panel.evaluate(()=>window.mediaSailUpdate.call('check'));
   const deadline=Date.now()+150000;
   do{
    state=await page.evaluate(()=>window.desktopUpdates.status());
    if(['current','error'].includes(state.phase))break;
    await page.waitForTimeout(250);
   }while(Date.now()<deadline);
   if(state.phase==='current')break;
   await page.waitForTimeout(5000);
  }
  assert.equal(state.phase,'current',state.message);assert.equal(state.current,'0.3.0');
  await panel.screenshot({path:path.resolve(root,'../../outputs/MediaSail/MediaSail-软件更新.png')});
  console.log('PUBLIC GITHUB FEED PASSED: packaged 0.3.0 resolves the published stable release and is up to date. No download/install performed.');
 }finally{await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

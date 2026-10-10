const {_electron:electron}=require('playwright'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const executable=process.env.MEDIASAIL_BASELINE_EXE;if(!executable)throw Error('Set MEDIASAIL_BASELINE_EXE to a preserved baseline package');
(async()=>{
 const app=await electron.launch({executablePath:executable,args:[],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,EASEL_DESKTOP_DATA:path.join(root,'.test-data','feed-check-'+version+'-'+Date.now())},timeout:30000});
 try{
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});await page.locator('.sidebar-status').filter({hasText:'网关已连接'}).waitFor({timeout:240000});
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  const current=await app.evaluate(({app})=>app.getVersion());assert.notEqual(current,version);
  await page.locator('.settings-gear').click();const settings=page.getByRole('dialog',{name:'设置',exact:true});await settings.getByRole('button',{name:'软件更新',exact:true}).click();
  const [panel]=await Promise.all([app.waitForEvent('window',{predicate:p=>p!==page}),settings.getByRole('button',{name:'检查更新',exact:true}).click()]);await panel.waitForURL('**/updates.html');await panel.waitForFunction(()=>typeof window.mediaSailUpdate?.call==='function');
  let state;for(let i=0;i<3;i++){
   await panel.evaluate(()=>window.mediaSailUpdate.call('check'));const end=Date.now()+150000;
   do{state=await page.evaluate(()=>window.desktopUpdates.status());if(['available','current','error'].includes(state.phase))break;await page.waitForTimeout(500);}while(Date.now()<end);
   if(state.phase==='available')break;await page.waitForTimeout(3000);
  }
  assert.equal(state.phase,'available',state.message);assert.equal(state.version,version);
  await panel.screenshot({path:path.resolve(root,'../../outputs/MediaSail',`MediaSail-${current}-发现${version}.png`),animations:'disabled'});
  console.log('Unchanged GitHub feed: '+current+' discovers '+version+'. No download or installation.');
 }finally{await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

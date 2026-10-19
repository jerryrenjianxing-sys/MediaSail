// Read the original GitHub update feed from preserved packaged clients only.
'use strict';
const {_electron:electron}=require('playwright'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),target=require('../package.json').version;
const from=process.env.MEDIASAIL_CHECK_VERSION||'0.5.5';assert.ok(['0.5.4','0.5.5',target].includes(from));
const executable=path.resolve(root,'../../outputs/MediaSail','release-'+from,'win-unpacked/MediaSail.exe');
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','正式更新检查 '+from+' '+Date.now()),bootstrap=path.join(run,'定位'),libraryRoot=path.join(run,'资料库'),data=path.join(libraryRoot,'runtime');
const evidence=path.join(root,'docs/evidence','content-update-'+from+'-to-'+target+'.json'),screenshot=path.join(root,'docs/images',target,'update-check-'+from+'.png');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let app,page;
(async()=>{
 await fs.access(executable);await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
 await fs.writeFile(path.join(data,'ui-state.json'),JSON.stringify({schema:1,migration:{version:'0.3.3'},values:{easel_sessions:'[]',easel_onboarding_seen:'1',easel_theme:'light'}}));
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'Local'),APPDATA:path.join(run,'Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
 assert.equal(await app.evaluate(({app})=>app.getVersion()),from);
 const config=await fs.readFile(path.join(path.dirname(executable),'resources/app-update.yml'),'utf8');assert.match(config,/provider: github/);assert.match(config,/repo: MediaSail/);assert.match(config,/owner: jerryrenjianxing-sys/);
 await page.getByRole('button',{name:'控制台',exact:true}).click();await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('.settings-nav').getByRole('button',{name:'软件更新',exact:true}).click();
 const [panel]=await Promise.all([app.waitForEvent('window',{predicate:value=>value!==page}),page.locator('.settings-panel').getByRole('button',{name:'检查更新',exact:true}).click()]);
 await panel.waitForURL('**/updates.html');let state;
 for(let attempt=0;attempt<3;attempt++){
  await panel.evaluate(()=>window.mediaSailUpdate.call('check'));const end=Date.now()+120000;
  do{state=await page.evaluate(()=>window.desktopUpdates.status());if(['current','available','error'].includes(state.phase))break;await delay(500);}while(Date.now()<end);
  if(state.phase!=='error')break;await delay(2000);
 }
 assert.equal(state.phase,from===target?'current':'available',state.message);if(from!==target)assert.equal(state.version,target);assert.equal(state.transferred,0);
 await fs.mkdir(path.dirname(screenshot),{recursive:true});await panel.screenshot({path:screenshot,animations:'disabled'});
 await fs.mkdir(path.dirname(evidence),{recursive:true});await fs.writeFile(evidence,JSON.stringify({passed:true,from,to:target,checkedAt:new Date().toISOString(),state,source:'unchanged packaged GitHub electron-updater feed',downloadRequested:false,installRequested:false,isolatedLibrary:true},null,2));
 console.log('PUBLISHED UPDATE CHECK '+from+' -> '+target+' '+state.phase);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}});

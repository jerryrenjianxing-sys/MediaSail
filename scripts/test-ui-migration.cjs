const { _electron:electron }=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data','storage-v033-'+Date.now(),'旧数据 中文');
const launch=()=>electron.launch({executablePath:path.join(root,'node_modules/electron/dist/electron.exe'),args:[path.join(__dirname,'ui-migration-fixture.cjs')],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,MEDIASAIL_TEST_PROFILE:data}});
(async()=>{
 let app=await launch();
 try{
  await app.firstWindow();
  await app.evaluate(async()=>{
   const {BrowserWindow,session}=global.fixture,s=session.defaultSession;
   s.protocol.handle('http',()=>new Response('<!doctype html><title>fixture</title>',{headers:{'content-type':'text/html'}}));
   const w=new BrowserWindow({show:false});
   for(let i=0;i<3;i++){
    await w.loadURL('http://127.0.0.1:'+(42110+i)+'/');
    await w.webContents.executeJavaScript(`localStorage.setItem('easel_sessions',JSON.stringify([{id:'shared',title:'中文测试',messages:[{role:'user',content:'端口 ${i}'}],sessionKey:'shared-backend',pendingTurnId:'old-turn'}]));localStorage.setItem('easel_theme','${i===1?'dark':'light'}');localStorage.setItem('easel_chat_reset_20260902','1');`);
    if(i===2)await w.webContents.executeJavaScript("localStorage.removeItem('easel_sessions');localStorage.removeItem('easel_theme');localStorage.removeItem('easel_chat_reset_20260902')");
   }
   // A remote origin and a local origin lacking app keys must not be migrated.
   await w.loadURL('http://127.0.0.1:42113/');await w.webContents.executeJavaScript("localStorage.setItem('unrelated','do not import')");
   s.flushStorageData();w.destroy();
  });
 }finally{await app.close();}
 app=await launch();
 try{
  await app.firstWindow();
  const result=await app.evaluate(async()=>{
   const {root,data}=global.fixture,req=process.getBuiltinModule('node:module').createRequire(root+'/package.json');
   const {migrateUiState}=req('./desktop/ui-migration.cjs');
   return migrateUiState({data,resources:root+'/build',bridgeResources:root});
  });
  const chats=JSON.parse(result.values.easel_sessions);assert.equal(chats.length,2);assert.equal(result.values.easel_theme,'dark');assert.equal(result.migration.copies,1);assert.ok(chats.every(x=>!x.messages[0].content.includes('端口 2')));assert.ok(!('unrelated' in result.values));
  await fs.writeFile(path.join(data,'migration-result.json'),JSON.stringify(result,null,2));console.log('ISOLATED CHROMIUM MIGRATION PASSED: multiple ports, tombstones, conflict copy, latest preference, no external connections.');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

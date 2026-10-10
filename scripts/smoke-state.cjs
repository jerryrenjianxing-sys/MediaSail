// Test packaged state across genuinely different local origins, never the installed user profile.
const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../outputs/MediaSail');
const data=path.join(root,'.test-data','state-packaged-'+Date.now(),'用户 中文 数据');
const executable=process.env.EASEL_TEST_EXE||path.join(out,'win-unpacked/MediaSail.exe');
let app;
async function occupy(port=0){const server=net.createServer(s=>s.destroy());await new Promise((r,j)=>{server.once('error',j);server.listen(port,'127.0.0.1',r);});return server;}
async function launch(blockedPort){
 app=await electron.launch({executablePath:executable,args:[],env:{...process.env,ELECTRON_RUN_AS_NODE:undefined,EASEL_DESKTOP_DATA:data},timeout:30000});
 await app.evaluate((_e,port)=>{const net=process.getBuiltinModule('node:net'),listen=net.Server.prototype.listen;net.Server.prototype.listen=function(value,...args){return listen.call(this,value===7860?port:value,...args);};},blockedPort);
 const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:210000});await page.locator('.sidebar-status').filter({hasText:'网关已连接'}).waitFor({timeout:210000});
 const onboarding=page.getByRole('button',{name:'先用通用模式'});if(await onboarding.isVisible())await onboarding.click();return page;
}
async function close(){if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});await app.close();app=null;}}
(async()=>{
 await fs.mkdir(data,{recursive:true});
 // Real Chromium old storage created by the isolated migration test, not JSON injection into a new store.
 const fixtureNames=(await fs.readdir(path.join(root,'.test-data'))).filter(n=>n.startsWith('storage-v033-')).sort();assert.ok(fixtureNames.length);
 await fs.cp(path.join(root,'.test-data',fixtureNames.at(-1),'旧数据 中文','Local Storage'),path.join(data,'Local Storage'),{recursive:true,filter:p=>path.basename(p)!=='LOCK'});
 let server=await occupy();let firstPort;
 try{
  const page=await launch(server.address().port);firstPort=Number(new URL(page.url()).port);
  const state=await page.evaluate(()=>window.desktopUiState.call('load'));assert.equal(state.migration.copies,1);assert.equal(state.migration.sessions,2);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  await page.locator('.theme-toggle').click();
  const chats=Array.from({length:125},(_,i)=>({id:'retained-'+i,title:'保留对话 '+i,created:i,messages:[{role:'user',content:'中文历史 '+i}]}));
  await page.evaluate(async chats=>{await window.desktopUiState.call('set',{key:'easel_sessions',value:JSON.stringify(chats)});await window.desktopUiState.call('set',{key:'easel_publish_draft',value:JSON.stringify({title:'保留草稿',body:'跨端口 中文 内容',platforms:['xiaohongshu'],overrides:{},tags:''})});await window.desktopUiState.call('flush');},chats);
  await page.reload();await page.locator('.sidebar-logo').waitFor();
  await fs.mkdir(path.join(data,'workspace/outputs/跨端口验收'),{recursive:true});await fs.writeFile(path.join(data,'workspace/outputs/跨端口验收/成品.txt'),'用户成品保留');
  await fs.mkdir(path.join(data,'workspace/profiles/自定义'),{recursive:true});await fs.writeFile(path.join(data,'workspace/profiles/自定义/profile.md'),'自定义角色保留');
  await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'port-state-fixture',value:'keep',secure:true,expirationDate:Date.now()/1000+86400});await s.cookies.flushStore();});
  await close();
 }finally{await close();await new Promise(r=>server.close(r));}
 server=await occupy(firstPort);
 try{
  const page=await launch(firstPort);const secondPort=Number(new URL(page.url()).port);assert.notEqual(firstPort,secondPort);
  const state=await page.evaluate(()=>window.desktopUiState.call('load'));assert.equal(JSON.parse(state.values.easel_sessions).filter(s=>s.messages.length).length,125);assert.equal(state.values.easel_theme,'light');assert.match(state.values.easel_publish_draft,/跨端口 中文 内容/);
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  const cookie=await app.evaluate(async({session})=>session.fromPartition('persist:aitoearn-cn').cookies.get({name:'port-state-fixture'}));assert.equal(cookie[0].value,'keep');
  assert.equal(await fs.readFile(path.join(data,'workspace/outputs/跨端口验收/成品.txt'),'utf8'),'用户成品保留');assert.equal(await fs.readFile(path.join(data,'workspace/profiles/自定义/profile.md'),'utf8'),'自定义角色保留');
  await page.locator('.sidebar-nav').getByRole('button',{name:'对话',exact:true}).click();
  await page.getByText('保留对话 0',{exact:true}).click();
  await page.getByText('中文历史 0',{exact:true}).waitFor();
  await page.screenshot({path:path.join(out,'MediaSail-0.3.3-跨端口数据保留.png'),animations:'disabled'});
  await fs.writeFile(path.join(out,'MediaSail-0.3.3-state-verification.json'),JSON.stringify({firstPort,secondPort,retainedChats:125,migration:state.migration,data,checkedAt:new Date().toISOString()},null,2));
  console.log('PACKAGED CROSS-PORT STATE PASSED: '+firstPort+' -> '+secondPort+'; 125 chats, draft, actual theme UI, output, persona and isolated Aito cookie retained.');
 }finally{await close();await new Promise(r=>server.close(r));}
})().catch(async e=>{console.error(e);await close();process.exitCode=1;});

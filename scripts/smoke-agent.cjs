// Isolated packaged application tests; fixture feed never offers a real installer.
const {_electron:electron}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../../outputs/MediaSail'),data=path.join(root,'.test-data','Agent 接入 0.4.1 '+Date.now());
const evidence=path.join(out,'verification-0.4.1');fs.mkdirSync(evidence,{recursive:true});
const exe=process.env.EASEL_TEST_EXE||path.join(out,'win-unpacked/MediaSail.exe');
let requests=0,offline=false;
const server=http.createServer((req,res)=>{
 if(req.url.startsWith('/latest.yml')){requests++;if(offline){res.writeHead(503);res.end('offline fixture');return;}
 res.end("version: 0.4.2\nfiles:\n  - url: MediaSail-fixture.exe\n    sha512: "+Buffer.alloc(64).toString('base64')+"\n    size: 1\npath: MediaSail-fixture.exe\nsha512: "+Buffer.alloc(64).toString('base64')+"\nreleaseDate: '2026-10-10T00:00:00.000Z'\n");return;}
 res.writeHead(404);res.end();
});
let app;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function launch(feed){
 const env={...process.env,EASEL_DESKTOP_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:exe,args:[],env,timeout:30000});
 await app.evaluate(({app,session},{feed,data})=>{
  const req=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
  const updater=req('electron-updater').autoUpdater;updater.setFeedURL({provider:'generic',url:feed});
  Object.defineProperty(updater.app,'baseCachePath',{get:()=>data});
  session.fromPartition('persist:aitoearn-cn').protocol.handle('https',()=>new Response('<html><body>AitoEarn layout fixture (no account)</body></html>',{headers:{'content-type':'text/html'}}));
 },{feed,data});
 const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:240000});
 await page.locator('.sidebar-status').filter({hasText:'网关已连接'}).waitFor({timeout:240000});
 const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
 return page;
}
async function helper(info,args,expected=0){
 const helper=path.join(info.skillDir,'scripts/mediasail.ps1');
 const p=cp.spawn('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,...args,'--data-dir',data],{windowsHide:true});
 let stdout='',stderr='';p.stdout.setEncoding('utf8');p.stderr.setEncoding('utf8');p.stdout.on('data',s=>stdout+=s);p.stderr.on('data',s=>stderr+=s);
 const code=await new Promise((r,j)=>{p.on('error',j);p.on('exit',r);});assert.equal(code,expected,stdout+'\n'+stderr);return stdout;
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const feed='http://127.0.0.1:'+server.address().port;
 try{
  let page=await launch(feed);assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.4.1');
  assert.equal(await page.locator('.sidebar-nav .nav-item').first().innerText(),'连接 Agent');
  await page.getByRole('button',{name:'连接 Agent',exact:true}).click();
  await page.getByRole('button',{name:'复制 Skill',exact:true}).click();await page.getByRole('button',{name:'已复制',exact:true}).waitFor();
  const copied=await app.evaluate(({clipboard})=>clipboard.readText());assert.match(copied,/agent-connection.json/);assert.match(copied,/初次接入/);assert.ok(copied.includes(data));
  let info=JSON.parse(fs.readFileSync(path.join(data,'agent-connection.json'),'utf8'));
  assert.equal(info.status,'ready');assert.equal(info.baseUrl,page.url().replace(/\/$/,''));
  const connected=JSON.parse(await helper(info,['check']));assert.equal(connected.connected,true);assert.equal(connected.gateway,true);
  assert.equal(JSON.parse(await(await fetch(info.baseUrl+'/api/agent-info')).text()).instanceId,info.instanceId);
  const zip=await fetch(info.baseUrl+'/api/v1/skill');assert.equal(zip.status,200);
  const zipfile=path.join(data,'skill.zip');fs.writeFileSync(zipfile,Buffer.from(await zip.arrayBuffer()));
  const listing=await helper(info,['python','-m','zipfile','-l',zipfile]);for(const name of ['mediasail/SKILL.md','mediasail/references/api-schema.json','mediasail/scripts/mediasail.ps1'])assert.ok(listing.includes(name));
  const flattened=await(await fetch(info.baseUrl+'/api/platform-skill?format=markdown')).text();assert.match(flattened,/allow_implicit_invocation: false/);assert.ok(!flattened.includes('EASEL_DESKTOP_TOKEN'));
  fs.mkdirSync(path.join(info.profiles,'Agent 测试'),{recursive:true});fs.writeFileSync(path.join(info.profiles,'Agent 测试/identity.md'),'测试画像：内容运营');fs.writeFileSync(path.join(info.profiles,'Agent 测试/memory.md'),'旧经验');
  const persona=await(await fetch(info.baseUrl+'/api/persona/'+encodeURIComponent('Agent 测试'))).json();assert.match(persona.content,/内容运营/);
  const saved=await fetch(info.baseUrl+'/api/persona/'+encodeURIComponent('Agent 测试')+'/file',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({filename:'memory.md',content:'外部 Agent 整理的经验'})});assert.equal(saved.status,200);
  fs.mkdirSync(path.join(info.outputs,'连接验收'),{recursive:true});fs.writeFileSync(path.join(info.outputs,'连接验收/成品.md'),'# 外部 Agent 的成品\n结合测试画像完成。');
  await helper(info,['python','skills/shared/scripts/manifest.py','meta','--topic','连接验收','--title','外部 Agent 成品','--kind','article','--status','ready','--deliverables','成品.md']);
  const tree=await(await fetch(info.baseUrl+'/api/outputs')).json();assert.ok(JSON.stringify(tree).includes('外部 Agent 成品'));
  assert.match(await helper(info,['node','--version']),/v24/);
  // Real clipboard denied: the existing manual-copy dialog must provide identical instructions.
  await page.evaluate(()=>{Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw new Error('clipboard fixture denial');}});});
  await page.getByRole('button',{name:'已复制',exact:true}).click();const manual=page.getByRole('dialog');await manual.waitFor();assert.equal(await manual.getByRole('textbox',{name:'Skill',exact:true}).inputValue(),copied.replace(/\r\n/g,'\n'));await manual.getByRole('button',{name:'完成',exact:true}).click();
  await page.locator('.desktop-update-banner').waitFor({timeout:30000});assert.equal(requests,1,'One automatic check after ready');
  await page.screenshot({path:path.join(evidence,'agent-light.png'),animations:'disabled'});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});await page.screenshot({path:path.join(evidence,'agent-dark.png'),animations:'disabled'});
  const panelEvent=app.waitForEvent('window',{predicate:p=>p!==page});await page.getByRole('button',{name:'查看更新',exact:true}).click();const panel=await panelEvent;await panel.locator('#headline').waitFor();assert.match(await panel.locator('#headline').innerText(),/0.4.2/);
  await panel.close();
  await page.getByRole('button',{name:'内容库',exact:true}).click();await page.getByText('外部 Agent 成品',{exact:true}).first().waitFor();
  await page.getByRole('button',{name:'AI 发布',exact:true}).click();await page.getByTestId('aito-viewport').waitFor();await wait(500);
  let before=await page.getByTestId('aito-viewport').boundingBox();
  await page.getByRole('button',{name:'关闭更新提示，本次运行不再提醒'}).click();await page.locator('.desktop-update-banner').waitFor({state:'detached'});await wait(500);
  let after=await page.getByTestId('aito-viewport').boundingBox();assert.ok(after.y<before.y);
  const view=await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http:'));return w.contentView.children.find(v=>v.webContents&&v.webContents!==w.webContents)?.getBounds();});
  assert.ok(view&&Math.abs(view.y-after.y)<=1,'Embedded AitoEarn view follows banner layout');
  await page.getByRole('button',{name:'连接 Agent',exact:true}).click();await page.reload();await page.getByRole('button',{name:'连接 Agent',exact:true}).click();assert.equal(await page.locator('.desktop-update-banner').count(),0);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http:'));w.close();});
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http:')).isVisible()),false);
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http:'));w.show();});assert.equal(await page.locator('.desktop-update-banner').count(),0);
  const oldId=info.instanceId,oldUrl=info.baseUrl;await app.close();app=null;
  const closed=JSON.parse(await helper(info,['check'],1));assert.equal(closed.connected,false);assert.equal(closed.found.tools,true);
  // Stale but reachable service at the former URL must not pass the identity check.
  const occupied=http.createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({product:'MediaSail',instanceId:'another-app'}));});await new Promise(r=>occupied.listen(Number(new URL(oldUrl).port),'127.0.0.1',r));
  try{
   fs.writeFileSync(path.join(data,'agent-connection.json'),JSON.stringify(info));const stale=JSON.parse(await helper(info,['check'],1));assert.equal(stale.connected,false);
   page=await launch(feed);info=JSON.parse(fs.readFileSync(path.join(data,'agent-connection.json'),'utf8'));assert.notEqual(info.instanceId,oldId);assert.notEqual(info.baseUrl,oldUrl);assert.equal(JSON.parse(await helper(info,['check'])).connected,true);
   await page.locator('.desktop-update-banner').waitFor({timeout:30000});assert.equal(requests,2);assert.equal(fs.readFileSync(path.join(info.profiles,'Agent 测试/memory.md'),'utf8'),'外部 Agent 整理的经验');
   await page.screenshot({path:path.join(evidence,'update-banner.png'),animations:'disabled'});
   // Offline failure is visible in Settings/update window, not a new banner.
   await page.getByRole('button',{name:'关闭更新提示，本次运行不再提醒'}).click();offline=true;await page.evaluate(()=>window.desktopUpdates.openAndCheck());
   await page.waitForFunction(async()=> (await window.desktopUpdates.status()).phase==='error');assert.equal(await page.locator('.desktop-update-banner').count(),0);
   offline=false;await page.evaluate(()=>window.desktopUpdates.openAndCheck());await page.waitForFunction(async()=> (await window.desktopUpdates.status()).phase==='available');
  }finally{await new Promise(r=>occupied.close(r));}
  fs.writeFileSync(path.join(evidence,'agent-result.json'),JSON.stringify({passed:true,version:'0.4.1',date:new Date().toISOString(),automaticChecks:2,totalMetadataRequests:requests,oldUrl,newUrl:info.baseUrl,checks:['copied prompt','manual copy','full skill zip','profile read/write','manifest and content library','bundled Python/Node','light/dark','automatic banner','shared updater','dismiss across reload and tray','restart reminder','AitoEarn bounds','offline recovery','port change','stale identity rejection','offline paths']},null,2));
  console.log('AGENT AND STARTUP BANNER INTEGRATION PASSED');
 }finally{if(app)await app.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.closeAllConnections();server.close();});

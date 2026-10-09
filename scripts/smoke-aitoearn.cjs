const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data/AI 发布 e2e-'+Date.now());
const executable=process.env.EASEL_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe');
const env={...process.env,EASEL_DESKTOP_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
const output=path.join(data,'workspace/outputs/测试 图文');fs.mkdirSync(output,{recursive:true});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZxkAAAAASUVORK5CYII=','base64');
fs.writeFileSync(path.join(output,'甲.png'),png);fs.writeFileSync(path.join(output,'乙.png'),Buffer.concat([png,Buffer.from('fixture-B')]));
fs.writeFileSync(path.join(output,'成品.md'),'第一行正文\n第二行 #测试');
fs.writeFileSync(path.join(output,'.easel.json'),JSON.stringify({title:'桌面带入测试',summary:'摘要',kind:'xhs-note',deliverables:['成品.md','甲.png','乙.png']}));
cp.execFileSync(path.join(root,'build/runtime/ffmpeg/ffmpeg.exe'),['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=320x180:d=1','-pix_fmt','yuv420p','-c:v','libx264','-y',path.join(output,'测试 视频.mp4')],{windowsHide:true});
async function installFixture(app,seed){
 await app.evaluate(async({session},seed)=>{
  globalThis.aitoFixture=seed||{groups:[],drafts:[],uploads:0,creates:0,requests:[],assetsAuth:[],signed:0,failPage:false,hold:false};
  const sess=session.fromPartition('persist:aitoearn-cn');
  await sess.protocol.handle('https',async request=>{
   const state=globalThis.aitoFixture,url=new URL(request.url),route=url.pathname;state.requests.push(request.method+' '+route);
   const json=data=>new Response(JSON.stringify({code:0,data}),{headers:{'Content-Type':'application/json'}});
   if(url.hostname==='assets.aitoearn.cn'){
    if(request.method==='PUT'){state.assetsAuth.push(request.headers.get('authorization'));await request.arrayBuffer();state.uploads++;if(state.hold)await new Promise(resolve=>{globalThis.releaseAitoUpload=resolve;});return new Response('',{status:200});}
    return new Response(Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZxkAAAAASUVORK5CYII='),c=>c.charCodeAt(0)),{headers:{'Content-Type':'image/png'}});
   }
   if(route.startsWith('/api/')){
    if(request.headers.get('authorization')!=='Bearer desktop-fixture-only')return new Response(JSON.stringify({code:401,message:'fixture login required'}),{status:401});
    const body=request.method==='POST'?await request.json():null;
    if(route==='/api/user/mine')return json({id:'fixture-user',name:'本地测试账号'});
    if(route.startsWith('/api/material/group/list/'))return json({list:state.groups,total:state.groups.length});
    if(route==='/api/material/group'){const group={id:'fixture-group',name:body.name};state.groups.push(group);return json(group);}
    if(route==='/api/assets/uploadSign'){const id='asset-'+(++state.signed);return json({id,url:'https://assets.aitoearn.cn/'+id,uploadUrl:'https://assets.aitoearn.cn/upload/'+id});}
    const asset=route.match(/^\/api\/assets\/([^/]+)\/confirm$/);if(asset)return json({url:'https://assets.aitoearn.cn/'+asset[1]});
    if(route.startsWith('/api/material/list/'))return json({list:state.drafts,total:state.drafts.length});
    if(route==='/api/material'&&request.method==='POST'){state.creates++;const draft={...body,id:'draft-'+state.creates};state.drafts.push(draft);return json({id:draft.id});}
    throw new Error('Unexpected API: '+request.method+' '+route);
   }
   if(state.failPage)return Response.error();
   const cards=state.drafts.map(d=>`<article data-testid="draftbox-draft-card" onclick="document.querySelector('#opened').textContent='已打开草稿'" style="padding:15px;border:1px solid #aaa"><img src="${d.coverUrl||''}" width="50"><p>${d.title}</p></article>`).join('');
   const html=`<!doctype html><html lang="zh"><body style="font-family:Arial;padding:30px;background:#f4f5f7"><h1>AitoEarn 测试站点</h1><p>此页面仅用于本地自动化验证，没有连接真实账号。</p><button id="login" onclick="localStorage.setItem('User',JSON.stringify({state:{token:'desktop-fixture-only',userInfo:{id:'fixture-user'}}}));document.querySelector('#login-state').textContent='测试账号已登录'">登录测试账号</button><span id="login-state"></span><button id="popup" onclick="window.open('https://accounts.example.test/auth')">授权弹窗测试</button><textarea id="editing" placeholder="验证切换时保留编辑状态"></textarea><div id="opened"></div>${cards}</body></html>`;
   return new Response(html,{headers:{'Content-Type':'text/html;charset=utf-8'}});
  });
 },seed);
}
async function remote(app,script){return app.evaluate(({webContents},script)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith('https://aitoearn.cn'));if(!wc)throw new Error('Remote view missing');return wc.executeJavaScript(script);},script);}
async function launch(seed){
 const app=await electron.launch({executablePath:executable,args:process.env.EASEL_TEST_EXE?[]:[root],env,timeout:30000});
 await installFixture(app,seed);const page=await app.firstWindow();page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
 await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();
 const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
 return {app,page};
}
async function status(page){return page.evaluate(()=>window.desktopAito.call('status'));}
async function waitJob(page,predicate){for(let i=0;i<150;i++){const s=await status(page);if(predicate(s))return s;await page.waitForTimeout(200);}throw new Error('Timed out waiting for import: '+JSON.stringify(await status(page)));}
(async()=>{
 let app,page,seed;
 try{
  ({app,page}=await launch());
  await page.getByText('内容库',{exact:true}).first().click();
  await page.getByRole('button',{name:'发送到 AI 发布',exact:true}).first().click();
  await page.getByRole('textbox',{name:'发送标题'}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'发送标题'}).inputValue(),'桌面带入测试');
  assert.match(await page.getByRole('textbox',{name:'发送正文'}).inputValue(),/第一行正文/);
  await page.getByRole('button',{name:'下移图片 1',exact:true}).click();
  await page.getByRole('button',{name:'打开页面登录',exact:true}).click();
  await page.getByTestId('aito-page').waitFor();
  for(let i=0;i<50;i++){try{if(await remote(app,"Boolean(document.querySelector('#login'))"))break;}catch{}await page.waitForTimeout(200);}
  await remote(app,"document.querySelector('#login').click()");
  assert.equal(await remote(app,"typeof window.desktopAito + ':' + typeof require"),'undefined:undefined');
  console.log('REMOTE PAGE SANDBOX AND LOGIN SESSION VERIFIED');
  await page.getByRole('button',{name:'待发送内容',exact:true}).click();
  await page.getByRole('button',{name:'创建 / 使用「Easel 导入」',exact:true}).click();
  await page.getByRole('combobox',{name:'AitoEarn 草稿箱'}).selectOption('fixture-group');
  await page.getByRole('button',{name:'保存到 AitoEarn 草稿',exact:true}).click();
  const completed=await waitJob(page,s=>s.jobs[0]?.status==='done'&&!s.busy);
  seed=await app.evaluate(()=>globalThis.aitoFixture);
  assert.equal(seed.creates,1);assert.equal(seed.uploads,2);assert.deepEqual(seed.assetsAuth,[null,null]);
  assert.equal(seed.drafts[0].title,'桌面带入测试');assert.equal(seed.drafts[0].desc,'第一行正文\n第二行 #测试');
  assert.equal(completed.jobs[0].files[0].name,'乙.png');
  assert.ok(seed.requests.every(r=>!r.includes('/publish')));console.log('REAL ELECTRON IPC, AUTHENTICATED ADAPTER AND STREAMING UPLOAD PASSED (MOCK REMOTE)');
  await page.waitForTimeout(1200);
  await remote(app,"document.querySelector('#editing').value='保留编辑进度'");
  await page.getByText('内容库',{exact:true}).first().click();await page.getByText('AI 发布',{exact:true}).first().click();
  assert.equal(await remote(app,"document.querySelector('#editing').value"),'保留编辑进度');
  console.log('SWITCHING PAGES PRESERVES REMOTE EDITOR');
  await page.getByRole('button',{name:'待发送内容',exact:true}).click();
  await page.getByRole('button',{name:'保存到 AitoEarn 草稿',exact:true}).click();
  await page.waitForTimeout(500);assert.equal(await app.evaluate(()=>globalThis.aitoFixture.creates),1);
  await page.getByRole('button',{name:'待发送内容',exact:true}).click();
  await page.getByRole('button',{name:'视频',exact:true}).click();
  await page.getByRole('textbox',{name:'发送标题'}).fill('视频带入测试');
  await page.getByRole('combobox',{name:'发送视频'}).selectOption('测试 图文/测试 视频.mp4');
  await page.getByRole('button',{name:'使用视频首帧作封面',exact:true}).click();
  await page.getByRole('button',{name:'使用视频首帧作封面',exact:true}).waitFor({timeout:20000});
  assert.match(await page.getByRole('combobox',{name:'发送封面'}).inputValue(),/_aitoearn-cover-/);
  await page.screenshot({path:path.resolve(root,'../../outputs/ElectronEasel/AI发布-成品带入.png'),fullPage:true});
  await page.getByRole('button',{name:'保存到 AitoEarn 草稿',exact:true}).click();
  await waitJob(page,s=>s.jobs[0]?.status==='done'&&!s.busy);
  const videoDraft=await app.evaluate(()=>globalThis.aitoFixture.drafts.at(-1));assert.equal(videoDraft.type,'video');assert.equal(videoDraft.mediaList[0].type,'video');assert.ok(videoDraft.coverUrl);
  console.log('VIDEO IMPORT AND REAL FFMPEG COVER EXTRACTION VERIFIED');
  // An upload in flight contributes to the existing exit confirmation and continues in the tray.
  await app.evaluate(()=>{globalThis.aitoFixture.hold=true;});
  fs.writeFileSync(path.join(output,'乙.png'),Buffer.concat([png,Buffer.from('changed-B-for-tray')]));
  await page.getByRole('button',{name:'待发送内容',exact:true}).click();
  await page.getByRole('button',{name:'图文',exact:true}).click();
  await page.getByRole('textbox',{name:'发送正文'}).fill('托盘后台发送测试');
  await page.getByRole('button',{name:'保存到 AitoEarn 草稿',exact:true}).click();
  await waitJob(page,s=>s.jobs[0]?.status==='uploading');
  await app.evaluate(({dialog,app})=>{globalThis.originalDialog=dialog.showMessageBox;globalThis.exitPrompts=0;dialog.showMessageBox=async()=>{globalThis.exitPrompts++;return {response:0};};app.quit();});
  await page.waitForTimeout(800);assert.equal(await app.evaluate(()=>globalThis.exitPrompts),1);
  await app.evaluate(({BrowserWindow,dialog})=>{dialog.showMessageBox=globalThis.originalDialog;BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1')).close();globalThis.aitoFixture.hold=false;globalThis.releaseAitoUpload?.();});
  await waitJob(page,s=>s.jobs[0]?.status==='done'&&!s.busy);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].show());
  console.log('AI UPLOAD EXIT CONFIRMATION AND TRAY BACKGROUND COMPLETION VERIFIED');
  await page.waitForTimeout(1200);
  await remote(app,"document.querySelector('#popup').click()");await page.waitForTimeout(400);
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),2);
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('https://accounts.example.test')).close());
  await app.evaluate(()=>{globalThis.aitoFixture.failPage=true;});await page.getByRole('button',{name:'刷新',exact:true}).click();
  await page.getByRole('button',{name:'重试加载',exact:true}).waitFor({timeout:15000});
  await app.evaluate(()=>{globalThis.aitoFixture.failPage=false;});await page.getByRole('button',{name:'重试加载',exact:true}).click();
  await page.waitForTimeout(700);
  assert.equal((await status(page)).web.error,'');console.log('OAUTH POPUP AND NETWORK RETRY VERIFIED');
  await page.screenshot({path:path.resolve(root,'../../outputs/ElectronEasel/AI发布-模拟流程.png'),fullPage:true});
  seed=await app.evaluate(()=>globalThis.aitoFixture);await app.close();app=null;
  ({app,page}=await launch(seed));
  await page.getByText('AI 发布',{exact:true}).first().click();await page.waitForTimeout(800);
  const connection=await page.evaluate(()=>window.desktopAito.call('connection'));assert.equal(connection.user.id,'fixture-user');assert.equal(connection.selectedGroup,'fixture-group');
  assert.equal((await status(page)).jobs.filter(j=>j.status==='done').length,3);
  assert.equal(await remote(app,"JSON.parse(localStorage.getItem('User')).state.token"),'desktop-fixture-only');
  console.log('LOGIN, SELECTED GROUP AND IMPORT RECORDS SURVIVE RESTART');
 }finally{if(app)await app.close();}
 console.log('AITO E2E PASSED — REMOTE WEBSITE AND API MOCKED, NO REAL ACCOUNT OR PUBLICATION');
})().catch(e=>{console.error(e);process.exitCode=1;});

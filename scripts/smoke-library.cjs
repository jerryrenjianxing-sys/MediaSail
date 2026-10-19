// Electron UI, isolated Documents library, real local service and synthetic
// platform responses only. Never opens the daily installation or real accounts.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const output=path.resolve(root,require('../package.json').build.directories.output);
const executable=path.resolve(process.env.EASEL_TEST_EXE||path.join(output,'win-unpacked/MediaSail.exe'));
const development=path.basename(executable).toLowerCase()==='electron.exe';
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','资料库 UI '+version+' '+Date.now());
const bootstrap=path.join(run,'隔离 定位资料'),libraryRoot=path.join(run,'共用 资料库 中文');
const data=path.join(libraryRoot,'runtime'),workspace=path.join(libraryRoot,'workspace');
const evidence=path.resolve(process.env.EASEL_LIBRARY_EVIDENCE||path.join(root,'docs/images',version));
const persona='资料库 测试画像',project='外部 Agent 合成报告';
const checks=[],errors=[],shots=[],whoamiRequests=[],wireWhoamiRequests=[];let app,page,info,analyticsReads=0,douyinState='login_required';
const stamp=Math.floor(Date.now()/1000);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function contained(base,file){const relative=path.relative(path.resolve(base),path.resolve(file));return relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);}
for(const forbidden of ['D:\\mediasail',path.join(process.env.LOCALAPPDATA||os.tmpdir(),'Programs/MediaSail')]){
  assert.ok(executable.toLowerCase()!==path.resolve(forbidden).toLowerCase()&&!contained(forbidden,executable),'Refusing daily installation');
}
assert.ok(contained(path.join(os.homedir(),'Documents','MediaSail 隔离验证'),run));
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');}
async function until(test,message,timeout=20000){const deadline=Date.now()+timeout;let last;do{try{if(await test())return;}catch(e){last=e;}await sleep(150);}while(Date.now()<deadline);throw Error(message+(last?': '+last.message:''));}
function record(name){checks.push(name);console.log('LIBRARY UI: '+name);}
async function api(url,options){const response=await fetch(info.baseUrl+url,options);const value=await response.json();assert.ok(response.ok,url+': '+JSON.stringify(value));return value;}
async function shot(name){const file=path.join(evidence,name+'.png');await page.screenshot({path:file,animations:'disabled'});shots.push(file);}
async function theme(value){if(await page.locator('html').getAttribute('data-theme')!==value)await page.locator('.skill-header .skill-theme').click();await until(async()=>await page.locator('html').getAttribute('data-theme')===value,'Theme '+value);await sleep(850);}
async function nav(name){await page.locator('.sidebar-nav').getByRole('button',{name,exact:true}).click();}
async function settings(){await page.getByRole('button',{name:'设置',exact:true}).click();await page.locator('.settings-nav').getByRole('button',{name:'资料库',exact:true}).click();}
async function helper(args){const result=cp.spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(info.skillDir,'scripts/mediasail.ps1'),...args,'--data-dir',data],{encoding:'utf8',timeout:30000,windowsHide:true});assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''));return result.stdout;}
async function close(){if(app){await app.close();app=null;}}
async function fixtureRoutes(){
  await page.route('**/api/accounts/*/whoami*',async route=>{
    const url=new URL(route.request().url());whoamiRequests.push(url.pathname+url.search);
    const douyin=url.pathname.includes('/douyin/'),state=douyin?douyinState:'unknown';
    await route.fulfill({json:{loggedIn:state==='verified',verificationStatus:state,accountId:state==='verified'?'fixture-douyin':null,name:state==='verified'?'合成抖音账号':'',avatar:'',checkedAt:stamp,cached:false,errorCode:state==='unknown'?'FIXTURE_OFFLINE':state==='login_required'?'LOGIN_REQUIRED':'',message:state==='unknown'?'隔离样本：暂时无法验证':state==='login_required'?'隔离样本：创作者后台需要登录':''}});
  });
  await page.route('**/api/trends*',route=>route.fulfill({json:{trends:[],updated:stamp}}));
  await page.route('**/api/analytics/douyin',route=>{
    analyticsReads++;
    return route.fulfill({json:{platform:'douyin',name:'抖音',nickname:'合成抖音账号',loggedIn:analyticsReads===1,verificationStatus:analyticsReads===1?'verified':'unknown',accountId:analyticsReads===1?'fixture-douyin':null,checkedAt:stamp,cached:false,errorCode:analyticsReads===1?'':'FIXTURE_OFFLINE',message:analyticsReads===1?'':'隔离样本：本次网络不可用',followers:analyticsReads===1?123:null,likes:analyticsReads===1?456:null,following:null,posts:analyticsReads===1?7:null,metrics:[],notes:[],growth:{last:null,day:null,week:null,month:null,year:null},metrics_title:'隔离样本指标',source:'douyin-creator',fetched_at:stamp}});
  });
}
async function launch(){
  const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'隔离宿主 AppData'),APPDATA:path.join(run,'隔离宿主 Roaming')};
  delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:development?[root]:[],env,timeout:60000});
  page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('request',request=>{if(request.url().includes('/whoami'))wireWhoamiRequests.push(request.url());});await fixtureRoutes();
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
  await until(async()=>{info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));return info.status==='ready';},'Isolated library service ready');
}
(async()=>{
  await fs.access(executable);await fs.mkdir(evidence,{recursive:true});
  const prepared=await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
  const preparedId=prepared.libraryId;
  await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3',sessions:0,copies:0,sources:[]},values:{easel_sessions:'[]',easel_theme:'light',easel_onboarding_seen:'1',mediasail_selected_profile:persona}});
  for(const file of ['identity.md','audience.md','style.md','platforms.md','preferences.md','memory.md'])await write(path.join(workspace,'profiles',persona,file),'# 合成验收资料\n'+file+'\n不包含真实账号。');
  try{
    await launch();assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
    assert.equal(info.libraryRoot,libraryRoot);assert.equal(info.workspace,workspace);assert.equal(info.outputs,path.join(workspace,'outputs'));
    assert.equal(info.profiles,path.join(workspace,'profiles'));assert.equal(info.skillDir,path.join(libraryRoot,'agent-skill/mediasail'));
    assert.equal(await page.locator('.sidebar').count(),0);await theme('light');await shot('home-light');await theme('dark');await shot('home-dark');await theme('light');
    record('MediaSail Agent home, animated themes, shared library paths, independent Documents location');
    const connected=JSON.parse(await helper(['check']));assert.equal(connected.connected,true);assert.equal(connected.paths.outputs,info.outputs);
    assert.equal((await api('/api/agent-info')).instanceId,info.instanceId);
    const profile=(await api('/api/persona/'+encodeURIComponent(persona)+'/files')).files;assert.equal(profile.length,6);
    record('Agent helper and real business APIs share the selected workspace');
    await page.getByRole('button',{name:'控制台',exact:true}).click();await page.locator('.sidebar').waitFor();await settings();
    const status=await page.evaluate(()=>window.desktopLibrary.call('status'));
    for(const field of ['mode','libraryRoot','dataRoot','workspace','libraryId','pending','defaultLibraryRoot','conflicts'])assert.ok(field in status,field);
    assert.equal(status.mode,'library');assert.equal(status.libraryId,preparedId);assert.equal(status.libraryRoot,libraryRoot);
    await page.getByText(libraryRoot,{exact:true}).waitFor();await shot('settings-library-light');
    await page.locator('.settings-close').click();await nav('连接 Agent');await theme('dark');await page.getByRole('button',{name:'控制台',exact:true}).click();await settings();await shot('settings-library-dark');await page.locator('.settings-close').click();
    record('Settings shows actual selected library, runtime, workspace, identity and all status fields in both themes');
    await write(path.join(info.outputs,project,'报告.md'),'# 合成运营报告\n由独立文件操作生成，再读取业务界面核验。');
    await helper(['python','skills/shared/scripts/manifest.py','meta','--topic',project,'--profile',persona,'--title','合成报告 · 外部 Agent 回存','--kind','article','--status','ready','--deliverables','报告.md']);
    const outputs=await api('/api/outputs');assert.equal(outputs.find(row=>row.name===project).meta.deliverablePaths[0],project+'/报告.md');
    assert.match((await api('/api/output/'+encodeURIComponent(project)+'/'+encodeURIComponent('报告.md'))).content,/合成运营报告/);
    await nav('内容库');await page.getByText('合成报告 · 外部 Agent 回存',{exact:true}).first().waitFor();await shot('content-library');
    record('Agent-created Chinese project and real manifest helper are readable and listed');
    await nav('画像');await page.getByRole('button',{name:'✏️ 编辑资料',exact:true}).click();
    const dimension=page.locator('.profile-dim').filter({hasText:'身份定位'}).first(),field=dimension.locator('textarea');await field.fill('尚未保存的合成画像编辑');
    assert.equal(await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),true);
    await settings();await page.getByRole('button',{name:'更换资料库',exact:true}).click();await page.getByRole('alert').filter({hasText:'还有未保存的编辑或表单'}).waitFor();
    const refusal=await page.evaluate(async targetRoot=>{try{await window.desktopLibrary.call('change',{targetRoot});return '';}catch(e){return e.message;}},path.join(run,'不应创建的更换目标'));
    assert.match(refusal,/未保存/);await assert.rejects(fs.access(path.join(bootstrap,'library-migration.json')),{code:'ENOENT'});
    await shot('unsaved-library-change-protected');await page.locator('.settings-close').click();assert.equal(await field.inputValue(),'尚未保存的合成画像编辑');
    await dimension.getByRole('button',{name:'保存',exact:true}).click();await until(async()=>!await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),'Saved profile clears library-change guard');
    assert.equal((await api('/api/persona/'+encodeURIComponent(persona)+'/files')).files.find(row=>row.filename==='identity.md').content,'尚未保存的合成画像编辑');
    record('Dirty profile blocks renderer and main-process library change; draft survives; save removes guard');
    await app.evaluate(({dialog},target)=>{globalThis.__librarySmokePicker=dialog.showOpenDialog;dialog.showOpenDialog=async()=>({canceled:false,filePaths:[target]});},path.join(run,'可选择的新位置'));
    const originalLocation=await fs.readFile(path.join(bootstrap,'library-location.json'),'utf8');
    await settings();await page.getByRole('button',{name:'更换资料库',exact:true}).click();await page.getByRole('button',{name:'使用此资料库并重启',exact:true}).waitFor();await page.getByText(/请先保存编辑并结束软件内任务/).waitFor();
    await page.getByRole('button',{name:'取消',exact:true}).click();await assert.rejects(fs.access(path.join(bootstrap,'library-migration.json')),{code:'ENOENT'});
    assert.equal(await fs.readFile(path.join(bootstrap,'library-location.json'),'utf8'),originalLocation);await assert.rejects(fs.access(path.join(run,'可选择的新位置')),{code:'ENOENT'});
    await app.evaluate(({dialog})=>{dialog.showOpenDialog=globalThis.__librarySmokePicker;delete globalThis.__librarySmokePicker;});await page.locator('.settings-close').click();
    record('Native picker bridge previews exact selected target; cancellation leaves the current library unchanged');
    const localBackup=path.join(data,'upgrade-backups','ui-fixture','local','skills/合成方法.md'),incoming=path.join(data,'upgrade-backups','ui-fixture','incoming','skills/合成方法.md');
    await write(localBackup,'合成本地修改');await write(incoming,'合成新版原件');
    await write(path.join(data,'installed-manifest.json.conflicts.json'),{conflicts:[{path:'skills/合成方法.md',local:localBackup,incoming}]});
    await settings();await page.locator('summary').filter({hasText:'1 个工作文件'}).click();
    await page.getByText('当前工作文件：'+workspace+'/skills/合成方法.md',{exact:true}).waitFor();await page.getByText('新版原件：'+incoming,{exact:true}).waitFor();await shot('settings-upgrade-conflict');await page.locator('.settings-close').click();
    record('Expandable upgrade conflicts expose working file, local backup and incoming original paths');
    const jsonOptions=value=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
    const idea=await api('/api/ideas',jsonOptions({title:'合成选题基线',note:'原备注',status:'pending'}));
    await nav('工作台');await page.getByRole('button',{name:'记选题',exact:true}).click();const ideaCard=page.locator('.idea-card').filter({hasText:'合成选题基线'});await ideaCard.hover();await ideaCard.getByRole('button',{name:'编辑',exact:true}).click();
    const ideaField=page.getByPlaceholder('想做的内容 / 角度');await ideaField.fill('选题尚未保存的编辑');assert.equal(await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),true);
    const ideaBlocked=await page.evaluate(async targetRoot=>{try{await window.desktopLibrary.call('change',{targetRoot});return '';}catch(e){return e.message;}},path.join(run,'选题不应更换'));
    assert.match(ideaBlocked,/未保存/);
    await api('/api/ideas/'+idea.id,{...jsonOptions({title:'外部改过的选题',note:'外部备注',status:'pending'}),method:'PUT'});await sleep(650);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('status').filter({hasText:'这个选题已有外部更新'}).waitFor();assert.equal(await ideaField.inputValue(),'选题尚未保存的编辑');
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('.modal').getByRole('button',{name:'保存',exact:true}).click();assert.equal(await ideaField.inputValue(),'选题尚未保存的编辑');await page.locator('.modal').getByRole('button',{name:'取消',exact:true}).click();
    const today=new Date().toLocaleDateString('en-CA'),schedule=await api('/api/schedule',jsonOptions({title:'合成排期基线',date:today,status:'draft'}));
    await nav('工作台');await page.getByRole('button',{name:'排日历',exact:true}).click();await page.locator('.cal-event').filter({hasText:'合成排期基线'}).first().click();
    const scheduleField=page.getByPlaceholder('要发什么内容');await scheduleField.fill('排期尚未保存的编辑');assert.equal(await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),true);
    const calendarBlocked=await page.evaluate(async targetRoot=>{try{await window.desktopLibrary.call('change',{targetRoot});return '';}catch(e){return e.message;}},path.join(run,'排期不应更换'));
    assert.match(calendarBlocked,/未保存/);
    await api('/api/schedule/'+schedule.id,{...jsonOptions({title:'外部改过的排期',date:today,status:'draft'}),method:'PUT'});await sleep(650);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.getByRole('status').filter({hasText:'这个排期已有外部更新'}).waitFor();assert.equal(await scheduleField.inputValue(),'排期尚未保存的编辑');
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('.modal').getByRole('button',{name:'保存',exact:true}).click();assert.equal(await scheduleField.inputValue(),'排期尚未保存的编辑');await page.locator('.modal').getByRole('button',{name:'取消',exact:true}).click();
    record('Idea/calendar drafts block library changes and survive focus refresh and declined external-overwrite confirmation');
    await nav('账号');const card=page.locator('.account-card').filter({has:page.locator('.account-card-name',{hasText:'抖音'})});await card.getByText('需要登录',{exact:true}).waitFor();await sleep(350);douyinState='verified';
    const forced=()=>whoamiRequests.filter(url=>url.includes('/douyin/whoami?force=1')).length;
    const before=forced();await card.getByRole('button',{name:'校验账号',exact:true}).click();await until(()=>forced()>before,'First force request observed');await card.getByText('✓ 已验证登录',{exact:true}).waitFor();douyinState='login_required';
    const second=forced();await card.getByRole('button',{name:'校验账号',exact:true}).click();await until(()=>forced()>second,'Second force request observed');await card.getByText('需要登录',{exact:true}).waitFor();
    record('Manual verification requests force=1; same-second negative replaces cached success');
    await nav('工作台');await page.locator('.ana-plats').getByRole('button',{name:'抖音',exact:true}).click();await until(async()=>await page.locator('.ana-stat-val').first().innerText()==='123','Synthetic valid analytics visible');await page.locator('.dash-card-wide').scrollIntoViewIfNeeded();
    await page.locator('.ana-plats').getByRole('button',{name:'抖音',exact:true}).click();await page.getByRole('status').filter({hasText:'本次刷新未成功'}).waitFor();assert.equal(await page.locator('.ana-stat-val').first().innerText(),'123');await page.getByText(/上次采集：/).waitFor();await shot('analysis-last-result-preserved');
    record('Unknown refresh retains prior values and original sample time instead of false zero');
    await app.evaluate(({shell})=>{globalThis.__libraryExternal=[];shell.openExternal=async url=>{globalThis.__libraryExternal.push(url);};});
    const currentText=await page.locator('.page-host').innerText();await page.locator('.sidebar-nav').getByRole('link',{name:'AI 发布 ↗',exact:true}).click();
    await until(async()=>(await app.evaluate(()=>globalThis.__libraryExternal)).length===1,'External browser request');
    assert.deepEqual(await app.evaluate(()=>globalThis.__libraryExternal),['https://aitoearn.cn/zh-CN']);
    assert.equal(await page.locator('.page-host').innerText(),currentText);
    const views=await app.evaluate(({webContents})=>webContents.getAllWebContents().map(w=>w.getURL()));
    assert.ok(!views.some(url=>url.startsWith('https://aitoearn.cn/')));assert.equal(await page.evaluate(()=>typeof window.desktopAito),'undefined');
    record('AI Publish uses the fixed external website without navigation, embedded view or upload runtime');
    assert.deepEqual(errors,[]);await close();
    await write(path.join(evidence,'library-ui-result.json'),{passed:true,version,executable,run,libraryRoot,data,workspace,testedAt:new Date().toISOString(),checks,shots,errors,whoamiRequests,platformResponsesAreSynthetic:true,realLocalService:true,realPackagedApplication:!development,realAccountsUsed:false,publicationPerformed:false,scope:'Selected-library UI and library-change preflight; first selection, direct opening and upgrade covered by separate tests; no data migration performed'});
    console.log('LIBRARY UI PASSED: '+path.join(evidence,'library-ui-result.json'));
  }catch(error){if(page)await page.screenshot({path:path.join(evidence,'library-ui-failure.png'),animations:'disabled'}).catch(()=>{});await write(path.join(evidence,'library-ui-result.json'),{passed:false,version,executable,run,checks,errors,whoamiRequests,wireWhoamiRequests,error:error.stack});throw error;}
  finally{await close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

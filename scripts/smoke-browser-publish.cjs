// Actual packaged UI, isolated synthetic library. Only Electron shell targets are
// captured; this script never launches a real browser or opens the daily app.
'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),version=pkg.version;
const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','浏览器发布 '+version+' '+Date.now());
const bootstrap=path.join(run,'独立 定位'),libraryRoot=path.join(run,'共享 中文 空格资料库'),data=path.join(libraryRoot,'runtime');
const evidence=path.join(root,'docs/images',version),summary=path.join(root,'docs/evidence','browser-publish-'+version+'.json');
const project='早餐咖啡 中文 项目',title='早餐咖啡图文发布样本';
const checks=[],shots=[],errors=[],dialogs=[],requests=[],shellCalls=[];
let app,page,info,outputs,oldHistory,partitionMarker,originalHistory,originalMarker,originalManifest;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');}
async function until(test,message,timeout=25000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await test())return;}catch(error){last=error;}await sleep(150);}throw Error(message+(last?': '+last.message:''));}
function record(name){checks.push(name);console.log('BROWSER PUBLISH: '+name);}
async function shot(name){const file='browser-'+name+'.png';await page.screenshot({path:path.join(evidence,file),animations:'disabled'});shots.push(file);}
const card=()=>page.getByTestId('project-card').filter({has:page.getByText(title,{exact:true})});
const editor=()=>page.getByRole('dialog',{name:'编辑归档信息',exact:true});
const publishLink=()=>page.locator('.sidebar-nav').getByRole('link',{name:'AI 发布 ↗',exact:true});
async function getCalls(){return await app.evaluate(()=>globalThis.__browserPublishCapture.calls);}
async function shellFailure(kind,value){await app.evaluate((_electron,input)=>{globalThis.__browserPublishCapture[input.kind]=input.value;},{kind,value});}
async function assertNoRemote(){
  assert.equal(await page.evaluate(()=>typeof window.desktopAito),'undefined');
  const urls=await app.evaluate(({webContents})=>webContents.getAllWebContents().map(contents=>contents.getURL()));
  assert.ok(!urls.some(url=>/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/.test(url)),'No remote embedded renderer: '+JSON.stringify(urls));
  assert.deepEqual(requests.filter(row=>/aitoearn|aliyuncs/i.test(row.url)),[],'No AitoEarn web requests');
  return urls;
}
async function retained(historyBytes=originalHistory){
  assert.deepEqual(await fs.readFile(oldHistory),historyBytes,'Old imports bytes retained');
  assert.deepEqual(await fs.readFile(partitionMarker),originalMarker,'Synthetic partition marker retained');
  assert.deepEqual(await fs.readFile(path.join(outputs,project,'.easel.json')),originalManifest,'Project metadata never changed');
  assert.deepEqual((await fs.readdir(path.dirname(partitionMarker))).sort(),['fixture-only.txt'],'No embedded partition was initialized');
}
async function launch(){
  const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立 LocalAppData'),APPDATA:path.join(run,'独立 Roaming')};
  delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>requests.push({method:request.method(),url:request.url()}));
  // Unexpected browser dialogs are declined, never automatically approved.
  page.on('dialog',async dialog=>{dialogs.push({type:dialog.type(),message:dialog.message()});await dialog.dismiss();});
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
  info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(info.version,version);assert.equal(info.libraryRoot,libraryRoot);
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),data);
  await app.evaluate(({shell})=>{
    globalThis.__browserPublishCapture={calls:[],failExternal:false,failPath:false,external:shell.openExternal,openPath:shell.openPath};
    shell.openExternal=async url=>{const state=globalThis.__browserPublishCapture;state.calls.push({kind:'external',target:url,failed:state.failExternal});if(state.failExternal)throw Error('隔离样本：默认浏览器不可用');};
    shell.openPath=async directory=>{const state=globalThis.__browserPublishCapture;state.calls.push({kind:'path',target:directory,failed:state.failPath});return state.failPath?'隔离样本：系统拒绝打开文件夹':'';};
  });
}
async function openLibrary(){
  await page.evaluate(name=>{location.hash='#/outputs/'+encodeURIComponent(name);},project);
  await page.getByTestId('content-library').waitFor();await page.getByText('内容库',{exact:true}).last().click();await card().waitFor();
  await page.getByRole('button',{name:'创作内容',exact:true}).click();await page.getByLabel('搜索内容库',{exact:true}).fill('早餐');await until(async()=>await page.getByTestId('project-card').count()===1,'One filtered project');
}
async function assertFilters(){assert.equal(await page.getByLabel('搜索内容库',{exact:true}).inputValue(),'早餐');assert.equal(await page.getByRole('button',{name:'创作内容',exact:true}).getAttribute('aria-pressed'),'true');}
async function theme(value){if(await page.locator('html').getAttribute('data-theme')!==value)await page.locator('.sidebar-header button').first().click();await until(async()=>await page.locator('html').getAttribute('data-theme')===value,'theme '+value);await sleep(900);}
async function historySettings(){await page.locator('.settings-gear').click();await page.locator('.settings-nav').getByRole('button',{name:'历史存档',exact:true}).click();await page.getByRole('button',{name:'打开旧 AI 发布记录目录',exact:true}).waitFor();}
async function close(){
  if(!app)return;
  // If a failed assertion left the one edited field dirty, restore its baseline
  // in the renderer and cancel the form before a normal exit. No file is saved.
  if(page&&!page.isClosed()&&await editor().count()){
    await editor().getByLabel('标题',{exact:true}).fill(title);
    await editor().getByRole('button',{name:'取消',exact:true}).click();
    await editor().waitFor({state:'hidden'});
  }
  shellCalls.push(...await getCalls());
  await app.evaluate(({shell})=>{const state=globalThis.__browserPublishCapture;shell.openExternal=state.external;shell.openPath=state.openPath;delete globalThis.__browserPublishCapture;});
  await app.close();app=null;page=null;
}
(async()=>{
  assert.ok(require('semver').gte(version,'0.5.5'),'Browser publishing evidence requires version 0.5.5 or later');
  for(const forbidden of ['D:\\mediasail',path.join(process.env.LOCALAPPDATA||os.tmpdir(),'Programs','MediaSail')])assert.ok(!executable.toLowerCase().startsWith(path.resolve(forbidden).toLowerCase()+path.sep),'Refusing daily installation');
  assert.equal(path.basename(executable),'MediaSail.exe');await fs.access(executable);await fs.mkdir(evidence,{recursive:true});
  const prepared=await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});outputs=path.join(prepared.workspace,'outputs');
  await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_sessions:'[]',easel_theme:'light',easel_onboarding_seen:'1'}});
  await write(path.join(outputs,project,'.easel.json'),{title,summary:'隔离发布便捷入口',category:'creation',kind:'cards',status:'draft',tags:['早餐'],deliverables:['正文.md'],steps:[{skill:'external-agent',summary:'合成验收'}],custom:{retain:true}});
  await write(path.join(outputs,project,'正文.md'),'# 合成文案\n只用于本地验收，不公开发布。');await write(path.join(outputs,project,'素材 子目录','顺序说明.txt'),'第二张先，第一张后。');
  await write(path.join(outputs,'分析 无关项目','.easel.json'),{title:'隔离分析报告',category:'analysis'});await write(path.join(outputs,'分析 无关项目','报告.md'),'合成报告');
  oldHistory=path.join(data,'aitoearn','imports.json');partitionMarker=path.join(data,'Partitions','aitoearn-cn','fixture-only.txt');
  await write(oldHistory,{schema:1,compose:{projectPath:project,title:'旧正文仅在记录中',body:'合成旧正文，保留原件',images:[project+'/第二张.png',project+'/第一张.png'],mode:'images'},jobs:[{id:'old-uploading',status:'uploading',message:'旧上传中合成记录'},{id:'old-creating',status:'creating',message:'旧结果不明合成记录'}]});
  await write(partitionMarker,'Synthetic partition marker only; this is NOT a Cookie or authenticated session.');
  originalHistory=await fs.readFile(oldHistory);originalMarker=await fs.readFile(partitionMarker);originalManifest=await fs.readFile(path.join(outputs,project,'.easel.json'));
  try{
    await launch();await retained();await openLibrary();await assertNoRemote();
    const pageBefore=await page.locator('.page-host').innerText();await publishLink().click();await until(async()=>(await getCalls()).length===1,'Default browser request captured');
    assert.deepEqual(await getCalls(),[{kind:'external',target:'https://aitoearn.cn/zh-CN',failed:false}]);await page.getByRole('status').filter({hasText:'已交给默认浏览器打开 AitoEarn'}).waitFor();assert.equal(await page.locator('.page-host').innerText(),pageBefore);await assertFilters();assert.equal(dialogs.length,0);
    assert.equal(await page.getByRole('button',{name:'发送到 AI 发布',exact:true}).count(),0);record('侧栏固定官网外链，不导航、不打开内嵌网页，原筛选与内容保留');
    await theme('light');await shot('project-light');await theme('dark');await shot('project-dark');await theme('light');
    const projectDirectory=await fs.realpath(path.join(outputs,project));
    await card().getByRole('button',{name:'打开项目文件夹',exact:true}).click();await until(async()=>(await getCalls()).length===2,'Project card opens folder');assert.equal((await getCalls()).at(-1).target,projectDirectory);await assertFilters();assert.equal(await page.locator('.gallery-head .crumb-sep').count(),0);
    await shellFailure('failPath',true);await card().getByRole('button',{name:'打开项目文件夹',exact:true}).click();await page.getByRole('alert').filter({hasText:'无法在文件管理器中打开文件夹'}).waitFor();await assertFilters();await card().waitFor();await shot('folder-error');await shellFailure('failPath',false);
    await card().locator('.gcard-name').click();await page.getByText('素材 子目录',{exact:true}).click();await page.getByRole('button',{name:'打开项目文件夹',exact:true}).click();await until(async()=>(await getCalls()).length===4,'Subdirectory opens parent project');assert.equal((await getCalls()).at(-1).target,projectDirectory);await shot('project-subdirectory');
    await page.getByText('内容库',{exact:true}).last().click();await card().waitFor();await assertFilters();record('卡片与子目录均打开同一一级项目，shell 失败明确提示且保留分类搜索');
    await card().getByRole('button',{name:'编辑归档信息',exact:true}).click();await editor().getByLabel('标题',{exact:true}).fill('未保存的浏览器发布编辑');
    const dialogsBefore=dialogs.length;await publishLink().evaluate(link=>link.click());await until(async()=>(await getCalls()).length===5,'Dirty editor external link');await sleep(650);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await editor().getByRole('status').filter({hasText:'未保存编辑仍然保留'}).waitFor();assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'未保存的浏览器发布编辑');await assertFilters();assert.equal(dialogs.length,dialogsBefore);assert.equal(await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),true);await retained();await shot('draft-preserved');
    await shellFailure('failExternal',true);await publishLink().evaluate(link=>link.click());await page.getByRole('alert').filter({hasText:'无法调用默认浏览器'}).waitFor();assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'未保存的浏览器发布编辑');assert.equal(dialogs.length,dialogsBefore);
    await app.evaluate(({app})=>{app.quit();return true;});await until(()=>dialogs.length===dialogsBefore+1,'Actual exit asks before abandoning metadata');assert.match(dialogs.at(-1).message,/未保存/);await sleep(300);assert.equal(await page.evaluate(()=>document.body.inert),false);assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'未保存的浏览器发布编辑');
    assert.equal((await(await fetch(info.baseUrl+'/api/status')).json()).serviceReady,true);await editor().getByLabel('标题',{exact:true}).fill(title);await editor().getByRole('button',{name:'取消',exact:true}).click();await editor().waitFor({state:'hidden'});await assertFilters();await shot('open-error');await shellFailure('failExternal',false);
    record('未保存归档在浏览器成功/失败及窗口 focus 后仍保留，真实退出提示被拒绝后服务继续；还原表单后正常取消');
    await historySettings();await page.getByText(/部分正文和图片顺序可能只存在于旧记录/).waitFor();await page.getByText(/结果尚未确认的旧任务/).waitFor();
    await page.getByRole('button',{name:'打开旧 AI 发布记录目录',exact:true}).click();await until(async()=>(await getCalls()).length===7,'Old history directory opened');assert.equal((await getCalls()).at(-1).target,await fs.realpath(path.dirname(oldHistory)));await shot('history-light');await page.locator('.settings-close').click();await theme('dark');await historySettings();await shot('history-dark');await page.locator('.settings-close').click();
    await retained();await assertNoRemote();await close();await retained();record('旧 compose、uploading/creating 记录和合成分区标记字节不变；历史入口只打开目录');
    await launch();await retained();await openLibrary();await assertFilters();await historySettings();
    const savedDirectory=path.join(run,'保留旧 AI 发布记录');await fs.rename(path.dirname(oldHistory),savedDirectory);
    try{await page.getByRole('button',{name:'打开旧 AI 发布记录目录',exact:true}).click();await page.getByRole('alert').filter({hasText:'没有可打开的旧 AI 发布记录目录'}).waitFor();await assert.rejects(fs.access(path.dirname(oldHistory)),{code:'ENOENT'});assert.deepEqual(await getCalls(),[]);await shot('history-missing');}finally{await fs.rename(savedDirectory,path.dirname(oldHistory));}
    await page.locator('.settings-close').click();await retained();await assertNoRemote();await close();await retained();record('正常退出重开继续使用同库；无历史目录时明确提示且不创建目录');
    const corruptHistory=Buffer.from('{ malformed old history: do not parse, replay or overwrite');await fs.writeFile(oldHistory,corruptHistory);
    await launch();await retained(corruptHistory);await openLibrary();await historySettings();await page.getByRole('button',{name:'打开旧 AI 发布记录目录',exact:true}).click();await until(async()=>(await getCalls()).length===1,'Malformed history opens directory without reading JSON');assert.equal((await getCalls()).at(-1).target,await fs.realpath(path.dirname(oldHistory)));await shot('history-malformed');await page.locator('.settings-close').click();await retained(corruptHistory);const finalViews=await assertNoRemote();await close();await retained(corruptHistory);await fs.writeFile(oldHistory,originalHistory);await retained();
    record('坏 JSON 不影响启动及目录入口、不被读取覆盖；所有阶段没有旧任务重试或 AitoEarn 页面请求');
    assert.deepEqual(errors,[]);assert.equal(dialogs.length,1,'Only the deliberately declined dirty-exit confirmation occurred');
    await write(summary,{schema:1,version,passed:true,testedAt:new Date().toISOString(),realPackagedApplication:true,syntheticDataOnly:true,realAccountUsed:false,publications:0,realBrowserLaunched:false,shellMethodsCapturedOnly:true,partitionEvidence:'Sentinel bytes and directory listing only; no claim of Cookie/login validation',executable,testedAppAsarSha256:sha(await fs.readFile(path.join(path.dirname(executable),'resources/app.asar'))),libraryRoot,run,checks,shots,dialogs,shellCalls,retainedSha256:{oldImports:sha(originalHistory),partitionMarker:sha(originalMarker),projectManifest:sha(originalManifest)},finalEmbeddedUrls:finalViews,aitoearnRendererRequests:requests.filter(row=>/aitoearn|aliyuncs/i.test(row.url)),errors});
    console.log('BROWSER PUBLISH PASSED '+summary);
  }catch(error){if(page&&!page.isClosed())await shot('failure').catch(()=>{});await write(summary,{schema:1,version,passed:false,testedAt:new Date().toISOString(),run,checks,shots,errors,dialogs,shellCalls,error:error.stack});throw error;}finally{await close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

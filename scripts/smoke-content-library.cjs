// Final packaged application, synthetic files and an isolated library only.
'use strict';
const {_electron:electron}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),version=pkg.version;
const executable=path.resolve(process.env.EASEL_TEST_EXE||path.join(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe'));
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','内容分类 '+version+' '+Date.now());
const bootstrap=path.join(run,'独立 定位'),libraryRoot=path.join(run,'共用 中文 空格资料库'),data=path.join(libraryRoot,'runtime');
const evidence=path.join(root,'docs/images',version),summary=path.join(root,'docs/evidence','content-library-'+version+'.json');
const checks=[],errors=[],shots=[];let app,page,info;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,timeout=20000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await fn())return;}catch(error){last=error;}await delay(150);}throw Error(label+(last?': '+last.message:''));}
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');}
function record(name){checks.push(name);console.log('CONTENT LIBRARY: '+name);}
async function api(url,options){const response=await fetch(info.baseUrl+url,options),value=await response.json();assert.ok(response.ok,url+': '+JSON.stringify(value));return value;}
const json=value=>({headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});
const cards=()=>page.getByTestId('project-card');
const card=name=>cards().filter({has:page.getByText(name,{exact:true})});
const editor=()=>page.getByRole('dialog',{name:'编辑归档信息',exact:true});
async function shot(name){await page.screenshot({path:path.join(evidence,name+'.png'),animations:'disabled'});shots.push(name+'.png');}
async function theme(value){if(await page.locator('html').getAttribute('data-theme')!==value)await page.locator('.sidebar-header button').first().click();await until(async()=>await page.locator('html').getAttribute('data-theme')===value,'theme '+value);await delay(900);}
async function count(expected){await until(async()=>await cards().count()===expected,'Expected '+expected+' visible projects');}
async function filter(name,value){await page.getByLabel(name,{exact:true}).selectOption(value);}
async function clearFilters(){await page.locator('.library-results').getByRole('button',{name:'清空筛选',exact:true}).click();}
async function launch(){
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立Local'),APPDATA:path.join(run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/accounts/*/whoami*',route=>route.fulfill({json:{loggedIn:false,verificationStatus:'unknown',accountId:null,name:'',avatar:'',checkedAt:0,errorCode:'SYNTHETIC',message:'仅本地内容验收'}}));
 await page.route('**/api/trends*',route=>route.fulfill({json:{trends:[],updated:0}}));
 await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
 info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(info.version,version);assert.equal(info.libraryRoot,libraryRoot);
}
async function openLibrary(expected=5){await page.evaluate(project=>{location.hash='#/outputs/'+encodeURIComponent(project);},'创作 示例');await page.getByTestId('content-library').waitFor();await page.getByText('内容库',{exact:true}).last().click();await count(expected);}
async function close(){if(app){await page?.evaluate(()=>{window.confirm=()=>true;}).catch(()=>{});await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();app=null;}}
(async()=>{
 assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'),'Refusing daily installation');
 await fs.access(executable);await fs.mkdir(evidence,{recursive:true});
 const library=await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)}),outputs=path.join(library.workspace,'outputs');
 await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_sessions:'[]',easel_theme:'light',easel_onboarding_seen:'1'}});
 for(const persona of ['咖啡品牌','研究画像'])await write(path.join(library.workspace,'profiles',persona,'identity.md'),'# 隔离合成画像\n'+persona);
 const fixtures=[
  ['创作 示例',{title:'早餐咖啡图文',summary:'轻松创作与教程',category:'creation',profile:'咖啡品牌',platform:'小红书',kind:'cards',status:'draft',tags:['早餐','Campaign-A'],deliverables:['正文.md'],cover:'封面.png',steps:[{layer:'produce',skill:'external-agent',summary:'合成步骤'}],custom:{retain:true}}],
  ['分析 示例',{title:'十月运营复盘',summary:'粉丝增长样本分析',category:'analysis',profile:'研究画像',platform:'抖音',kind:'article',status:'ready',tags:['周报'],deliverables:['正文.md']}],
  ['参考 示例',{title:'行业案例汇总',summary:'保存原始来源',category:'reference',profile:'咖啡品牌',kind:'video',status:'published',tags:['案例']}],
  ['旧项目 无登记',null],
  ['自定义 示例',{title:'旧自定义形态',kind:'custom-format',status:'custom-stage',profile:'已经删除的画像',tags:['保留原值'],custom:{untouched:1}}]
 ];
 for(const[name,meta]of fixtures){await write(path.join(outputs,name,'正文.md'),'# '+name+'\n合成文件，只用于隔离验收。');if(meta)await write(path.join(outputs,name,'.easel.json'),meta);}
 await write(path.join(outputs,'创作 示例','assets','来源.txt'),'过程文件');await fs.copyFile(path.join(root,'branding/MediaSail-app-icon.png'),path.join(outputs,'创作 示例','封面.png'));
 const originalContent=await fs.readFile(path.join(outputs,'创作 示例','正文.md'));
 try{
  await launch();await openLibrary();
  for(const[name,expected]of [['创作内容',1],['分析报告',1],['参考资料',1],['未分类',2],['全部',5]]){await page.getByRole('button',{name,exact:true}).click();await count(expected);}
  record('用途分类及旧项目未分类，全部项目保持原目录');
  const search=page.getByLabel('搜索内容库',{exact:true});
  for(const term of ['早餐','Campaign-a','轻松创作','创作 示例']){await search.fill(term);await count(1);await card('早餐咖啡图文').waitFor();}
  await search.fill('原文绝不匹配-xyz');await count(0);await search.waitFor();await page.getByRole('button',{name:'全部',exact:true}).waitFor();await clearFilters();await count(5);
  await page.getByRole('button',{name:'创作内容',exact:true}).click();await search.fill('早餐');await filter('画像','咖啡品牌');await filter('平台','小红书');await filter('形态','graphic');await filter('阶段','draft');await count(1);await shot('content-library-filtered');
  await filter('平台','抖音');await count(0);await clearFilters();await count(5);
  record('中文、大小写、目录、摘要、标签搜索及多维交集、零结果和清空筛选');
  await theme('light');await shot('content-library-light');await theme('dark');await shot('content-library-dark');
  await page.getByRole('button',{name:'创作内容',exact:true}).click();await search.fill('早餐');await card('早餐咖啡图文').locator('.gcard-name').click();
  await page.getByText('正文.md',{exact:true}).click();await page.locator('.drawer-body').getByText('合成文件，只用于隔离验收。').waitFor();await page.locator('.drawer-header .icon-btn').click();
  await page.getByRole('button',{name:'视频',exact:true}).click();await page.getByRole('button',{name:'文档',exact:true}).waitFor();await page.getByRole('button',{name:'全部',exact:true}).click();await page.getByText('正文.md',{exact:true}).waitFor();
  await page.getByText('内容库',{exact:true}).last().click();await count(1);assert.equal(await search.inputValue(),'早餐');await clearFilters();await count(5);
  record('成品预览、项目内筛选零结果可恢复，返回保留顶层搜索及分类');
  await card('早餐咖啡图文').getByRole('button',{name:'编辑归档信息',exact:true}).click();await editor().waitFor();await shot('content-editor-dark');await editor().getByRole('button',{name:'取消',exact:true}).click();
  await theme('light');await card('早餐咖啡图文').getByRole('button',{name:'编辑归档信息',exact:true}).click();await editor().waitFor();await shot('content-editor-light');
  await editor().getByLabel('标题',{exact:true}).fill('早餐咖啡新版标题');await editor().getByLabel('摘要',{exact:true}).fill('界面增量修改');
  assert.equal(await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),true);
  const blocked=await page.evaluate(async target=>{try{await window.desktopLibrary.call('change',{targetRoot:target});return '';}catch(error){return error.message;}},path.join(run,'不应切换'));
  assert.match(blocked,/未保存/);
  let refusedQuit=false;page.once('dialog',async dialog=>{refusedQuit=true;await dialog.dismiss();});await app.evaluate(({app})=>{app.quit();return true;});await until(()=>refusedQuit,'Exit asks about dirty metadata');await delay(300);
  assert.equal((await api('/api/status')).serviceReady,true);assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'早餐咖啡新版标题');assert.equal(await page.evaluate(()=>document.body.inert),false);
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('.sidebar-nav').getByRole('button',{name:'连接 Agent',exact:true}).evaluate(button=>button.click());await editor().waitFor();assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'早餐咖啡新版标题');
  page.once('dialog',dialog=>dialog.dismiss());await editor().getByRole('button',{name:'取消',exact:true}).click();await editor().waitFor();
  const manifest=path.join(outputs,'创作 示例','.easel.json'),raw=JSON.parse(await fs.readFile(manifest,'utf8'));raw.summary='外部 Agent 已更新';raw.external='保留新字段';await write(manifest,raw);
  await delay(600);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'早餐咖啡新版标题');
  await editor().getByRole('button',{name:'保存',exact:true}).click();await editor().getByRole('alert').waitFor();assert.equal(await editor().getByLabel('标题',{exact:true}).inputValue(),'早餐咖啡新版标题');await shot('content-editor-conflict');
  page.once('dialog',dialog=>dialog.accept());await editor().getByRole('button',{name:'放弃修改并载入最新',exact:true}).click();await until(async()=>await editor().getByLabel('摘要',{exact:true}).inputValue()==='外部 Agent 已更新','Reload external metadata');
  await editor().getByLabel('标题',{exact:true}).fill('早餐咖啡新版标题');await editor().getByLabel('用途',{exact:true}).selectOption('analysis');await editor().getByRole('button',{name:'保存',exact:true}).click();await editor().waitFor({state:'hidden'});
  const saved=JSON.parse(await fs.readFile(manifest,'utf8'));assert.equal(saved.title,'早餐咖啡新版标题');assert.equal(saved.category,'analysis');assert.equal(saved.summary,'外部 Agent 已更新');assert.equal(saved.external,'保留新字段');assert.deepEqual(saved.steps,raw.steps);assert.deepEqual(saved.custom,raw.custom);assert.deepEqual(saved.deliverables,raw.deliverables);assert.equal(saved.cover,raw.cover);assert.deepEqual(await fs.readFile(path.join(outputs,'创作 示例','正文.md')),originalContent);
  assert.equal(await page.evaluate(()=>window.mediaSailHasUnsavedEdits()),false);await card('早餐咖啡新版标题').waitFor();
  record('归档编辑、真实退出取消/离页/取消/切库保护、Agent并发冲突和重读，未提交字段及成品保留');
  await card('旧自定义形态').getByRole('button',{name:'编辑归档信息',exact:true}).click();await editor().getByLabel('标题',{exact:true}).fill('自定义值仍保留');await editor().getByRole('button',{name:'保存',exact:true}).click();await editor().waitFor({state:'hidden'});
  const custom=JSON.parse(await fs.readFile(path.join(outputs,'自定义 示例','.easel.json'),'utf8'));assert.equal(custom.kind,'custom-format');assert.equal(custom.status,'custom-stage');assert.equal(custom.profile,'已经删除的画像');
  await card('自定义值仍保留').getByRole('button',{name:'编辑归档信息',exact:true}).click();await editor().getByLabel('摘要',{exact:true}).fill('慢保存完成后的摘要');
  let releaseSave;const saveGate=new Promise(resolve=>{releaseSave=resolve;});let heldSaves=0;
  await page.route('**/api/projects/*/metadata',async route=>{if(route.request().method()==='PATCH'){heldSaves++;await saveGate;}await route.continue();});
  try{
   await editor().getByRole('button',{name:'保存',exact:true}).click();await until(()=>heldSaves===1,'Slow write is in flight');
   assert.equal(await editor().getByRole('button',{name:'正在保存…',exact:true}).isDisabled(),true);
   let busyNavigation=false;page.once('dialog',async dialog=>{busyNavigation=/正在保存/.test(dialog.message());await dialog.accept();});await page.locator('.sidebar-nav').getByRole('button',{name:'连接 Agent',exact:true}).evaluate(button=>button.click());await until(()=>busyNavigation,'Busy save blocks navigation');
   let busyQuit=false;page.once('dialog',async dialog=>{busyQuit=/正在保存/.test(dialog.message());await dialog.accept();});await app.evaluate(({app})=>{app.quit();return true;});await until(()=>busyQuit,'Busy save blocks actual exit');assert.equal((await api('/api/status')).serviceReady,true);assert.equal(heldSaves,1);
  }finally{releaseSave();await page.unroute('**/api/projects/*/metadata');}
  await editor().waitFor({state:'hidden'});assert.equal(JSON.parse(await fs.readFile(path.join(outputs,'自定义 示例','.easel.json'),'utf8')).summary,'慢保存完成后的摘要');
  record('慢保存时重复提交、离页和真实退出被阻止，完成后结果可读回');
  const route='**/api/projects/'+encodeURIComponent('自定义 示例')+'/metadata';
  await card('自定义值仍保留').getByRole('button',{name:'编辑归档信息',exact:true}).click();await editor().getByLabel('摘要',{exact:true}).fill('保存失败草稿');
  await page.route(route,async route=>{if(route.request().method()==='PATCH')await route.fulfill({status:500,json:{detail:{code:'write_failed',message:'隔离样本：写入失败，原文件保留'}}});else await route.continue();});
  await editor().getByRole('button',{name:'保存',exact:true}).click();await editor().getByRole('alert').waitFor();assert.equal(await editor().getByLabel('摘要',{exact:true}).inputValue(),'保存失败草稿');
  await page.unroute(route);page.once('dialog',dialog=>dialog.accept());await editor().getByRole('button',{name:'取消',exact:true}).click();
  record('自定义旧值保留，写入失败保留编辑并允许取消');
  const empty=path.join(outputs,'旧项目 无登记','.easel.json'),endpoint='/api/projects/'+encodeURIComponent('旧项目 无登记')+'/metadata';
  const first=await api(endpoint);assert.equal(first.revision,'missing');await api(endpoint,{method:'PATCH',...json({revision:first.revision,changes:{category:'reference',title:'旧项目补登记'}})});
  const bad=path.join(outputs,'坏登记 样本');await write(path.join(bad,'报告.md'),'bad manifest fixture');await write(path.join(bad,'.easel.json'),'{ broken JSON');const response=await fetch(info.baseUrl+'/api/projects/'+encodeURIComponent('坏登记 样本')+'/metadata');assert.equal(response.status,409);assert.equal(await fs.readFile(path.join(bad,'.easel.json'),'utf8'),'{ broken JSON');
  record('缺登记项目可补分类，损坏登记报错且原件保留');
  const marker=JSON.parse(await fs.readFile(path.join(libraryRoot,'.mediasail-library.json'),'utf8')).libraryId;await close();await launch();assert.equal(info.libraryId,marker);await openLibrary(6);
  record('真实打包进程正常退出重启后沿用同一资料库与归档信息');
  assert.deepEqual(errors,[]);const appAsarSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(path.dirname(executable),'resources/app.asar'))).digest('hex');
  await close();await write(summary,{schema:1,version,passed:true,testedAt:new Date().toISOString(),realPackagedApplication:true,syntheticDataOnly:true,realAccountUsed:false,publications:0,libraryRoot,executable,testedAppAsarSha256:appAsarSha256,checks,shots,errors});
  console.log('CONTENT LIBRARY PASSED '+summary);
 }catch(error){if(page)await shot('content-library-failure').catch(()=>{});await write(summary,{version,passed:false,checks,errors,error:error.stack,run});throw error;}finally{await close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

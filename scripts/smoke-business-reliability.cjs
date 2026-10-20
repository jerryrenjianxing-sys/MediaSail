// Real packaged UI; synthetic network responses only, isolated library.
'use strict';
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json');
const executable = path.resolve(process.env.EASEL_TEST_EXE || path.resolve(root, pkg.build.directories.output, 'win-unpacked/MediaSail.exe'));
const run = path.join(os.homedir(), 'Documents/MediaSail 隔离验证', '业务可靠性 0.5.10 ' + Date.now());
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let app, release = () => {};
(async () => {
  assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'));
  const bootstrap = path.join(run, '定位'), libraryRoot = path.join(run, '资料库');
  const layout = await require('../desktop/library.cjs').chooseLibrary({ bootstrapRoot: bootstrap, targetRoot: libraryRoot, installDirectory: path.dirname(executable) });
  await fs.mkdir(layout.dataRoot, { recursive: true });
  await fs.writeFile(path.join(layout.dataRoot, 'ui-state.json'), JSON.stringify({schema:1,migration:{version:'0.3.3'},values:{easel_onboarding_seen:'1'}}));
  const env = {...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'Local'),APPDATA:path.join(run,'Roaming')};
  delete env.EASEL_DESKTOP_DATA; delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({executablePath:executable,env,timeout:60000});
  const page = await app.firstWindow();
  const identity = name => ({loggedIn:true,verificationStatus:'verified',accountId:name,name,avatar:'',checkedAt:Date.now()/1000});
  let pending = false;
  const held = new Promise(resolve => { release = resolve; });
  await page.route('**/api/analytics/platforms', route=>route.fulfill({json:[]}));
  await page.route('**/api/accounts', route=>route.fulfill({json:[{platform:'xiaohongshu',name:'小红书',supported:true,backend:'browser',loggedIn:false,verificationStatus:'unknown',checkedAt:0}]}));
  await page.route('**/api/accounts/*/whoami*', async route=>{
    if (route.request().url().includes('force=1')) return route.fulfill({json:identity('新账号')});
    pending=true; await held; await route.fulfill({json:identity('旧账号')});
  });
  await page.route('**/api/trends*', route=>route.fulfill({json:{trends:[],updated:0}}));
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});
  await page.getByRole('button',{name:'控制台',exact:true}).first().click();
  await page.getByRole('button',{name:'账号',exact:true}).click();
  for(let i=0;i<100&&!pending;i++) await delay(100);
  assert.ok(pending,'background verification held at network boundary');
  await page.getByRole('button',{name:'校验账号',exact:true}).click();
  await page.locator('.account-nick').filter({hasText:'新账号'}).waitFor();
  release(); await delay(800);
  assert.equal(await page.locator('.account-nick').innerText(),'新账号','late verification cannot replace newer identity');
  console.log('PASS: inverse account responses preserve newest identity');
  await page.route('**/api/accounts/*/whoami*',route=>route.fulfill({json:{loggedIn:false,verificationStatus:'unknown',name:'',avatar:'',checkedAt:Date.now()/1000}}));
  await page.route('**/api/accounts/*/logout',route=>route.fulfill({json:{ok:true}}));
  page.on('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'退出登录',exact:true}).click();
  await page.getByRole('button',{name:'登录',exact:true}).waitFor();
  let startPending=false;
  const startGate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/login/xiaohongshu',async route=>{startPending=true;await startGate;await route.fulfill({json:{mode:'qr',state:'qr_ready',qr:'_login/synthetic.png'}});});
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await page.locator('.overlay').getByRole('button',{name:'关闭',exact:true}).click();
  assert.ok(startPending);release();await delay(500);
  assert.equal(await page.locator('.overlay').count(),0,'late start response cannot reopen closed QR');
  let polls=0;
  const pollGate=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/login/xiaohongshu',route=>route.fulfill({json:{mode:'qr',state:'starting',qr:''}}));
  await page.route('**/api/login/xiaohongshu/status',async route=>{polls++;await pollGate;await route.fulfill({json:{state:'expired',message:'合成过期二维码',qr:''}});});
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await delay(6500);assert.equal(polls,1,'slow status requests cannot overlap');
  release();await page.getByRole('button',{name:'重新获取二维码',exact:true}).waitFor();
  await page.route('**/api/login/xiaohongshu/status',route=>route.fulfill({json:{state:'qr_ready',message:'新二维码',qr:'_login/synthetic.png',qrTs:22}}));
  await page.route('**/api/media/_login/synthetic.png*',route=>route.fulfill({path:path.join(root,'branding/MediaSail-app-icon.png')}));
  await page.getByRole('button',{name:'重新获取二维码',exact:true}).click();
  await page.getByAltText('登录二维码').waitFor();
  assert.ok((await page.getByAltText('登录二维码').getAttribute('src')).includes('v=22'));
  await page.locator('.overlay').getByRole('button',{name:'关闭',exact:true}).click();
  const previousPolls=polls;await delay(2200);assert.equal(polls,previousPolls);
  console.log('PASS: closed QR, slow polls and expired-code refresh');

  const evidence=path.join(root,'docs/images/0.5.10');await fs.mkdir(evidence,{recursive:true});
  const groups=[{platform:'weibo',label:'微博',items:[{title:'合成热点',hot:'42',url:'https://example.invalid'}],status:'cached',fetchedAt:1700000000,source:'https://example.invalid',stale:true,error:'来源暂时不可用'},
    {platform:'douyin',label:'抖音',items:[],status:'live',fetchedAt:1700000300,source:'https://example.invalid',stale:false,error:''},
    {platform:'zhihu',label:'知乎',items:[],status:'unavailable',fetchedAt:null,source:null,stale:false,error:'来源暂时不可用'}];
  await page.route('**/api/trends*',route=>route.fulfill({json:{trends:groups,updated:Date.now()/1000}}));
  await page.locator('.sidebar-nav').getByRole('button',{name:'工作台',exact:true}).click();
  await page.getByText(/刷新失败，显示缓存/).waitFor();
  await page.getByRole('button',{name:'看热点',exact:true}).click();
  await page.getByText(/刷新失败，显示缓存/).waitFor();
  await page.screenshot({path:path.join(evidence,'trends-light.png')});
  await page.evaluate(()=>{document.documentElement.dataset.theme='dark';});
  await page.screenshot({path:path.join(evidence,'trends-dark.png')});
  console.log('PASS: hotlist live/cache/unavailable displayed in both views');

  const session=await page.context().newCDPSession(page);
  await session.send('Emulation.setTimezoneOverride',{timezoneId:'Asia/Shanghai'});
  await page.clock.install({time:new Date('2026-10-19T16:30:00Z')});
  const schedule=[];
  await page.route('**/api/schedule',route=>{
    if(route.request().method()==='POST'){const body=route.request().postDataJSON();schedule.push(body);return route.fulfill({json:{...body,id:'synthetic'}});}
    return route.fulfill({json:[{id:'past',title:'昨天过期日程',date:'2026-10-19',status:'draft',time:''},{id:'today',title:'今天合成日程',date:'2026-10-20',status:'draft',time:''}]});
  });
  await page.locator('.sidebar-nav').getByRole('button',{name:'工作台',exact:true}).click();
  await page.getByText('今天合成日程',{exact:true}).waitFor();
  assert.equal(await page.getByText('昨天过期日程',{exact:true}).count(),0);
  await page.route('**/api/ideas',route=>route.fulfill({json:[{id:'sample',title:'合成选题',status:'pending',note:''}]}));
  await page.getByRole('button',{name:'记选题',exact:true}).click();
  await page.getByRole('button',{name:'排期',exact:true}).click();
  for(let i=0;i<30&&!schedule.length;i++)await delay(100);
  assert.equal(schedule[0].date,'2026-10-20');
  console.log('PASS: dashboard and idea scheduling use local civil date');
  await page.locator('.sidebar-nav').getByRole('button',{name:'工作台',exact:true}).click();
  await page.getByRole('button',{name:'去发布',exact:true}).click();
  await page.getByPlaceholder('标题（部分平台需要）').fill('日期合成草稿');
  await page.getByPlaceholder('填写已准备的内容，在右侧预览并编辑各平台版本…').fill('仅保存本地草稿，不发布。');
  await page.getByRole('button',{name:'存草稿并排期',exact:true}).click();
  for(let i=0;i<30&&schedule.length<2;i++)await delay(100);
  assert.equal(schedule[1].date,'2026-10-20');
  console.log('PASS: publish draft scheduling uses local civil date');
  await fs.mkdir(path.join(root,'docs/evidence'),{recursive:true});
  await fs.writeFile(path.join(root,'docs/evidence/business-ui-0.5.10.json'),JSON.stringify({version:pkg.version,passed:true,syntheticDataOnly:true,checkedAt:new Date().toISOString(),checks:['inverse account responses','closed QR start response','non-overlapping polls','QR expiry and refresh','hotlist status both views','local dashboard and idea date']},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  release(); if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}
});

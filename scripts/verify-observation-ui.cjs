// UI acceptance uses synthetic API responses; storage correctness is tested over HTTP/CLI separately.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'vendor/easel/web/frontend');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let browser,server;
async function main(){
 server=cp.spawn(process.execPath,[path.join(frontend,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','0'],{cwd:frontend,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';server.stdout.on('data',chunk=>output+=String(chunk));server.stderr.on('data',chunk=>output+=String(chunk));
 for(let attempt=0;attempt<100&&!/http:\/\/127\.0\.0\.1:\d+/.test(output);attempt++)await sleep(100);
 const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];if(!url)throw new Error('UI host did not start: '+output);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:980}});
 await page.addInitScript(()=>localStorage.setItem('easel_onboarding_seen','1'));
 const calls=[];let readFailure=false;
 let observations=[{observationId:'synthetic-a',platform:'douyin',accountId:'account-a',nickname:'合成账号 A',
   producer:'external-agent',source:'douyin-creator-home',fetched_at:1793577600,importedAt:1793577660,
   followers:12,likes:0,following:null,posts:null,metrics:[{label:'主页访问量',value:9,window:'7-days',unit:'count'}],
   notes:[],collection:{status:'partial',missingFields:['posts'],issues:[{field:'posts',code:'not_observed',message:'尚未读取作品页'}]},
   usable:true,growthStatus:'unavailable',growthReason:'没有同口径历史',reportPaths:['outputs/合成报告/report.md'],evidenceRefs:[]}];
 await page.route('**/api/**',async route=>{
   const endpoint=new URL(route.request().url()).pathname;calls.push(endpoint);
   if(endpoint==='/api/account-observations'&&readFailure){await route.fulfill({status:503,json:{ok:false,code:'observation_io_error',error:'合成资料库暂不可用'}});return;}
   const responses={ '/api/status':{serviceReady:true},'/api/personas':[],'/api/account-observations':{ok:true,observations,errors:[]},
     '/api/outputs':[{name:'合成报告',path:'合成报告',type:'dir',children:[{name:'report.md',path:'合成报告/report.md',type:'file',kind:'text'}]}], '/api/ideas':[], '/api/schedule':[], '/api/trends':{trends:[],updated:0},
     '/api/analytics/platforms':[{platform:'douyin',name:'抖音',loggedIn:false,verificationStatus:'login_required'}],
     '/api/accounts':[{platform:'douyin',name:'抖音',supported:true,loggedIn:false,verificationStatus:'login_required'}]};
   if(endpoint.startsWith('/api/output/')){await route.fulfill({json:{path:'合成报告/report.md',content:'# 合成报告预览\nreport-body-proof',kind:'text',isBinary:false}});return;}
   await route.fulfill({json:responses[endpoint]??{}});
 });
 await page.goto(url);await page.getByRole('button',{name:'控制台',exact:true}).click();
 await page.getByRole('heading',{name:'账号观测',exact:true}).waitFor({timeout:8000});
 await page.getByRole('heading',{name:/合成账号 A/}).waitFor({timeout:8000});
 assert.match(await page.locator('body').innerText(),/合成账号 A/);
 assert.match(await page.locator('body').innerText(),/尚未读取作品页/);
 assert(!calls.some(call=>/\/whoami$|\/api\/analytics\/douyin|\/api\/login\//.test(call)),'Saved data must not verify or collect');
 await page.getByRole('combobox',{name:'账号'}).selectOption('account-a');
 observations=[{...observations[0],observationId:'synthetic-other',accountId:'account-b',nickname:'合成账号 B',fetched_at:1793664000,importedAt:1793664060},...observations];
 await page.getByRole('button',{name:'刷新资料',exact:true}).click();
 await page.waitForTimeout(150);
 assert.equal(await page.getByRole('combobox',{name:'账号'}).inputValue(),'account-a');
 assert.match(await page.locator('.observation-panel').innerText(),/合成账号 A/);
 readFailure=true;
 await page.getByRole('button',{name:'刷新资料',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'合成资料库暂不可用'}).waitFor({timeout:4000});
 assert.match(await page.locator('.observation-panel').innerText(),/合成账号 A/);
 readFailure=false;
 observations=observations.filter(row=>row.accountId!=='account-a');
 await page.getByRole('button',{name:'刷新资料',exact:true}).click();
 await page.waitForTimeout(150);
 assert.equal(await page.getByRole('combobox',{name:'账号'}).inputValue(),'account-a','Removed account must remain explicitly selected until user changes it');
 assert.match(await page.locator('.observation-panel').innerText(),/未替你切换账号/);
 await page.getByRole('button',{name:'账号与数据',exact:true}).click();
 await page.getByRole('heading',{name:'账号与数据',exact:true}).waitFor();
 await page.getByRole('button',{name:'打开旧采集工具',exact:true}).click();
 await page.getByText('登录工具会话',{exact:true}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.waitForTimeout(150);
 assert(!calls.some(call=>/\/whoami$|\/api\/analytics\/douyin|\/api\/login\//.test(call)),'Focus and native area opening must remain read-only');
 const evidence=path.join(root,'.test-data/observation-ui-0512');await fs.mkdir(evidence,{recursive:true});
 await page.screenshot({path:path.join(evidence,'accounts-light.png'),fullPage:true});
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';document.documentElement.style.colorScheme='dark';});
 await page.screenshot({path:path.join(evidence,'accounts-dark.png'),fullPage:true});
 await page.keyboard.press('Escape');
 await page.getByRole('link',{name:'outputs/合成报告/report.md',exact:true}).click();
 await page.locator('.outputs-viewer-content').getByText('report-body-proof',{exact:true}).waitFor({timeout:4000});
 await page.locator('.drawer-header .icon-btn').click();
 await page.evaluate(()=>location.hash='#/outputs/'+encodeURIComponent('合成报告'));
 await page.locator('.gcard-name').getByText('report.md',{exact:true}).waitFor();
 await page.evaluate(()=>location.hash='#/outputs/'+encodeURIComponent('合成报告')+'/deleted.md');
 await page.getByRole('alert').filter({hasText:'引用的文件或目录已不存在'}).waitFor();
 assert.equal(await page.locator('.gcard-name').getByText('report.md',{exact:true}).count(),1);
 console.log('Observation UI accepted: saved data, account selection, native isolation, focus, light/dark.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.kill();});

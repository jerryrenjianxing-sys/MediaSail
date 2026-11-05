'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'vendor/easel/web/frontend');
let browser,host;
async function main(){
 host=cp.spawn(process.execPath,[path.join(frontend,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','0'],{cwd:frontend,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';host.stdout.on('data',chunk=>output+=chunk);host.stderr.on('data',chunk=>output+=chunk);
 for(let i=0;i<100&&!/http:\/\/127\.0\.0\.1:\d+/.test(output);i++)await new Promise(resolve=>setTimeout(resolve,100));const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url,output);
 browser=await chromium.launch({channel:'msedge',headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--disable-features=OverlayScrollbar']});
 const evidence=path.join(root,'.test-data/legacy-drawer-0513');await fs.mkdir(evidence,{recursive:true});
 for(const scale of [1,1.25,1.5]){
  const page=await browser.newPage({viewport:{width:1440,height:980},deviceScaleFactor:scale});await page.addInitScript(()=>localStorage.setItem('easel_onboarding_seen','1'));const calls=[];
  await page.route('**/api/**',async route=>{const request=route.request(),key=new URL(request.url()).pathname;calls.push({key,method:request.method()});
   const responses={'/api/status':{serviceReady:true},'/api/personas':[],'/api/account-observations':{ok:true,observations:[],errors:[]},'/api/outputs':[],'/api/ideas':[],'/api/schedule':[],'/api/trends':{trends:[],updated:0},'/api/analytics/platforms':[],
    '/api/accounts':Array.from({length:7},(_,i)=>({platform:i?'platform-'+i:'wechat-oa',backend:i?'synthetic':'wechat-oa',name:i?'合成平台'+i:'微信公众号',supported:true,loggedIn:false,verificationStatus:'login_required'}))};
   if(key.includes('login')&&request.method()==='POST'){await route.fulfill({json:{mode:'credentials'}});return;}
   if(key==='/api/accounts')await new Promise(resolve=>setTimeout(resolve,100));
   await route.fulfill({json:responses[key]??{}});
  });
  await page.goto(url);await page.getByRole('button',{name:'控制台',exact:true}).click();await page.getByRole('button',{name:'账号与数据',exact:true}).click();
  const bounds=()=>page.locator('.accounts-page').first().evaluate(el=>({width:el.clientWidth,scrollTop:el.scrollTop,height:el.scrollHeight}));
  const before=await bounds();const opener=page.getByRole('button',{name:/采集工具/});await opener.click();
  const drawer=page.getByRole('dialog',{name:'旧采集工具',exact:true});await drawer.waitFor({timeout:3000});
  await drawer.getByText('合成平台6',{exact:true}).waitFor();assert.deepEqual(await bounds(),before);
  await drawer.locator('.legacy-tools-body').evaluate(el=>el.scrollTop=el.scrollHeight);
  await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});assert.deepEqual(await bounds(),before);assert.equal(await opener.evaluate(el=>el===document.activeElement),true);
  assert(!calls.some(call=>/whoami|\/api\/analytics\/|\/api\/login\//.test(call.key)&&call.method!=='GET'),'Opening must not perform verification or collection');
  await opener.press('Space');await drawer.waitFor();await drawer.getByRole('button',{name:'登录工具会话',exact:true}).first().click();
  await page.getByPlaceholder('wx...').fill('synthetic-app-id');page.once('dialog',dialog=>dialog.dismiss());await page.keyboard.press('Escape');assert.equal(await drawer.isVisible(),true);assert.equal(await page.getByPlaceholder('wx...').inputValue(),'synthetic-app-id');
  page.once('dialog',dialog=>dialog.accept());await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});assert.deepEqual(await bounds(),before);
  await opener.click();await drawer.waitFor();await page.waitForTimeout(300);await page.screenshot({path:path.join(evidence,'drawer-'+scale+'.png'),fullPage:true});
  await drawer.getByRole('button',{name:'关闭旧采集工具',exact:true}).click();await page.close();
 }
 console.log('Legacy drawer accepted: stable page/scrollbar, focus, keyboard, deferred accounts, unsaved edits, 100/125/150% device scale.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(host)host.kill()});

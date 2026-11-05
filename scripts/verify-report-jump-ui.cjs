// Delayed synthetic HTTP responses exercise the report jump through the rendered UI.
// Run from the repository root: node scripts/verify-report-jump-ui.cjs
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),frontend=path.join(root,'vendor/easel/web/frontend'),evidence=path.join(root,'.test-data/report-jump-ui');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let host,browser;
async function fixturePage(url){
 const page=await browser.newPage();await page.addInitScript(()=>localStorage.setItem('easel_onboarding_seen','1'));
 const tree=[{name:'fixture',path:'fixture',type:'dir',children:[{name:'report.md',path:'fixture/report.md',type:'file',kind:'text'}]}];
 let hold=false,release,admitted,notify;
 await page.route('**/api/**',async route=>{
  const key=new URL(route.request().url()).pathname;
  if(key==='/api/outputs'){
   if(hold){hold=false;const gate=new Promise(resolve=>release=resolve);notify();await gate;}
   await route.fulfill({json:tree});return;
  }
  if(key.startsWith('/api/output/')){await route.fulfill({json:{path:'fixture/report.md',kind:'text',isBinary:false,content:'# report\nreport-body-proof'}});return;}
  if(key.startsWith('/api/projects/')){await route.fulfill({json:{ok:true,project:'fixture',revision:'a'.repeat(64),metadata:{title:'baseline title'}}});return;}
  const data={'/api/status':{serviceReady:true},'/api/personas':[],'/api/account-observations':{ok:true,observations:[],errors:[]}};
  await route.fulfill({json:data[key]??{}});
 });
 await page.goto(url+'/#/outputs/fixture');await page.getByRole('button',{name:'编辑归档信息',exact:true}).waitFor();await pause(200);
 return {page,
  async holdReportJump(){hold=true;admitted=new Promise(resolve=>notify=resolve);await page.evaluate(()=>location.hash='#/outputs/fixture/report.md');await admitted;},
  releaseTree(){release();}
 };
}
async function main(){
 host=cp.spawn(process.execPath,[path.join(frontend,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','0'],{cwd:frontend,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';host.stdout.on('data',chunk=>output+=chunk);host.stderr.on('data',chunk=>output+=chunk);
 for(let i=0;i<100&&!/http:\/\/127\.0\.0\.1:\d+/.test(output);i++)await pause(100);
 const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url,output);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const results=[];
 for(let repetition=1;repetition<=3;repetition++){
  const focus=await fixturePage(url);await focus.holdReportJump();
  await focus.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await pause(150);focus.releaseTree();await pause(600);
  const focusResult={repetition,scenario:'focus-refresh-during-report-fetch',previewCount:await focus.page.locator('.outputs-viewer-content').count(),errorText:await focus.page.getByRole('alert').allTextContents()};
  results.push(focusResult);console.log(JSON.stringify(focusResult));
  await fs.mkdir(evidence,{recursive:true});await fs.writeFile(path.join(evidence,'latest-results.json'),JSON.stringify(results,null,2)+'\n');
  assert.equal(focusResult.previewCount,1,'Focus refresh must preserve the explicit report jump');
  await focus.page.locator('.outputs-viewer-content').getByText('report-body-proof',{exact:true}).waitFor();
  await focus.page.close();

  const edits=await fixturePage(url);await edits.holdReportJump();
  await edits.page.getByRole('button',{name:'编辑归档信息',exact:true}).click();await edits.page.getByRole('textbox',{name:'标题',exact:true}).fill('unsaved proof');
  assert.equal(await edits.page.evaluate(()=>window.mediaSailHasUnsavedEdits?.()),true);
  let dialogs=0;edits.page.on('dialog',async dialog=>{dialogs++;await dialog.dismiss()});edits.releaseTree();await pause(600);
  const editsResult={repetition,scenario:'metadata-edit-after-fetch-finishes',dirty:await edits.page.evaluate(()=>window.mediaSailHasUnsavedEdits?.()),editorCount:await edits.page.getByRole('dialog',{name:'编辑归档信息',exact:true}).count(),confirmationCount:dialogs,previewCount:await edits.page.locator('.outputs-viewer-content').count()};
  results.push(editsResult);console.log(JSON.stringify(editsResult));await fs.writeFile(path.join(evidence,'latest-results.json'),JSON.stringify(results,null,2)+'\n');
  assert.equal(editsResult.dirty,true,'A draft created during the tree read must remain dirty');assert.equal(editsResult.editorCount,1);assert.equal(editsResult.confirmationCount,1);assert.equal(editsResult.previewCount,0);
  assert.equal(await edits.page.getByRole('textbox',{name:'标题',exact:true}).inputValue(),'unsaved proof');
  await edits.page.close();

  const cancelled=await fixturePage(url);await cancelled.holdReportJump();
  await cancelled.page.getByRole('button',{name:'账号与数据',exact:true}).click();
  await cancelled.page.getByRole('heading',{name:'账号与数据',exact:true}).waitFor();cancelled.releaseTree();await pause(250);
  await cancelled.page.getByRole('button',{name:'内容库',exact:true}).click();await pause(600);
  assert.equal(await cancelled.page.locator('.outputs-viewer-content').count(),0,'Returning to the library must not replay an abandoned navigation');
  results.push({repetition,scenario:'navigation-away-during-report-fetch',previewCount:0});
  await cancelled.page.close();
 }
 await fs.writeFile(path.join(evidence,'latest-results.json'),JSON.stringify(results,null,2)+'\n');
 console.log('Report jump races passed: focus refresh, new metadata draft and abandoned navigation, three repetitions each.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(host)host.kill()});

const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data/AI 发布 live');
 const env={...process.env,EASEL_DESKTOP_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:process.env.EASEL_TEST_EXE||path.join(root,'node_modules/electron/dist/electron.exe'),args:process.env.EASEL_TEST_EXE?[]:[root],env});
 try{
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  await page.getByText('AI 发布',{exact:true}).first().click();
  let info;
  for(let i=0;i<90;i++){
   info=await app.evaluate(async({webContents,BrowserWindow})=>{
    const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith('https://aitoearn.cn'));
    if(!wc)return null;
    const view=BrowserWindow.getAllWindows()[0].contentView.children[0];
    return {url:wc.getURL(),loading:wc.isLoading(),bounds:view.getBounds(),visible:view.getVisible(),text:await wc.executeJavaScript('document.body.innerText.slice(0,2500)').catch(()=>''),privileges:await wc.executeJavaScript('typeof window.desktopAito+":"+typeof require').catch(()=>'')};
   });
   if(info?.text?.length>150&&!info.loading)break;await page.waitForTimeout(500);
  }
  console.log('LIVE WEBSITE',JSON.stringify(info));
  assert.equal(info.visible,true);assert.ok(info.bounds.width>400&&info.bounds.height>300);assert.ok(info.text.length>150);assert.equal(info.privileges,'undefined:undefined');assert.ok(!info.text.includes('当前地址没有匹配到可用页面'));
  assert.equal((await page.evaluate(()=>window.desktopAito.call('status'))).web.error,'');
  const encoded=await app.evaluate(async({BrowserWindow,desktopCapturer})=>{
   const win=BrowserWindow.getAllWindows()[0];win.show();win.focus();
   const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1600,height:1100}});
   const source=sources.find(s=>s.id===win.getMediaSourceId());
   return (source&&!source.thumbnail.isEmpty()?source.thumbnail:(await win.capturePage())).toPNG().toString('base64');
  });
  fs.writeFileSync(path.resolve(root,'../../outputs/ElectronEasel/AI发布-原版网页.png'),Buffer.from(encoded,'base64'));
  // Real website is inspected only while signed out. No tokens or account writes.
  await assert.rejects(page.evaluate(()=>window.desktopAito.call('connection')),/登录/);
  console.log('LIVE AITO PAGE AND SIGNED-OUT STATE PASSED');
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

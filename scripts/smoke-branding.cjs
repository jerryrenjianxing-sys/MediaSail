// Packaged-app branding and upgrade checks. Only disposable profiles, no installer or real accounts.
const {_electron:electron}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),run=path.join(root,'.test-data/branding-v032'),out=path.resolve(root,'../../outputs/MediaSail');
const mode=process.argv[2]||'ui',baseline=mode==='seed'||mode==='feed-old';
const data=path.join(run,mode==='ui'?'全新 中文 数据':mode==='feed-old'?'旧版 更新检查':'升级 中文 数据 同端口');
const executable=baseline?path.join(run,'baseline-0.3.1/MediaSail.exe'):(process.env.EASEL_TEST_EXE||path.join(out,'win-unpacked/MediaSail.exe'));
const stateRoot=path.join(data,'home/.openclaw-easel/workspace');
const fixture='Easel 历史用户文字必须保留';
const oldSession={id:'branding-history',title:'旧版测试会话',created:1,messages:[{role:'user',content:fixture}]};
let app;
async function ready(){
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:210000});
  await page.locator('.sidebar-status').filter({hasText:'网关已连接'}).waitFor({timeout:210000});
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  return page;
}
async function noOldBrand(page,label){
  assert.doesNotMatch(await page.locator('body').innerText(),/\bEasel\b/,label);
  assert.equal(await page.locator('img[src*="easel-icon"]').count(),0,label+' icon');
}
(async()=>{
  fs.mkdirSync(run,{recursive:true});
  let testPort;
  if(mode==='seed'){
    const net=require('node:net'),server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));testPort=server.address().port;await new Promise(r=>server.close(r));
    fs.writeFileSync(path.join(run,'upgrade-port.json'),JSON.stringify(testPort));
  }else if(mode==='upgrade')testPort=JSON.parse(fs.readFileSync(path.join(run,'upgrade-port.json'),'utf8'));
  const env={...process.env,EASEL_DESKTOP_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:[],env,timeout:30000});
  try{
    if(testPort)await app.evaluate((_electron,port)=>{
      // The normal preferred port is occupied on this machine. Keep the same
      // isolated test origin in both versions without touching that other service.
      // This changes only the test's local port selection, never update transport.
      const net=process.getBuiltinModule('node:net'),original=net.Server.prototype.listen;
      net.Server.prototype.listen=function(value,...args){return original.call(this,value===7860?port:value,...args);};
    },testPort);
    if(mode==='ui')await app.evaluate(({app,session})=>{
      // Only supply read-only identity/group fixtures; no real website request or draft is created.
      const req=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
      const {WebsiteAdapter}=req('./desktop/aitoearn/adapter.cjs');
      WebsiteAdapter.prototype.identity=async()=>({id:'branding-fixture',name:'界面验证账号'});
      WebsiteAdapter.prototype.groups=async()=>[{id:'branding-group',name:'MediaSail 导入'}];
      session.fromPartition('persist:aitoearn-cn').webRequest.onBeforeRequest({urls:['https://aitoearn.cn/*']},(_d,cb)=>cb({cancel:true}));
    });
    const page=await ready();
    if(testPort)assert.equal(new URL(page.url()).port,String(testPort),'Both versions must use the same isolated browser origin');
    assert.equal(await app.evaluate(({app})=>app.getVersion()),baseline?'0.3.1':'0.3.2');
    if(mode==='seed'){
      await page.locator('.sidebar-nav').getByRole('button',{name:'对话',exact:true}).click();
      assert.equal(await page.locator('.chat-hero-brand span').innerText(),'Easel');
      for(const name of ['AGENTS.md','SOUL.md'])fs.copyFileSync(path.join(stateRoot,name),path.join(run,'before-'+name));
      for(const folder of ['outputs/品牌验证','assets','profiles/自定义'])fs.mkdirSync(path.join(data,'workspace',folder),{recursive:true});
      fs.appendFileSync(path.join(data,'workspace/.env'),'\nMEDIASAIL_BRAND_FIXTURE=keep-031\n');
      fs.writeFileSync(path.join(data,'workspace/outputs/品牌验证/成品.txt'),fixture);
      fs.writeFileSync(path.join(data,'workspace/assets/素材.txt'),fixture);
      fs.writeFileSync(path.join(data,'workspace/profiles/自定义/profile.md'),fixture);
      await page.evaluate(session=>{localStorage.setItem('easel_sessions',JSON.stringify([session]));localStorage.setItem('easel_active_session',session.id);},oldSession);
      await page.reload();await ready();
      assert.ok(await page.evaluate(id=>JSON.parse(localStorage.getItem('easel_sessions')).some(s=>s.id===id),oldSession.id));
      await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'mediasail-brand-fixture',value:'keep-031',secure:true,expirationDate:Date.now()/1000+604800});await s.cookies.flushStore();});
      console.log('0.3.1 SEED PASSED: actual old chat branding, original defaults, user files, history and non-auth cookie');
    }else if(mode==='upgrade'){
      for(const relative of ['outputs/品牌验证/成品.txt','assets/素材.txt','profiles/自定义/profile.md'])assert.equal(fs.readFileSync(path.join(data,'workspace',relative),'utf8'),fixture);
      assert.match(fs.readFileSync(path.join(data,'workspace/.env'),'utf8'),/MEDIASAIL_BRAND_FIXTURE=keep-031/);
      const history=await page.evaluate(()=>JSON.parse(localStorage.getItem('easel_sessions')));
      assert.deepEqual(history.find(s=>s.id===oldSession.id).messages,oldSession.messages);
      const cookies=await app.evaluate(async({session})=>session.fromPartition('persist:aitoearn-cn').cookies.get({name:'mediasail-brand-fixture'}));assert.equal(cookies[0].value,'keep-031');
      for(const name of ['AGENTS.md','SOUL.md']){
        assert.match(fs.readFileSync(path.join(stateRoot,name),'utf8'),/你是 MediaSail/);
        assert.deepEqual(fs.readFileSync(path.join(stateRoot,'.mediasail-brand-backup-0.3.2',name)),fs.readFileSync(path.join(run,'before-'+name)));
      }
      assert.equal(await page.locator('.sidebar-logo h1').innerText(),'MediaSail');
      await page.screenshot({path:path.join(out,'MediaSail-0.3.2-旧数据升级.png'),animations:'disabled'});
      console.log('0.3.1 -> 0.3.2 WORKSPACE UPGRADE PASSED: identity backups, config, assets, content, custom profile, chat history, session storage');
    }else if(mode==='feed-old'){
      await page.locator('.settings-gear').click();const settings=page.getByRole('dialog',{name:'设置',exact:true});
      await settings.getByRole('button',{name:'软件更新',exact:true}).click();
      const [panel]=await Promise.all([app.waitForEvent('window',{predicate:w=>w!==page,timeout:30000}),settings.getByRole('button',{name:'检查更新',exact:true}).click()]);
      let state;
      for(let attempt=0;attempt<3;attempt++){
        await panel.evaluate(()=>window.mediaSailUpdate.call('check'));
        const end=Date.now()+150000;
        do{state=await page.evaluate(()=>window.desktopUpdates.status());if(['available','current','error'].includes(state.phase))break;await page.waitForTimeout(250);}while(Date.now()<end);
        if(state.phase==='available')break;await page.waitForTimeout(3000);
      }
      assert.equal(state.phase,'available',state.message);assert.equal(state.current,'0.3.1');assert.equal(state.version,'0.3.2');
      await panel.screenshot({path:path.join(out,'MediaSail-0.3.1-发现0.3.2.png'),animations:'disabled'});
      console.log('REAL GITHUB FEED: packaged 0.3.1 discovers 0.3.2 via Settings. No download/install performed.');
    }else{
      assert.equal(await page.title(),'MediaSail');
      for(const theme of ['light','dark']){
        if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('.theme-toggle').click();
        for(const name of ['工作台','对话','技能库','内容库','账号','画像']){
          await page.locator('.sidebar-nav').getByRole('button',{name,exact:true}).click();
          if(name==='技能库')await page.locator('.skill-card').first().waitFor();
          await noOldBrand(page,theme+' '+name);
        }
        await page.locator('.sidebar-nav').getByRole('button',{name:'对话',exact:true}).click();
        await page.locator('.chat-hero-brand').waitFor();
        assert.equal(await page.locator('.chat-hero-brand span').innerText(),'MediaSail');
        assert.equal(await page.locator('.chat-hero-brand img').getAttribute('src'),await page.locator('.sidebar-logo-icon').getAttribute('src'));
        await page.waitForFunction(()=>[...document.querySelectorAll('.chat-hero-brand img,.sidebar-logo-icon')].every(i=>i.complete&&i.naturalWidth>0));
        await page.screenshot({path:path.join(out,`MediaSail-0.3.2-${theme==='light'?'浅色':'深色'}界面.png`),animations:'disabled'});
        await page.getByRole('button',{name:'看看能做什么',exact:true}).click();await noOldBrand(page,theme+' capabilities');await page.locator('.brush-close').click();
        await page.locator('.settings-gear').click();const settings=page.getByRole('dialog',{name:'设置',exact:true});
        for(const name of [/模型配置/,/环境安装/,/软件更新/,/更多设置/]){await settings.locator('.settings-nav').getByRole('button',{name}).click();await noOldBrand(page,theme+' settings');}
        await settings.getByRole('button',{name:'软件更新',exact:true}).click();assert.equal(await settings.getByTestId('update-current-version').innerText(),'0.3.2');
        await page.screenshot({path:path.join(out,`MediaSail-0.3.2-${theme==='light'?'浅色':'深色'}设置.png`),animations:'disabled'});await settings.locator('.settings-close').click();
      }
      // Skills documentation changes product prose only; source links, code and attribution remain literal.
      await page.route('**/api/skill/ai-image-gen',route=>route.fulfill({json:{name:'ai-image-gen',description:'Easel 技能',body:'# Easel 项目\n\n使用 Easel 创作。\n\n`Easel command`\n\n[Easel upstream](https://github.com/ZJU-REAL/Easel)\n\nEasel 自研，保留作者署名。',envKeys:[],apiKeys:[],apiConfigured:true,needsApi:false}}));
      await page.locator('.sidebar-nav').getByRole('button',{name:'技能库',exact:true}).click();
      await page.locator('.skill-card').filter({has:page.locator('.skill-card-rawname',{hasText:/^ai-image-gen$/})}).click();
      await page.locator('.skill-body-md').waitFor();const skillBody=page.locator('.skill-body-md');
      assert.match(await skillBody.innerText(),/MediaSail 项目/);assert.equal(await skillBody.locator('code').innerText(),'Easel command');
      assert.equal(await skillBody.locator('a').getAttribute('href'),'https://github.com/ZJU-REAL/Easel');assert.match(await skillBody.innerText(),/Easel 自研/);
      await page.locator('.drawer-overlay button[title="关闭"]').click();await page.unroute('**/api/skill/ai-image-gen');
      fs.mkdirSync(path.join(data,'workspace/outputs/品牌验证'),{recursive:true});fs.writeFileSync(path.join(data,'workspace/outputs/品牌验证/正文.txt'),'用于界面验收的文字，不发送到平台。');
      await page.locator('.sidebar-nav').getByRole('button',{name:'内容库',exact:true}).click();await page.getByRole('button',{name:'发送到 AI 发布',exact:true}).first().click();
      const send=page.getByRole('dialog',{name:'发送到 AI 发布',exact:true});await send.getByRole('button',{name:'创建 / 使用「MediaSail 导入」',exact:true}).waitFor();await noOldBrand(page,'send panel');
      await send.getByRole('button',{name:'暂存并关闭'}).click();
      await page.locator('.sidebar-nav').getByRole('button',{name:'AI 发布',exact:true}).click();await page.getByRole('button',{name:/发送记录/}).click();
      await page.getByText('还没有发送记录。从 MediaSail 内容库选择成品，即可带入 AitoEarn 草稿箱。',{exact:true}).waitFor();await noOldBrand(page,'AI publishing shell');
      for(const route of ['/static/index.html','/static/main.html','/onepage']){
        const response=await page.request.get(new URL(route,page.url()).href);assert.equal(response.status(),200);
        const html=await response.text();const info=await page.evaluate(html=>{const d=new DOMParser().parseFromString(html,'text/html');d.querySelectorAll('script,style').forEach(n=>n.remove());return {title:d.title,text:d.body.textContent,icons:[...d.querySelectorAll('img[src*="mediasail-icon"],link[rel="icon"]')].map(n=>n.getAttribute('src')||n.getAttribute('href'))};},html);
        assert.match(info.title,/MediaSail/);assert.doesNotMatch(info.text,/\bEasel\b/);assert.ok(info.icons.length);assert.ok(info.icons.every(x=>x==='/static/mediasail-icon.png'));
      }
      const icon=await page.request.get(new URL('/static/mediasail-icon.png',page.url()).href);assert.deepEqual(await icon.body(),fs.readFileSync(path.join(root,'branding/MediaSail-app-icon.png')));
      console.log('PACKAGED BRAND UI PASSED: light/dark navigation, chat, settings, capabilities, skill docs, AI import, static pages and approved icon bytes');
    }
  }finally{
    if(app){await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});}).catch(()=>{});await app.close();}
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

// Independently verify an Agent's synthetic work in the packaged UI and files.
'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {_electron:electron}=require('playwright');let observerApp;
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const projects=[{name:'十分钟早餐咖啡图文方案20261016',category:'creation'},{name:'早餐咖啡合成样本复盘20261016',category:'analysis'}];
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await delay(150);}throw Error(label);}
async function attachOwnedPlaywrightMain(info){
 // Playwright already starts its own random-port inspector; never signal a
 // second inspector or attach to another app's fixed port.
 assert.ok(Number.isInteger(info.pid)&&info.pid>0);
 const observed=JSON.parse(cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$targetProcess=Get-CimInstance Win32_Process -Filter 'ProcessId=${info.pid}';$ports=@(Get-NetTCPConnection -State Listen -OwningProcess ${info.pid}|Where-Object LocalAddress -eq '127.0.0.1'|Select-Object -ExpandProperty LocalPort);@{executable=$targetProcess.ExecutablePath;ports=$ports}|ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true,timeout:20000}));
 assert.equal(observed.executable.toLowerCase(),info.executable.toLowerCase());let target;
 for(const port of observed.ports){try{const list=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json();target=list.find(item=>item.type==='node'&&item.webSocketDebuggerUrl?.startsWith(`ws://127.0.0.1:${port}/`));if(target)break;}catch{}}
 assert.ok(target,'Expected the owned Playwright Node inspector');
 const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const message=JSON.parse(event.data),request=pending.get(message.id);if(request){pending.delete(message.id);clearTimeout(request.timer);if(message.error||message.result?.exceptionDetails)request.reject(Error(JSON.stringify(message.error||message.result.exceptionDetails)));else request.resolve(message.result?.result?.value);}});
 return {evaluate(expression){return new Promise((resolve,reject)=>{const next=++id,timer=setTimeout(()=>{pending.delete(next);reject(Error('Observer timed out'));},15000);pending.set(next,{resolve,reject,timer});ws.send(JSON.stringify({id:next,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});},close(){ws.close();for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('Observer closed'));}pending.clear();}};
}
(async()=>{
 const host=JSON.parse(await fs.readFile(path.join(root,'.test-data/agent-acceptance-host.json'),'utf8'));
 assert.ok(host.run.includes('MediaSail 隔离验证'));assert.ok(host.libraryRoot.startsWith(host.run+path.sep));
 let info=JSON.parse(await fs.readFile(path.join(host.data,'agent-connection.json'),'utf8'));assert.equal(info.version,version);assert.equal(info.libraryRoot,host.libraryRoot);assert.ok(!info.executable.toLowerCase().startsWith('d:\\mediasail\\'));
 if(info.status==='stopped'){
  const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:host.bootstrap,LOCALAPPDATA:path.join(host.run,'独立Local'),APPDATA:path.join(host.run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  observerApp=await electron.launch({executablePath:info.executable,args:[],env,timeout:60000});const first=await observerApp.firstWindow();await first.waitForURL('http://127.0.0.1:*/',{timeout:180000});await first.locator('.skill-home').waitFor();info=JSON.parse(await fs.readFile(path.join(host.data,'agent-connection.json'),'utf8'));
 }
 assert.equal(info.status,'ready');
 const live=await(await fetch(info.baseUrl+'/api/agent-info')).json();assert.equal(live.instanceId,info.instanceId);
 const list=await(await fetch(info.baseUrl+'/api/outputs')).json(),results=[];
 for(const project of projects){
  const raw=JSON.parse(await fs.readFile(path.join(info.outputs,project.name,'.easel.json'),'utf8')),visible=list.find(item=>item.name===project.name);assert.ok(visible,project.name);assert.equal(raw.category,project.category);assert.equal(visible.meta.category,project.category);assert.equal(raw.profile,host.persona);assert.equal(visible.meta.profile,host.persona);assert.ok(raw.deliverables.length);
  for(const name of raw.deliverables){const source=await fs.readFile(path.join(info.outputs,project.name,name),'utf8'),url=info.baseUrl+'/api/output/'+[project.name,name].map(encodeURIComponent).join('/'),response=await(await fetch(url)).json();assert.equal(response.content.replaceAll('\r\n','\n'),source.replaceAll('\r\n','\n'));}
  results.push({name:project.name,title:raw.title,category:raw.category,profile:raw.profile,deliverables:raw.deliverables});
 }
 const inspector=await attachOwnedPlaywrightMain(info),window="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http://127.0.0.1:'))";
 const render=code=>inspector.evaluate(`(()=>{const w=${window};return w.webContents.executeJavaScript(${JSON.stringify(code)});})()`);
 try{
  await render(`location.hash='#/outputs/'+encodeURIComponent(${JSON.stringify(projects[1].name)});true`);await until(()=>render(`document.body.innerText.includes(${JSON.stringify(results[1].title)})&&document.body.innerText.includes('分析报告')`),'Agent analysis visible in project detail');
  await render("document.querySelector('.gallery-head .crumb').click();true");await until(()=>render("Boolean(document.querySelector('.library-categories'))"),'Project category controls');
  for(const [category,label]of [['analysis','分析报告'],['creation','创作内容']]){
   await render(`document.querySelector('.library-categories button[aria-label="${label}"]').click();true`);const expected=results.find(item=>item.category===category);
   await until(()=>render(`Array.from(document.querySelectorAll('[data-testid="project-card"]')).some(card=>card.dataset.project===${JSON.stringify(expected.name)})`),'Agent project visible under '+category);
   assert.equal(await render(`Array.from(document.querySelectorAll('[data-testid="project-card"]')).length`),1);
  }
  await render("document.querySelector('.library-categories button[aria-label=\"全部\"]').click();true");
  await until(()=>render(`document.querySelector('.library-categories button[aria-label="全部"]').getAttribute('aria-pressed')==='true'&&document.querySelectorAll('[data-testid="project-card"]').length===${results.length}`),'All Agent projects painted');await delay(300);
  const screenshot=path.join(root,'docs/images',version,'independent-agent-content.png');await inspector.evaluate(`(async()=>{const image=await ${window}.webContents.capturePage();process.mainModule.require('node:fs').writeFileSync(${JSON.stringify(screenshot)},image.toPNG());return true;})()`);
  const result={version,passed:true,checkedAt:new Date().toISOString(),syntheticDataOnly:true,realPackagedUi:true,realService:true,matchingFileApiAndUi:true,projects:results,publicationPerformed:false};
  await fs.writeFile(path.join(root,'docs/evidence/external-content-ui-'+version+'.json'),JSON.stringify(result,null,2));console.log('INDEPENDENT AGENT FILE/API/UI VERIFIED '+JSON.stringify(results));
 }finally{inspector.close();await fs.writeFile(host.controlFile,'normal-test-stop');}
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(observerApp)await observerApp.close();});

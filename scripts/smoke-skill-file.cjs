'use strict';
// Synthetic local library; actual Electron/Windows clipboard, no messages sent.
const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process'), http = require('node:http');
const { fileURLToPath } = require('node:url');
const root = path.resolve(__dirname, '..'), pkg = require('../package.json');
const run = path.join(os.homedir(), 'Documents/MediaSail 隔离验证', 'Skill 文件 # % ' + Date.now());
const bootstrap = path.join(run, '定位'), libraryRoot = path.join(run, '中文 空格资料库');
const executable = path.resolve(root, pkg.build.directories.output, 'win-unpacked/MediaSail.exe');
const evidence = path.join(root, 'docs/images', pkg.version), result = { version: pkg.version, passed: false, checks: [], syntheticDataOnly: true, messagesSent: 0, targetClients: {trae:'not verified; native UI helper unavailable',codex:'not verified; native UI helper unavailable'} };
let app, page, info, clipboardBackup;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, message) { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (await test()) return; await delay(100); } throw Error(message); }
function record(message) { result.checks.push(message); console.log('SKILL FILE: ' + message); }
async function ps(args) { return new Promise((resolve, reject) => { const child = cp.spawn('powershell.exe', ['-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass',...args], {windowsHide:true,timeout:30000}); let out='',err=''; child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',value=>out+=value);child.stderr.on('data',value=>err+=value);child.on('error',reject);child.on('close',code=>code===0?resolve(out):reject(Error(out+'\n'+err))); }); }
async function start() {
  const env = {...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'Local'),APPDATA:path.join(run,'Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({executablePath:executable,env,timeout:60000});page=await app.firstWindow();
  page.on('dialog',dialog=>dialog.dismiss());
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
  info=JSON.parse(await fs.readFile(path.join(bootstrap,'agent-connection.json'),'utf8'));
}
async function copyFile(label='复制 Skill 文件') {
  await page.getByRole('button',{name:label,exact:true}).click();await page.getByText('文件已复制，可到 Agent 中粘贴。',{exact:true}).waitFor();
  const uri=await app.evaluate(async({clipboard})=>{const items=await clipboard.read();return await(await items[0].getType('text/uri-list')).text();});return fileURLToPath(uri.trim());
}
(async()=>{
  await fs.mkdir(evidence,{recursive:true});
  await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
  await fs.writeFile(path.join(libraryRoot,'runtime/ui-state.json'),JSON.stringify({schema:1,migration:{version:'0.3.3'},values:{mediasail_skill_filename:'历史自定义.md',easel_onboarding_seen:'1',easel_theme:'light'}}));
  try {
    await start();
    assert.equal(await page.getByLabel('Skill 复制选项',{exact:true}).count(),0,'homepage must have a single copy button without a dropdown');
    assert.equal(await page.getByRole('textbox',{name:'Skill',exact:true}).count(),0,'long text dialog is removed');
    assert.equal(await page.getByRole('button',{name:'修改文件名',exact:true}).count(),0);
    assert.equal(await page.locator('.skill-home dialog').count(),0);
    record('homepage has a single MD button with no dropdown, filename editor or text dialog');
    assert.equal(await page.getByRole('button',{name:'复制文字',exact:true}).count(),0,'homepage must offer MD files only');
    await page.screenshot({path:path.join(evidence,'skill-file-home.png'),animations:'disabled'});
    clipboardBackup=await app.evaluate(async({clipboard})=>{const items=await clipboard.read();return await Promise.all(items.map(async item=>{const result={};for(const type of item.types){const value=await item.getType(type);result[type]=type==='electron application/bookmark'?{bookmark:value}:{bytes:Array.from(new Uint8Array(await value.arrayBuffer())),type:value.type};}return result;}));});
    const file=await copyFile();assert.equal(path.basename(file),'MediaSail 接入.md');
    const bytes=await fs.readFile(file),card=bytes.toString('utf8');assert.match(card,/Get-Content -LiteralPath/);assert.match(card,/仅在本机文件无法访问时/);
    assert.equal(card,await(await fetch(info.baseUrl+'/api/platform-skill?format=connect')).text());
    const drops=JSON.parse(await ps(['-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);Add-Type -AssemblyName System.Windows.Forms;ConvertTo-Json -InputObject @([Windows.Forms.Clipboard]::GetFileDropList()) -Compress"]));
    assert.deepEqual(drops,[file]);record('real Windows file-drop clipboard points to an exact UTF-8 MD snapshot');

    // A real Chromium paste target, separate from MediaSail; not claimed to be TRAE/Codex.
    const receiverReady=app.waitForEvent('window');await app.evaluate(async({BrowserWindow})=>{globalThis.__pasteReceiver=new BrowserWindow({width:900,height:550,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});await globalThis.__pasteReceiver.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<h1>合成文件粘贴验收</h1><p>此页仅本地验证，不上传文件。</p><div contenteditable="true" style="border:1px solid;padding:30px" aria-label="接入附件">在此粘贴</div><pre id="received"></pre><script>document.addEventListener("paste",async e=>{e.preventDefault();window.received=await Promise.all(Array.from(e.clipboardData.files).map(async f=>({name:f.name,text:await f.text()})));document.querySelector("#received").textContent=JSON.stringify(window.received,null,2);});</script>'));});
    const receiver=await receiverReady;await receiver.getByLabel('接入附件').click();await receiver.keyboard.press('Control+v');await receiver.waitForFunction(()=>Array.isArray(window.received)&&window.received.length===1);
    assert.deepEqual(await receiver.evaluate(()=>window.received),[{name:'MediaSail 接入.md',text:card}]);await receiver.screenshot({path:path.join(evidence,'skill-file-paste-receiver.png')});await receiver.close();record('independent Chromium input receives the actual named MD file and full bytes without text fallback');

    const command=card.match(/```powershell\s*([\s\S]*?)```/)[1],script=path.join(run,'连接示例.ps1');await fs.writeFile(script,'\ufeff$ErrorActionPreference="Stop"\n[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)\n'+command,'utf8');
    const began=Date.now(),connected=JSON.parse(await ps(['-File',script]));result.connectionCommandMs=Date.now()-began;assert.equal(connected.connected,true);assert.equal(connected.serviceReady,true);assert.equal(connected.paths.skillDir,info.skillDir);record('generated complete command connects using current discovery without ZIP or full self-test');

    const repeated=await copyFile('已复制');assert.equal(path.basename(repeated),'MediaSail 接入.md');assert.notEqual(repeated,file);assert.deepEqual(await fs.readFile(file),bytes);
    await page.screenshot({path:path.join(evidence,'skill-file-light.png'),animations:'disabled'});
    await page.getByRole('button',{name:'切换到深色主题',exact:true}).click();await delay(1000);await page.screenshot({path:path.join(evidence,'skill-file-dark.png'),animations:'disabled'});record('repeated copies keep the fixed name and independent files despite a legacy custom preference');
    const viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight}));await page.setViewportSize({width:480,height:900});await page.screenshot({path:path.join(evidence,'skill-file-narrow.png'),animations:'disabled'});await page.setViewportSize(viewport);

    await app.evaluate(({clipboard})=>{globalThis.__originalClipboardWrite=clipboard.write;clipboard.write=async()=>{throw Error('synthetic clipboard locked');};});
    await page.getByRole('button',{name:'已复制',exact:true}).click();await page.getByText(/synthetic clipboard locked/).waitFor();
    assert.equal(await page.getByRole('button',{name:'复制文字',exact:true}).count(),0);
    assert.equal(await page.locator('dialog[open]').count(),0);
    const unchanged=await app.evaluate(async({clipboard})=>await(await(await clipboard.read())[0].getType('text/uri-list')).text());assert.equal(fileURLToPath(unchanged.trim()),repeated);
    await page.screenshot({path:path.join(evidence,'skill-file-retry.png'),animations:'disabled'});
    await app.evaluate(({clipboard})=>{clipboard.write=globalThis.__originalClipboardWrite;});
    const retry=await copyFile('重试');assert.equal(path.basename(retry),'MediaSail 接入.md');assert.notEqual(retry,repeated);assert.equal(await fs.readFile(retry,'utf8'),card);
    const formats=await app.evaluate(async({clipboard})=>(await clipboard.read())[0].types);assert.ok(formats.includes('text/uri-list'));assert.ok(!formats.includes('text/plain'));record('clipboard failure preserves the previous file, offers retry only, then copies a new MD without text');
    // Do not inspect/render this new clipboard payload until its owner has quit.
    await page.getByRole('button',{name:'已复制',exact:true}).click();await page.getByText('文件已复制，可到 Agent 中粘贴。',{exact:true}).waitFor();await app.close();app=null;
    const afterExit=JSON.parse(await ps(['-Command',"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);Add-Type -AssemblyName System.Windows.Forms;ConvertTo-Json -InputObject @([Windows.Forms.Clipboard]::GetFileDropList()) -Compress"]));assert.equal(afterExit.length,1);const last=afterExit[0];assert.equal(path.basename(last),'MediaSail 接入.md');assert.equal(await fs.readFile(last,'utf8'),card);
    await start();assert.equal(await page.getByLabel('Skill 复制选项',{exact:true}).count(),0);const restarted=await copyFile();assert.equal(path.basename(restarted),'MediaSail 接入.md');assert.deepEqual(await fs.readFile(file),bytes);assert.equal(JSON.parse(await fs.readFile(path.join(libraryRoot,'runtime/ui-state.json'),'utf8')).values.mediasail_skill_filename,'历史自定义.md');record('restart still copies the fixed name; old preference and snapshots remain untouched');
    const oldUrl=info.baseUrl;await app.close();app=null;
    const occupied=http.createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({product:'another app'}));});await new Promise(resolve=>occupied.listen(Number(new URL(oldUrl).port),'127.0.0.1',resolve));
    try {
      const nextLibrary=path.join(run,'另一 中文资料库');await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:nextLibrary,installDirectory:path.dirname(executable)});await start();
      assert.notEqual(info.baseUrl,oldUrl);const current=JSON.parse(await ps(['-File',script]));assert.equal(current.connected,true);assert.equal(current.libraryRoot,nextLibrary);assert.equal(current.paths.skillDir,info.skillDir);assert.deepEqual(await fs.readFile(file),bytes);record('the original copied card resolves a different library and port through current discovery');
    } finally { await new Promise(resolve=>occupied.close(resolve)); }
    result.passed=true;result.cacheFile=last;
  } finally {
    if(app){if(clipboardBackup)await app.evaluate(async({clipboard,ClipboardItem},items)=>{if(!items.length){clipboard.clear();return;}await clipboard.write(items.map(item=>new ClipboardItem(Object.fromEntries(Object.entries(item).map(([type,value])=>[type,value.bookmark??new Blob([new Uint8Array(value.bytes)],{type:value.type})])))));},clipboardBackup).catch(()=>{});await app.close().catch(()=>{});}
    await fs.mkdir(path.join(root,'docs/evidence'),{recursive:true});await fs.writeFile(path.join(root,'docs/evidence','skill-file-'+pkg.version+'.json'),JSON.stringify(result,null,2));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

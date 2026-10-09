const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data/品牌 升级 v030'),seed=process.argv.includes('--seed');
 if(!process.env.EASEL_TEST_EXE)throw new Error('Set the exact installed test executable');
 const env={...process.env,EASEL_DESKTOP_DATA:data,PATH:`${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:process.env.EASEL_TEST_EXE,args:[],env});
 try{
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  const marker=path.join(data,'workspace/outputs/升级保留/成品.txt');
  if(seed){
   assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.2.0');
   fs.mkdirSync(path.dirname(marker),{recursive:true});fs.writeFileSync(marker,'MediaSail 改名后保留内容');
   fs.appendFileSync(path.join(data,'workspace/.env'),'\nMEDIASAIL_UPGRADE_FIXTURE=keep-v020\n');
   await page.evaluate(()=>localStorage.setItem('mediasail-upgrade-test','keep-v020'));
   await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'mediasail-upgrade-fixture',value:'keep-v020',expirationDate:Date.now()/1000+604800,secure:true});await s.cookies.flushStore();});
   console.log('INSTALLED 0.2.0: CONFIG, CONTENT AND NON-AUTH TEST COOKIE SEEDED');
  }else{
   assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.3.0');assert.equal(await page.title(),'MediaSail');
   assert.equal(fs.readFileSync(marker,'utf8'),'MediaSail 改名后保留内容');
   assert.match(fs.readFileSync(path.join(data,'workspace/.env'),'utf8'),/MEDIASAIL_UPGRADE_FIXTURE=keep-v020/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('mediasail-upgrade-test')),'keep-v020');
   assert.equal(await app.evaluate(async({session})=>(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'mediasail-upgrade-fixture'}))[0]?.value),'keep-v020');
   await page.getByRole('button',{name:/软件更新/}).waitFor();
   assert.equal(await page.evaluate(async()=>(await(await fetch('/api/status')).json()).gateway),true);
   const shortcuts=JSON.parse(cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; $Shell = New-Object -ComObject WScript.Shell; @([Environment]::GetFolderPath('DesktopDirectory'),[Environment]::GetFolderPath('Programs')) | ForEach-Object { $Link = Join-Path $_ 'MediaSail.lnk'; if (-not (Test-Path -LiteralPath $Link)) { throw 'Missing MediaSail shortcut' }; $Shell.CreateShortcut($Link).TargetPath } | ConvertTo-Json"],{encoding:'utf8',windowsHide:true}));
   assert.equal(shortcuts.length,2);for(const target of shortcuts)assert.equal(path.resolve(target).toLowerCase(),path.resolve(process.env.EASEL_TEST_EXE).toLowerCase());
   await page.screenshot({path:path.resolve(root,'../../outputs/MediaSail/MediaSail-主界面.png'),fullPage:true});
   console.log('INSTALLED 0.2.0 → MEDIASAIL 0.3.0: CONTENT, CONFIG, LOCAL STORAGE, SESSION AND PORTABLE RUNTIME PASSED');
  }
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

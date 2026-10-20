// Verify the independent Agent's actual files through the packaged application.
'use strict';
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
let app;
(async()=>{
 const host=JSON.parse(await fs.readFile(path.join(root,'.test-data/agent-acceptance-host.json'),'utf8'));
 assert.ok(host.run.includes('MediaSail 隔离验证'));assert.ok(host.libraryRoot.startsWith(host.run+path.sep));
 const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:host.bootstrap,LOCALAPPDATA:path.join(host.run,'独立Local'),APPDATA:path.join(host.run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,env,timeout:60000});const page=await app.firstWindow();
 await page.route('**/api/accounts/*/whoami*',route=>route.fulfill({json:{loggedIn:false,verificationStatus:'unknown'}}));
 await page.route('**/api/trends*',route=>route.fulfill({json:{trends:[],updated:0}}));
 await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});
 const info=JSON.parse(await fs.readFile(path.join(host.data,'agent-connection.json'),'utf8'));
 const identity=await(await fetch(info.baseUrl+'/api/agent-info')).json();assert.equal(identity.instanceId,info.instanceId);
 const name='运营证据-独立接入验收',project=path.join(info.outputs,name);
 const metadata=JSON.parse(await fs.readFile(path.join(project,'.easel.json'),'utf8'));
 assert.equal(metadata.profile,host.persona);assert.equal(metadata.deliverables.length,2);assert.equal(metadata.status,'draft');
 const projects=await(await fetch(info.baseUrl+'/api/outputs')).json();assert.ok(projects.find(item=>item.name===name));
 for(const file of metadata.deliverables){
  const original=await fs.readFile(path.join(project,file),'utf8');
  const visible=await(await fetch(info.baseUrl+'/api/output/'+[name,file].map(encodeURIComponent).join('/'))).json();
  assert.equal(visible.content.replaceAll('\r\n','\n'),original.replaceAll('\r\n','\n'));
 }
 const memory=await fs.readFile(path.join(info.profiles,host.persona,'memory.md'),'utf8');assert.match(memory,/100/);assert.ok(memory.length>220);
 await page.getByRole('button',{name:'控制台',exact:true}).first().click();
 await page.locator('.sidebar-nav').getByRole('button',{name:'内容库',exact:true}).click();
 await page.getByText(metadata.title,{exact:true}).first().waitFor();
 const images=path.join(root,'docs/images',pkg.version);await fs.mkdir(images,{recursive:true});
 await page.screenshot({path:path.join(images,'independent-method-agent.png')});
 await page.locator('.sidebar-nav').getByRole('button',{name:'技能方法',exact:true}).click();
 await page.getByText('声音画像',{exact:true}).first().click();
 await page.getByText('文风证据与改稿学习',{exact:true}).waitFor();
 await page.screenshot({path:path.join(images,'voice-method.png')});
 const agent=JSON.parse(await fs.readFile(path.join(project,'assets/验收记录.json'),'utf8'));
 const result={passed:true,version:pkg.version,checkedAt:new Date().toISOString(),syntheticDataOnly:true,realService:true,realPackagedUi:true,profileRetainedAndUpdated:true,deliverables:metadata.deliverables,methodReferencesVisible:true,agent};
 await fs.writeFile(path.join(root,'docs/evidence/method-agent-'+pkg.version+'.json'),JSON.stringify(result,null,2));
 console.log('INDEPENDENT METHOD AGENT FILE/API/UI VERIFIED');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

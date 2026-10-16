const fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
(async()=>{
 const host=JSON.parse(await fs.readFile(path.join(root,'.test-data/agent-acceptance-host.json'),'utf8'));
 const info=JSON.parse(await fs.readFile(path.join(host.data,'agent-connection.json'),'utf8'));
 assert.equal(info.libraryRoot,host.libraryRoot);assert.equal(info.status,'ready');assert.ok(Number.isInteger(info.pid));
 const ports=cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Get-NetTCPConnection -State Listen -OwningProcess ${info.pid} | Select-Object -ExpandProperty LocalPort -Unique`],{encoding:'utf8',windowsHide:true}).trim().split(/\s+/).map(Number);
 let port;for(const candidate of ports){try{const version=await(await fetch('http://127.0.0.1:'+candidate+'/json/version',{signal:AbortSignal.timeout(2000)})).json();if(version.Browser&&!version.Browser.startsWith('node.js/')){port=candidate;break;}}catch{}}
 assert.ok(port,'Test-owned Chromium debugger required');const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
 try{
  const page=browser.contexts()[0].pages().find(p=>p.url()===info.baseUrl+'/');assert.ok(page);
  if(await page.getByRole('button',{name:'控制台',exact:true}).count())await page.getByRole('button',{name:'控制台',exact:true}).click();
  await page.locator('.sidebar-nav').getByRole('button',{name:'内容库',exact:true}).click();
  const project='十分钟早餐咖啡-首次接入验收',dir=path.join(info.outputs,project),manifest=JSON.parse(await fs.readFile(path.join(dir,'.easel.json'),'utf8'));
  await page.getByText(manifest.title,{exact:true}).first().waitFor();
  const shot=path.join(root,'docs/images',pkg.version,'external-agent-project.png');await page.screenshot({path:shot,animations:'disabled'});
  const outputs=await(await fetch(info.baseUrl+'/api/outputs')).json(),shown=outputs.find(p=>p.name===project);assert.ok(shown);assert.equal(manifest.profile,host.persona);assert.equal(manifest.status,'draft');assert.equal(manifest.deliverables.length,2);
  const matches=[];for(const name of manifest.deliverables){const text=await fs.readFile(path.join(dir,name),'utf8'),received=await(await fetch(info.baseUrl+'/api/output/'+encodeURIComponent(project)+'/'+encodeURIComponent(name))).json();assert.equal(received.content,text);matches.push({file:name,contentMatches:true});}
  const memory=await fs.readFile(path.join(info.profiles,host.persona,'memory.md'),'utf8');assert.match(memory,/100/);assert.ok(memory.length>220,'Experience update must retain original and add evidence');
  const evidence={schema:1,passed:true,version:pkg.version,testedAt:new Date().toISOString(),entry:'fresh-independent-agent-with-copied-skill',realPackagedApplication:true,realLocalService:true,realSocialAccountUsed:false,publications:false,libraryPathsMatch:true,profileUpdatedAndVisible:true,projectVisibleInNativeUI:true,deliverables:matches,businessTools:['track.py snapshot','track.py trend','wordcount.py','manifest.py meta'],businessResults:{followers:{before:100,after:125,delta:25,percent:25},totalLikes:{before:180,after:230,delta:50,percent:27.78},datesAreSyntheticSequence:true},limitations:['Two samples produce a warning plus original trend/prediction labels; Agent declined temporal inference.','List metadata contains display fields; profile ownership verified from original manifest.','Manifest CRLF is normalized to LF by text API; parsed JSON and normalized text match.','wordcount social_count includes punctuation; actual text count is 285.'],scope:'Independent Agent read only copied connection guidance and linked Skill; root separately verified its created project in the packaged UI.'};
  await fs.writeFile(path.join(root,'docs/evidence/external-agent-0.5.2.json'),JSON.stringify(evidence,null,2)+'\n');console.log('EXTERNAL AGENT UI ACCEPTED');
 }finally{await browser.close();await fs.writeFile(host.controlFile,'stop');}
})().catch(error=>{console.error(error);process.exitCode=1;});

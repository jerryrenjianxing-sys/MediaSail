// Genuine cached browser/session retention. Only the disposable hosted Windows fixture may call this.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),cp=require('node:child_process'),http=require('node:http');
function hosted(){assert.equal(process.platform,'win32');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Never run this installer fixture on a user PC');}
async function startManagedBrowser({info,evidence,env}){
 hosted();
 const source=path.join(info.skillDir,'scripts/browser.ps1'),connection=info.connectionFile;
 const ps=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const commandHost=path.join(__dirname,'run-browser-job-fixture.ps1');
 function invoke(entry,args){
  const result=cp.spawnSync(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',commandHost,entry,...args],{env:{...env,GITHUB_ACTIONS:process.env.GITHUB_ACTIONS,RUNNER_ENVIRONMENT:process.env.RUNNER_ENVIRONMENT},encoding:'utf8',windowsHide:true,timeout:180000,maxBuffer:5e6});
  if(result.error)throw result.error;
  if(result.status!==0)throw Error('Browser fixture command failed: '+result.stdout+result.stderr);
  return JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''));
 }
 const status=invoke(source,['status','--connection',connection]);assert.equal(status.running,false);
 const html='<!doctype html><meta charset="utf-8"><title>MediaSail managed browser upgrade fixture</title><h1>专用浏览器升级验收</h1><p>合成页面，不使用平台账号。</p><input id="proof" aria-label="验收输入" value="中文 空格路径"><p id="saved"></p><script>document.querySelector("#saved").textContent=localStorage.getItem("mediasail-fixture")||"empty";</script>';
 const server=http.createServer((request,response)=>{response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Set-Cookie':'mediasail-fixture=retained; Path=/; SameSite=Lax'});response.end(html)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 let receipt,group;
 let closed=false;
 const raw=(...args)=>invoke(receipt.entry,['run','--group-config',receipt.groupConfig,'--session-ref',receipt.sessionRef,'--',...args]);
 const evaluate=expression=>{const sync=raw('cooperate','sync');return raw('evaluate',expression,'--context',sync.context_id,'--observation',sync.observation_id)};
 async function close(){
  if(closed)return;closed=true;
  const errors=[];
  try{
   if(receipt)try{invoke(receipt.entry,['disconnect','--group-config',receipt.groupConfig,'--session-ref',receipt.sessionRef]);}catch(error){errors.push(error);}
   if(group){
    try{
     const stopped=cp.spawnSync(path.join(group.cache,'bsk.exe'),['daemon','stop','--json'],{env:{...env,BSK_HOME:path.join(group.directory,'bsk-home'),BSK_AUTO_START:'0',BSK_AUTO_UPDATE:'off'},windowsHide:true,timeout:30000});
     assert.ifError(stopped.error);assert.equal(stopped.status,0);
    }catch(error){errors.push(error);}
    try{
     const quote=value=>"'"+String(value).replaceAll("'","''")+"'";
     const code=`$ErrorActionPreference='Stop';$p=Get-Process -Id ${group.browserPid} -ErrorAction SilentlyContinue;if($p){if($p.Path -ne ${quote(group.browserExecutable)} -or $p.StartTime.ToUniversalTime().Ticks.ToString() -ne ${quote(group.browserStarted)}){throw 'Fixture browser identity changed'};if(!$p.CloseMainWindow()){throw 'Normal fixture close failed'};if(!$p.WaitForExit(20000)){throw 'Fixture browser did not close normally'}}`;
     cp.execFileSync(ps,['-NoProfile','-NonInteractive','-Command',code],{env,windowsHide:true,timeout:30000});
    }catch(error){errors.push(error);}
   }
  }finally{await new Promise(resolve=>server.close(resolve));}
  if(errors.length)throw new AggregateError(errors,'Managed-browser fixture cleanup failed');
 }
 try{
  // Async CLI: keep the fixture HTTP server responsive while navigation waits.
  const result=await new Promise((resolve,reject)=>cp.execFile(ps,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',commandHost,source,'connect','--connection',connection,'--name','升级缓存验收','--url',url],{env:{...env,GITHUB_ACTIONS:process.env.GITHUB_ACTIONS,RUNNER_ENVIRONMENT:process.env.RUNNER_ENVIRONMENT},encoding:'utf8',windowsHide:true,timeout:180000},(error,stdout,stderr)=>error?reject(Error(stdout+stderr)):resolve(JSON.parse(stdout.trim()))));
  receipt=result;
  group=JSON.parse(await fs.readFile(receipt.groupConfig,'utf8'));
  assert.equal(receipt.ok,true);assert.equal(receipt.navigationWarning,undefined);
  const first=evaluate('(()=>{localStorage.setItem("mediasail-fixture","retained");return {title:document.title,value:document.querySelector("#proof").value,cookie:document.cookie,marker:localStorage.getItem("mediasail-fixture")}})()');
  assert.equal(first.ok,true);assert.equal(first.value.title,'MediaSail managed browser upgrade fixture');assert.equal(first.value.value,'中文 空格路径');assert.match(first.value.cookie,/mediasail-fixture=retained/);assert.equal(first.value.marker,'retained');
  const record={passed:false,libraryId:info.libraryId,cache:group.cache,bundleId:group.bundleId,browserPid:group.browserPid,toolVersion:group.toolVersion,browserVersion:group.browserVersion,checkedWithoutGlobalNodePython:true,commandOwnership:'test-owned nested BREAKAWAY_OK Job per CLI; outer runner Job unchanged'};
  await fs.writeFile(path.join(evidence,'managed-browser.json'),JSON.stringify(record,null,2));
  return {
   async verify(stage){
    const observation=raw('observe');assert.match(observation.text,/专用浏览器升级验收/);
    const current=JSON.parse(await fs.readFile(receipt.groupConfig,'utf8'));assert.equal(current.browserPid,group.browserPid);assert.equal(current.cache,group.cache);
    const read=evaluate('({cookie:document.cookie,marker:localStorage.getItem("mediasail-fixture"),value:document.querySelector("#proof").value})');
    assert.equal(read.ok,true);assert.equal(read.value.marker,'retained');assert.match(read.value.cookie,/mediasail-fixture=retained/);assert.equal(read.value.value,'中文 空格路径');
    record.stages??=[];record.stages.push(stage);record.passed=true;await fs.writeFile(path.join(evidence,'managed-browser.json'),JSON.stringify(record,null,2));
   },
   close
  };
 }catch(error){try{await close();}catch(cleanupError){throw new AggregateError([error,cleanupError],'Managed-browser fixture and cleanup failed');}throw error;}
}
module.exports={startManagedBrowser};

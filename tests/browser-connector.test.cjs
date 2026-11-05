'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net'),crypto=require('node:crypto'),cp=require('node:child_process');
test('desktop browser connection checks identity and retains a request result for retries',async()=>{
 const {BrowserConnector}=require('../desktop/browser-connector.cjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail connector 中文 '));
 // A real child PowerShell fixture represents the native process boundary.
 const entry=path.join(directory,'fixture.ps1');await fs.writeFile(entry,"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);'{\"ok\":true,\"sessionRef\":\"test-receipt\"}'");
 const info={schema:1,product:'MediaSail',status:'ready',pid:process.pid,executable:process.execPath,instanceId:crypto.randomUUID(),libraryId:'test-library',libraryRoot:directory,workspace:path.join(directory,'workspace'),connectionFile:path.join(directory,'connection.json')};
 const host=new BrowserConnector({info,bootstrap:directory,data:directory,entry,available:()=>true});
 const descriptor=await host.start();const secret=JSON.parse(await fs.readFile(descriptor.credentialFile,'utf8'));
 const exchange=message=>new Promise((resolve,reject)=>{const socket=net.createConnection(descriptor.pipe);let buffer='';socket.on('connect',()=>socket.end(JSON.stringify(message)+'\n'));socket.on('data',chunk=>buffer+=chunk);socket.on('end',()=>{try{resolve(JSON.parse(buffer))}catch(error){reject(error)}});socket.on('error',reject);});
 const request={schema:1,instanceId:info.instanceId,libraryId:info.libraryId,token:secret.token,requestId:crypto.randomUUID(),action:'connect',name:'test',url:'https://example.invalid/'};
 try{
  assert.equal((await exchange({...request,token:'0'.repeat(64)})).code,'connector_unauthorized');
  assert.equal((await exchange({...request,libraryId:'wrong'})).code,'library_mismatch');
  assert.equal((await exchange({...request,command:'arbitrary'})).code,'invalid_request');
  assert.equal((await exchange({...request,url:'file:///C:/arbitrary'})).code,'invalid_request');
  assert.equal((await exchange({...request,url:'https://user:password@example.invalid/'})).code,'invalid_request');
  const first=await exchange(request);assert.equal(first.ok,true);
  let result;for(let i=0;i<100;i++){result=await exchange({...request,action:'status'});if(result.state!=='pending')break;await new Promise(resolve=>setTimeout(resolve,25));}
  assert.equal(result.state,'completed');assert.equal(result.receipt.sessionRef,'test-receipt');
  assert.deepEqual(await exchange(request),result);
  assert.equal((await exchange({...request,url:'https://different.invalid/'})).code,'request_conflict');
  assert.equal(host.busy(),false);
  if(process.platform==='win32'){
   const manifest=path.join(directory,'manifest.json');await fs.writeFile(manifest,JSON.stringify({schema:1,product:'MediaSailBrowser',bundleId:'a'.repeat(64)}));
   await fs.writeFile(path.join(directory,'.mediasail-library.json'),JSON.stringify({product:'MediaSail',state:'ready',libraryId:info.libraryId}));
   await fs.writeFile(info.connectionFile,JSON.stringify({...info,browserTools:{manifest,connector:descriptor}}));
   const cli=path.resolve(__dirname,'../agent-skill/mediasail/scripts/browser.ps1');
   const output=await new Promise((resolve,reject)=>cp.execFile(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',cli,'connect','--connection',info.connectionFile],{encoding:'utf8',windowsHide:true,timeout:20000},(error,stdout,stderr)=>error?reject(Error(stdout+stderr)):resolve(JSON.parse(stdout.trim()))));
   assert.equal(output.ok,true);assert.equal(output.sessionRef,'test-receipt');assert.match(output.requestId,/^[a-f0-9-]{36}$/);
  }
 }finally{await host.close();}
 await assert.rejects(fs.access(descriptor.credentialFile),{code:'ENOENT'});
});

test('concurrent retries start one desktop connection and shutdown drains an admitted request',async()=>{
 const {BrowserConnector}=require('../desktop/browser-connector.cjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail request retries ')),counter=path.join(directory,'starts.txt'),entry=path.join(directory,'fixture.ps1');
 await fs.writeFile(entry,"[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);[IO.File]::AppendAllText('"+counter.replaceAll("'","''")+"','1');Start-Sleep -Milliseconds 400;'{\"ok\":true,\"sessionRef\":\"one-session\"}'");
 const info={instanceId:crypto.randomUUID(),libraryId:'retry-library',connectionFile:path.join(directory,'connection.json')};
 let available=true;const host=new BrowserConnector({info,bootstrap:directory,data:directory,entry,available:()=>available});const descriptor=await host.start();const {token}=JSON.parse(await fs.readFile(descriptor.credentialFile,'utf8'));
 const exchange=message=>new Promise((resolve,reject)=>{const socket=net.createConnection(descriptor.pipe);let buffer='';socket.on('connect',()=>socket.end(JSON.stringify(message)+'\n'));socket.on('data',chunk=>buffer+=chunk);socket.on('end',()=>{try{resolve(JSON.parse(buffer))}catch(error){reject(error)}});socket.on('error',reject);});
 const request={schema:1,token,instanceId:info.instanceId,libraryId:info.libraryId,requestId:crypto.randomUUID(),action:'connect'};
 const results=await Promise.all(Array.from({length:5},()=>exchange(request)));assert.ok(results.every(result=>result.requestId===request.requestId));assert.equal(host.busy(),true);
 available=false;assert.equal((await exchange({...request,requestId:crypto.randomUUID()})).code,'desktop_busy');
 await host.close();assert.equal(host.busy(),false);assert.equal(await fs.readFile(counter,'utf8'),'1');
 const saved=JSON.parse(await fs.readFile(path.join(directory,'browser/connect-requests',request.requestId+'.json'),'utf8'));assert.equal(saved.state,'completed');assert.equal(saved.receipt.sessionRef,'one-session');
});

test('a completed startup whose final receipt cannot be saved is unknown rather than pending forever',{skip:process.platform!=='win32'},async()=>{
 const {BrowserConnector}=require('../desktop/browser-connector.cjs');
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail receipt failure ')),entry=path.join(directory,'fixture.ps1');
 await fs.writeFile(entry,"Start-Sleep -Milliseconds 500;'{\"ok\":true,\"sessionRef\":\"uncommitted-session\"}'");
 const info={instanceId:crypto.randomUUID(),libraryId:'failure-library',connectionFile:path.join(directory,'connection.json')};const host=new BrowserConnector({info,bootstrap:directory,data:directory,entry});const descriptor=await host.start();const {token}=JSON.parse(await fs.readFile(descriptor.credentialFile,'utf8'));
 const exchange=message=>new Promise((resolve,reject)=>{const socket=net.createConnection(descriptor.pipe);let buffer='';socket.on('connect',()=>socket.end(JSON.stringify(message)+'\n'));socket.on('data',chunk=>buffer+=chunk);socket.on('end',()=>{try{resolve(JSON.parse(buffer))}catch(error){reject(error)}});socket.on('error',reject);});
 const request={schema:1,token,instanceId:info.instanceId,libraryId:info.libraryId,requestId:crypto.randomUUID(),action:'connect'},file=path.join(directory,'browser/connect-requests',request.requestId+'.json');
 try{
  assert.equal((await exchange(request)).state,'pending');await fs.chmod(file,0o444);
  for(let i=0;i<100&&host.busy();i++)await new Promise(resolve=>setTimeout(resolve,25));assert.equal(host.busy(),false);
  const result=await exchange({...request,action:'status'});assert.equal(result.ok,false);assert.equal(result.code,'connect_unknown');
  assert.equal((await exchange(request)).code,'connect_unknown','The original request must not be replayed');
 }finally{await fs.chmod(file,0o666);await host.close();}
});

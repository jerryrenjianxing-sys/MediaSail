const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),entry=path.join(root,'agent-skill/mediasail/scripts/browser.ps1');
const shell=path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2));}
async function fixture(){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail browser 中文 '));
 const library=path.join(base,'资料库'),resources=path.join(base,'resources');
 await write(path.join(library,'.mediasail-library.json'),{schema:1,product:'MediaSail',state:'ready',libraryId:'test-library-browser-0512'});
 await fs.mkdir(path.join(library,'workspace'),{recursive:true});
 const browser=Buffer.from('synthetic browser executable for preparation tests only');
 const bsk=Buffer.from('synthetic tool executable; never launched');
 const archive=async(file,entries)=>{const source=file+'.source';for(const [name,bytes] of Object.entries(entries)){await fs.mkdir(path.dirname(path.join(source,name)),{recursive:true});await fs.writeFile(path.join(source,name),bytes);}const quote=value=>"'"+value.replaceAll("'","''")+"'";cp.execFileSync(shell,['-NoProfile','-NonInteractive','-Command','Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('+quote(source)+','+quote(file)+')'],{windowsHide:true});};
 await archive(path.join(resources,'browser.zip'),{'chrome.exe':browser});
 const extension=Buffer.from('{"manifest_version":3,"name":"test","version":"0.4.1"}');
 await archive(path.join(resources,'extension.zip'),{'manifest.json':extension});
 await write(path.join(resources,'bsk.exe'),bsk.toString());
 const manifest={schema:1,product:'MediaSailBrowser',bundleId:'a'.repeat(64),browser:{version:'156.0.8078.73',archive:'browser.zip',sha256:hash(await fs.readFile(path.join(resources,'browser.zip'))),executable:'browser/chrome.exe'},bsk:{version:'0.4.1',build:'mediasail.1',file:'bsk.exe',sha256:hash(bsk)},extension:{archive:'extension.zip',sha256:hash(await fs.readFile(path.join(resources,'extension.zip'))),extensionId:'abcdefghijklmnopabcdefghijklmnop'},cacheFiles:[{path:'browser/chrome.exe',sha256:hash(browser)},{path:'bsk.exe',sha256:hash(bsk)},{path:'extension/manifest.json',sha256:hash(extension)}]};
 await write(path.join(resources,'manifest.json'),manifest);
 const connection=path.join(library,'runtime/agent-connection.json');
 await write(connection,{schema:1,product:'MediaSail',status:'stopped',libraryRoot:library,libraryId:'test-library-browser-0512',workspace:path.join(library,'workspace'),connectionFile:connection,browserTools:{manifest:path.join(resources,'manifest.json'),entry}});
 return {base,library,resources,connection,manifest};
}
function call(info,action){const result=cp.spawnSync(shell,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',entry,action,'--connection',info.connection],{encoding:'utf8',windowsHide:true,timeout:30000});if(result.error)throw result.error;assert.ok(result.stdout.trim().startsWith('{'),result.stderr||result.stdout);return {...result,value:JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''))};}
test('browser tools prepare a verified offline cache without starting a browser',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture();
 const first=call(info,'prepare');
 assert.equal(first.status,0,JSON.stringify(first.value));assert.equal(first.value.ok,true);assert.equal(first.value.prepared,true);
 assert.equal(first.value.libraryId,'test-library-browser-0512');
 assert.equal(await fs.readFile(path.join(first.value.cache,'browser/chrome.exe'),'utf8'),'synthetic browser executable for preparation tests only');
 const again=call(info,'prepare');assert.equal(again.value.cache,first.value.cache);assert.equal(again.value.reused,true);
 const status=call(info,'status');assert.equal(status.value.running,false);assert.equal(status.value.prepared,true);
 await fs.access(path.join(info.library,'runtime/browser'));await assert.rejects(fs.access(path.join(info.library,'runtime/browser/profile')),{code:'ENOENT'});
});
test('the regular helper exposes browser status without a Python installation',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture();
 const helper=path.join(root,'agent-skill/mediasail/scripts/mediasail.ps1');
 const result=cp.spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'browser','status','--data-dir',path.dirname(info.connection)],{encoding:'utf8',windowsHide:true,timeout:15000});
 const value=JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''));
 assert.equal(result.status,0,JSON.stringify(value));assert.equal(value.ok,true);assert.equal(value.running,false);assert.equal(value.prepared,false);
});
test('an unknown session fails without preparing or launching another browser',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture();
 const result=cp.spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',entry,'run','--connection',info.connection,'--session-ref','11111111-1111-1111-1111-111111111111','--','observe'],{encoding:'utf8',windowsHide:true,timeout:15000});
 assert.ok(result.stdout.trim(),result.stderr);const value=JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''));
 assert.equal(result.status,1);assert.match(value.error,/session.*not found/i);
 await assert.rejects(fs.access(path.join(info.library,'runtime/browser/profile')),{code:'ENOENT'});
});

test('the regular browser helper preserves the native argument boundary',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture(),helper=path.join(root,'agent-skill/mediasail/scripts/mediasail.ps1');
 const result=cp.spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper,'browser','run','--data-dir',path.dirname(info.connection),'--session-ref','11111111-1111-1111-1111-111111111111','--','observe'],{encoding:'utf8',windowsHide:true,timeout:15000});
 const value=JSON.parse(result.stdout.trim().replace(/^\uFEFF/,''));
 assert.equal(result.status,1);assert.match(value.error,/session.*not found/i);
});

test('a library connection follows its discovery mirror once without a false loop',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture(),discovery=path.join(info.base,'bootstrap/agent-connection.json');
 const value=JSON.parse(await fs.readFile(info.connection,'utf8'));value.discoveryFile=discovery;
 await write(info.connection,value);await write(discovery,value);
 const answer=call(info,'status');
 assert.equal(answer.status,0,JSON.stringify(answer.value));assert.equal(answer.value.libraryId,value.libraryId);
});

test('damaged assets fail closed and an interrupted stage is never adopted',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture();
 const interrupted=path.join(info.library,'runtime/cache/browser-tool/.staging-interrupted/keep.txt');
 await write(interrupted,'retain incomplete preparation');
 const prepared=call(info,'prepare');assert.equal(prepared.status,0);
 const executable=path.join(prepared.value.cache,'bsk.exe');await write(executable,'damaged but retained');
 const failed=call(info,'prepare');assert.equal(failed.status,1);assert.match(failed.value.error,/verification failed/i);
 assert.equal(await fs.readFile(executable,'utf8'),'damaged but retained');assert.equal(await fs.readFile(interrupted,'utf8'),'retain incomplete preparation');
 await assert.rejects(fs.access(path.join(info.library,'runtime/browser/profile')),{code:'ENOENT'});
});

test('concurrent preparers activate one complete cache',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture();
 const run=()=>new Promise((resolve,reject)=>cp.execFile(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',entry,'prepare','--connection',info.connection],{encoding:'utf8',windowsHide:true,timeout:30000},(error,stdout)=>error?reject(error):resolve(JSON.parse(stdout.trim()))));
 const results=await Promise.all([run(),run()]);assert.ok(results.every(result=>result.ok));
 assert.equal(results[0].cache,results[1].cache);assert.equal(results.filter(result=>result.reused).length,1);
 assert.equal((await fs.readdir(results[0].cache)).includes('manifest.json'),true);
});

test('a stored session cannot be used with another library identity',{skip:process.platform!=='win32'},async()=>{
 const info=await fixture(),reference='22222222-2222-2222-2222-222222222222';
 await write(path.join(info.library,'runtime/browser/sessions',reference+'.json'),{schema:1,libraryId:'another-library',sessionRef:reference,state:'connected'});
 const result=cp.spawnSync(shell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',entry,'run','--connection',info.connection,'--session-ref',reference,'--','observe'],{encoding:'utf8',windowsHide:true,timeout:15000});
 assert.equal(result.status,1);assert.match(JSON.parse(result.stdout).error,/another library/i);
});

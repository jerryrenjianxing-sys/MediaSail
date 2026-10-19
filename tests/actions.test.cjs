const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {AITO_URL,projectDirectory,aitoHistoryDirectory,createActionsHandler}=require('../desktop/actions.cjs');

async function fixture(t){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail 打开 中文 ')),outputs=path.join(root,'共享资料库','workspace','outputs'),data=path.join(root,'共享资料库','runtime');
  await fs.mkdir(outputs,{recursive:true});await fs.mkdir(data,{recursive:true});
  t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));await fs.rm(root,{recursive:true,force:true});});
  const main={mainFrame:{url:'http://127.0.0.1:4567/'}},event={sender:main,senderFrame:main.mainFrame},calls=[];
  const shell={openExternal:async url=>{calls.push({kind:'external',url});},openPath:async directory=>{calls.push({kind:'path',directory});return '';}};
  const handler=createActionsHandler({shell,main:()=>main,localOrigin:()=> 'http://127.0.0.1:4567',outputs:()=>outputs,data:()=>data});
  return {root,outputs,data,main,event,calls,shell,handler};
}

test('AI publish opens exactly the fixed official URL and accepts no supplied URL or other action',async t=>{
  const f=await fixture(t);assert.equal(AITO_URL,'https://aitoearn.cn/zh-CN');
  assert.equal((await f.handler(f.event,'open-aitoearn')).ok,true);assert.deepEqual(f.calls,[{kind:'external',url:AITO_URL}]);
  for(const input of ['https://other.example','file:///private',{},null])assert.equal((await f.handler(f.event,'open-aitoearn',input)).ok,false);
  for(const action of ['external','send','retry','openDraft','https://other.example','constructor',null])assert.equal((await f.handler(f.event,action)).ok,false);
  assert.equal(f.calls.length,1);assert.deepEqual(await fs.readdir(f.data),[]);
});

test('only the current local main window and root main frame may use any action',async t=>{
  const f=await fixture(t),other={mainFrame:{url:'http://127.0.0.1:4567/'}};
  for(const url of ['https://aitoearn.cn/zh-CN','http://127.0.0.1:4567/assets/index.html','http://127.0.0.1:9999/','http://127.0.0.1:4567/?remote=1','file:///app/startup.html','not a URL']){
    f.main.mainFrame.url=url;
    for(const action of ['open-aitoearn','open-project-folder','open-aito-history'])assert.equal((await f.handler(f.event,action,'fixture')).ok,false);
  }
  f.main.mainFrame.url='http://127.0.0.1:4567/';
  for(const event of [{sender:other,senderFrame:other.mainFrame},{sender:f.main,senderFrame:{url:f.main.mainFrame.url}},{sender:f.main,senderFrame:null}])assert.equal((await f.handler(event,'open-aitoearn')).ok,false);
  const unavailable=createActionsHandler({shell:f.shell,main:()=>f.main,localOrigin:()=> 'http://127.0.0.1:4567',outputs:()=>f.outputs,data:()=>f.data,available:()=>false});
  assert.match((await unavailable(f.event,'open-aitoearn')).error,/退出|切换/);assert.equal(f.calls.length,0);
});

test('opens an existing Chinese and spaced top-level project without reading or changing its files',async t=>{
  const f=await fixture(t),name='中文 成品 项目',project=path.join(f.outputs,name);await fs.mkdir(project);
  const file=path.join(project,'.easel.json'),bytes=Buffer.from('malformed metadata is irrelevant to opening a folder');await fs.writeFile(file,bytes);
  const before=await fs.stat(file);assert.equal((await f.handler(f.event,'open-project-folder',name)).ok,true);
  assert.deepEqual(f.calls,[{kind:'path',directory:await fs.realpath(project)}]);assert.deepEqual(await fs.readFile(file),bytes);assert.equal((await fs.stat(file)).mtimeMs,before.mtimeMs);
  await fs.rm(project,{recursive:true});assert.match((await f.handler(f.event,'open-project-folder',name)).error,/不存在|普通文件夹/);assert.equal(f.calls.length,1);
});

test('project action refuses traversal, absolute paths, nested paths, aliases and system folders',async t=>{
  const f=await fixture(t),outside=path.join(f.root,'outside');await fs.mkdir(outside);await fs.mkdir(path.join(f.outputs,'项目'));
  for(const name of ['',null,{},['项目'],'.','..','../outside','..\\outside','项目/子目录','项目\\子目录',outside,'C:\\other','C:other','\\\\server\\share','项目:stream','项目.','项目 ','x\0y','_analytics','.hidden','analytics','WECHAT'])assert.equal((await f.handler(f.event,'open-project-folder',name)).ok,false,String(name));
  await fs.writeFile(path.join(f.outputs,'ordinary.txt'),'must not open a file');assert.equal((await f.handler(f.event,'open-project-folder','ordinary.txt')).ok,false);
  assert.equal(f.calls.length,0);assert.deepEqual(await fs.readdir(outside),[]);
});

test('project junctions both inside and outside the library and a linked outputs root are rejected',async t=>{
  const f=await fixture(t),outside=path.join(f.root,'outside'),inside=path.join(f.outputs,'真实项目');await fs.mkdir(outside);await fs.mkdir(inside);
  const type=process.platform==='win32'?'junction':'dir';
  for(const [name,target] of [['越界链接',outside],['同库链接',inside]]){await fs.symlink(target,path.join(f.outputs,name),type);assert.equal((await f.handler(f.event,'open-project-folder',name)).ok,false);}
  const linkedRoot=path.join(f.root,'linked-outputs');await fs.symlink(f.outputs,linkedRoot,type);await assert.rejects(projectDirectory(linkedRoot,'真实项目'),/不可用/);
  assert.equal(f.calls.length,0);assert.deepEqual(await fs.readdir(outside),[]);
});

test('opening old AI history neither creates missing storage nor parses or rewrites old records',async t=>{
  const f=await fixture(t),history=path.join(f.data,'aitoearn');
  assert.match((await f.handler(f.event,'open-aito-history')).error,/没有|未创建/);assert.deepEqual(await fs.readdir(f.data),[]);assert.equal(f.calls.length,0);
  await fs.mkdir(history);const record=path.join(history,'imports.json'),bytes=Buffer.from('{broken old record, uploading/creating tasks must stay untouched');await fs.writeFile(record,bytes);const before=await fs.stat(record);
  assert.equal((await f.handler(f.event,'open-aito-history')).ok,true);assert.deepEqual(f.calls,[{kind:'path',directory:await fs.realpath(history)}]);assert.deepEqual(await fs.readFile(record),bytes);assert.equal((await fs.stat(record)).mtimeMs,before.mtimeMs);
  for(const input of [history,'../../other',{},null])assert.equal((await f.handler(f.event,'open-aito-history',input)).ok,false);
  assert.equal(f.calls.length,1);assert.deepEqual(await fs.readdir(f.data),['aitoearn']);
});

test('old AI history must be an ordinary fixed directory, never a file, junction or unavailable data root',async t=>{
  const f=await fixture(t),history=path.join(f.data,'aitoearn'),outside=path.join(f.root,'outside');await fs.mkdir(outside);await fs.writeFile(history,'keep');
  assert.equal((await f.handler(f.event,'open-aito-history')).ok,false);assert.equal(await fs.readFile(history,'utf8'),'keep');await fs.unlink(history);
  await fs.symlink(outside,history,process.platform==='win32'?'junction':'dir');assert.equal((await f.handler(f.event,'open-aito-history')).ok,false);
  await assert.rejects(aitoHistoryDirectory(null),/尚未连接/);await assert.rejects(projectDirectory(null,'项目'),/尚未连接/);assert.equal(f.calls.length,0);assert.deepEqual(await fs.readdir(outside),[]);
});

test('Windows directory spelling uses filesystem case rules without accepting another location',{skip:process.platform!=='win32'},async t=>{
  const f=await fixture(t),project=path.join(f.outputs,'Agent Project');await fs.mkdir(project);await fs.mkdir(path.join(f.data,'AitoEarn'));
  assert.equal((await f.handler(f.event,'open-project-folder','agent project')).ok,true);assert.equal((await f.handler(f.event,'open-aito-history')).ok,true);assert.equal(f.calls.length,2);
});

test('filesystem permission and OS launcher failures are returned without claiming success',async t=>{
  const f=await fixture(t),project=path.join(f.outputs,'项目');await fs.mkdir(project);
  // Hosted Windows TEMP may use RUNNER~1 while realpath expands its long name.
  const canonical=await fs.realpath(project);
  let denied=0;
  const original=fs.lstat,mocked=t.mock.method(fs,'lstat',async target=>{if(typeof target==='string'&&path.relative(canonical,target)===''){denied++;const error=Error('ACL denied');error.code='EACCES';throw error;}return original(target);});
  assert.match((await f.handler(f.event,'open-project-folder','项目')).error,/权限/);assert.equal(denied,1,'The permission fault must actually hit the canonical project path');assert.equal(f.calls.length,0);mocked.mock.restore();
  f.shell.openExternal=async()=>{throw Error('no default application');};const browser=await f.handler(f.event,'open-aitoearn');assert.equal(browser.ok,false);assert.match(browser.error,/默认浏览器/);
  f.shell.openPath=async()=> 'Explorer rejected this location';let result=await f.handler(f.event,'open-project-folder','项目');assert.equal(result.ok,false);assert.match(result.error,/文件管理器.*Explorer rejected/);
  f.shell.openPath=async()=>{throw Error('launcher unavailable');};result=await f.handler(f.event,'open-project-folder','项目');assert.equal(result.ok,false);assert.match(result.error,/文件管理器.*launcher unavailable/);
});

test('preload exposes exactly three narrow actions and propagates explicit failures',async()=>{
  const exposed={},calls=[];let response={ok:true,data:true};
  const electron={contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},ipcRenderer:{invoke:async(...args)=>{calls.push(args);return response;},on:()=>{},removeListener:()=>{}}};
  vm.runInNewContext(await fs.readFile(path.join(__dirname,'../desktop/preload.cjs'),'utf8'),{require:id=>{assert.equal(id,'electron');return electron;}});
  assert.equal(exposed.desktopAito,undefined);assert.deepEqual(Object.keys(exposed.desktopActions).sort(),['openAitoHistory','openAitoearn','openProjectFolder']);
  await exposed.desktopActions.openAitoearn('https://other.example');await exposed.desktopActions.openProjectFolder('中文 项目');await exposed.desktopActions.openAitoHistory('C:\\outside');
  assert.deepEqual(calls,[['actions:call','open-aitoearn',undefined],['actions:call','open-project-folder','中文 项目'],['actions:call','open-aito-history',undefined]]);
  response={ok:false,error:'系统无法打开'};await assert.rejects(exposed.desktopActions.openAitoearn(),/系统无法打开/);
});

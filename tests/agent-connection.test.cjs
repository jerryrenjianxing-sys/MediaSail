const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {AgentConnection,writeDisconnectedDiscovery}=require('../desktop/agent-connection.cjs');
test('discovery is atomic, secret-free, changes instance/port, and cannot stop a newer owner',()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'MediaSail 中文 '));
 try{
  const c=new AgentConnection(data),options={python:'C:/runtime/python.exe',env:{EASEL_DESKTOP_WORKSPACE:path.join(data,'workspace'),EASEL_DESKTOP_NODE:'C:/runtime/node.exe',PATH:'C:/runtime',HOME:path.join(data,'home'),EASEL_DESKTOP_TOKEN:'private-desktop-token',OPENAI_API_KEY:'private-model-key',HTTPS_PROXY:'https://private-proxy'}};
  const args={version:'0.4.0',baseUrl:'http://127.0.0.1:50111',options,skillDir:'C:/app/agent-skill/mediasail',executable:'C:/app/MediaSail.exe'};
  c.begin(args);c.write('ready');
  const first=JSON.parse(fs.readFileSync(c.file,'utf8'));
  assert.equal(first.status,'ready');assert.equal(first.baseUrl,args.baseUrl);
  assert.doesNotMatch(fs.readFileSync(c.file,'utf8'),/private-|TOKEN|API_KEY|HTTPS_PROXY/);
  const backend=JSON.parse(options.env.EASEL_AGENT_CONNECTION_JSON);assert.equal(backend.instanceId,first.instanceId);
  const next=new AgentConnection(data);next.begin({...args,baseUrl:'http://127.0.0.1:50222'});
  c.stop();assert.equal(JSON.parse(fs.readFileSync(c.file,'utf8')).baseUrl,'http://127.0.0.1:50222');
  next.stop();const stopped=JSON.parse(fs.readFileSync(c.file,'utf8'));assert.equal(stopped.status,'stopped');assert.equal(stopped.baseUrl,null);assert.equal(stopped.workspace,first.workspace);
  assert.equal(fs.readdirSync(data).filter(f=>f.endsWith('.tmp')).length,0);
 }finally{fs.rmSync(data,{recursive:true,force:true});}
});

test('no selected library replaces stale discovery without leaking old paths or restoring an old owner',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'MediaSail selection '));
 try{
  const mirror=path.join(root,'bootstrap/agent-connection.json'),old=new AgentConnection(path.join(root,'old'));
  old.begin({version:'0.5.2',baseUrl:'http://127.0.0.1:11111',options:{python:'private-old-python',env:{EASEL_DESKTOP_WORKSPACE:'private-old-workspace'}},skillDir:'private-old-skill',selectedProfile:'private-old-profile',executable:'MediaSail.exe',discoveryFile:mirror});
  writeDisconnectedDiscovery({file:mirror,version:'0.5.3',executable:'MediaSail.exe'});old.stop();
  const value=JSON.parse(fs.readFileSync(mirror,'utf8'));assert.equal(value.status,'needs-library');assert.equal(value.needsLibrarySelection,true);assert.equal(value.connectionFile,mirror);
  for(const key of ['baseUrl','libraryRoot','libraryId','dataDir','workspace','skillDir','python','profiles','outputs','tools','selectedProfile'])assert.equal(value[key],null,key);
  assert.deepEqual(value.environment,{});assert.doesNotMatch(fs.readFileSync(mirror,'utf8'),/private-old/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('an old library cannot replace the discovery mirror of the new library on exit',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'MediaSail libraries '));
 try{
  const mirror=path.join(root,'bootstrap','agent-connection.json');
  const args={version:'0.5.2',baseUrl:'http://127.0.0.1:11111',options:{python:'python.exe',env:{EASEL_DESKTOP_WORKSPACE:path.join(root,'workspace')}},skillDir:'skill',executable:'MediaSail.exe',discoveryFile:mirror};
  const old=new AgentConnection(path.join(root,'old'));old.begin({...args,libraryId:'old-library'});
  const next=new AgentConnection(path.join(root,'next'));next.begin({...args,libraryId:'next-library'});
  old.stop();assert.equal(JSON.parse(fs.readFileSync(mirror,'utf8')).libraryId,'next-library');
  assert.equal(JSON.parse(fs.readFileSync(mirror,'utf8')).connectionFile,next.file);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {AgentConnection}=require('../desktop/agent-connection.cjs');
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

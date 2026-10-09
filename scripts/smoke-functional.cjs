const path=require('node:path'),fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');
const {syncWorkspace}=require('../desktop/workspace.cjs');const {freePort,environment,startSupervisor,stopSupervisor,state}=require('../desktop/runtime.cjs');
(async()=>{
 const root=path.resolve(__dirname,'..'), data=path.join(root,'.test-data/功能验证 v2'), resources=process.env.EASEL_TEST_RESOURCES || path.join(root,'build');
 let requests=0;
 const mock=http.createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  if(req.url?.endsWith('/models')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'desktop-mock'}]}));return;}
  requests++;const input=JSON.parse(body||'{}');const text='ElectronEasel integration test passed.';
  if(input.stream){res.setHeader('Content-Type','text/event-stream');for(const chunk of [{delta:{role:'assistant',content:text},finish_reason:null},{delta:{},finish_reason:'stop'}])res.write('data: '+JSON.stringify({id:'test',object:'chat.completion.chunk',created:Math.floor(Date.now()/1000),model:'desktop-mock',choices:[{index:0,...chunk}]})+'\n\n');res.end('data: [DONE]\n\n');}
  else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'test',object:'chat.completion',choices:[{index:0,message:{role:'assistant',content:text},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));}
 });await new Promise(r=>mock.listen(0,'127.0.0.1',r));
 const work=await syncWorkspace(path.join(resources,'payload'),data);
 const port=await freePort(7860),gateway=await freePort(37289),options=environment(resources,data,work,port,gateway),url=`http://127.0.0.1:${port}`;
 const bridge=process.env.EASEL_TEST_RESOURCES || root;
 let child;const launch=async()=>{child=startSupervisor(bridge,options,e=>{if(e.event==='error')console.log(e.message);});const deadline=Date.now()+180000;while(Date.now()<deadline){if(child.exitCode!==null)throw new Error('Startup failed');try{const s=await state(url,options.env.EASEL_DESKTOP_TOKEN);const r=await fetch(url+'/api/status',{signal:AbortSignal.timeout(6000)});if(s.ready&&(await r.json()).gateway)return;}catch{}await new Promise(r=>setTimeout(r,700));}throw new Error('Timeout');};
 const post=async(endpoint,value)=>{const r=await fetch(url+endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(endpoint+' '+r.status+' '+await r.text());return r.json();};
 try{
  await launch();console.log('ISOLATED RUNTIME READY');
  const form=new FormData();form.append('sessionId','desktop-functional');form.append('files',new Blob(['素材中文测试'],{type:'text/plain'}),'素材 测试.txt');
  const upload=await fetch(url+'/api/upload',{method:'POST',body:form});assert.equal(upload.status,200);console.log('ATTACHMENT IMPORT OK');
  const idea=await post('/api/ideas',{title:'桌面测试选题',note:'持久化验证'});
  const settings=await post('/api/settings/models/save',{channel:'chat',rows:[{slot:'custom',name:'desktop-test',model:'desktop-mock',baseUrl:`http://127.0.0.1:${mock.address().port}/v1`,key:'desktop-test-key-only',protocol:'openai',primary:true}]});assert.equal(settings.ok,true);console.log('ORIGINAL MODEL SETTINGS SAVED');
  // Only the disposable test profile allows our local mock; product policies are unchanged.
  const cfgFile=options.env.OPENCLAW_CONFIG_PATH,cfg=JSON.parse(fs.readFileSync(cfgFile));cfg.models.providers['desktop-test'].request={allowPrivateNetwork:true};cfg.models.providers['desktop-test'].api='openai-completions';fs.writeFileSync(cfgFile,JSON.stringify(cfg));
  await stopSupervisor(child);await launch();
  const ideas=await(await fetch(url+'/api/ideas')).json();assert.ok(ideas.some(x=>x.id===idea.id));assert.equal(JSON.parse(fs.readFileSync(cfgFile)).models.providers['desktop-test'].apiKey,'desktop-test-key-only');console.log('RESTART PRESERVES CONTENT AND SETTINGS');
  const result=await fetch(url+'/api/chat/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'Reply with the integration test confirmation.',sessionId:'desktop-functional-'+Date.now()}),signal:AbortSignal.timeout(90000)});
  const stream=await result.text();fs.writeFileSync(path.join(data,'chat-test.txt'),stream);assert.ok(stream.includes('ElectronEasel integration test passed.'),stream.slice(-2000));assert.ok(requests>0);console.log('CHAT THROUGH REAL GATEWAY + LOCAL MOCK MODEL OK');
 }finally{await stopSupervisor(child);mock.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {ImportStore,selectedFile}=require('../desktop/aitoearn/imports.cjs');
const {AitoError,WebsiteAdapter,pageRequest,sameDraft}=require('../desktop/aitoearn/adapter.cjs');
const testRoot=path.resolve(__dirname,'../.test-data/aito-unit');fs.mkdirSync(testRoot,{recursive:true});
function fixture(t){
  const root=fs.mkdtempSync(path.join(testRoot,'case-')),outputs=path.join(root,'outputs');fs.mkdirSync(path.join(outputs,'中文 项目'),{recursive:true});
  for(const name of ['甲.png','乙.png','片段.mp4'])fs.writeFileSync(path.join(outputs,'中文 项目',name),'fixture '+name);
  const remote={user:{id:'user-1',name:'测试账号'},groups:[{id:'group-1',name:'测试草稿箱'}],drafts:[],puts:0,creates:0};
  const adapter={identity:async()=>remote.user,groups:async()=>remote.groups,createGroup:async()=>remote.groups[0],sign:async f=>({id:f.hash,url:'https://assets.aitoearn.cn/'+f.hash,uploadUrl:'https://assets.aitoearn.cn/upload/'+f.hash}),confirm:async id=>({url:'https://assets.aitoearn.cn/'+id}),createDraft:async payload=>{remote.creates++;const draft={...payload,id:'draft-'+remote.creates};remote.drafts.push(draft);return {id:draft.id};},findDraft:async p=>remote.drafts.find(d=>sameDraft(d,p))?.id||null};
  const upload=async(_file,_meta,_sign,signal,progress)=>{if(signal.aborted)throw new AitoError('暂停','paused');remote.puts++;progress(1);};
  const options={data:root,outputs,adapter,upload};const store=new ImportStore(options);
  const input={title:'中文标题',body:'正文\n#话题',images:['中文 项目/乙.png','中文 项目/甲.png'],cover:'中文 项目/甲.png',groupId:'group-1',accountId:'user-1'};
  t.after(async()=>{await store.shutdown();if(!root.startsWith(testRoot+path.sep))throw new Error('Unsafe test cleanup');fs.rmSync(root,{recursive:true,force:true});});
  return {root,outputs,remote,adapter,store,input,options};
}
test('draft transfer preserves text and order, reuses uploads, and deduplicates repeat clicks',async t=>{
  const f=fixture(t);const id=await f.store.start(f.input);await f.store.running;
  const job=f.store.state.jobs[0];assert.equal(job.status,'done');assert.equal(f.remote.puts,2);assert.equal(f.remote.creates,1);
  assert.equal(f.remote.drafts[0].desc,f.input.body);assert.equal(f.remote.drafts[0].type,'article');
  assert.equal(f.remote.drafts[0].mediaList[0].url,job.uploads[job.files[0].hash].url);
  assert.equal(await f.store.start(f.input),id);assert.equal(f.remote.creates,1);
  assert.equal(JSON.stringify(f.store.snapshot()).includes('uploadUrl'),false);
});
test('only selected media confined to outputs may be uploaded, including junction checks',async t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.root,'secret.png'),'private');
  await assert.rejects(selectedFile(f.outputs,'../secret.png'),/内容库/);
  await assert.rejects(selectedFile(f.outputs,path.join(f.root,'secret.png')),/路径/);
  fs.mkdirSync(path.join(f.root,'outside'));fs.writeFileSync(path.join(f.root,'outside','secret.png'),'private');
  fs.symlinkSync(path.join(f.root,'outside'),path.join(f.outputs,'escape'),'junction');
  await assert.rejects(selectedFile(f.outputs,'escape/secret.png'),/内容库/);
  fs.writeFileSync(path.join(f.outputs,'中文 项目','key.env'),'private');
  await assert.rejects(selectedFile(f.outputs,'中文 项目/key.env'),/支持/);
});
test('account changes and missing group prevent all uploads',async t=>{
  const f=fixture(t);f.remote.user={id:'user-2',name:'另一账号'};
  await assert.rejects(f.store.start(f.input),/账号已改变/);assert.equal(f.remote.puts,0);
  f.remote.user.id='user-1';await assert.rejects(f.store.start({...f.input,groupId:'foreign'}),/不属于/);
  await assert.rejects(f.store.start({...f.input,images:[]}),/图片或一个视频/);
});
test('single video and its cover become a video draft without image attachments',async t=>{
  const f=fixture(t);await f.store.start({...f.input,images:[],video:'中文 项目/片段.mp4'});await f.store.running;
  const draft=f.remote.drafts[0];assert.equal(draft.type,'video');assert.equal(draft.mediaList.length,1);assert.equal(draft.mediaList[0].type,'video');assert.ok(draft.coverUrl);assert.equal(f.remote.puts,2);
});
test('a lost create response stays uncertain across restart and reconciles without reposting',async t=>{
  const f=fixture(t),create=f.adapter.createDraft;
  f.adapter.createDraft=async p=>{await create(p);throw new AitoError('超时','uncertain');};
  const id=await f.store.start(f.input);await f.store.running;
  assert.equal(f.store.state.jobs[0].status,'uncertain');
  await f.store.start(f.input);assert.equal(f.remote.creates,1);
  const reopened=new ImportStore(f.options);assert.equal(reopened.state.jobs[0].status,'uncertain');
  await assert.rejects(reopened.retry(id),/先核对/);assert.equal(await reopened.reconcile(id),true);
  assert.equal(reopened.state.jobs[0].draftId,'draft-1');assert.equal(f.remote.creates,1);
});
test('absent uncertain draft requires explicit reconciliation and retry',async t=>{
  const f=fixture(t);const create=f.adapter.createDraft;
  f.adapter.createDraft=async()=>{throw new AitoError('超时','uncertain');};
  const id=await f.store.start(f.input);await f.store.running;
  await assert.rejects(f.store.retry(id,true),/先核对/);assert.equal(await f.store.reconcile(id),false);
  f.adapter.createDraft=create;await f.store.retry(id,true);await f.store.running;
  assert.equal(f.remote.puts,2);assert.equal(f.remote.creates,1);assert.equal(f.store.state.jobs[0].status,'done');
});
test('expired login pauses import and resumes under original account without reupload',async t=>{
  const f=fixture(t);let attempts=0;const create=f.adapter.createDraft;
  f.adapter.createDraft=async p=>{if(!attempts++)throw new AitoError('重新登录','login');return create(p);};
  const id=await f.store.start(f.input);await f.store.running;assert.equal(f.store.state.jobs[0].status,'login');
  await f.store.retry(id);await f.store.running;assert.equal(f.remote.puts,2);assert.equal(f.remote.creates,1);
});
test('checkpointed interrupted upload resumes only remaining files',async t=>{
  const f=fixture(t);let calls=0;const original=f.store.upload;
  f.store.upload=async(...args)=>{if(++calls===2)throw new AitoError('连接中断');return original(...args);};
  const id=await f.store.start(f.input);await f.store.running;assert.equal(f.store.state.jobs[0].status,'failed');
  f.store.upload=original;await f.store.retry(id);await f.store.running;assert.equal(f.remote.puts,2);assert.equal(f.remote.creates,1);
});
test('in-flight create is restored as uncertain and corrupt history is never overwritten',async t=>{
  const f=fixture(t);const id=await f.store.start(f.input);await f.store.running;
  f.store.state.jobs[0].status='creating';f.store.save();const restored=new ImportStore(f.options);assert.equal(restored.state.jobs.find(j=>j.id===id).status,'uncertain');
  fs.writeFileSync(f.store.file,'broken');assert.throws(()=>new ImportStore(f.options),/不会覆盖/);assert.equal(fs.readFileSync(f.store.file,'utf8'),'broken');
});
test('website adapter rejects every publishing endpoint before reaching the website',async()=>{
  const adapter=new WebsiteAdapter(()=>{throw new Error('Must not reach website');});
  await assert.rejects(adapter.request('v2/channels/publish/flows','POST',{}),/不支持/);
  await assert.rejects(adapter.request('https://other.example/upload','POST',{}),/不支持/);
  await assert.rejects(adapter.request('material/other','DELETE'),/不支持/);
});
test('isolated page request keeps bearer token in the website and validates account and origin',async()=>{
  let calls=0;
  const sandbox={location:{origin:'https://aitoearn.cn'},localStorage:{getItem:()=>JSON.stringify({state:{token:'fixture-private-token',userInfo:{id:'u'}}})},setTimeout,clearTimeout,AbortController,fetch:async(url,options)=>{calls++;assert.equal(url,'https://aitoearn.cn/api/user/mine');assert.equal(options.headers.Authorization,'Bearer fixture-private-token');return {ok:true,status:200,json:async()=>({code:0,data:{id:'u'}})};}};
  const result=await vm.runInNewContext(`(${pageRequest.toString()})('https://aitoearn.cn','user/mine','GET',undefined,'u')`,sandbox);
  assert.equal(result.data.id,'u');assert.equal(JSON.stringify(result).includes('fixture-private-token'),false);
  const wrong=await vm.runInNewContext(`(${pageRequest.toString()})('https://aitoearn.cn','user/mine','GET',undefined,'different')`,sandbox);assert.equal(wrong.kind,'login');assert.equal(calls,1);
  sandbox.location.origin='https://other.example';const origin=await vm.runInNewContext(`(${pageRequest.toString()})('https://aitoearn.cn','user/mine','GET')`,sandbox);assert.equal(origin.kind,'login');assert.equal(calls,1);
});

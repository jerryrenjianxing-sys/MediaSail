const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {UiStateStore,mergeOrigins,trustedStateSender}=require('../desktop/ui-state.cjs');
const chat=(id,text)=>({id,title:'旧会话',messages:[{role:'user',content:text}],sessionKey:'agent:'+id,pendingTurnId:'turn:'+id,created:1});
test('merge all live origins: duplicates, conflicting copies, latest settings, >100 chats',()=>{
  const old=Array.from({length:121},(_,i)=>chat('chat-'+i,'旧内容'+i));
  const recent=[{...old[0],messages:[{role:'user',content:'更新后的内容'}]},old[1]];
  const state=mergeOrigins([{origin:'http://127.0.0.1:1',sequence:1,values:{easel_sessions:JSON.stringify(old),easel_theme:'light'}},{origin:'http://127.0.0.1:2',sequence:2,values:{easel_sessions:JSON.stringify(recent),easel_theme:'dark',easel_active_session:'chat-0',easel_publish_draft:'{"body":"新草稿"}'}}]);
  const merged=JSON.parse(state.values.easel_sessions);assert.equal(merged.length,122);assert.equal(state.migration.copies,1);assert.equal(state.values.easel_theme,'dark');assert.equal(state.values.easel_active_session,'chat-0');
  const copy=merged.find(x=>x.recoveredFrom);assert.match(copy.title,/恢复副本/);assert.equal(copy.sessionKey,undefined);assert.equal(copy.pendingTurnId,undefined);
  assert.equal(mergeOrigins([]).values.easel_chat_reset_20260902,'1');
  assert.throws(()=>mergeOrigins([{origin:'local',sequence:1,values:{easel_sessions:'broken'}}]),/无法解析/);
});
test('serial disk state survives reopen and deletion; a malformed main file recovers previous snapshot',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mediasail-state-'));
  try{
    const store=new UiStateStore(dir);await store.open(async()=>mergeOrigins([]));
    await Promise.all([store.change('easel_theme','dark'),store.change('easel_publish_draft','中文 草稿')]);
    await store.change('easel_theme',null);await store.flush();
    const next=new UiStateStore(dir);await next.open(()=>{throw Error('must not migrate twice');});assert.equal(next.snapshot().values.easel_theme,undefined);assert.equal(next.snapshot().values.easel_publish_draft,'中文 草稿');
    await fs.writeFile(next.file,'broken');const recovered=new UiStateStore(dir);await recovered.open(()=>{throw Error();});assert.equal(recovered.snapshot().values.easel_publish_draft,'中文 草稿');assert.ok((await fs.readdir(dir)).some(f=>f.includes('.damaged-')));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('failed save preserves old disk data, flush retries, invalid keys cannot write files',async()=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mediasail-write-'));
  try{
    const store=new UiStateStore(dir);await store.open(async()=>mergeOrigins([]));const before=await fs.readFile(store.file,'utf8');
    const persist=store.persist.bind(store);store.persist=async()=>{throw Error('disk full');};
    await assert.rejects(store.change('easel_theme','dark'),/disk full/);assert.equal(await fs.readFile(store.file,'utf8'),before);await assert.rejects(store.flush(),/disk full/);
    store.persist=persist;await store.flush();assert.equal(JSON.parse(await fs.readFile(store.file,'utf8')).values.easel_theme,'dark');
    await assert.rejects(store.change('../../secret','x'));await assert.rejects(store.change('__proto__','x'));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('only the local main frame can access the disk state bridge',()=>{
  const main={mainFrame:{url:'http://127.0.0.1:4567/'}},event={sender:main,senderFrame:main.mainFrame};assert.equal(trustedStateSender(event,main,'http://127.0.0.1:4567'),true);
  for(const url of ['https://aitoearn.cn/zh','http://127.0.0.1:4567/assets/test.html','http://127.0.0.1:5678/','file:///app/startup.html']){main.mainFrame.url=url;assert.equal(trustedStateSender(event,main,'http://127.0.0.1:4567'),false);}
  main.mainFrame.url='http://127.0.0.1:4567/';assert.equal(trustedStateSender({...event,senderFrame:{url:main.mainFrame.url}},main,'http://127.0.0.1:4567'),false);
});

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {assertStartupLibraryIdle,appendStartupLog}=require('../desktop/startup-recovery.cjs');
const running={supervisor:{pid:123},options:{env:{EASEL_DESKTOP_TOKEN:'fixture-instance-token'}},baseUrl:'http://127.0.0.1:12345'};

test('first library selection without a business service does not require a service request',async()=>{
  let requests=0;await assertStartupLibraryIdle({supervisor:null,state:async()=>{requests++;throw Error('must not request');}});assert.equal(requests,0);
});
test('startup error permits library change only after an authenticated idle response',async()=>{
  let requests=0;await assertStartupLibraryIdle({...running,state:async(url,token)=>{requests++;assert.equal(url,running.baseUrl);assert.equal(token,running.options.env.EASEL_DESKTOP_TOKEN);return {active:0};}});assert.equal(requests,1);
  for(const active of [1,-1,null,undefined,'0'])await assert.rejects(assertStartupLibraryIdle({...running,state:async()=>({active})}),/任务/);
});
test('unreachable or identity-rejected service cannot be treated as idle',async()=>{
  for(const error of [Error('network unavailable'),Error('service identity mismatch')])await assert.rejects(assertStartupLibraryIdle({...running,state:async()=>{throw error;}}),/无法确认后台任务状态/);
});
function fixture(t){const root=fs.mkdtempSync(path.join(os.tmpdir(),'MediaSail log recovery '));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return {root,data:path.join(root,'chosen/runtime'),bootstrapRoot:path.join(root,'bootstrap')};}
test('log permission failure falls back to bootstrap selection logs and retains the original error',t=>{
  const f=fixture(t),primary=path.join(f.data,'logs'),fallback=path.join(f.bootstrapRoot,'selection-ui/logs'),original=fs.mkdirSync;
  t.mock.method(fs,'mkdirSync',(directory,...args)=>{if(directory===primary){const error=Error('read only library');error.code='EACCES';throw error;}return original(directory,...args);});
  const message='原始错误：资料库文件无法保存';assert.equal(appendStartupLog({...f,message}),fallback);assert.match(fs.readFileSync(path.join(fallback,'desktop.log'),'utf8'),/原始错误：资料库文件无法保存/);
});
test('failure of both log locations never throws or substitutes the original startup error',t=>{
  const f=fixture(t);t.mock.method(fs,'mkdirSync',()=>{const error=Error('both locations read only');error.code='EACCES';throw error;});
  const startup={message:'原始错误：所选资料库权限不足',error:true};assert.equal(appendStartupLog({...f,message:startup.message}),null);assert.deepEqual(startup,{message:'原始错误：所选资料库权限不足',error:true});
});

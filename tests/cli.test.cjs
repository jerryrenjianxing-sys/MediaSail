const {test}=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {environment}=require('../desktop/runtime.cjs');
test('portable CLI preserves Unicode, exact arguments and binary output',async t=>{
 const root=path.resolve(__dirname,'..'),data=await fs.mkdtemp(path.join(os.tmpdir(),'easel-cli-'));t.after(()=>fs.rm(data,{recursive:true,force:true}));
 const o=environment(path.join(root,'build'),data,path.join(root,'vendor/easel'),12345,12346),exe=path.join(root,'build/runtime/launchers/python3.exe');
 const args=['中文素材','a b','embedded"quote','trailing\\','line1\nline2'];
 const r=cp.spawnSync(exe,['-c','import json,sys;print(json.dumps(sys.argv[1:],ensure_ascii=False))',...args],{env:o.env,windowsHide:true,encoding:'utf8'});assert.equal(r.status,0);assert.deepEqual(JSON.parse(r.stdout),args);
 const b=cp.spawnSync(exe,['-c','import sys;sys.stdout.buffer.write(bytes(range(256)))'],{env:o.env,windowsHide:true});assert.deepEqual(b.stdout,Buffer.from(Array.from({length:256},(_,i)=>i)));
});

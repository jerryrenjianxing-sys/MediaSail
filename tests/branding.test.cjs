const {test}=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process'),path=require('node:path');
test('agent default migration preserves custom content, backups and repeated launches',()=>{
  const root=path.resolve(__dirname,'..');
  const result=cp.spawnSync(path.join(root,'build/runtime/python/cpython-3.11.15-windows-x86_64-none/python.exe'),[path.join(__dirname,'test_branding.py')],{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});

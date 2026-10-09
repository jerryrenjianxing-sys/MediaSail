const r=require('../desktop/runtime.cjs'),path=require('path'),cp=require('child_process');
const o=r.environment(path.resolve('build'),path.resolve('.test-data/probe'),path.resolve('vendor/easel'),45671,45672);
for(const [cmd,args]of [[o.python,['-c','import os;print(os.path.expanduser("~"));import fastapi;print(fastapi.__version__)']],[o.env.EASEL_DESKTOP_NODE,['--version']]]){
 const p=cp.spawnSync(cmd,args,{env:o.env,encoding:'utf8',timeout:15000,windowsHide:true});console.log(JSON.stringify({cmd,status:p.status,error:p.error?.message,out:p.stdout,err:p.stderr}));
}
o.env.EASEL_DESKTOP_DIAGNOSTICS='1';
const p=cp.spawnSync(o.python,['-u',path.resolve('bridge/server.py')],{env:o.env,encoding:'utf8',timeout:32000,windowsHide:true});console.log(JSON.stringify({status:p.status,error:p.error?.message,out:p.stdout,err:p.stderr}));

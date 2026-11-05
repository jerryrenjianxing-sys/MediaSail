'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
test('native browser commands accept raw case-duplicate proxy variables and preserve Chinese arguments',{skip:process.platform!=='win32'},async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'MediaSail native 中文 ')),exe=path.join(directory,'probe.exe');
 cp.execFileSync(path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe'),['/nologo','/target:exe','/out:'+exe,path.join(root,'agent-skill/mediasail/scripts/browser-native.cs'),path.join(root,'tests/fixtures/browser-environment.cs')],{windowsHide:true});
 const file=path.join(directory,'result.json');cp.execFileSync(exe,['duplicate',file],{windowsHide:true,timeout:15000});
 const value=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(value.ok,true,value.message);assert.equal(value.exitCode,0);
 const output=JSON.parse(value.stdout);assert.equal(output.proxy,'http://127.0.0.1:9');assert.match(output.bypass,/example\.invalid/);assert.match(output.bypass,/127\.0\.0\.1/);assert.equal(output.argument,'中文 空格 "quote" \\end\\');assert.equal(value.stderr,'中文诊断');
 for(const [mode,expected]of [['none',''],['single','http://127.0.0.1:9'],['lower','http://127.0.0.1:10']]){
  const file=path.join(directory,mode+'.json');cp.execFileSync(exe,[mode,file],{windowsHide:true,timeout:15000});const value=JSON.parse(await fs.readFile(file,'utf8'));assert.equal(value.ok,true,value.message);const read=JSON.parse(value.stdout);assert.equal(read.proxy,expected);assert.match(read.bypass,/localhost,127\.0\.0\.1,::1/);
 }
});

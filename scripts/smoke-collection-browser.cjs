// Real packaged Python + installed Chrome/Edge; only platform HTTP is synthetic.
'use strict';
const path=require('node:path'),fs=require('node:fs'),cp=require('node:child_process'),os=require('node:os'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),out=path.resolve(root,pkg.build.directories.output,'win-unpacked/resources');
const python=path.join(out,'runtime/python/cpython-3.11.15-windows-x86_64-none/python.exe');
const source=process.env.COLLECTION_SOURCE||path.join(out,'payload/easel/skills/shared/scripts');
const run=fs.mkdtempSync(path.join(os.tmpdir(),'MediaSail-collection-中文-'));
const home='合成账号\n关注\n9\n粉丝指数\n7\n获赞\n74\n近7日\n播放量\n482\n较前7日-783\n主页访问量\n57\n较前7日+43\n作品分享\n0\n作品评论\n3';
const body='内容管理\n作品 (5)\n'+Array.from({length:5},(_,i)=>`9张\n合成作品${i+1}\n编辑作品\n设置权限\n删除作品\n2026年11月02日 18:42\n已发布\n播放\n${501+i}\n点赞\n3\n评论\n1\n分享\n0\n收藏\n1`).join('\n')+'\n没有更多作品';
const results=[];
for(const [name,overrides]of [['delayed',{content:body}],['empty',{content:'内容管理\n作品 (0)\n暂无作品'}],['connection',{content:body,navigationError:true}]]){
 const workspace=path.join(run,name);fs.mkdirSync(workspace);fs.mkdirSync(path.join(workspace,'home'));const fixture=path.join(workspace,'sample.json');fs.writeFileSync(fixture,JSON.stringify({home,delayMs:1800,...overrides}));
 const env={...process.env,EASEL_ROOT:workspace,COLLECTION_FIXTURE:fixture,COLLECTION_SOURCE:source,COLLECTION_REAL_BROWSER:'1',PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};delete env.EASEL_BROWSER_EXECUTABLE;delete env.ELECTRON_RUN_AS_NODE;
 if(process.env.COLLECTION_BROWSER)env.EASEL_BROWSER_EXECUTABLE=process.env.COLLECTION_BROWSER;
 const started=Date.now(),processResult=cp.spawnSync(python,['-X','utf8','-B',path.join(root,'tests/fixtures/collection_cli.py'),'fetch','--platform','douyin','--profile-base',path.join(workspace,'浏览器资料')],{env,encoding:'utf8',timeout:90000,windowsHide:true});
 assert.equal(processResult.status,0,processResult.stderr || String(processResult.error));const data=JSON.parse(processResult.stdout.trim().split(/\r?\n/).at(-1));
 assert.equal(data.verificationStatus,'verified',(processResult.stderr||'')+JSON.stringify({errorCode:data.errorCode,message:data.message,collection:data.collection}));
 if(name==='delayed'){assert.equal(data.posts,null);assert.equal(data.collection.notesCoverage.total,5);assert.equal(data.notes.length,5);assert.equal(data.followerIndex,7);assert.equal(data.followers,null);assert.equal(data.collection.status,'partial');}
 if(name==='empty'){assert.equal(data.posts,null);assert.equal(data.collection.notesCoverage.total,0);assert.equal(data.collection.notesCoverage.status,'empty');}
 if(name==='connection'){assert.equal(data.likes,74);assert.equal(data.posts,null);assert.ok(data.collection.issues.some(x=>x.code==='content_navigation_failed'));}
 results.push({name,passed:true,elapsedMs:Date.now()-started,collection:data.collection});console.log('REAL BROWSER '+name+' PASSED');
}
fs.mkdirSync(path.join(root,'docs/evidence'),{recursive:true});fs.writeFileSync(path.join(root,'docs/evidence','collection-browser-'+pkg.version+'.json'),JSON.stringify({version:pkg.version,passed:true,syntheticHttpOnly:true,realPackagedPython:true,realInstalledBrowser:true,realAccountsUsed:false,checkedAt:new Date().toISOString(),results},null,2));

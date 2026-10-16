const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),fs=require('node:fs'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),{fixtureScope}=require('../scripts/verify-library-selection-ci.cjs');
test('0.5.2 registered upgrade harness refuses local, wrong checkout and AppData fixture paths before mutation',()=>{
 const base={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Windows',GITHUB_RUN_ID:'123',RUNNER_TEMP:path.join(os.tmpdir(),'hosted-temp'),LOCALAPPDATA:path.join(os.tmpdir(),'hosted-appdata'),GITHUB_WORKSPACE:root};
 for(const override of [{GITHUB_ACTIONS:'false'},{RUNNER_ENVIRONMENT:'self-hosted'},{GITHUB_RUN_ID:'bad'},{GITHUB_WORKSPACE:path.dirname(root)},{RUNNER_TEMP:path.join(base.LOCALAPPDATA,'Temp')}])assert.throws(()=>fixtureScope({...base,...override},'win32'));
 assert.throws(()=>fixtureScope(base,'linux'));const scope=fixtureScope(base,'win32');assert.equal(scope.target,path.join(base.RUNNER_TEMP,'mediasail-direct-library-123','中文 原安装','MediaSail'));assert.notEqual(scope.target,scope.libraryRoot);
 const child=cp.spawnSync(process.execPath,[path.join(root,'scripts/verify-library-selection-ci.cjs')],{env:{...process.env,GITHUB_ACTIONS:'false',RUNNER_ENVIRONMENT:'self-hosted'},encoding:'utf8',windowsHide:true});assert.equal(child.status,1);assert.match(child.stderr,/never run on a user PC/);
});
test('new hosted upgrade verifies the published 0.5.2 baseline and never pre-sets an install path on update',()=>{
 const script=fs.readFileSync(path.join(root,'scripts/verify-library-selection-ci.cjs'),'utf8'),workflow=fs.readFileSync(path.join(root,'.github/workflows/verify-library-selection.yml'),'utf8');
 assert.match(workflow,/1f7d9b2dd9a51b04a3b6aeafa4087b717d8ae7a238f01201ef9becac28be55ed/);assert.match(workflow,/273956517/);assert.match(workflow,/0\.5\.2/);assert.match(workflow,/0\.5\.3/);assert.match(script,/setup\(candidate,\['\/S','--updated','--force-run'\]/);assert.doesNotMatch(script,/setup\(candidate,\[.*\/D=/);assert.match(script,/choiceAndSessionRetainedAcrossCoverInstall=true/);
});
test('library selection helper refuses local invocation before filesystem, process or UI access',async()=>{
 const helper=require('../scripts/select-library-fixture.cjs'),previous=process.env.GITHUB_ACTIONS;process.env.GITHUB_ACTIONS='false';try{await assert.rejects(helper.selectLibraryFixture({}),/Hosted fixture only|win32/);}finally{if(previous===undefined)delete process.env.GITHUB_ACTIONS;else process.env.GITHUB_ACTIONS=previous;}
});

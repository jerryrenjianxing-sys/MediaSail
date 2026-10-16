const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),{fixtureScope}=require('../scripts/verify-content-upgrade-ci.cjs');
test('content upgrade fixture refuses user PCs and unsafe locations before installer or data access',()=>{
 const base={GITHUB_ACTIONS:'true',RUNNER_ENVIRONMENT:'github-hosted',RUNNER_OS:'Windows',GITHUB_RUN_ID:'123',RUNNER_TEMP:path.join(os.tmpdir(),'hosted-content'),LOCALAPPDATA:path.join(os.tmpdir(),'hosted-local'),GITHUB_WORKSPACE:root};
 for(const override of [{GITHUB_ACTIONS:'false'},{RUNNER_ENVIRONMENT:'self-hosted'},{RUNNER_OS:'Linux'},{GITHUB_RUN_ID:'bad'},{GITHUB_WORKSPACE:path.dirname(root)},{RUNNER_TEMP:path.join(base.LOCALAPPDATA,'Temp')}])assert.throws(()=>fixtureScope({...base,...override},'win32'));
 assert.throws(()=>fixtureScope(base,'linux'));const scope=fixtureScope(base,'win32');assert.notEqual(scope.target,scope.libraryRoot);
 const child=cp.spawnSync(process.execPath,[path.join(root,'scripts/verify-content-upgrade-ci.cjs')],{env:{...process.env,GITHUB_ACTIONS:'false'},encoding:'utf8',windowsHide:true});assert.equal(child.status,1);assert.match(child.stderr,/never run on a user PC/);
});

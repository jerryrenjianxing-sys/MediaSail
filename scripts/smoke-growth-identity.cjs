// Final packaged HTTP/UI acceptance. Only _scrape input is synthetic, inside a
// disposable editable library; the actual packaged growth engine and API run.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'));
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','增长归属 '+pkg.version+' '+Date.now());
const bootstrap=path.join(run,'独立 定位'),libraryRoot=path.join(run,'中文 空格 资料库'),data=path.join(libraryRoot,'runtime');
const evidence=path.join(root,'docs/evidence/growth-identity-packaged-'+pkg.version+'.json');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let app,page,info;
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');}
async function until(test,label){for(let i=0;i<150;i++){if(await test())return;await sleep(100);}throw Error(label);}
async function deltas(){return page.locator('.ana-overview .ana-stat-delta').allTextContents();}
(async()=>{
 const library=await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
 const old={platform:'xiaohongshu',name:'小红书',nickname:'合成验收',loggedIn:true,followers:900,likes:null,following:null,posts:1,metrics:[],notes:[],growth:{last:{followers:800},week:{followers:800}},fetched_at:1};
 await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_onboarding_seen:'1',easel_theme:'light',easel_analytics:JSON.stringify({xiaohongshu:old})}});
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立Local'),APPDATA:path.join(run,'独立Roaming'),PYTHONDONTWRITEBYTECODE:'1'};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();
 await page.route('**/api/accounts/*/whoami*',route=>route.fulfill({json:{loggedIn:false,verificationStatus:'unknown',accountId:null,checkedAt:Math.floor(Date.now()/1000),cached:false,errorCode:'SYNTHETIC_QA',message:'合成测试不连接平台账号'}}));
 await page.route('**/api/trends*',route=>route.fulfill({json:{trends:[],updated:0}}));
 await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
 info=JSON.parse(await fs.readFile(library.connectionFile,'utf8'));assert.equal(info.libraryRoot,libraryRoot);
 const script=path.join(library.workspace,'skills/shared/scripts/account_stats.py'),subject=path.join(run,'packaged-account-stats.py'),fixture=path.join(run,'synthetic-collection.json');
 await fs.copyFile(script,subject);
 // Preserve and load the genuine packaged script, changing only browser IO.
 await write(script,`import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('packaged_growth_subject',${JSON.stringify(subject)})\nsubject=importlib.util.module_from_spec(spec)\nspec.loader.exec_module(subject)\nsubject._scrape=lambda *args: json.loads(open(${JSON.stringify(fixture)},encoding='utf-8').read())\nif __name__=='__main__': sys.exit(subject.main())\n`);
 const history=path.join(info.outputs,'_analytics/xiaohongshu.jsonl');
 const original=' {"ts":1,"followers":100} \r\n'+JSON.stringify({ts:2,platform:'douyin',accountId:'synthetic-a',source:'xiaohongshu-creator',verificationStatus:'verified',followers:1000})+'\n'+JSON.stringify({ts:3,platform:'xiaohongshu',accountId:'synthetic-foreign',source:'xiaohongshu-creator',verificationStatus:'verified',followers:2000});
 await write(history,original);
 await page.getByRole('button',{name:'控制台',exact:true}).click();await page.locator('.ana-overview').waitFor();
 assert.ok((await deltas()).every(value=>value==='—'),'Legacy cache must not render +800');
 await page.getByRole('button',{name:'较上次',exact:true}).click();
 const base={nickname:'合成验收',followers:900,likes:null,following:null,posts:1,metrics:[],notes:[],logged_in:true};
 async function collect(change){
  await write(fixture,{...base,...change});
  const response=page.waitForResponse(response=>response.url()===info.baseUrl+'/api/analytics/xiaohongshu');
  await page.locator('.ana-plats').getByRole('button',{name:'小红书',exact:true}).click();
  const result=await(await response).json();await until(async()=>!(await page.locator('.ana-plats').getByRole('button',{name:'小红书',exact:true}).isDisabled()),'UI collection did not finish');
  assert.ok((await fs.readFile(history,'utf8')).startsWith(original),'Legacy bytes were rewritten');return result;
 }
 const unowned=await collect({});assert.equal(unowned.growthStatus,'identity_unverified');assert.ok(Object.values(unowned.growth).every(value=>value===null));assert.equal(await fs.readFile(history,'utf8'),original);assert.ok((await deltas()).every(value=>value==='—'));await page.getByText(/尚未核验稳定账号编号与采集来源/).waitFor();
 const identity={verificationStatus:'verified',accountId:'synthetic-a',source:'xiaohongshu-creator'};
 const first=await collect({...identity,followers:10});assert.equal(first.growthStatus,'no_history');assert.ok((await deltas()).every(value=>value==='—'));
 const next=await collect({...identity,followers:15});assert.equal(next.growth.last.followers,5);assert.ok((await deltas()).includes('▲+5'));assert.equal(next.likes,null);
 const switched=await collect({...identity,accountId:'synthetic-b',followers:1900});assert.equal(switched.growthStatus,'no_history');assert.ok((await deltas()).every(value=>value==='—'));
 const sameB=await collect({...identity,accountId:'synthetic-b',followers:1902});assert.equal(sameB.growth.last.followers,2);assert.ok((await deltas()).includes('▲+2'));
 const beforeFailure=await fs.readFile(history,'utf8');
 const failed=await collect({...identity,verificationStatus:'unknown',accountId:'synthetic-b',followers:9999,errorCode:'SYNTHETIC_NETWORK_FAILURE',message:'合成网络错误'});assert.equal(failed.growthStatus,'identity_unverified');assert.equal(await fs.readFile(history,'utf8'),beforeFailure);assert.ok((await deltas()).includes('▲+2'));await page.getByText(/本次刷新未成功/).waitFor();
 const sourceChange=await collect({...identity,accountId:'synthetic-b',source:'different-creator-response',followers:8000});assert.equal(sourceChange.growthStatus,'no_history');assert.ok((await deltas()).every(value=>value==='—'));
 await page.screenshot({path:path.join(root,'docs/images',pkg.version,'growth-identity-protected.png'),animations:'disabled'});
 const result={schema:1,version:pkg.version,passed:true,testedAtUtc:new Date().toISOString(),testedAppAsarSha256:crypto.createHash('sha256').update(await fs.readFile(path.join(path.dirname(executable),'resources/app.asar'))).digest('hex'),realPackagedApplication:true,realHttpApi:true,realGrowthEngine:true,browserCollectionInput:'synthetic _scrape response in isolated editable workspace',automaticWhoamiAndTrends:'anonymous network fixture',realPlatformAccountsUsed:false,publications:false,legacyCacheDeltaHidden:true,unownedCountsAvailableWithoutSnapshot:true,platformAccountAndSourceIsolated:true,sameVerifiedIdentityDelta:true,missingMetricsRemainNull:true,failedRefreshKeepsLastResultAndNoSnapshot:true,legacyJsonlBytesPreserved:true,actualLibraryUsed:true};
 result.testedPayloadManifestSha256=crypto.createHash('sha256').update(await fs.readFile(path.join(path.dirname(executable),'resources/payload/manifest.json'))).digest('hex');
 result.testedAccountStatsSha256=crypto.createHash('sha256').update(await fs.readFile(subject)).digest('hex');
 await app.close();app=null;result.normalExit=true;await write(evidence,result);console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

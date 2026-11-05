// Runs only the development app against a synthetic library, never the daily installation.
const fs=require('node:fs/promises'),path=require('node:path');
const {_electron:electron}=require('playwright');
const root=path.resolve(__dirname,'..'),reuse=Boolean(process.argv[2]);
const run=reuse?path.resolve(process.argv[2]):path.join(root,'.test-data','观测接入验收 '+Date.now());
if(!run.startsWith(path.join(root,'.test-data')+path.sep))throw new Error('Acceptance data must stay in the isolated test directory');
const library=path.join(run,'合成资料库'),bootstrap=path.join(run,'独立发现');
const control=path.join(run,'stop-'+process.pid);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let app;
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');}
async function main(){
 const executable=path.join(root,'node_modules/electron/dist/electron.exe');
 await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:library,installDirectory:path.dirname(executable)});
 if(!reuse){await write(path.join(library,'runtime/ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_sessions:'[]',easel_onboarding_seen:'1',mediasail_selected_profile:'合成运营画像'}});
 for(const [name,body] of Object.entries({identity:'测试品牌，提供实用咖啡知识；本次任务只做合成账号数据分析。',audience:'工作日时间紧张的上班族。',style:'先说事实，使用清楚的中文，不作缺乏证据的因果推断。',platforms:'合成测试平台 douyin，账号编号 test-browser-account。',preferences:'分析数据、写本地报告；不登录或发布真实内容。',memory:'合成历史：粉丝10、获赞50、公开作品1。'}))await write(path.join(library,'workspace/profiles/合成运营画像',name+'.md'),'# 合成资料\n'+body+'\n');}
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立Local'),APPDATA:path.join(run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,args:[root],env,timeout:60000});
 const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});
 await page.locator('.skill-home').waitFor();
 const info=JSON.parse(await fs.readFile(path.join(library,'runtime/agent-connection.json'),'utf8'));
 const card=await(await fetch(info.baseUrl+'/api/platform-skill?format=connect')).text();
 await write(path.join(run,'MediaSail 接入.md'),card);
 await write(path.join(root,'.test-data/observation-acceptance-host.json'),{run,library,bootstrap,baseUrl:info.baseUrl,card:path.join(run,'MediaSail 接入.md'),stop:control,verify:path.join(run,'verify'),result:path.join(run,'ui-result.json')});
 console.log('OBSERVATION_ACCEPTANCE_READY '+run);
 const deadline=Date.now()+60*60*1000;let verified=false;
 while(Date.now()<deadline){
  try{await fs.access(control);break;}catch{}
  if(!verified)try{
   await fs.access(path.join(run,'verify'));
   await page.getByRole('button',{name:'控制台',exact:true}).click();
   await page.getByRole('heading',{name:/外部 Agent 合成账号/}).waitFor({timeout:15000});
   await page.getByText('外部 Agent 观测验收报告',{exact:true}).first().waitFor({timeout:15000});
   await page.screenshot({path:path.join(run,'dashboard-light.png'),fullPage:true});
   await page.getByRole('button',{name:'账号与数据',exact:true}).click();
   await page.getByRole('heading',{name:'账号与数据',exact:true}).waitFor();
   await page.screenshot({path:path.join(run,'accounts-light.png'),fullPage:true});
   await write(path.join(run,'ui-result.json'),{ok:true,verifiedAt:new Date().toISOString()});verified=true;
  }catch(error){if(error.code!=='ENOENT'){await write(path.join(run,'ui-result.json'),{ok:false,error:String(error)});verified=true;}}
  await sleep(500);
 }
 await app.close();app=null;console.log('OBSERVATION_ACCEPTANCE_CLOSED');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

// Host a synthetic shared library for a fresh external Agent acceptance session.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json');
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','外部 Agent 首次接入 '+Date.now());
const bootstrap=path.join(run,'定位'),libraryRoot=path.join(run,'共享资料库');
const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
const persona='外部 Agent 验收画像';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let app;
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');}
(async()=>{
 await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
 const data=path.join(libraryRoot,'runtime');
 await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_sessions:'[]',easel_onboarding_seen:'1',mediasail_selected_profile:persona}});
 const profile={
 'identity.md':'# 合成品牌\n手工咖啡器具运营团队，帮助上班族用简单动作喝到稳定的咖啡。目标：围绕“十分钟早餐咖啡”策划一篇原创图文。',
 'audience.md':'# 受众\n工作日时间紧张的城市上班族，希望简单、可靠，不喜欢夸张承诺。',
 'style.md':'# 表达\n实用、轻松；先给可执行的小动作，再解释原因；避免虚假实验和捏造用户反馈。',
 'platforms.md':'# 平台\n合成测试平台：xiaohongshu。只做本地策划和成果，不连接真实社交账号。',
 'preferences.md':'# 交付\n一份本地运营小结和一篇约三百字图文正文，回存本画像的新项目，标记为待用户检查。',
 'memory.md':'# 合成经营记录\n上次小样本：粉丝100，累计获赞180。当前：粉丝125，累计获赞230。目标：调用现有业务计算工具记录并核对增长，再结合画像创作。本段为隔离验收虚构样本，不代表真实经营数据。'
 };
 for(const [name,text]of Object.entries(profile))await write(path.join(libraryRoot,'workspace/profiles',persona,name),text);
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'独立Local'),APPDATA:path.join(run,'独立Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
 const info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));
 const connect=await(await fetch(info.baseUrl+'/api/platform-skill?format=connect')).text();
 await write(path.join(run,'MediaSail 接入.md'),connect);await write(path.join(root,'.test-data/agent-acceptance-host.json'),{run,libraryRoot,data,bootstrap,copyFile:path.join(run,'MediaSail 接入.md'),baseUrl:info.baseUrl,persona,controlFile:path.join(run,'stop')});
 console.log('EXTERNAL_AGENT_READY '+path.join(root,'.test-data/agent-acceptance-host.json'));
 const deadline=Date.now()+60*60*1000;while(Date.now()<deadline){try{await fs.access(path.join(run,'stop'));break;}catch{}await sleep(1000);}
 await app.close();app=null;console.log('EXTERNAL_AGENT_CLOSED');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

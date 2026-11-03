// Offline evidence acceptance: a real isolated app, synthetic files, no account login.
'use strict';
const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),run=path.join(os.homedir(),'Documents/MediaSail 隔离验证','采集证据 Agent '+Date.now());
const bootstrap=path.join(run,'定位'),libraryRoot=path.join(run,'共享资料库'),data=path.join(libraryRoot,'runtime'),persona='采集证据合成画像';let app;
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2));}
(async()=>{
 const executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
 await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
 await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3'},values:{easel_onboarding_seen:'1',mediasail_selected_profile:persona}});
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'Local'),APPDATA:path.join(run,'Roaming')};delete env.ELECTRON_RUN_AS_NODE;delete env.EASEL_DESKTOP_DATA;
 app=await electron.launch({executablePath:executable,env});const page=await app.firstWindow();await page.route('**/api/accounts/*/whoami*',r=>r.fulfill({json:{loggedIn:false,verificationStatus:'unknown'}}));await page.route('**/api/trends*',r=>r.fulfill({json:{trends:[],updated:0}}));
 await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});const info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));
 for(const [name,body]of Object.entries({identity:'合成咖啡运营账号，帮助上班族理解简单的咖啡制作。全部为隔离测试数据。',audience:'想用简单动作提高早餐咖啡稳定性的上班族。',style:'清楚、务实，区分观察和推测。',platforms:'本次分析抖音合成账号 synthetic-account 的近期全部作品，资料库中有原始采集与页面快照。',preferences:'希望得到可复核的近期作品分析，报告回存内容库待检查。按任务选择方法，不追求无依据的肯定结论。',memory:'当前项目「抖音合成采集资料」保存了本次材料。粉丝与转化的实际情况仍以证据为准。'}))await write(path.join(info.profiles,persona,name+'.md'),'# '+name+'\n'+body+'\n');
 const directory=path.join(info.outputs,'抖音合成采集资料'),assets=path.join(directory,'assets');
 const home='合成账号\n关注\n9\n粉丝指数\n7\n获赞\n74\n近7日\n播放量\n482\n较前7日-783\n主页访问量\n57\n较前7日+43\n作品分享\n0\n作品评论\n3';
 const content='内容管理\n作品 (9)\n'+Array.from({length:9},(_,i)=>{const date=new Date(Date.UTC(2026,9,24+i));return `9张\n合成咖啡选题${i+1}\n编辑作品\n删除作品\n${date.getUTCFullYear()}年${date.getUTCMonth()+1}月${date.getUTCDate()}日 18:42\n已发布\n播放\n${100+50*i}\n点赞\n${i+1}\n评论\n1\n分享\n0\n收藏\n${i}\n吸粉量\n0`;}).join('\n')+'\n没有更多作品';
 const fixture=path.join(run,'synthetic-browser.json');await write(fixture,{home,content});
 const cliEnv={...process.env,EASEL_ROOT:info.workspace,EASEL_BROWSER_EXECUTABLE:info.python,COLLECTION_FIXTURE:fixture,COLLECTION_SOURCE:path.join(info.tools,'shared/scripts'),PYTHONUTF8:'1',PYTHONDONTWRITEBYTECODE:'1'};delete cliEnv.COLLECTION_REAL_BROWSER;
 const collected=cp.spawnSync(info.python,['-X','utf8','-B',path.join(root,'tests/fixtures/collection_cli.py'),'fetch','--platform','douyin','--profile-base',path.join(run,'合成浏览器')],{env:cliEnv,encoding:'utf8',windowsHide:true});if(collected.status!==0)throw Error(collected.stderr);
 const raw=JSON.parse(collected.stdout.trim().split(/\r?\n/).at(-1));await write(path.join(assets,'初次采集.json'),raw);
 await write(path.join(assets,'内容管理页.txt'),'# 合成页面快照\n账号：synthetic-account\n来源：https://creator.douyin.com/creator-micro/content/manage\n采集时间：'+new Date().toISOString()+'\n仅用于离线验收，不代表真实平台数据。\n\n'+content);
 await write(path.join(directory,'.easel.json'),{title:'抖音合成采集资料',category:'reference',kind:'article',status:'ready',profile:persona,deliverables:[],summary:'仅合成数据：初次采集和对应页面证据。'});
 await write(path.join(run,'MediaSail 接入.md'),await(await fetch(info.baseUrl+'/api/platform-skill?format=connect')).text());
 await write(path.join(root,'.test-data/collection-agent-host.json'),{run,bootstrap,libraryRoot,data,persona,copyFile:path.join(run,'MediaSail 接入.md'),baseUrl:info.baseUrl,controlFile:path.join(run,'stop')});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));console.log('COLLECTION_AGENT_READY '+path.join(root,'.test-data/collection-agent-host.json'));
 while(true){try{await fs.access(path.join(run,'stop'));break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 await app.close();app=null;console.log('COLLECTION_AGENT_CLOSED');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

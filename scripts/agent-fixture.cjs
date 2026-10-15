const {_electron:electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,require('../package.json').build.directories.output),data=path.join(root,'.test-data','独立 Agent 0.5.0 '+Date.now());
let app;
(async()=>{
 const env={...process.env,EASEL_DESKTOP_DATA:data,LOCALAPPDATA:path.join(data,'test-host-local')};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({executablePath:path.join(out,'win-unpacked/MediaSail.exe'),args:[],env,timeout:30000});
 const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:60000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(w=>w.hide()));
 const info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));
 const r=await fetch(info.baseUrl+'/api/profile/build',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'独立验收',form:{direction:'面向新手的内容运营方法',goal:'提高收藏与有效互动',tone:'清楚、具体'}})});if(!r.ok)throw Error(await r.text());
 const assets=path.join(info.outputs,'独立验收月报/assets');await fs.mkdir(assets,{recursive:true});
 await fs.writeFile(path.join(assets,'原始数据.json'),JSON.stringify({month:'2026-09',platform:'xiaohongshu',followers:1000,followers_change:50,posts:[{title:'新手运营检查表',date:'2026-09-03',type:'图文',pillar:'方法',reach:1000,likes:100,comments:20,saves:50,shares:10},{title:'工具清单',date:'2026-09-10',type:'图文',pillar:'工具',reach:2000,likes:60,comments:10,saves:100,shares:10},{title:'每日碎片',date:'2026-09-17',type:'图文',pillar:'日常',reach:1000,likes:10,comments:2,saves:3,shares:0}]},null,2));
 const prompt=await(await fetch(info.baseUrl+'/api/platform-skill?format=connect')).text();
 await fs.writeFile(path.join(data,'copied-skill.txt'),prompt+'\n\n任务：使用测试画像「独立验收」，根据 outputs/独立验收月报/assets/原始数据.json 完成9月复盘。复用现有业务计算核对指标，按专业方法形成具体建议；报告登记到内容库，结论更新回画像memory。仅隔离测试，不联系真实平台、不发文。\n');
 console.log(JSON.stringify({ready:true,data,prompt:path.join(data,'copied-skill.txt'),connection:info.connectionFile}));
 const stop=path.join(data,'stop-fixture');while(true){try{await fs.access(stop);break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 const outputs=await(await fetch(info.baseUrl+'/api/outputs')).json();await fs.writeFile(path.join(data,'visible-results.json'),JSON.stringify(outputs,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

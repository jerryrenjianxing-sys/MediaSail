'use strict';
// Ordinary web renderer without the desktop preload: no alternate text transport.
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),run=path.join(os.homedir(),'Documents/MediaSail 隔离验证','网页版接入 '+Date.now());
const bootstrap=path.join(run,'定位'),libraryRoot=path.join(run,'资料库'),executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
(async()=>{
 await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'Local'),APPDATA:path.join(run,'Roaming')};delete env.ELECTRON_RUN_AS_NODE;delete env.EASEL_DESKTOP_DATA;
 const app=await electron.launch({executablePath:executable,env});
 try{await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1});});const home=await app.firstWindow();await home.waitForURL('http://127.0.0.1:*/',{timeout:180000});
 const next=app.waitForEvent('window');await app.evaluate(async({BrowserWindow},url)=>{const window=new BrowserWindow({width:1024,height:780,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});await window.loadURL(url);},home.url());
 const web=await next;await web.locator('.skill-home').waitFor();await web.evaluate(()=>localStorage.setItem('easel_onboarding_seen','1'));await web.reload();await web.locator('.skill-home').waitFor();assert.equal(await web.evaluate(()=>typeof window.desktopActions),'undefined');
 const copy=web.getByRole('button',{name:'复制 Skill 文件',exact:true});assert.equal(await copy.count(),1,'web must retain the MD-only entry');assert.equal(await copy.isDisabled(),true);
 await web.getByText('请使用桌面版复制 MD 文件。',{exact:true}).waitFor();
 assert.equal(await web.getByRole('button',{name:'复制文字',exact:true}).count(),0);assert.equal(await web.getByRole('textbox',{name:'Skill',exact:true}).count(),0);assert.equal(await web.locator('dialog[open]').count(),0);
 await web.getByRole('button',{name:'控制台',exact:true}).click();await web.locator('.sidebar').getByRole('button',{name:'连接 Agent',exact:true}).click();await web.locator('.skill-home').waitFor();assert.equal(await copy.isDisabled(),true);
 await fs.mkdir(path.join(root,'docs/evidence'),{recursive:true});await fs.writeFile(path.join(root,'docs/evidence','skill-web-'+pkg.version+'.json'),JSON.stringify({passed:true,version:pkg.version,desktopPreload:false,checks:['MD-only entry disabled without desktop capability','short desktop-only hint','no text option or manual dialog','console round trip retains the same behavior'],messagesSent:0},null,2));
 await web.close();console.log('SKILL WEB PASSED');
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

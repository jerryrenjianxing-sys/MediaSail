'use strict';
// Ordinary web renderer, deliberately without the desktop preload; clipboard permission is the only Adapter stub.
const {_electron:electron}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const root=path.resolve(__dirname,'..'),pkg=require('../package.json'),run=path.join(os.homedir(),'Documents/MediaSail 隔离验证','网页版接入 '+Date.now());
const bootstrap=path.join(run,'定位'),libraryRoot=path.join(run,'资料库'),executable=path.resolve(root,pkg.build.directories.output,'win-unpacked/MediaSail.exe');
(async()=>{
 await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
 const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'Local'),APPDATA:path.join(run,'Roaming')};delete env.ELECTRON_RUN_AS_NODE;delete env.EASEL_DESKTOP_DATA;
 const app=await electron.launch({executablePath:executable,env});
 try{const home=await app.firstWindow();await home.waitForURL('http://127.0.0.1:*/',{timeout:180000});
 const next=app.waitForEvent('window');await app.evaluate(async({BrowserWindow},url)=>{const window=new BrowserWindow({width:1024,height:780,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});await window.loadURL(url);},home.url());
 const web=await next;await web.locator('.skill-home').waitFor();assert.equal(await web.evaluate(()=>typeof window.desktopActions),'undefined');assert.equal(await web.getByRole('button',{name:'复制 Skill 文件',exact:true}).count(),0);
 await web.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async text=>{window.__webCopied=text;}}));
 await web.getByRole('button',{name:'复制文字',exact:true}).click();await web.getByText('接入文字已复制，可粘贴给你的 Agent。',{exact:true}).waitFor();
 const expected=await(await fetch(home.url()+'api/platform-skill?format=connect')).text();assert.equal(await web.evaluate(()=>window.__webCopied),expected);
 await web.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:async()=>{throw Error('denied fixture');}}));await web.getByRole('button',{name:'已复制',exact:true}).click();
 const modal=web.getByRole('dialog');await modal.waitFor();assert.equal(await modal.getByRole('textbox',{name:'Skill',exact:true}).inputValue(),expected.replace(/\r\n/g,'\n'));await modal.getByRole('button',{name:'完成',exact:true}).click();
 await fs.mkdir(path.join(root,'docs/evidence'),{recursive:true});await fs.writeFile(path.join(root,'docs/evidence','skill-web-'+pkg.version+'.json'),JSON.stringify({passed:true,version:pkg.version,desktopPreload:false,clipboardAdapter:'browser permission success/denial only',checks:['web renderer offers text only','same connection card','manual fallback on denial'],messagesSent:0},null,2));
 await web.close();console.log('SKILL WEB PASSED');
 }finally{await app.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

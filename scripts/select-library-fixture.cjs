// Disposable runner only: click the real startup button; stub only the native
// folder picker result. Core validation, initialization, commit and relaunch run.
'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs/promises'),cp=require('node:child_process');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,timeout,label){const end=Date.now()+timeout;while(Date.now()<end){try{const result=await fn();if(result)return result;}catch(error){if(Date.now()+500>=end)throw error;}await delay(200);}throw Error('Timed out: '+label);}
async function selectLibraryFixture({inspector,pid,exe,libraryRoot,evidence,cancelFirst=true}){
 assert.equal(process.platform,'win32');assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted fixture only');assert.equal(process.env.RUNNER_ENVIRONMENT,'github-hosted','Hosted fixture only');assert.equal(process.env.RUNNER_OS,'Windows');
 const under=(parent,file)=>{const rel=path.relative(path.resolve(parent),path.resolve(file));return rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel);};
 assert.ok(under(process.env.RUNNER_TEMP,exe)&&under(process.env.RUNNER_TEMP,libraryRoot));assert.equal(path.basename(exe),'MediaSail.exe');assert.ok(under(path.join(process.env.GITHUB_WORKSPACE,'installer-evidence'),evidence));
 assert.ok(Number.isInteger(pid)&&pid>0);const observed=JSON.parse(cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}'|Select-Object ProcessId,ExecutablePath|ConvertTo-Json -Compress`],{encoding:'utf8',windowsHide:true,timeout:30000}));assert.equal(observed.ExecutablePath?.toLowerCase(),exe.toLowerCase());
 await fs.mkdir(evidence,{recursive:true});await fs.mkdir(libraryRoot,{recursive:true});
 const window="process.mainModule.require('electron').BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:')&&w.webContents.getURL().includes('startup.html'))";
 await until(()=>inspector.evaluate(`Boolean(process.mainModule?.require&&process.mainModule.require('electron').app.isReady()&&${window})`),30000,'actual library-choice startup page');
 const body=await until(async()=>{const text=await inspector.evaluate(`(()=>{const w=${window};return w.webContents.executeJavaScript("document.body.innerText");})()`);return text.includes('选择资料库')?text:false;},30000,'startup body');assert.match(body,/选择资料库/);
 const screenshot=path.join(evidence,'app-library-selection.png');await inspector.evaluate(`(async()=>{const w=${window},image=await w.webContents.capturePage();process.mainModule.require('node:fs').writeFileSync(${JSON.stringify(screenshot)},image.toPNG());return true;})()`);
 await inspector.evaluate(`(()=>{const {dialog}=process.mainModule.require('electron'),original=dialog.showOpenDialog;globalThis.__libraryFixture={calls:0,cancel:${JSON.stringify(cancelFirst)}};dialog.showOpenDialog=async function(...args){const options=args.at(-1);if(options?.title==='选择 MediaSail 资料库'){globalThis.__libraryFixture.calls++;return globalThis.__libraryFixture.cancel?{canceled:true,filePaths:[]}:{canceled:false,filePaths:[${JSON.stringify(libraryRoot)}]};}return original.apply(this,args);};return true;})()`);
 const click=()=>inspector.evaluate(`(()=>{const w=${window};return w.webContents.executeJavaScript("(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='选择资料库');if(!b||b.disabled)throw Error('Actual enabled library-choice button unavailable');b.click();return true;})()");})()`);
 if(cancelFirst){await click();await until(()=>inspector.evaluate('globalThis.__libraryFixture.calls===1'),10000,'actual canceled folder picker');await delay(300);assert.equal(await inspector.evaluate(`Boolean(${window})`),true,'Cancel must remain on the choice page');assert.equal(await inspector.evaluate("process.mainModule.require('electron').app.getVersion()"),'0.5.3');await inspector.evaluate('globalThis.__libraryFixture.cancel=false;true');}
 await click();return {actualStartupButtonClicked:true,nativePickerTitle:'选择 MediaSail 资料库',onlyPickerResultStubbed:true,cancellationKeptChoicePage:cancelFirst,selectedRoot:libraryRoot,screenshot};
}
module.exports={selectLibraryFixture};

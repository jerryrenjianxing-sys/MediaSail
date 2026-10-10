const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('settings may open/check only from the local main frame; install stays panel-only',async()=>{
  const handlers=new Map(),calls={checks:0,downloads:0,installs:0,shows:0};
  const main={webContents:{mainFrame:{url:'http://127.0.0.1:7860/'}}};
  const exports={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../desktop/updates-window.cjs'),'utf8'),{
    module:exports,__dirname:path.join(__dirname,'../desktop'),require:id=>id==='electron'?{ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},shell:{}}:id==='./updates.cjs'?require('../desktop/updates.cjs'):require(id),
  });
  const updates={dismissBanner:()=>{calls.dismissed=true;},check:async()=>{calls.checks++;},download:async()=>{calls.downloads++;},install:async()=>{calls.installs++;},snapshot:()=>({phase:'idle'}),on:()=>{}};
  const window=new exports.exports.UpdatesWindow({updates,main,localOrigin:()=> 'http://127.0.0.1:7860',startupUrl:'file:///app/startup.html',data:'test'});
  window.show=()=>{calls.shows++;};
  const event=sender=>({sender,senderFrame:sender.mainFrame});
  const check=handlers.get('updates:open-and-check');
  assert.equal(handlers.get('updates:dismiss-banner')(event(main.webContents)),true);assert.equal(calls.dismissed,true);
  assert.equal(check(event(main.webContents)),true);assert.equal(calls.checks,1);assert.equal(calls.shows,1);
  assert.equal((await handlers.get('updates:call')(event(main.webContents),'install')).ok,false);
  assert.equal((await handlers.get('updates:call')(event(main.webContents),'download')).ok,false);
  assert.equal(check({sender:main.webContents,senderFrame:{url:main.webContents.mainFrame.url}}),false);
  for(const url of ['file:///app/startup.html','https://aitoearn.cn/zh','http://127.0.0.1:7860/assets/test.html','http://127.0.0.1:9000/']){
    main.webContents.mainFrame.url=url;assert.equal(check(event(main.webContents)),false);assert.equal(handlers.get('updates:dismiss-banner')(event(main.webContents)),false);
  }
  const remote={mainFrame:{url:'http://127.0.0.1:7860/'}};assert.equal(check(event(remote)),false);
  assert.equal(calls.checks,1);assert.equal(calls.downloads,0);assert.equal(calls.installs,0);
});

const test=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {Updates,trustedUpdateSender}=require('../desktop/updates.cjs');
class FakeUpdater extends EventEmitter{
  constructor(){super();this.checks=0;this.downloads=0;this.installs=0;}
  async checkForUpdates(){this.checks++;this.emit('checking-for-update');await new Promise(r=>setTimeout(r,5));if(this.offline)throw new Error('offline');this.emit('update-available',{version:'0.4.0',files:[{size:1000}]});}
  async downloadUpdate(token){this.downloads++;if(this.waitForCancel){await new Promise((r,j)=>token.onCancel(()=>j(new Error('cancelled'))));return;}if(this.badHash){this.emit('error',new Error('sha512 checksum mismatch'));throw new Error('sha512 checksum mismatch');}this.emit('download-progress',{percent:50,transferred:500,total:1000,bytesPerSecond:250});this.emit('update-downloaded',{version:'0.4.0'});}
  quitAndInstall(silent,run){assert.equal(silent,true);assert.equal(run,true);this.installs++;if(this.installFailure)this.emit('error',new Error('installer missing'));}
}
const setup=(options={})=>{const updater=new FakeUpdater();return {updater,service:new Updates({updater,version:'0.3.0',...options})};};
test('manual updates: single check/download, progress, no background install, task cancellation',async()=>{
  let permitted=false;const {updater,service}=setup({prepareInstall:async()=>permitted});
  assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false);assert.equal(updater.allowDowngrade,false);
  await Promise.all([service.check(),service.check()]);assert.equal(updater.checks,1);
  await Promise.all([service.download(),service.download()]);assert.equal(updater.downloads,1);assert.equal(service.snapshot().phase,'downloaded');
  await service.check();assert.equal(updater.checks,1);await service.install();assert.equal(updater.installs,0);assert.equal(service.snapshot().phase,'downloaded');
  permitted=true;await Promise.all([service.install(),service.install()]);assert.equal(updater.installs,1);
});
test('offline check and invalid checksum can retry, but cannot install rejected files',async()=>{
  const {updater,service}=setup();updater.offline=true;await service.check();assert.equal(service.snapshot().phase,'error');
  updater.offline=false;await service.check();updater.badHash=true;await service.download();assert.equal(service.snapshot().phase,'error');assert.match(service.snapshot().message,/校验/);await service.install();assert.equal(updater.installs,0);
  updater.badHash=false;await service.check();await service.download();assert.equal(service.snapshot().phase,'downloaded');
});
test('exit cancels download and failed installer recovers services',async()=>{
  const a=setup();await a.service.check();a.updater.waitForCancel=true;const download=a.service.download();await new Promise(r=>setImmediate(r));assert.equal(a.service.busy(),true);await a.service.shutdown();await download;
  let recovered=0;const b=setup({recoverInstall:()=>{recovered++;}});await b.service.check();await b.service.download();b.updater.installFailure=true;await b.service.install();assert.equal(recovered,1);assert.equal(b.service.snapshot().phase,'error');
});
test('development never checks/downloads and arbitrary renderer frames cannot update',async()=>{
  const {updater,service}=setup({enabled:false});await service.check();await service.download();assert.equal(updater.checks,0);assert.equal(service.snapshot().phase,'disabled');
  const main={mainFrame:{url:'http://127.0.0.1:7860/'}},panel={mainFrame:{url:'file:///app/updates.html'}};
  const options={main,panel,localOrigin:'http://127.0.0.1:7860',startupUrl:'file:///app/startup.html',panelUrl:'file:///app/updates.html'};
  const event=sender=>({sender,senderFrame:sender.mainFrame});
  assert.equal(trustedUpdateSender(event(main),options),true);assert.equal(trustedUpdateSender(event(main),options,true),false);
  assert.equal(trustedUpdateSender(event(panel),options,true),true);
  assert.equal(trustedUpdateSender({sender:main,senderFrame:{url:main.mainFrame.url}},options),false);
  for(const url of ['https://aitoearn.cn/zh-CN','http://127.0.0.1:7860/assets/a.html','http://127.0.0.1:9000/','file:///other.html']){main.mainFrame.url=url;assert.equal(trustedUpdateSender(event(main),options),false);}
});

test('startup checks once, reuses successful manual checks, closes without download, and resets only on process recreation',async()=>{
 const wait=()=>new Promise(r=>setTimeout(r,35));
 const a=setup();a.service.scheduleStartupCheck(5);a.service.scheduleStartupCheck(5);await wait();
 assert.equal(a.updater.checks,1);assert.equal(a.updater.downloads,0);assert.equal(a.updater.installs,0);
 a.service.dismissBanner();assert.equal(a.service.snapshot().bannerDismissed,true);
 await a.service.check();assert.equal(a.service.snapshot().bannerDismissed,true);
 const b=setup();await b.service.check();b.service.scheduleStartupCheck(5);await wait();assert.equal(b.updater.checks,1);assert.equal(b.service.snapshot().bannerDismissed,false);
 const c=setup();c.updater.offline=true;c.service.scheduleStartupCheck(5);await wait();assert.equal(c.service.snapshot().phase,'error');c.updater.offline=false;await c.service.check();assert.equal(c.service.snapshot().phase,'available');
 const d=setup();d.service.scheduleStartupCheck(5);await d.service.shutdown();await wait();assert.equal(d.updater.checks,0);
});

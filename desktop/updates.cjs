const {EventEmitter}=require('node:events');

const RELEASES='https://github.com/jerryrenjianxing-sys/MediaSail/releases';
// No URL, shell command, path or feed option is accepted from a renderer.
function trustedUpdateSender(event,{main,localOrigin,startupUrl,panel,panelUrl},panelOnly=false){
  if(!event.sender || event.senderFrame!==event.sender.mainFrame)return false;
  if(event.sender===panel && event.senderFrame.url===panelUrl)return true;
  if(panelOnly || event.sender!==main)return false;
  if(event.senderFrame.url===startupUrl)return true;
  try{const u=new URL(event.senderFrame.url);return Boolean(localOrigin)&&u.origin===localOrigin&&u.pathname==='/'&&!u.search;}catch{return false;}
}

class Updates extends EventEmitter{
  constructor({updater,version,enabled=true,prepareInstall=async()=>true,recoverInstall=()=>{},log=()=>{}}){
    super();Object.assign(this,{updater,enabled,prepareInstall,recoverInstall,log});
    this.state={phase:enabled?'idle':'disabled',current:version,version:'',percent:0,transferred:0,total:0,bytesPerSecond:0,message:enabled?'可以检查是否有新版本。':'开发模式不下载更新，请使用安装版。',checkedAt:null};
    this.operation=null;this.token=null;this.installPending=false;this.stopped=false;
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.autoRunAppAfterInstall=true;
    updater.allowPrerelease=false;updater.allowDowngrade=false;updater.disableWebInstaller=true;
    updater.on('checking-for-update',()=>this.set({phase:'checking',message:'正在连接 GitHub 检查更新…'}));
    updater.on('update-available',info=>this.set({phase:'available',version:info.version,total:info.files?.[0]?.size||0,message:`发现新版本 ${info.version}，可以开始下载。`}));
    updater.on('update-not-available',()=>this.set({phase:'current',version:'',checkedAt:Date.now(),message:'当前已是最新版本。'}));
    updater.on('download-progress',p=>this.set({phase:'downloading',percent:Math.max(0,Math.min(100,p.percent||0)),transferred:p.transferred||0,total:p.total||0,bytesPerSecond:p.bytesPerSecond||0,message:'正在下载，关闭到托盘后仍会继续。'}));
    updater.on('update-downloaded',info=>this.set({phase:'downloaded',version:info.version,percent:100,message:'新版已准备好，重启安装后生效。'}));
    updater.on('error',e=>this.error(e));
  }
  snapshot(){return {...this.state};}
  set(change){if(this.stopped)return;Object.assign(this.state,change);this.emit('state',this.snapshot());}
  error(error){
    if(this.stopped)return;
    this.log(error?.stack||String(error));
    const installing=this.state.phase==='installing';
    const code=String(error?.code||error?.message||'').slice(0,150);
    let message=/sha512|checksum|signature/i.test(code)?'安装包校验未通过，请重新下载或前往版本页面。':/404|ERR_UPDATER_NO_PUBLISHED_VERSIONS/i.test(code)?'暂未找到可用版本，请稍后再试。':'更新未完成，请检查网络后重试。';
    if(installing)message='未能启动安装程序，本地服务正在恢复。可前往版本页面手动下载。';
    this.set({phase:'error',message});
    if(installing)void Promise.resolve(this.recoverInstall()).catch(e=>this.log(String(e)));
  }
  async check(){
    if(!this.enabled||this.stopped||this.operation||['downloaded','installing'].includes(this.state.phase))return this.snapshot();
    const task=Promise.resolve().then(()=>this.updater.checkForUpdates());this.operation=task;
    try{await task;this.set({checkedAt:Date.now()});}catch(e){this.error(e);}finally{if(this.operation===task)this.operation=null;}
    return this.snapshot();
  }
  async download(){
    if(!this.enabled||this.stopped||this.operation||this.state.phase!=='available')return this.snapshot();
    const {CancellationToken}=require('builder-util-runtime');this.token=new CancellationToken();
    this.set({phase:'downloading',percent:0,transferred:0,bytesPerSecond:0,message:'正在准备下载…'});
    const task=Promise.resolve().then(()=>this.updater.downloadUpdate(this.token));this.operation=task;
    try{await task;}catch(e){this.error(e);}finally{this.token=null;if(this.operation===task)this.operation=null;}
    return this.snapshot();
  }
  async install(){
    if(this.stopped||this.installPending||this.state.phase!=='downloaded')return this.snapshot();
    this.installPending=true;
    try{
      if(!await this.prepareInstall())return this.snapshot();
      this.set({phase:'installing',message:'正在打开安装进度窗口。完整运行环境需要解压，请稍候；成功后会自动重新打开。'});
      this.updater.quitAndInstall(true,true);
    }catch(e){this.error(e);}finally{this.installPending=false;}
    return this.snapshot();
  }
  busy(){return this.state.phase==='downloading'||this.state.phase==='installing'||this.installPending;}
  async shutdown(){
    this.stopped=true;this.token?.cancel();
    if(this.operation){let timer;try{await Promise.race([this.operation.catch(()=>{}),new Promise(resolve=>{timer=setTimeout(resolve,3000);})]);}finally{clearTimeout(timer);}}
  }
}
module.exports={Updates,RELEASES,trustedUpdateSender};

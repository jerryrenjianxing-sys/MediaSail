const {BrowserWindow,ipcMain,shell}=require('electron');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {RELEASES,trustedUpdateSender}=require('./updates.cjs');
class UpdatesWindow{
  constructor({updates,main,localOrigin,startupUrl,data}){
    Object.assign(this,{updates,main,localOrigin,startupUrl,data});this.panel=null;
    this.panelUrl=pathToFileURL(path.join(__dirname,'updates.html')).href;
    ipcMain.handle('updates:open',event=>{if(this.trusted(event)){this.show();return true;}return false;});
    ipcMain.handle('updates:call',async(event,action)=>{
      if(!this.trusted(event,action!=='status'))return {ok:false,error:'此页面不能操作软件更新。'};
      switch(action){
        case 'status':return {ok:true,data:updates.snapshot()};
        // Start long operations without keeping an IPC request alive until download finishes.
        case 'check':void updates.check();break;
        case 'download':void updates.download();break;
        case 'install':void updates.install();break;
        case 'releases':await shell.openExternal(RELEASES);break;
        case 'logs':await shell.openPath(path.join(data,'logs'));break;
        default:return {ok:false,error:'不支持的更新操作。'};
      }
      return {ok:true,data:updates.snapshot()};
    });
    updates.on('state',state=>{for(const wc of [main.webContents,this.panel?.webContents])if(wc&&!wc.isDestroyed())wc.send('updates:state',state);});
  }
  trusted(event,panelOnly=false){return trustedUpdateSender(event,{main:this.main.webContents,localOrigin:this.localOrigin(),startupUrl:this.startupUrl,panel:this.panel?.webContents,panelUrl:this.panelUrl},panelOnly);}
  show(){
    if(this.main.isMinimized())this.main.restore();this.main.show();
    if(this.panel&&!this.panel.isDestroyed()){this.panel.show();this.panel.focus();return;}
    this.panel=new BrowserWindow({width:560,height:545,minWidth:520,minHeight:510,parent:this.main,show:false,title:'MediaSail · 软件更新',autoHideMenuBar:true,icon:path.join(__dirname,'assets/icon.ico'),webPreferences:{preload:path.join(__dirname,'updates-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
    this.panel.setMenu(null);
    this.panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    this.panel.webContents.on('will-navigate',event=>event.preventDefault());
    this.panel.once('ready-to-show',()=>this.panel?.show());
    this.panel.on('closed',()=>{this.panel=null;});
    void this.panel.loadURL(this.panelUrl);
  }
  hide(){this.panel?.hide();}
}
module.exports={UpdatesWindow};

const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,shell,dialog}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {syncWorkspace}=require('./workspace.cjs');
const {freePort,environment,startSupervisor,stopSupervisor,state}=require('./runtime.cjs');
const {AitoController}=require('./aitoearn/controller.cjs');
const {Updates}=require('./updates.cjs');
const {UpdatesWindow}=require('./updates-window.cjs');
const {UiStateStore,trustedStateSender}=require('./ui-state.cjs');
const {migrateUiState}=require('./ui-migration.cjs');

app.setName('MediaSail');
// Keep the original installation identity and data location across the rebrand.
app.setPath('userData',path.resolve(process.env.EASEL_DESKTOP_DATA || path.join(process.env.LOCALAPPDATA || app.getPath('appData'),'ElectronEasel')));
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();} else {
  let window,tray,supervisor,aito,updates,updatesWindow,starting=false,quitting=false,exitPending=false,ready=false,baseUrl='',options;
  let startup={message:'正在准备本地工作目录…',error:false};
  const data=app.getPath('userData');
  const uiState=new UiStateStore(data);
  const resources=app.isPackaged ? process.resourcesPath : path.join(__dirname,'../build');
  const bridgeResources=app.isPackaged?resources:path.join(__dirname,'..');
  const startupUrl=pathToFileURL(path.join(__dirname,'startup.html')).href;
  const show=()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}};
  function report(message,error=false){startup={message,error};fs.mkdirSync(path.join(data,'logs'),{recursive:true});fs.appendFileSync(path.join(data,'logs/desktop.log'),new Date().toISOString()+' '+message+'\n');}
  async function fail(message){ready=false;aito?.hide();report(message,true);if(window&&!window.isDestroyed())await window.loadURL(startupUrl);}
  const ownStartup=event=>event.sender===window?.webContents && event.senderFrame?.url===startupUrl;
  ipcMain.handle('startup:status',event=>ownStartup(event)?startup:null);
  ipcMain.handle('startup:retry',event=>{if(ownStartup(event))void start();});
  ipcMain.handle('startup:logs',event=>{if(ownStartup(event))return shell.openPath(path.join(data,'logs'));});
  ipcMain.handle('ui-state:call',async(event,action,input)=>{
    if(!trustedStateSender(event,window?.webContents,baseUrl))return {ok:false,error:'此页面无权访问界面数据。'};
    try{
      if(action==='load')return {ok:true,data:uiState.snapshot()};
      if(action==='set')return {ok:true,data:await uiState.change(input?.key,input?.value)};
      if(action==='remove')return {ok:true,data:await uiState.change(input?.key,null)};
      if(action==='flush')return {ok:true,data:await uiState.flush()};
      throw new Error('不支持的界面数据操作。');
    }catch(e){report('界面数据操作失败：'+e.message);return {ok:false,error:'界面数据未能保存，请重试。'+e.message};}
  });
  async function start(){
    if(starting||quitting)return;starting=true;ready=false;
    try{
      report('正在准备本地工作目录…');await stopSupervisor(supervisor);supervisor=null;
      await uiState.open(()=>migrateUiState({data,resources,bridgeResources,report}));
      const work=await syncWorkspace(path.join(resources,'payload'),data);
      if(!aito)aito=new AitoController({window,data,resources,localOrigin:()=>baseUrl,outputs:path.join(work,'outputs')});
      if(quitting)return;
      const port=await freePort(7860),gatewayPort=await freePort(37289);
      options=environment(resources,data,work,port,gatewayPort);baseUrl=`http://127.0.0.1:${port}`;
      report('正在启动 MediaSail 和本地服务…');
      let failure='';
      supervisor=startSupervisor(bridgeResources,options,event=>{if(event.event==='error'){failure=event.message;if(ready&&!quitting)void fail(event.message);}});
      const current=supervisor;
      supervisor.on('exit',(code)=>{if(!quitting&&current===supervisor&&ready)void fail(`本地服务已退出（${code}）。请重试或查看日志。`);});
      const deadline=Date.now()+150000;
      while(Date.now()<deadline){
        if(quitting)return;
        if(failure)throw new Error(failure);
        if(current.exitCode!==null)throw new Error('本地服务启动失败，请查看日志后重试。');
        try{
          const [s,g]=await Promise.all([state(baseUrl,options.env.EASEL_DESKTOP_TOKEN),fetch(`http://127.0.0.1:${gatewayPort}/readyz`,{signal:AbortSignal.timeout(2000)})]);
          if(s.ready&&g.ok){
            const api=await fetch(baseUrl+'/api/status',{signal:AbortSignal.timeout(5000)});
            if(api.ok && (await api.json()).gateway){ready=true;report('MediaSail 已就绪');await window.loadURL(baseUrl);return;}
          }
        }catch{}
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      throw new Error('本地服务启动超时，请查看日志后重试。');
    }catch(e){await stopSupervisor(supervisor);supervisor=null;if(!quitting)await fail(e.message);}
    finally{starting=false;}
  }
  async function confirmStop(forUpdate=false){
      let active=0;
      if(ready){try{active=(await state(baseUrl,options.env.EASEL_DESKTOP_TOKEN)).active;}catch{active=-1;}}
      else if(starting)active=-1;
      if(aito?.busy())active=Math.max(1,active);
      if(!forUpdate&&updates?.busy())active=Math.max(1,active);
      if(active!==0){
        show();const answer=await dialog.showMessageBox(window,{type:'question',title:forUpdate?'更新 MediaSail':'退出 MediaSail',message:active>0?'还有任务正在进行，退出会中断任务。':'暂时无法确认后台任务状态。',detail:forUpdate?'建议等任务结束后再安装更新。':'关闭窗口可以让程序继续留在托盘运行。',buttons:['继续运行',forUpdate?'中断任务并安装':'退出程序'],defaultId:0,cancelId:0,noLink:true});
        if(answer.response!==1)return false;
      }
      return true;
  }
  async function prepareInstall(){
    if(exitPending||quitting)return false;exitPending=true;
    try{
      if(!await confirmStop(true))return false;
      await flushUiState();
      quitting=true;await aito?.shutdown();await stopSupervisor(supervisor);supervisor=null;await flushUiState();return true;
    }catch(e){await recoverInstall();throw e;}finally{exitPending=false;}
  }
  async function recoverInstall(){quitting=false;ready=false;aito?.resume();report('更新安装未启动，正在恢复本地服务…');await start();}
  async function flushUiState(){
    if(ready&&window&&!window.isDestroyed()&&window.webContents.getURL()===baseUrl+'/')await window.webContents.executeJavaScript('window.mediaSailPrepareClose?.()');
    await uiState.flush();
  }
  async function exit(){
    if(exitPending||quitting||updates?.installPending)return;exitPending=true;
    try{
      if(!await confirmStop())return;
      await flushUiState();
      quitting=true;await aito?.shutdown();await stopSupervisor(supervisor);await flushUiState();await updates?.shutdown();tray?.destroy();app.quit();
    }catch(e){
      if(quitting){quitting=false;ready=false;aito?.resume();await start();}
      else if(window&&!window.isDestroyed())await window.webContents.executeJavaScript('document.body.inert=false').catch(()=>{});
      show();dialog.showErrorBox('MediaSail 尚未退出','数据保存尚未完成，请稍后重试。'+e.message);
    }finally{exitPending=false;}
  }
  app.on('second-instance',show);
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();void exit();}});
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    app.setAppUserModelId('org.electroneasel.desktop');
    window=new BrowserWindow({width:1360,height:900,minWidth:900,minHeight:640,title:'MediaSail',icon:path.join(__dirname,'assets/icon.ico'),backgroundColor:'#faf9f6',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    Menu.setApplicationMenu(null);
    window.on('close',event=>{if(!quitting){event.preventDefault();updatesWindow?.hide();window.hide();}});
    window.on('query-session-end',()=>{quitting=true;void aito?.shutdown();supervisor?.stdin.end('shutdown\n');});
    const external=url=>{try{const u=new URL(url);if(['https:','http:'].includes(u.protocol))void shell.openExternal(url);}catch{}};
    window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
    window.webContents.on('will-navigate',(event,url)=>{if(url!==startupUrl && (!baseUrl || new URL(url).origin!==baseUrl)){event.preventDefault();external(url);}});
    window.webContents.session.setPermissionRequestHandler((_wc,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
    window.webContents.on('render-process-gone',()=>{if(!quitting)void fail('界面异常退出，请重试。');});
    const {autoUpdater}=require('electron-updater');
    const updateLog=message=>{try{const dir=path.join(data,'logs');fs.mkdirSync(dir,{recursive:true});fs.appendFileSync(path.join(dir,'updates.log'),new Date().toISOString()+' '+String(message)+'\n');}catch{}};
    autoUpdater.logger={info:updateLog,warn:updateLog,error:updateLog,debug:()=>{}};
    updates=new Updates({updater:autoUpdater,version:app.getVersion(),enabled:app.isPackaged,prepareInstall,recoverInstall,log:updateLog});
    updatesWindow=new UpdatesWindow({updates,main:window,localOrigin:()=>baseUrl,startupUrl,data});
    tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets/icon.png')).resize({width:20,height:20}));
    tray.setToolTip('MediaSail');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开 MediaSail',click:show},{label:'检查更新…',click:()=>{updatesWindow.show();void updates.check();}},{type:'separator'},{label:'退出',click:()=>void exit()}]));tray.on('double-click',show);
    await window.loadURL(startupUrl);void start();
    const timer=setTimeout(()=>void updates.check(),15000);timer.unref();
  }).catch(e=>{dialog.showErrorBox('MediaSail 启动失败',e.message);quitting=true;app.quit();});
}

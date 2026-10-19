const {app,BrowserWindow,Tray,Menu,nativeImage,ipcMain,shell,dialog,clipboard,ClipboardItem}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {syncWorkspace,syncAgentSkill,atomic}=require('./workspace.cjs');
const library=require('./library.cjs');
const {acquire}=require('./single-instance.cjs');
const {freePort,environment,startSupervisor,stopSupervisor,state}=require('./runtime.cjs');
const {createActionsHandler}=require('./actions.cjs');
const {createSkillShareHandler,validateSkillFileName}=require('./skill-share.cjs');
const {Updates}=require('./updates.cjs');
const {AgentConnection,writeDisconnectedDiscovery}=require('./agent-connection.cjs');
const {UpdatesWindow}=require('./updates-window.cjs');
const {UiStateStore,trustedStateSender}=require('./ui-state.cjs');
const {migrateUiState}=require('./ui-migration.cjs');
const {archiveHistory}=require('./history-archive.cjs');
const {cleanupLegacyUpdates}=require('./update-cache.cjs');
const {adoptInstallerBaseline}=require('./installer-cache.cjs');
const {assertStartupLibraryIdle,appendStartupLog}=require('./startup-recovery.cjs');

app.setName('MediaSail');
// Keep the original installation identity and data location across the rebrand.
const explicitDataRoot=process.env.EASEL_DESKTOP_DATA||null;
const bootstrapRoot=path.resolve(process.env.EASEL_LIBRARY_BOOTSTRAP||explicitDataRoot||path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'ElectronEasel'));
const defaultLibraryRoot=path.join(app.getPath('documents'),'MediaSail资料库');
const locationOptions={bootstrapRoot,defaultLibraryRoot,explicitDataRoot};
let layout,bootError;
try{
  layout=library.readLocation(locationOptions);
  if(layout.selectionError)bootError=new Error(layout.selectionError);
}catch(e){bootError=e;layout={mode:'unselected',bootstrapRoot,workspace:null,libraryRoot:null,needsSelection:true};}
const selectionMode=Boolean(layout.needsSelection||bootError);
// Keep the old lock address for compatibility with a still-running 0.5.0.
fs.mkdirSync(bootstrapRoot,{recursive:true});app.setPath('userData',bootstrapRoot);
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();} else {
  let window,tray,supervisor,updates,updatesWindow,starting=false,quitting=false,exitPending=false,ready=false,baseUrl='',options;
  let startup={message:selectionMode?'请选择资料库。这次选择一次，以后沿用。':'正在准备本地工作目录…',error:Boolean(bootError)};
  if(bootError)startup.message='资料库位置暂不可用，请重新选择一个空目录或有效资料库。\n'+bootError.message;
  const data=selectionMode?path.join(bootstrapRoot,'selection-ui'):layout.dataRoot;
  fs.mkdirSync(data,{recursive:true});app.setPath('userData',data);app.setPath('sessionData',data);
  const single=acquire({key:explicitDataRoot||process.env.EASEL_LIBRARY_BOOTSTRAP?bootstrapRoot:undefined,onRaise:()=>show()}).catch(error=>({primary:false,error,close:async()=>{}}));
  const agentConnection=new AgentConnection(data);
  const uiState=new UiStateStore(data);
  const resources=app.isPackaged ? process.resourcesPath : path.join(__dirname,'../build');
  const bridgeResources=app.isPackaged?resources:path.join(__dirname,'..');
  const startupUrl=pathToFileURL(path.join(__dirname,'startup.html')).href;
  let startupLogDirectory=path.join(data,'logs');
  const show=()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus();}};
  function report(message,error=false){startup={message,error};startupLogDirectory=appendStartupLog({data,bootstrapRoot,message})||startupLogDirectory;}
  async function fail(message){ready=false;agentConnection.stop();report(message,true);if(window&&!window.isDestroyed())await window.loadURL(startupUrl);}
  const ownStartup=event=>event.sender===window?.webContents && event.senderFrame===window?.webContents.mainFrame && event.senderFrame?.url===startupUrl;
  ipcMain.handle('startup:status',event=>ownStartup(event)?{...startup,needsSelection:selectionMode,canRetry:!selectionMode||Boolean(bootError),busy:libraryChanging||starting}:null);
  ipcMain.handle('startup:retry',event=>{
    if(!ownStartup(event)||libraryChanging)return;
    if(!selectionMode){void start();return;}
    if(bootError){libraryChanging=true;report('正在重新检测资料库位置…');void restartLibrary().catch(error=>report(error.message,true)).finally(()=>{libraryChanging=false;});}
  });
  ipcMain.handle('startup:logs',event=>{if(ownStartup(event))return shell.openPath(startupLogDirectory);});
  ipcMain.handle('startup:quit',event=>{if(ownStartup(event))void exit();});
  ipcMain.handle('startup:updates',event=>{if(ownStartup(event)&&updatesWindow&&!libraryChanging){updatesWindow.show();void updates.check();return true;}return false;});
  ipcMain.handle('startup:library',async(event,action)=>{
    if(!ownStartup(event))return {ok:false,error:'此页面不能选择资料库。'};
    try{
      if(action!=='choose')throw Error('不支持的资料库操作。');
      if(libraryChanging||starting||updates?.busy())throw Error('请等待当前操作完成后再选择资料库。');
      libraryChanging=true;
      const pick=await dialog.showOpenDialog(window,{title:'选择 MediaSail 资料库',defaultPath:defaultLibraryRoot,properties:['openDirectory','createDirectory']});
      if(pick.canceled)return {ok:true,data:{canceled:true}};
      await assertStartupLibraryIdle({supervisor,options,baseUrl,state});
      await library.chooseLibrary({bootstrapRoot,targetRoot:pick.filePaths[0],installDirectory:path.dirname(app.getPath('exe')),explicitDataRoot});
      await restartLibrary();return {ok:true,data:{restarting:true}};
    }catch(e){report(e.message,true);return {ok:false,error:e.message};}
    finally{libraryChanging=false;}
  });
  let libraryChanging=false;
  ipcMain.handle('actions:call',createActionsHandler({shell,main:()=>window?.webContents,localOrigin:()=>baseUrl,outputs:()=>layout.workspace?path.join(layout.workspace,'outputs'):null,data:()=>data,available:()=>ready&&!quitting&&!libraryChanging}));
  ipcMain.handle('skill:copy-file',createSkillShareHandler({clipboard,ClipboardItem,main:()=>window?.webContents,localOrigin:()=>baseUrl,data:()=>data,available:()=>ready&&!quitting&&!libraryChanging}));
  ipcMain.handle('library:call',async(event,action,input)=>{
    if(!trustedStateSender(event,window?.webContents,baseUrl))return {ok:false,error:'此页面不能操作资料库。'};
    try{
      if(action==='status'){
        let conflicts=[];for(const file of ['installed-manifest.json.conflicts.json','agent-skill-manifest.json.conflicts.json'])try{conflicts.push(...JSON.parse(fs.readFileSync(path.join(data,file),'utf8')).conflicts);}catch{}
        return {ok:true,data:{...library.libraryStatus({bootstrapRoot,current:layout}),defaultLibraryRoot,conflicts}};
      }
      if(action==='open'){const error=await shell.openPath(layout.libraryRoot||data);if(error)throw Error(error);return {ok:true,data:true};}
      if(action==='choose'){const pick=await dialog.showOpenDialog(window,{title:'选择 MediaSail 资料库目录',defaultPath:layout.libraryRoot||defaultLibraryRoot,properties:['openDirectory','createDirectory']});return {ok:true,data:{path:pick.canceled?null:pick.filePaths[0]}};}
      if(action!=='change')throw Error('不支持的资料库操作。');
      if(libraryChanging)throw Error('资料库操作正在准备，请稍候。');libraryChanging=true;
      try{
        if(updates?.busy()||starting)throw Error('请等待更新或启动完成后再更改资料库。');
        if((await state(baseUrl,options.env.EASEL_DESKTOP_TOKEN)).active!==0)throw Error('还有采集、登录或发布任务，请等任务结束再更改资料库。');
        if(await window.webContents.executeJavaScript('Boolean(window.mediaSailHasUnsavedEdits?.())'))throw Error('还有未保存的编辑或表单，请先保存或取消编辑，再更改资料库。');
        if(!await flushUiState())throw Error('资料库更换已取消，请先保存或取消归档编辑。');
        await library.chooseLibrary({bootstrapRoot,targetRoot:input?.targetRoot,installDirectory:path.dirname(app.getPath('exe')),explicitDataRoot});
        await restartLibrary();return {ok:true,data:{restarting:true}};
      }finally{libraryChanging=false;if(!quitting)await window.webContents.executeJavaScript('window.mediaSailResetClose?.();document.body.inert=false').catch(()=>{});}
    }catch(e){return {ok:false,error:e.message};}
  });
  async function restartLibrary(){
    try{
      if(uiState.state)await uiState.flush();
      agentConnection.stop();writeDisconnectedDiscovery({file:path.join(bootstrapRoot,'agent-connection.json'),version:app.getVersion(),executable:app.getPath('exe'),reason:'library_restarting'});await stopSupervisor(supervisor);supervisor=null;
      await updates?.shutdown();quitting=true;app.relaunch();app.quit();
    }catch(e){quitting=false;ready=false;throw e;}
  }
  ipcMain.handle('data:archive',async event=>{
    if(!trustedStateSender(event,window?.webContents,baseUrl))return {ok:false,error:'此页面不能打开历史存档。'};
    try{const directory=await archiveHistory(data,uiState.snapshot());const error=await shell.openPath(directory);if(error)throw Error(error);return {ok:true};}catch(e){report('历史存档未能打开：'+e.message);return {ok:false,error:e.message};}
  });
  ipcMain.handle('ui-state:call',async(event,action,input)=>{
    if(!trustedStateSender(event,window?.webContents,baseUrl))return {ok:false,error:'此页面无权访问界面数据。'};
    try{
      if(action==='load')return {ok:true,data:uiState.snapshot()};
      if(action==='set'||action==='remove'){if(action==='set'&&input?.key==='mediasail_skill_filename')validateSkillFileName(input.value);const result=await uiState.change(input?.key,action==='remove'?null:input?.value);if(input?.key==='mediasail_selected_profile')agentConnection.selectProfile(action==='remove'?null:input?.value);return {ok:true,data:result};}
      if(action==='flush')return {ok:true,data:await uiState.flush()};
      throw new Error('不支持的界面数据操作。');
    }catch(e){report('界面数据操作失败：'+e.message);return {ok:false,error:'界面数据未能保存，请重试。'+e.message};}
  });
  async function start(){
    if(selectionMode||starting||quitting)return;starting=true;ready=false;
    try{
      report('正在准备本地工作目录…');agentConnection.stop();await stopSupervisor(supervisor);supervisor=null;
      await uiState.open(()=>migrateUiState({data,resources,bridgeResources,report}));
      await archiveHistory(data,uiState.snapshot());
      const work=await syncWorkspace(path.join(resources,'payload'),data,{workspaceRoot:layout.workspace});
      const skillDir=layout.agentSkillRoot||path.join(bridgeResources,'agent-skill/mediasail');
      if(layout.agentSkillRoot)await syncAgentSkill(path.join(bridgeResources,'agent-skill/mediasail'),skillDir,data,app.getVersion());
      if(layout.libraryRoot){
        const guide=path.join(layout.libraryRoot,'MediaSail-使用说明.md');
        if(!fs.existsSync(guide))await atomic(guide,'# MediaSail 资料库\n\n软件与外部 Agent 共用这一份真实目录。你可以直接创建项目、编辑画像、改进方法与工具。\n\n- workspace/profiles：六维画像与运营经验。\n- workspace/outputs：项目、报告、素材、中间文件和成品；项目内 .easel.json 用于内容库展示。系统前缀保存分析、选题、日历与发布记录。\n- workspace/skills：业务计算、运营及创作方法；索引见 skills/KNOWLEDGE.md 与 skills/business-tools.md。\n- workspace/assets：原有共享素材。\n- agent-skill/mediasail/SKILL.md：完整接入说明及按需参考资料。\n- runtime：配置、账号浏览器资料、旧版 AitoEarn 会话与发送记录（仅保留）、界面状态、历史存档、更新缓存和升级备份。\n\n当前连接与工具路径见 runtime/agent-connection.json；端口和库位置以最新连接为准。软件关闭时仍可阅读资料及执行本地计算。无需每轮固定检查，也不限定创作工具。\n\n新成果按项目保存，之后可以刷新内容库并读回核对。更改资料库位置后，已有 Agent 需要重新读取连接资料。\n');
      }
      if(quitting)return;
      const port=await freePort(7860);
      options=environment(resources,data,work,port);baseUrl=`http://127.0.0.1:${port}`;
      agentConnection.begin({version:app.getVersion(),baseUrl,options,skillDir,executable:app.getPath('exe'),selectedProfile:uiState.snapshot().values.mediasail_selected_profile||null,libraryRoot:layout.libraryRoot,libraryId:layout.libraryId,discoveryFile:path.join(bootstrapRoot,'agent-connection.json')});
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
          const s=await state(baseUrl,options.env.EASEL_DESKTOP_TOKEN);
          if(s.ready){
            const api=await fetch(baseUrl+'/api/status',{signal:AbortSignal.timeout(5000)});
            if(api.ok && (await api.json()).serviceReady){ready=true;agentConnection.write('ready');report('MediaSail 已就绪');await window.loadURL(baseUrl);updates?.scheduleStartupCheck();if(app.isPackaged)void cleanupLegacyUpdates({updater:updates.updater,current:app.getVersion(),report});return;}
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
      if(!await flushUiState())return false;
      quitting=true;agentConnection.stop();await stopSupervisor(supervisor);supervisor=null;await flushUiState();return true;
    }catch(e){if(quitting)await recoverInstall();else if(window&&!window.isDestroyed())await window.webContents.executeJavaScript('window.mediaSailResetClose?.();document.body.inert=false').catch(()=>{});throw e;}finally{exitPending=false;}
  }
  async function recoverInstall(){quitting=false;ready=false;if(selectionMode){report('更新安装未能启动。可以重试检查更新，或选择资料库后继续使用。',true);return;}report('更新安装未启动，正在恢复本地服务…');await start();}
  async function flushUiState(){
    if(ready&&window&&!window.isDestroyed()&&window.webContents.getURL()===baseUrl+'/'&&await window.webContents.executeJavaScript('window.mediaSailPrepareClose?.()')===false)return false;
    await uiState.flush();
    return true;
  }
  async function exit(){
    if(exitPending||quitting||updates?.installPending)return;exitPending=true;
    try{
      if(!await confirmStop())return;
      if(!await flushUiState())return;
      quitting=true;agentConnection.stop();await stopSupervisor(supervisor);await flushUiState();await updates?.shutdown();tray?.destroy();app.quit();
    }catch(e){
      if(quitting){quitting=false;ready=false;await start();}
      else if(window&&!window.isDestroyed())await window.webContents.executeJavaScript('window.mediaSailResetClose?.();document.body.inert=false').catch(()=>{});
      show();dialog.showErrorBox('MediaSail 尚未退出','数据保存尚未完成，请稍后重试。'+e.message);
    }finally{exitPending=false;}
  }
  app.on('second-instance',show);
  app.on('before-quit',event=>{if(!quitting){event.preventDefault();void exit();}});
  app.on('window-all-closed',()=>{});
  app.whenReady().then(async()=>{
    const lock=await single;
    if(!lock.primary){if(lock.error)dialog.showErrorBox('MediaSail 未能启动',lock.error.message);quitting=true;app.quit();return;}
    app.once('quit',()=>{void single.then(lock=>lock.close());});
    app.setAppUserModelId('org.electroneasel.desktop');
    window=new BrowserWindow({width:1360,height:900,minWidth:900,minHeight:640,title:'MediaSail',icon:path.join(__dirname,'assets/icon.ico'),backgroundColor:'#faf9f6',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    Menu.setApplicationMenu(null);
    window.on('close',event=>{if(!quitting){event.preventDefault();updatesWindow?.hide();window.hide();}});
    window.on('query-session-end',()=>{quitting=true;agentConnection.stop();supervisor?.stdin.end('shutdown\n');});
    if(selectionMode)writeDisconnectedDiscovery({file:path.join(bootstrapRoot,'agent-connection.json'),version:app.getVersion(),executable:app.getPath('exe')});
    const external=url=>{try{const u=new URL(url);if(['https:','http:'].includes(u.protocol))void shell.openExternal(url);}catch{}};
    window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
    window.webContents.on('will-navigate',(event,url)=>{if(url!==startupUrl && (!baseUrl || new URL(url).origin!==baseUrl)){event.preventDefault();external(url);}});
    window.webContents.session.setPermissionRequestHandler((_wc,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
    window.webContents.on('render-process-gone',()=>{if(!quitting)void fail('界面异常退出，请重试。');});
    const {NsisUpdater}=require('electron-updater');
    const autoUpdater=new NsisUpdater();
    Object.defineProperty(autoUpdater.app,'baseCachePath',{get:()=>path.join(data,'update-cache')});
    autoUpdater.installDirectory=path.dirname(app.getPath('exe'));
    const updateLog=message=>{try{const dir=path.join(data,'logs');fs.mkdirSync(dir,{recursive:true});fs.appendFileSync(path.join(dir,'updates.log'),new Date().toISOString()+' '+String(message)+'\n');}catch{}};
    autoUpdater.logger={info:updateLog,warn:updateLog,error:updateLog,debug:()=>{}};
    if(app.isPackaged&&!selectionMode)await adoptInstallerBaseline({updater:autoUpdater,bootstrapRoot,version:app.getVersion(),report:updateLog});
    updates=new Updates({updater:autoUpdater,version:app.getVersion(),enabled:app.isPackaged,prepareInstall,recoverInstall,log:updateLog});
    updatesWindow=new UpdatesWindow({updates,main:window,localOrigin:()=>baseUrl,startupUrl,data});
    tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'assets/icon.png')).resize({width:20,height:20}));
    tray.setToolTip('MediaSail');tray.setContextMenu(Menu.buildFromTemplate([{label:'打开 MediaSail',click:show},{label:'检查更新…',click:()=>{updatesWindow.show();void updates.check();}},{type:'separator'},{label:'退出',click:()=>void exit()}]));tray.on('double-click',show);
    await window.loadURL(startupUrl);if(!selectionMode)void start();
  }).catch(e=>{dialog.showErrorBox('MediaSail 启动失败',e.message);quitting=true;app.quit();});
}

const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('desktopLibrary',{
  call:async(action,input)=>{const r=await ipcRenderer.invoke('library:call',action,input);if(!r?.ok)throw new Error(r?.error||'资料库操作未完成。');return r.data;}
});
contextBridge.exposeInMainWorld('desktopData',{
  openArchive:async()=>{const r=await ipcRenderer.invoke('data:archive');if(!r?.ok)throw new Error(r?.error||'无法打开历史存档。');}
});
contextBridge.exposeInMainWorld('desktopUiState',{
  call:async(action,input)=>{const result=await ipcRenderer.invoke('ui-state:call',action,input);if(!result.ok)throw new Error(result.error);return result.data;}
});
contextBridge.exposeInMainWorld('desktopUpdates',{
  open:()=>ipcRenderer.invoke('updates:open'),
  openAndCheck:()=>ipcRenderer.invoke('updates:open-and-check'),
  dismissBanner:()=>ipcRenderer.invoke('updates:dismiss-banner'),
  status:async()=>{const r=await ipcRenderer.invoke('updates:call','status');return r.ok?r.data:null;},
  subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('updates:state',listener);return()=>ipcRenderer.removeListener('updates:state',listener);}
});
contextBridge.exposeInMainWorld('desktopStartup',{
  retry:()=>ipcRenderer.invoke('startup:retry'),
  logs:()=>ipcRenderer.invoke('startup:logs'),
  library:async action=>{const result=await ipcRenderer.invoke('startup:library',action);if(!result?.ok)throw new Error(result?.error||'未能选择资料库。');return result.data;},
  checkUpdates:()=>ipcRenderer.invoke('startup:updates'),
  quit:()=>ipcRenderer.invoke('startup:quit'),
  status:()=>ipcRenderer.invoke('startup:status')
});
async function openAction(action,input){const result=await ipcRenderer.invoke('actions:call',action,input);if(!result?.ok)throw new Error(result?.error||'未能打开，请稍后重试。');return result.data;}
contextBridge.exposeInMainWorld('desktopActions',{
  openAitoearn:()=>openAction('open-aitoearn'),
  openProjectFolder:projectName=>openAction('open-project-folder',projectName),
  openAitoHistory:()=>openAction('open-aito-history')
});

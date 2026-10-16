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
  library:action=>ipcRenderer.invoke('startup:library',action),
  quit:()=>ipcRenderer.invoke('startup:quit'),
  status:()=>ipcRenderer.invoke('startup:status')
});
contextBridge.exposeInMainWorld('desktopAito',{
  call:async(action,input)=>{const result=await ipcRenderer.invoke('aito:call',action,input);if(!result.ok)throw new Error(result.error);return result.data;},
  subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('aito:state',listener);return()=>ipcRenderer.removeListener('aito:state',listener);}
});

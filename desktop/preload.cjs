const {contextBridge,ipcRenderer}=require('electron');
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
  status:()=>ipcRenderer.invoke('startup:status')
});
contextBridge.exposeInMainWorld('desktopAito',{
  call:async(action,input)=>{const result=await ipcRenderer.invoke('aito:call',action,input);if(!result.ok)throw new Error(result.error);return result.data;},
  subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('aito:state',listener);return()=>ipcRenderer.removeListener('aito:state',listener);}
});

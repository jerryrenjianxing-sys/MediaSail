const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('mediaSailUpdate',{
  call:async action=>{const result=await ipcRenderer.invoke('updates:call',action);if(!result.ok)throw new Error(result.error);return result.data;},
  subscribe:callback=>{const listener=(_event,state)=>callback(state);ipcRenderer.on('updates:state',listener);return()=>ipcRenderer.removeListener('updates:state',listener);}
});

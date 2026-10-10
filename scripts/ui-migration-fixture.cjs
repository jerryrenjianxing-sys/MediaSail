// Test-only Electron host. Never included in the packaged app.
const {app,BrowserWindow,session}=require('electron'),path=require('node:path');
const root=path.resolve(__dirname,'..'),data=path.resolve(process.env.MEDIASAIL_TEST_PROFILE||'');
if(!data.startsWith(path.join(root,'.test-data')+path.sep))throw Error('Only disposable repository profiles are allowed');
app.setPath('userData',data);
app.whenReady().then(()=>{global.fixture={app,BrowserWindow,session,root,data};new BrowserWindow({show:false,webPreferences:{sandbox:true}}).loadURL('about:blank');});
app.on('window-all-closed',()=>{});

const { WebContentsView, session, shell, net, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { WebsiteAdapter, AitoError, HOME, ORIGIN } = require('./adapter.cjs');
const { ImportStore, selectedFile, contained } = require('./imports.cjs');

function trustedUpload(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return false;
  return u.hostname === 'assets.aitoearn.cn' || /^[a-z0-9-]+\.oss(?:-[a-z0-9-]+)?\.aliyuncs\.com$/.test(u.hostname);
}
function streamUpload(file, meta, sign, signal, progress, sess) {
  if (!trustedUpload(sign.uploadUrl) || new URL(sign.url).origin !== 'https://assets.aitoearn.cn' || sign.uploadFields && Object.keys(sign.uploadFields).length) throw new AitoError('上传服务地址或上传方式变化，已停止并保留内容。');
  return new Promise((resolve, reject) => {
    const request = net.request({ method:'PUT', url:sign.uploadUrl, redirect:'error', session:sess, useSessionCookies:false });
    let stream, settled=false, sent=0;
    const timer=setTimeout(() => finish(new AitoError('上传超时，请检查网络后继续。')), 30*60*1000);
    const cancel=()=>finish(new AitoError('上传已暂停。', 'paused'));
    function finish(error) {
      if (settled) return; settled=true; clearTimeout(timer); signal.removeEventListener('abort',cancel);
      stream?.destroy(); if(error){request.abort();reject(error);}else resolve();
    }
    request.setHeader('Content-Type', meta.mime); request.setHeader('Content-Length', String(meta.size));
    request.on('error',()=>finish(new AitoError('素材上传连接中断，可稍后继续。')));
    request.on('response',response=>{
      response.on('error',()=>finish(new AitoError('无法确认上传结果。')));
      response.on('data',()=>{});
      response.on('end',()=>finish(response.statusCode>=200&&response.statusCode<300?null:new AitoError(`素材上传失败（${response.statusCode}）。`)));
    });
    signal.addEventListener('abort',cancel,{once:true}); if(signal.aborted){cancel();return;}
    stream=fs.createReadStream(file); stream.on('error',()=>finish(new AitoError('无法读取所选素材。')));
    stream.on('data',chunk=>{sent+=chunk.length;progress(Math.min(1,sent/meta.size));}); stream.pipe(request);
  });
}
class AitoController {
  constructor({ window, data, resources, localOrigin, outputs }) {
    this.window=window;this.data=data;this.resources=resources;this.localOrigin=localOrigin;this.outputs=outputs;
    this.view=null;this.requested=false;this.bounds=null;this.popups=new Set();this.coverTasks=new Set();this.closed=false;this.notificationTimer=null;
    this.web={loading:false,error:'',url:HOME};
    this.sess=session.fromPartition('persist:aitoearn-cn');
    this.sess.setPermissionRequestHandler((_wc,permission,callback)=>callback(permission==='clipboard-sanitized-write'));
    this.sess.setPermissionCheckHandler((_wc,permission)=>permission==='clipboard-sanitized-write');
    this.sess.on('will-download',(_event,item)=>{
      item.setSaveDialogOptions({title:'保存 AitoEarn 文件',defaultPath:item.getFilename()});
    });
    this.adapter=new WebsiteAdapter(()=>this.view?.webContents);
    try{this.store=new ImportStore({data,outputs,adapter:this.adapter,upload:(...args)=>streamUpload(...args,this.sess),onChange:()=>this.notify()});}
    catch(e){this.store=null;this.storeError=e.message;this.web.error=e.message;}
    this.completed=new Set(this.store?.state.jobs.filter(j=>j.status==='done').map(j=>j.id)||[]);this.pendingOpen=null;this.opening=false;
    this.register();
    window.on('resize',()=>this.layout());
    window.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMain)=>{if(isMain)this.hide();});
  }
  own(event) {
    try { const u=new URL(event.senderFrame.url);return event.sender===this.window.webContents && event.senderFrame===this.window.webContents.mainFrame && u.origin===this.localOrigin() && u.pathname==='/'; } catch{return false;}
  }
  register() {
    ipcMain.handle('aito:call',async(event,action,input)=>{
      if(!this.own(event))return {ok:false,error:'此页面无权调用桌面功能。'};
      try{return {ok:true,data:await this.call(action,input)};}catch(e){return {ok:false,error:e.message||'操作失败。',kind:e.kind||'failed'};}
    });
  }
  async call(action,input) {
    if(this.closed)throw new AitoError('程序正在退出或安装更新，请稍候。');
    if(!this.store&&action!=='status')throw new AitoError(this.storeError);
    switch(action){
      case 'status':return this.snapshot();
      case 'view': this.requested=Boolean(input?.visible);this.bounds=input?.bounds||this.bounds;if(this.requested)this.ensure();this.layout();this.openPending();return true;
      case 'home':this.ensure();void this.navigate(HOME);return true;
      case 'refresh':this.ensure();void this.navigate(this.view.webContents.getURL()||HOME);return true;
      case 'back':if(this.view?.webContents.navigationHistory.canGoBack())this.view.webContents.navigationHistory.goBack();return true;
      case 'external':{const url=new URL(this.view?.webContents.getURL()||HOME);for(const name of ['token','access_token','code','refresh_token'])url.searchParams.delete(name);await this.external(url.href);return true;}
      case 'connection':this.ensure();return this.store.connection();
      case 'group':return this.store.createGroup();
      case 'compose':return this.store.saveCompose(input);
      case 'send':return this.store.start(input);
      case 'retry':return this.store.retry(String(input?.id),input?.confirmedAbsent===true);
      case 'reconcile':return this.store.reconcile(String(input?.id));
      case 'openDraft':return this.openDraft(String(input?.id));
      case 'cover':return this.cover(String(input?.path));
      default:throw new AitoError('不支持的桌面操作。');
    }
  }
  snapshot(){return {...(this.store?.snapshot()||{compose:null,jobs:[],busy:false}),web:{...this.web},canGoBack:Boolean(this.view?.webContents.navigationHistory.canGoBack())};}
  busy(){return Boolean(this.store?.busy()||this.coverTasks.size);}
  notify(){
    if(this.notificationTimer||this.closed)return;
    this.notificationTimer=setTimeout(()=>{
      this.notificationTimer=null;
      for(const job of this.store?.state.jobs||[])if(job.status==='done'&&!this.completed.has(job.id)){this.completed.add(job.id);this.pendingOpen=job.id;}
      if(!this.window.isDestroyed())this.window.webContents.send('aito:state',this.snapshot());this.openPending();
    },120);
  }
  openPending(){if(!this.pendingOpen||!this.requested||this.opening||this.store?.busy())return;const id=this.pendingOpen;this.pendingOpen=null;this.opening=true;void this.openDraft(id).catch(()=>{const job=this.store?.state.jobs.find(j=>j.id===id);if(job)this.store.update(job,{message:'草稿已保存。页面暂时无法打开，可以稍后点击「打开草稿」。'});}).finally(()=>{this.opening=false;});}
  ensure(){
    if(this.view)return;
    this.view=new WebContentsView({webPreferences:{session:this.sess,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
    this.view.setBackgroundColor('#ffffff');this.window.contentView.addChildView(this.view);this.view.setVisible(false);
    const wc=this.view.webContents;
    wc.on('did-start-loading',()=>{this.web.loading=true;this.web.error='';this.notify();});
    wc.on('did-stop-loading',()=>{this.web.loading=false;this.layout();this.notify();});
    wc.on('did-navigate',(_e,url)=>{this.web.url=url.split('?')[0];this.notify();});
    wc.on('did-navigate-in-page',(_e,url)=>{this.web.url=url.split('?')[0];this.notify();});
    wc.on('did-fail-load',(_e,code,_description,_url,isMain)=>{if(isMain&&code!==-3){this.web.error='AitoEarn 页面暂时无法加载，请检查网络后重试。';this.web.loading=false;this.layout();this.notify();}});
    wc.on('render-process-gone',()=>{this.web.error='AI 发布页面已退出，请刷新恢复。';this.layout();this.notify();});
    wc.on('will-navigate',(event,url)=>{if(!this.siteURL(url)){event.preventDefault();void this.external(url);}});
    wc.on('will-redirect',(event,url)=>{if(!this.siteURL(url)){event.preventDefault();void this.external(url);}});
    wc.setWindowOpenHandler(({url})=>{
      try{if(new URL(url).protocol!=='https:')return {action:'deny'};}catch{return {action:'deny'};}
      return {action:'allow',overrideBrowserWindowOptions:{parent:this.window,width:1060,height:780,autoHideMenuBar:true,webPreferences:{session:this.sess,nodeIntegration:false,contextIsolation:true,sandbox:true}}};
    });
    wc.on('did-create-window',(popup)=>{
      this.popups.add(popup);popup.on('closed',()=>this.popups.delete(popup));
      popup.webContents.on('will-navigate',(event,url)=>{if(!/^https:\/\//i.test(url))event.preventDefault();});
      popup.webContents.on('will-redirect',(event,url)=>{if(!/^https:\/\//i.test(url))event.preventDefault();});
      popup.webContents.setWindowOpenHandler(({url})=>{void this.external(url);return {action:'deny'};});
    });
    void this.navigate(HOME);
  }
  siteURL(raw){try{return new URL(raw).origin===ORIGIN;}catch{return false;}}
  async external(url){try{if(new URL(url).protocol==='https:')await shell.openExternal(url);}catch{}}
  async navigate(url){
    if(!this.siteURL(url))throw new AitoError('只能在此视图打开 AitoEarn 中国站。');
    this.web.error='';this.web.loading=true;this.notify();
    try{await this.view.webContents.loadURL(url);}catch{this.web.error='AitoEarn 页面暂时无法加载，请重试。';this.web.loading=false;this.notify();}this.layout();
  }
  layout(){
    if(!this.view||this.window.isDestroyed())return;
    const b=this.bounds,[width,height]=this.window.getContentSize(),zoom=this.window.webContents.getZoomFactor();
    if(!this.requested||this.web.error||!b||![b.x,b.y,b.width,b.height].every(Number.isFinite)){this.view.setVisible(false);return;}
    const x=Math.max(0,Math.min(width,Math.round(b.x*zoom))),y=Math.max(0,Math.min(height,Math.round(b.y*zoom)));
    const w=Math.max(0,Math.min(width-x,Math.round(b.width*zoom))),h=Math.max(0,Math.min(height-y,Math.round(b.height*zoom)));
    this.view.setBounds({x,y,width:w,height:h});this.view.setVisible(w>0&&h>0);
  }
  hide(){this.requested=false;this.layout();}
  async openDraft(id){
    const job=this.store.state.jobs.find(j=>j.id===id);
    if(!job||job.status!=='done')throw new AitoError('草稿尚未保存成功。');
    await this.store.checkAccount(job);this.ensure();
    await this.navigate(`${ORIGIN}/zh-CN/draft-box?planId=${encodeURIComponent(job.content.groupId)}`);
    // Open the original card only when title AND media uniquely identify it. Never click a publish button.
    const selection={title:job.content.title,cover:job.payload?.coverUrl};
    await this.view.webContents.executeJavaScriptInIsolatedWorld(937,[{code:`(async()=>{const s=${JSON.stringify(selection)};for(let n=0;n<30;n++){const cards=[...document.querySelectorAll('[data-testid="draftbox-draft-card"]')].filter(c=>[...c.querySelectorAll('p')].some(p=>p.textContent===s.title)&&(!s.cover||[...c.querySelectorAll('img')].some(i=>i.src.split('?')[0]===s.cover.split('?')[0])));if(cards.length===1){cards[0].scrollIntoView({block:'center'});cards[0].click();return true;}await new Promise(r=>setTimeout(r,300));}return false;})()`}]).catch(()=>false);
    return true;
  }
  async cover(relative){
    if(this.store.busy())throw new AitoError('请等待发送完成。');
    const file=await selectedFile(this.outputs,relative);
    if(!file.mime.startsWith('video/'))throw new AitoError('请选择视频。');
    const source=fs.realpathSync(path.resolve(this.outputs,relative));
    const dest=path.join(path.dirname(source),`_aitoearn-cover-${file.hash.slice(0,16)}.jpg`);
    if(!contained(fs.realpathSync(this.outputs),dest))throw new AitoError('封面路径无效。');
    if(!fs.existsSync(dest))await new Promise((resolve,reject)=>{
      const child=spawn(path.join(this.resources,'runtime/ffmpeg/ffmpeg.exe'),['-hide_banner','-loglevel','error','-i',source,'-frames:v','1','-vf','scale=1280:-2','-y',dest],{windowsHide:true,stdio:'ignore'});
      this.coverTasks.add(child);
      const timer=setTimeout(()=>{child.kill();reject(new AitoError('提取封面超时，请选择一张图片作封面。'));},45000);
      child.on('error',()=>{this.coverTasks.delete(child);clearTimeout(timer);reject(new AitoError('封面生成失败，请手动选择图片。'));});
      child.on('exit',code=>{this.coverTasks.delete(child);clearTimeout(timer);code===0?resolve():reject(new AitoError('此视频暂时无法生成封面，请手动选择图片。'));});
    });
    return path.relative(this.outputs,dest).split(path.sep).join('/');
  }
  async shutdown(){this.closed=true;clearTimeout(this.notificationTimer);this.notificationTimer=null;for(const child of this.coverTasks)child.kill();await this.store?.shutdown();for(const p of this.popups)if(!p.isDestroyed())p.destroy();if(this.view){this.window.contentView.removeChildView(this.view);if(!this.view.webContents.isDestroyed())this.view.webContents.close();this.view=null;}}
  resume(){this.closed=false;if(this.store)this.store.stopping=false;this.requested=false;this.notify();}
}
module.exports={AitoController,trustedUpload,streamUpload};

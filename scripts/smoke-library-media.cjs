// Synthetic media only. Frozen packaged preview code and AitoEarn streaming code;
// upload transport is an offline writable fixture and cannot make network calls.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version;
const executable=path.resolve(process.env.EASEL_TEST_EXE||path.join(root,require('../package.json').build.directories.output,'win-unpacked/MediaSail.exe'));
const run=path.join(os.homedir(),'Documents','MediaSail 隔离验证','媒体预览 '+version+' '+Date.now());
const bootstrap=path.join(run,'定位'),libraryRoot=path.join(run,'中文 空格 资料库'),data=path.join(libraryRoot,'runtime');
const project='中文 空格 媒体项目',image='紫色 封面.png',video='紫色 短片.mp4';
const evidence=path.join(root,'docs/images',version),summary=path.join(root,'docs/evidence','library-media-'+version+'.json');
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
let app,page;
async function write(file,value){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');}
async function until(test,message){for(let i=0;i<100;i++){if(await test())return;await new Promise(resolve=>setTimeout(resolve,150));}throw Error(message);}
(async()=>{
  assert.ok(!executable.toLowerCase().startsWith('d:\\mediasail\\'));
  await fs.access(executable);await fs.mkdir(evidence,{recursive:true});
  const prepared=await require('../desktop/library.cjs').chooseLibrary({bootstrapRoot:bootstrap,targetRoot:libraryRoot,installDirectory:path.dirname(executable)});
  const directory=path.join(prepared.workspace,'outputs',project);await fs.mkdir(directory,{recursive:true});
  // FFmpeg is used only by this developer fixture, never bundled or required by MediaSail.
  for(const [name,tail]of [[image,['-frames:v','1']],[video,['-t','0.5','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart']]]){
    const result=cp.spawnSync(process.env.EASEL_TEST_FFMPEG||'ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=0x7552d9:s=160x96:r=10',...tail,path.join(directory,name)],{encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(result.status,0,result.stderr||result.error?.message);
  }
  // A valid ISO-BMFF free atom makes the stream span multiple 64 KiB chunks.
  const free=Buffer.alloc(1024*1024);free.writeUInt32BE(free.length,0);free.write('free',4,'ascii');await fs.appendFile(path.join(directory,video),free);
  await write(path.join(directory,'.easel.json'),{title:'合成媒体预览验收',kind:'video',status:'ready',deliverables:[image,video],cover:image});
  await write(path.join(data,'ui-state.json'),{schema:1,migration:{version:'0.3.3',sessions:0,copies:0,sources:[]},values:{easel_sessions:'[]',easel_theme:'light',easel_onboarding_seen:'1'}});
  const env={...process.env,EASEL_LIBRARY_BOOTSTRAP:bootstrap,LOCALAPPDATA:path.join(run,'宿主Local'),APPDATA:path.join(run,'宿主Roaming')};delete env.EASEL_DESKTOP_DATA;delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({executablePath:executable,args:[],env,timeout:60000});page=await app.firstWindow();
  await page.route('**/api/accounts/*/whoami*',route=>route.fulfill({json:{loggedIn:false,verificationStatus:'unknown',accountId:null,name:'',avatar:'',checkedAt:Math.floor(Date.now()/1000),errorCode:'OFFLINE_FIXTURE',message:'合成媒体验收不连接平台账号'}}));
  await page.route('**/api/trends*',route=>route.fulfill({json:{trends:[],updated:0}}));
  await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('.skill-home').waitFor();
  const info=JSON.parse(await fs.readFile(path.join(data,'agent-connection.json'),'utf8'));assert.equal(info.outputs,path.join(prepared.workspace,'outputs'));
  const media=[];
  for(const name of [image,video]){
    const relative=project+'/'+name,url=info.baseUrl+'/api/media/'+relative.split('/').map(encodeURIComponent).join('/');
    const response=await fetch(url);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer()),original=await fs.readFile(path.join(directory,name));assert.equal(hash(bytes),hash(original));
    media.push({relative,hash:hash(original),size:original.length});
  }
  await page.getByRole('button',{name:'控制台',exact:true}).click();await page.locator('.sidebar-nav').getByRole('button',{name:'内容库',exact:true}).click();
  await page.getByText('合成媒体预览验收',{exact:true}).click();await page.getByText(image,{exact:true}).click();
  const previewImage=page.locator('.drawer-body img');await until(()=>previewImage.evaluate(element=>element.complete&&element.naturalWidth===160),'Image preview must decode the library file');
  assert.ok((await previewImage.getAttribute('src')).includes('/api/media/'));await page.screenshot({path:path.join(evidence,'media-image-preview.png'),animations:'disabled'});await page.locator('.drawer-header .icon-btn').click();
  await page.getByText(video,{exact:true}).click();const previewVideo=page.locator('.drawer-body video');
  await until(()=>previewVideo.evaluate(element=>element.readyState>=1&&element.videoWidth===160&&Number.isFinite(element.duration)&&element.duration>0),'Video preview metadata must decode the library file');
  await page.screenshot({path:path.join(evidence,'media-video-preview.png'),animations:'disabled'});
  const streams=await app.evaluate(async({app},input)=>{
    const req=process.mainModule.require.bind(process.mainModule),path=req('node:path'),fs=req('node:fs'),crypto=req('node:crypto'),vm=req('node:vm'),{createRequire}=req('node:module'),{Writable}=req('node:stream'),{EventEmitter}=req('node:events');
    const filename=path.join(app.getAppPath(),'desktop/aitoearn/controller.cjs'),localRequire=createRequire(filename),{selectedFile}=localRequire('./imports.cjs');
    const reads=[],requests=[];
    const offlineNet={request:options=>{
      const record={url:options.url,bytes:0,chunks:0,headers:{},hash:null};requests.push(record);const hash=crypto.createHash('sha256');
      const sink=new Writable({write(chunk,_encoding,callback){record.bytes+=chunk.length;record.chunks++;hash.update(chunk);callback();}});
      sink.setHeader=(name,value)=>{record.headers[name]=value;};sink.abort=()=>sink.destroy();
      sink.on('finish',()=>{record.hash=hash.digest('hex');const response=new EventEmitter();response.statusCode=200;sink.emit('response',response);queueMicrotask(()=>response.emit('end'));});return sink;
    }};
    const realFs=new Proxy(fs,{get(target,key){return key==='createReadStream'?(file,...rest)=>{reads.push(file);return target.createReadStream(file,...rest);}:Reflect.get(target,key);}});
    const module={exports:{}};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,require:name=>name==='electron'?{...localRequire(name),net:offlineNet}:name==='node:fs'?realFs:localRequire(name),URL,Buffer,setTimeout,clearTimeout,queueMicrotask,console},{filename});
    const progress=[];
    for(const item of input.media){
      const selected=await selectedFile(input.outputs,item.relative),absolute=path.join(input.outputs,item.relative);if(selected.hash!==item.hash)throw Error('Selected library media hash mismatch');
      await module.exports.streamUpload(absolute,selected,{uploadUrl:'https://assets.aitoearn.cn/offline-fixture/'+encodeURIComponent(selected.name),url:'https://assets.aitoearn.cn/offline-fixture/'+encodeURIComponent(selected.name)},new AbortController().signal,value=>progress.push(value),null);
    }
    return {reads,requests,progress,source:filename};
  },{outputs:info.outputs,media});
  assert.equal(streams.reads.length,2);assert.equal(streams.requests.length,2);
  for(let index=0;index<media.length;index++){assert.equal(streams.reads[index],path.join(info.outputs,media[index].relative));assert.equal(streams.requests[index].hash,media[index].hash);assert.equal(streams.requests[index].bytes,media[index].size);assert.equal(streams.requests[index].headers['Content-Length'],String(media[index].size));}
  assert.ok(streams.requests[1].chunks>1);assert.equal(streams.progress.at(-1),1);
  const testedAppAsarSha256=hash(await fs.readFile(path.join(path.dirname(executable),'resources/app.asar')));
  await app.close();app=null;
  await write(summary,{schema:1,version,passed:true,testedAtUtc:new Date().toISOString(),testedAppAsarSha256,realPackagedApplication:true,syntheticMediaOnly:true,actualLibraryMediaApiHashesMatch:true,imagePreviewDecoded:true,videoPreviewMetadataDecoded:true,chineseAndSpacePaths:true,aitoSelectedMediaHashesMatch:true,aitoStreamReadPathsMatchLibrary:true,videoStreamChunks:streams.requests[1].chunks,streamLengthAndHashMatch:true,uploadTransport:'offline writable fixture around the frozen packaged streaming code',outboundUploads:0,realAccountUsed:false,publicationPerformed:false});
  console.log('LIBRARY MEDIA PASSED: '+summary);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(app)await app.close();});

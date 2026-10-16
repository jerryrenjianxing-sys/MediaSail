const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('startup selection, missing-drive retry and service retry show only applicable actions',async()=>{
 const elements=Object.fromEntries(['message','actions','selection-hint','loading-hint','retry','choose-library','updates','logs','quit'].map(name=>['#'+name,{hidden:false,disabled:false,textContent:'',onclick:null}]));
 const buttons=['retry','choose-library','updates','logs','quit'].map(name=>elements['#'+name]);let state={message:'Choose once',needsSelection:true,error:false,canRetry:false,busy:false};let selected,updates=0;
 const context={document:{querySelector:selector=>elements[selector],querySelectorAll:()=>buttons},window:{desktopStartup:{status:async()=>state,retry:()=>{},logs:()=>{},quit:()=>{},library:async action=>{selected=action;},checkUpdates:()=>{updates++;}}},setInterval:()=>{}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../desktop/startup.js'),'utf8'),context);await context.update();
 assert.equal(elements['#actions'].hidden,false);assert.equal(elements['#retry'].hidden,true);assert.equal(elements['#selection-hint'].hidden,false);assert.equal(elements['#choose-library'].textContent,'选择资料库');await elements['#choose-library'].onclick();assert.equal(selected,'choose');elements['#updates'].onclick();assert.equal(updates,1);
 state={...state,error:true,canRetry:true};await context.update();assert.equal(elements['#retry'].hidden,false);assert.equal(elements['#retry'].textContent,'重新检测');
 state={...state,needsSelection:false,busy:true};await context.update();assert.equal(elements['#retry'].textContent,'重试启动');assert.equal(elements['#choose-library'].textContent,'更换资料库');assert.ok(buttons.every(button=>button.disabled));
 const html=fs.readFileSync(path.join(__dirname,'../desktop/startup.html'),'utf8');assert.doesNotMatch(html,/返回原资料库|取消待迁移|迁移并重启/);assert.match(html,/新库需要重新配置画像和登录账号/);
 const main=fs.readFileSync(path.join(__dirname,'../desktop/main.cjs'),'utf8');assert.doesNotMatch(main,/migrateLegacyUpdateCache|queueLibraryChange|runPreparation|cancelPending|rollbackLocation/);
});

const {_electron:electron}=require('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),data=path.join(root,'.test-data/升级 验证 v020'),seed=process.argv.includes('--seed');
 if(!process.env.EASEL_TEST_EXE)throw new Error('Set the installed test executable explicitly');
 const env={...process.env,EASEL_DESKTOP_DATA:data};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({executablePath:process.env.EASEL_TEST_EXE,args:[],env});
 try{
  const page=await app.firstWindow();await page.waitForURL('http://127.0.0.1:*/',{timeout:180000});await page.locator('#root').waitFor();
  const welcome=page.getByRole('button',{name:'先用通用模式'});if(await welcome.isVisible())await welcome.click();
  const marker=path.join(data,'workspace/outputs/升级保留/成品.txt');
  if(seed){
   assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.1.0');
   fs.mkdirSync(path.dirname(marker),{recursive:true});fs.writeFileSync(marker,'覆盖升级必须保留的内容');
   fs.appendFileSync(path.join(data,'workspace/.env'),'\nELECTRONEASEL_UPGRADE_MARKER=keep-v010\n');
   await page.evaluate(()=>localStorage.setItem('desktop-upgrade-test','keep-v010'));
   await app.evaluate(async({session})=>{const s=session.fromPartition('persist:aitoearn-cn');await s.cookies.set({url:'https://aitoearn.cn',name:'desktop-upgrade-fixture',value:'keep-v010',expirationDate:Date.now()/1000+604800,secure:true});await s.cookies.flushStore();});
   console.log('INSTALLED 0.1.0 DATA AND BROWSER SESSION SEEDED');
  }else{
   assert.equal(await app.evaluate(({app})=>app.getVersion()),'0.2.0');
   assert.equal(fs.readFileSync(marker,'utf8'),'覆盖升级必须保留的内容');
   assert.match(fs.readFileSync(path.join(data,'workspace/.env'),'utf8'),/ELECTRONEASEL_UPGRADE_MARKER=keep-v010/);
   assert.equal(await page.evaluate(()=>localStorage.getItem('desktop-upgrade-test')),'keep-v010');
   assert.equal(await app.evaluate(async({session})=>(await session.fromPartition('persist:aitoearn-cn').cookies.get({name:'desktop-upgrade-fixture'}))[0]?.value),'keep-v010');
   await page.getByText('AI 发布',{exact:true}).first().waitFor();
   console.log('INSTALLED 0.1.0 TO 0.2.0 UPGRADE PRESERVES CONTENT, CONFIG AND SESSION');
  }
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

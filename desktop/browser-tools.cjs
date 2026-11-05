const fs=require('node:fs'),path=require('node:path');
// Describing optional assets never prepares them or starts a browser/daemon.
function describeBrowserTools(resources,skillDir){
 const manifest=path.join(resources,'browser-tools','manifest.json');
 if(!fs.existsSync(manifest))return null;
 try{
  const value=JSON.parse(fs.readFileSync(manifest,'utf8'));
  if(value.schema!==1||value.product!=='MediaSailBrowser'||!(/^[a-f0-9]{64}$/).test(value.bundleId))throw Error('Unsupported browser asset manifest');
  return {entry:path.join(skillDir,'scripts/browser.ps1'),manifest,version:value.bsk.version,browserVersion:value.browser.version,docs:path.join(skillDir,'references/browser-collaboration.md')};
 }catch(error){return {entry:path.join(skillDir,'scripts/browser.ps1'),manifest,error:error.message,docs:path.join(skillDir,'references/browser-collaboration.md')};}
}
module.exports={describeBrowserTools};

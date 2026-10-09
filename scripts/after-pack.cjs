const fs=require('node:fs/promises'),path=require('node:path');
const {getAppUpdatePublishConfiguration}=require('app-builder-lib/out/publish/PublishManager');
const {serializeToYaml}=require('builder-util');
// `--win dir` does not generate this automatically. Our installer is built from
// that verified directory, so generate it with builder's same configuration logic.
module.exports=async context=>{
  if(context.electronPlatformName!=='win32')return;
  const config=await getAppUpdatePublishConfiguration(context.packager,null,context.arch,false);
  if(config?.provider!=='github'||config.owner!=='jerryrenjianxing-sys'||config.repo!=='MediaSail')throw new Error('Unexpected update feed');
  await fs.writeFile(path.join(context.appOutDir,'resources/app-update.yml'),serializeToYaml(config));
};

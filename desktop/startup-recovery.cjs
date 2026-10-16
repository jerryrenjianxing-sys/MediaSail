const fs=require('node:fs');
const path=require('node:path');

// A startup error can replace the renderer while owned business tasks continue.
// Only a positively verified idle service permits changing its library.
async function assertStartupLibraryIdle({supervisor,options,baseUrl,state}){
  if(!supervisor||!options||!baseUrl)return;
  let status;
  try{status=await state(baseUrl,options.env?.EASEL_DESKTOP_TOKEN);}
  catch{throw Error('暂时无法确认后台任务状态，请先重试启动或等待任务结束，再更换资料库。');}
  if(status?.active!==0)throw Error('还有采集、登录或发布任务，或暂时无法确认任务状态，请等待任务结束再更换资料库。');
}

// Logging must never replace the useful startup error with another exception.
function appendStartupLog({data,bootstrapRoot,message}){
  const directories=new Set([path.join(data,'logs'),path.join(bootstrapRoot,'selection-ui','logs')]);
  for(const directory of directories){
    try{
      fs.mkdirSync(directory,{recursive:true});
      fs.appendFileSync(path.join(directory,'desktop.log'),new Date().toISOString()+' '+message+'\n');
      return directory;
    }catch{/* Keep the startup message and allow another selection even if neither log is writable. */}
  }
  return null;
}
module.exports={assertStartupLibraryIdle,appendStartupLog};

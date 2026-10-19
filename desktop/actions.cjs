const fs=require('node:fs/promises');
const path=require('node:path');
const {trustedStateSender}=require('./ui-state.cjs');

const AITO_URL='https://aitoearn.cn/zh-CN';

async function ordinaryDirectory(directory,message){
  try{
    const stat=await fs.lstat(directory);
    if(!stat.isDirectory()||stat.isSymbolicLink())throw Error(message);
  }catch(error){
    if(error.code==='ENOENT'||error.code==='ENOTDIR')throw Error(message);
    throw error;
  }
}

async function projectDirectory(outputs,name){
  if(typeof name!=='string'||!name||name.length>255||name.endsWith(' ')||name.endsWith('.')||
    /[<>:"/\\|?*\x00-\x1f]/.test(name)||name.startsWith('.')||name.startsWith('_')||
    ['analytics','wechat'].includes(name.toLowerCase()))throw Error('请选择内容库中的单个普通项目文件夹。');
  if(typeof outputs!=='string'||!path.isAbsolute(outputs))throw Error('当前资料库尚未连接，请稍后重试。');
  await ordinaryDirectory(outputs,'当前内容库目录不可用，未打开其他位置。');
  const root=await fs.realpath(outputs),candidate=path.join(root,name);
  await ordinaryDirectory(candidate,'项目已不存在或不是普通文件夹，请刷新内容库。');
  const resolved=await fs.realpath(candidate),relative=path.relative(root,resolved);
  if(!relative||path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)||path.dirname(relative)!=='.')throw Error('项目必须位于当前内容库的一级文件夹内。');
  return resolved;
}

async function aitoHistoryDirectory(data){
  if(typeof data!=='string'||!path.isAbsolute(data))throw Error('当前资料库尚未连接，请稍后重试。');
  await ordinaryDirectory(data,'当前资料库运行目录不可用。');
  const root=await fs.realpath(data),candidate=path.join(root,'aitoearn');
  await ordinaryDirectory(candidate,'当前资料库没有可打开的旧 AI 发布记录目录；未创建新目录。');
  const resolved=await fs.realpath(candidate);
  if(path.relative(candidate,resolved)!=='')throw Error('旧 AI 发布记录必须位于当前资料库的普通文件夹内。');
  return resolved;
}

// The bridge accepts only a fixed website or a top-level project name. It never
// reads history contents, creates folders, or accepts a URL or absolute path.
function createActionsHandler({shell,main,localOrigin,outputs,data,available=()=>true}){
  return async(event,action,input)=>{
    if(!trustedStateSender(event,main(),localOrigin()))return {ok:false,error:'此页面不能调用桌面打开功能。'};
    try{
      if(!available())throw Error('软件正在切换资料库或退出，请稍后重试。');
      if(action==='open-aitoearn'){
        if(input!==undefined)throw Error('打开 AI 发布不接受网址或其他参数。');
        try{await shell.openExternal(AITO_URL);}catch(error){throw Error('无法调用默认浏览器，请检查系统默认浏览器设置后重试。'+(error.message||''));}
        return {ok:true,data:true};
      }
      let directory;
      if(action==='open-project-folder')directory=await projectDirectory(outputs(),input);
      else if(action==='open-aito-history'){
        if(input!==undefined)throw Error('打开旧 AI 发布记录不接受路径或其他参数。');
        directory=await aitoHistoryDirectory(data());
      }else throw Error('不支持的桌面打开操作。');
      try{const error=await shell.openPath(directory);if(error)throw Error(error);}
      catch(error){throw Error('无法在文件管理器中打开文件夹，请检查目录权限或系统设置。'+(error.message||''));}
      return {ok:true,data:true};
    }catch(error){
      const message=['EACCES','EPERM'].includes(error.code)?'无法读取文件夹位置，请检查目录权限。':error.message;
      return {ok:false,error:message||'未能打开，请稍后重试。'};
    }
  };
}

module.exports={AITO_URL,projectDirectory,aitoHistoryDirectory,createActionsHandler};

const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function archiveHistory(data,snapshot){
  const directory=path.join(data,'history-archive','0.5.0'),marker=path.join(directory,'manifest.json');
  try{if(JSON.parse(await fs.readFile(marker,'utf8')).complete)return directory;}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
  await fs.mkdir(directory,{recursive:true});const files={};
  async function save(name,bytes){const dest=path.join(directory,name);await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest+'.tmp',bytes);await fs.rename(dest+'.tmp',dest);files[name]=hash(bytes);}
  await save('ui-state.json',Buffer.from(JSON.stringify(snapshot,null,2)));
  const agents=path.join(data,'home','.openclaw-easel','agents');
  async function copy(dir,prefix){
    for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(entry.isSymbolicLink())continue;const source=path.join(dir,entry.name),relative=prefix+'/'+entry.name;
      if(entry.isDirectory())await copy(source,relative);else if(entry.isFile()&&/\.(json|jsonl|md|txt)$/i.test(entry.name))await save(relative,await fs.readFile(source));}
  }
  try{for(const entry of await fs.readdir(agents,{withFileTypes:true})){if(!entry.isDirectory()||entry.isSymbolicLink())continue;const sessions=path.join(agents,entry.name,'sessions');try{await copy(sessions,'sessions/'+entry.name);}catch(e){if(e.code!=='ENOENT')throw e;}}}catch(e){if(e.code!=='ENOENT')throw e;}
  await save('README.txt',Buffer.from('MediaSail 0.5.0 历史存档\nui-state.json 保存升级前界面会话。sessions 保存可找到的旧后台会话。\n原始记录仍保留在原用户数据目录；本版本不再自动续聊或恢复执行。\n账号、素材和密钥不属于此存档的迁移范围。\n','utf8'));
  const bytes=JSON.stringify({schema:1,version:'0.5.0',complete:true,createdAt:new Date().toISOString(),files},null,2);await fs.writeFile(marker+'.tmp',bytes);await fs.rename(marker+'.tmp',marker);return directory;
}
module.exports={archiveHistory};

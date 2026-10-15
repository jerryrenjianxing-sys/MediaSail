const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),vendor=path.join(root,'vendor/easel'),patches=path.join(root,'patches');
const untracked=cp.execFileSync('git',['ls-files','--others','--exclude-standard','-z'],{cwd:vendor,encoding:'utf8'}).split('\0').filter(Boolean);
if(untracked.length)cp.execFileSync('git',['add','--intent-to-add','--',...untracked],{cwd:vendor});
const bytes=cp.execFileSync('git',['diff','--binary','HEAD','--'],{cwd:vendor,maxBuffer:30*1024*1024});
const file=path.join(patches,'easel-desktop.patch');fs.writeFileSync(file,bytes);
cp.execFileSync('git',['apply','--reverse','--check',file],{cwd:vendor});
for(const old of ['easel-ai-publish.patch','easel-branding.patch','easel-openclaw-model-name.patch']){const target=path.join(patches,old);if(fs.existsSync(target))fs.unlinkSync(target);}
console.log('Unified pinned-upstream patch verified.');

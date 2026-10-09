const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
// Preserve Git's exact UTF-8/LF patch bytes, including added frontend files.
const bytes=cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'diff','--binary','--','web/frontend']);
fs.writeFileSync(path.join(root,'patches/easel-ai-publish.patch'),bytes);
cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'apply','--reverse','--check',path.join(root,'patches/easel-ai-publish.patch')]);
console.log('Frontend patch verified against working source');

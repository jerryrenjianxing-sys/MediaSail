const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
// Preserve Git's exact UTF-8/LF patch bytes, including added frontend files.
const bytes=cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'diff','--binary','--','web/frontend']);
fs.writeFileSync(path.join(root,'patches/easel-ai-publish.patch'),bytes);
cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'apply','--reverse','--check',path.join(root,'patches/easel-ai-publish.patch')]);
console.log('Frontend patch verified against working source');
const branding=cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'diff','--binary','--','web/static/*.html','openclaw/workspace/AGENTS.md','openclaw/workspace/SOUL.md']);
const brandPatch=path.join(root,'patches/easel-branding.patch');
fs.writeFileSync(brandPatch,branding);
cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'apply','--reverse','--check',brandPatch]);
console.log('Static-page and agent-default branding patch verified');
// Normalize this legacy patch to Git's exact LF bytes as well, so clean LF checkouts reproduce it.
const modelPatch=path.join(root,'patches/easel-openclaw-model-name.patch');
fs.writeFileSync(modelPatch,cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'diff','--binary','--','web/app.py']));
cp.execFileSync('git',['-C',path.join(root,'vendor/easel'),'apply','--reverse','--check',modelPatch]);

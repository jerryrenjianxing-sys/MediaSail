const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const { digest } = require('../desktop/workspace.cjs');
require('./inventory-desktop.cjs');
const root = path.resolve(__dirname, '..'), source = path.join(root, 'vendor/easel');
const lock = require('../runtime-lock.json');
const hasGit=fs.existsSync(path.join(source,'.git'));
const snapshot=hasGit?null:JSON.parse(fs.readFileSync(path.join(root,'upstream-files.json'),'utf8'));
const ref = hasGit ? cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim() : snapshot.upstream;
if (ref !== lock.easel) throw new Error('Unexpected Easel revision');
if (!fs.existsSync(path.join(source, 'web/frontend/dist/index.html'))) throw new Error('Build the original frontend first');
const payload = path.join(root, 'build/payload');
fs.mkdirSync(payload, { recursive: true });
const names = hasGit ? cp.execFileSync('git', ['ls-files', '-z'], { cwd: source, encoding: 'utf8', maxBuffer: 10e6 }).split('\0').filter(Boolean) : Object.keys(snapshot.files).filter(x=>!x.startsWith('web/frontend/dist/'));
function walk(dir, prefix) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) {const name=prefix+'/'+e.name; if(e.isDirectory()) walk(path.join(dir,e.name),name); else names.push(name);} }
walk(path.join(source, 'web/frontend/dist'), 'web/frontend/dist');
walk(path.join(source, 'web/frontend/src'), 'web/frontend/src');
const manifest = { version: require('../package.json').version + '-' + lock.easel.slice(0,7), upstream: lock.easel, files: {} };
for (const name of new Set(names)) {
  if (path.basename(name) === '.gitkeep') continue;
  const bytes = fs.readFileSync(path.join(source,name));
  const dest=path.join(payload,'easel',name);
  fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,bytes);
  manifest.files[name]=digest(bytes);
}
fs.writeFileSync(path.join(payload,'manifest.json'),JSON.stringify(manifest,null,2));
// Remove stale generated payload files (never the writable user workspace).
const stagedRoot=path.resolve(payload,'easel');
if(!stagedRoot.startsWith(path.resolve(root,'build')+path.sep))throw new Error('Invalid staging cleanup root');
function prune(dir,prefix=''){
  for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const relative=prefix?prefix+'/'+e.name:e.name,absolute=path.join(dir,e.name);
    if(e.isDirectory())prune(absolute,relative);
    else if(!manifest.files[relative])fs.unlinkSync(absolute);
  }
}
prune(stagedRoot);
fs.mkdirSync(path.join(root,'licenses'),{recursive:true});
fs.copyFileSync(path.join(source,'LICENSE'),path.join(root,'licenses/Easel-APACHE-2.0.txt'));
fs.copyFileSync(path.join(root,'requirements.lock'),path.join(root,'licenses/requirements.lock'));
fs.copyFileSync(path.join(root,'node_modules/electron/dist/LICENSE'),path.join(root,'licenses/Electron-LICENSE.txt'));
fs.copyFileSync(path.join(root,'node_modules/electron/dist/LICENSES.chromium.html'),path.join(root,'licenses/Chromium-NOTICES.html'));
console.log(`Staged ${Object.keys(manifest.files).length} Easel files with desktop AI publishing additions.`);

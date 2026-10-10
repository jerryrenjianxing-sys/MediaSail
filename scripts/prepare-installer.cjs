// Deliberate, hash-checked patch of the pinned builder template. npm ci resets it;
// every installer build reapplies it. Never silently patch an unknown version.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'node_modules/app-builder-lib/templates/nsis/include/extractAppPackage.nsh');
const original='e4174388a0f7a1df0b85a0742aa1ea7a4b2b18f9f29dccd6ef10a66212f68148';
const marker='!include "'+path.join(root,'scripts/installer-extract.nsh')+'"';
const bytes=fs.readFileSync(file),text=bytes.toString('utf8');
if(text.endsWith(marker+'\n')){console.log('Pinned installer copy patch already applied');process.exit(0);}
if(require('app-builder-lib/package.json').version!=='26.15.3'||crypto.createHash('sha256').update(bytes).digest('hex')!==original)throw Error('Unknown NSIS template; review before patching');
const start=text.indexOf('!macro extractUsing7za FILE');if(start<0)throw Error('Missing extraction macro');
fs.writeFileSync(file,text.slice(0,start)+marker+'\n');
console.log('Applied checked long-path installer copy patch');

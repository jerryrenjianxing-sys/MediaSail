// Hash-checked patches for the pinned builder; npm ci resets both templates.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
if(require('app-builder-lib/package.json').version!=='26.15.3')throw Error('Unknown builder version');
function patch(name,original,marker,change){
 const file=path.join(root,'node_modules/app-builder-lib/templates/nsis/include',name),bytes=fs.readFileSync(file),text=bytes.toString('utf8');
 if(text.endsWith(marker+'\n'))return;
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==original)throw Error('Unknown NSIS template: '+name);
 fs.writeFileSync(file,change(text)+marker+'\n');
}
const include='!include "'+path.join(root,'scripts/installer-extract.nsh')+'"';
patch('extractAppPackage.nsh','e4174388a0f7a1df0b85a0742aa1ea7a4b2b18f9f29dccd6ef10a66212f68148',include,text=>{const start=text.indexOf('!macro extractUsing7za FILE');if(start<0)throw Error('Missing extraction macro');return text.slice(0,start);});
patch('installUtil.nsh','97bd546b5cd2aaf16b77bc9e2be8a18962dd74ab5c4d23b35b163ca89bf4dd2a','; MediaSail legacy-temp compatibility',text=>{let count=0;const changed=text.replace(/ExecWait ('[^\r\n]+') \$R0/g,(_,command)=>{count++;return '!insertmacro mediaSailLegacyExec '+command;});if(count!==2)throw Error('Unexpected old-uninstaller calls');return changed;});
console.log('Pinned installer copy and legacy temporary-path patches applied');

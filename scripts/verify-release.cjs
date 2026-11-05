const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const yaml=require('js-yaml'),pkg=require('../package.json');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,pkg.build.directories.output);
async function digest(file,type,format='hex'){const hash=crypto.createHash(type);for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest(format);}
(async()=>{
 const info=yaml.load(fs.readFileSync(path.join(out,'latest.yml'),'utf8'));
 if(info.version!==pkg.version)throw new Error('Release version mismatch');
 const installer=`MediaSail-${pkg.version}-win-x64-Setup.exe`;
 if(info.path!==installer||info.files?.length!==1||info.files[0].url!==installer)throw new Error('Unexpected update artifact');
 const bytes=fs.statSync(path.join(out,installer)).size;
 if(bytes>=2*1024**3)throw new Error('Installer exceeds GitHub release asset size limit');
 if(info.files[0].size!==bytes||await digest(path.join(out,installer),'sha512','base64')!==info.files[0].sha512||info.sha512!==info.files[0].sha512)throw new Error('Update installer SHA-512 mismatch');
 const files=[installer,installer+'.blockmap','latest.yml',`MediaSail-${pkg.version}-source.zip`];
 const hashes=new Map();
 if(pkg.build.extraResources.some(resource=>resource.to==='browser-tools')){
  const lock=require('../browser-tools.lock.json');
  const sources=JSON.parse(fs.readFileSync(path.join(out,'browser-source-kit.json'),'utf8'));
  const parts=JSON.parse(fs.readFileSync(path.join(out,'chromium-source-parts.json'),'utf8'));
  if(sources.version!==pkg.version||sources.asset!==`MediaSail-${pkg.version}-browser-sources.zip`||sources.sourcePreparation!=='source-preparation-review-passed')throw Error('Browser source-kit metadata mismatch');
  if(parts.sha256!==lock.browser.sourceSha256||parts.parts.length!==3||parts.parts.reduce((total,part)=>total+part.bytes,0)!==parts.bytes)throw Error('Chromium corresponding-source manifest mismatch');
  for(const asset of [{file:sources.asset,bytes:sources.bytes,sha256:sources.sha256},...parts.parts]){
   if(path.basename(asset.file)!==asset.file||!/^[-.\w]+$/.test(asset.file))throw Error('Unsafe browser source asset name');
   const file=path.join(out,asset.file),sha256=await digest(file,'sha256');
   if(fs.statSync(file).size!==asset.bytes||sha256!==asset.sha256)throw Error('Browser corresponding-source asset mismatch: '+asset.file);
   if(asset.bytes>=2*1024**3)throw Error('Browser source asset exceeds release size limit');
   hashes.set(asset.file,sha256);files.push(asset.file);
  }
  files.push('browser-source-kit.json','chromium-source-parts.json');
 }
 const checks=[];for(const name of files)checks.push(`${hashes.get(name)||await digest(path.join(out,name),'sha256')}  ${name}`);
 fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),checks.join('\n')+'\n');
 console.log('Release validated: version, asset paths, installer SHA-512 and corresponding-source hashes. SHA256SUMS.txt written for '+files.length+' assets.');
})().catch(e=>{console.error(e);process.exitCode=1;});

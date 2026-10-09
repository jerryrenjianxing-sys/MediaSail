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
 const checks=[];for(const name of files)checks.push(`${await digest(path.join(out,name),'sha256')}  ${name}`);
 fs.writeFileSync(path.join(out,'SHA256SUMS.txt'),checks.join('\n')+'\n');
 console.log('Release validated: version, asset paths, sizes and SHA-512. SHA256SUMS.txt written.');
})().catch(e=>{console.error(e);process.exitCode=1;});

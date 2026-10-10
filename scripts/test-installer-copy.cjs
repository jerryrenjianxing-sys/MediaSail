// Isolated NSIS regression; no registry, installed application or user-data writes.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.test-data');
const compiler=process.env.EASEL_TEST_NSIS;if(!compiler)throw Error('EASEL_TEST_NSIS is required');
fs.mkdirSync(base,{recursive:true});const dir=fs.mkdtempSync(path.join(base,'copy 中文 '));
const source=path.join(dir,'source'),dest=path.join(dir,'destination'),log=path.join(dir,'logs');
const relative=path.join('目录'.repeat(40),'nested-'.repeat(13),'result.txt');
const file=path.join(source,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'中文长路径内容');
assert.ok(path.dirname(file).length>248);
const result=path.join(dir,'original-result.txt');
function build(name,body){const script=String.raw`Unicode true
!include "LogicLib.nsh"
${process.env.EASEL_TEST_NSIS_PLUGINS?'!addplugindir /x86-unicode "'+process.env.EASEL_TEST_NSIS_PLUGINS+'"':''}
!define VERSION "copy-test"
!define MEDIA_SAIL_INSTALL_LOG_DIR "${log}"
!include "${path.join(root,'scripts/installer-extract.nsh')}"
Name "MediaSail disposable copy test"
OutFile "${path.join(dir,name+'.exe')}"
RequestExecutionLevel user
SilentInstall silent
Section
${body}
SectionEnd
`;const file=path.join(dir,name+'.nsi');fs.writeFileSync(file,'\ufeff'+script);cp.execFileSync(compiler,['-V2',file],{windowsHide:true,stdio:'inherit'});return path.join(dir,name+'.exe');}
const old=build('original',String.raw`CreateDirectory "${dest}"
ClearErrors
CopyFiles /SILENT "${source}\*" "${dest}"
IfErrors failed
StrCpy $0 "success"
Goto done
failed:
StrCpy $0 "copy-error"
done:
FileOpen $1 "${result}" w
FileWrite $1 $0
FileClose $1
SetErrorLevel 0`);
cp.execFileSync(old,['/S'],{windowsHide:true,timeout:30000});
assert.equal(fs.readFileSync(result,'utf8'),'copy-error','Fixture must reproduce the stock Shell copy failure');
const fixed=build('fixed',String.raw`!insertmacro mediaSailCopyExtracted "${source}" "${dest}"
SetErrorLevel 0`);
cp.execFileSync(fixed,['/S'],{windowsHide:true,timeout:30000});
assert.equal(fs.readFileSync(path.join(dest,relative),'utf8'),'中文长路径内容');
assert.match(fs.readFileSync(path.join(log,'installer-copy-test.ini'),'utf8'),/files-copied/);
if(process.env.EASEL_TEST_7ZA&&process.env.EASEL_TEST_NSIS_PLUGINS){
 const archive=path.join(dir,'fixture.7z');cp.execFileSync(process.env.EASEL_TEST_7ZA,['a','-t7z',archive,'.'],{cwd:source,windowsHide:true,stdio:'ignore'});
 const extracted=path.join(dir,'extracted');const ex=build('extraction',String.raw`SetOutPath "${extracted}"
!insertmacro extractUsing7za "${archive}"
SetErrorLevel 0`);cp.execFileSync(ex,['/S'],{windowsHide:true,timeout:30000});assert.equal(fs.readFileSync(path.join(extracted,relative),'utf8'),'中文长路径内容');
}
const fail=build('failed',String.raw`!insertmacro mediaSailCopyExtracted "${dir}\missing-source" "${dest}"
FileOpen $0 "${dir}\incorrect-success.txt" w
FileClose $0`);
const failed=cp.spawnSync(fail,['/S'],{windowsHide:true,timeout:30000});assert.ifError(failed.error);assert.equal(failed.status,2);assert.equal(fs.existsSync(path.join(dir,'incorrect-success.txt')),false);
assert.match(fs.readFileSync(path.join(log,'installer-copy-test.ini'),'utf8'),/copy-failed/);
console.log(JSON.stringify({passed:true,stockCopy:'fails on deep Unicode directory',fixedCopy:'contents verified',failedCopy:'exit 2, retained log, no success',fixture:dir}));

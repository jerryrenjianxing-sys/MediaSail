// Reproduce a legacy child uninstaller's normal-TEMP failure, then run the real
// compatibility macro and verify data, child exit code and environment restoration.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.test-data'),dir=fs.mkdtempSync(path.join(base,'legacy 临时目录 '));
const compiler=process.env.EASEL_TEST_NSIS,plugins=process.env.EASEL_TEST_NSIS_PLUGINS;if(!compiler||!plugins)throw Error('Set NSIS compiler and x86 Unicode plugin directory');
const temp=path.join(dir,'temporary'),source=path.join(dir,'source.txt');fs.mkdirSync(temp);fs.writeFileSync(source,'fixture contents');
const rel=path.join('nested-'.repeat(15),'nested-'.repeat(8),'result.txt'),destination='$PLUGINSDIR'+String.fromCharCode(92)+'old-install'+String.fromCharCode(92)+rel;
const parentDestination=path.win32.dirname(destination),extendedSource=String.fromCharCode(92,92,63,92)+source;
const env={...process.env,TEMP:temp,TMP:temp};
function build(name,body,extra=''){const exe=path.join(dir,name+'.exe'),nsi=path.join(dir,name+'.nsi');fs.writeFileSync(nsi,'\ufeff'+String.raw`Unicode true
!include "LogicLib.nsh"
!addplugindir /x86-unicode "${plugins}"
${extra}
OutFile "${exe}"
RequestExecutionLevel user
SilentInstall silent
Section
${body}
SectionEnd`);cp.execFileSync(compiler,['-V2',nsi],{windowsHide:true});return exe;}
const child=build('old child',String.raw`InitPluginsDir
CreateDirectory "${parentDestination}"
ClearErrors
Rename "${extendedSource}" "${destination}"
IfErrors failed
FileOpen $0 "${destination}" r
FileRead $0 $1
FileClose $0
StrCmp $1 "fixture contents" success failed
success:
FileOpen $0 "${path.join(dir,'child-success.txt')}" w
FileWrite $0 "$PLUGINSDIR"
FileClose $0
SetErrorLevel 17
Quit
failed:
SetErrorLevel 2`);
assert.equal(cp.spawnSync(child,['/S'],{env,windowsHide:true,timeout:30000}).status,2);
assert.equal(fs.existsSync(source),true);
const parent=build('parent',String.raw`!insertmacro mediaSailLegacyExec '"${child}" /S'
IfErrors failed
StrCmp $R0 17 0 failed
ReadEnvStr $0 "TEMP"
StrCmp $0 "${temp}" 0 failed
ReadEnvStr $0 "TMP"
StrCmp $0 "${temp}" 0 failed
!insertmacro mediaSailLegacyExec '"${path.join(dir,'not-present.exe')}" /S'
IfErrors 0 failed
ReadEnvStr $0 "TEMP"
StrCmp $0 "${temp}" 0 failed
ReadEnvStr $0 "TMP"
StrCmp $0 "${temp}" 0 failed
SetErrorLevel 0
Quit
failed:
SetErrorLevel 9`, '!include "'+path.join(root,'scripts/installer-legacy-temp.nsh')+'"');
cp.execFileSync(parent,['/S'],{env,windowsHide:true,timeout:30000});assert.ok(fs.readFileSync(path.join(dir,'child-success.txt'),'utf8').startsWith(String.fromCharCode(92,92,63,92)));
console.log(JSON.stringify({passed:true,ordinaryTemp:'legacy rename fails',compatibility:'child copied exact contents; exit 17 preserved',restoration:'TEMP/TMP restored after success and launch failure',fixture:dir}));

// Real, disposable NSIS fixture. Compile-time consent root prevents user-data writes.
'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),compiler=process.env.EASEL_TEST_NSIS;
if(!compiler)throw Error('EASEL_TEST_NSIS is required');
const base=path.join(root,'.test-data');fs.mkdirSync(base,{recursive:true});
const run=fs.mkdtempSync(path.join(base,'组件许可 ')),data=path.join(run,'隔离记录'),installed=path.join(run,'installed.txt');
const license=path.join(root,'licenses/browser-tools/Microsoft-Windows-SDK-10.0.28000-LICENSE.rtf');
const hash=crypto.createHash('sha256').update(fs.readFileSync(license)).digest('hex');
function compile(name,guard){
 const script=`Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!define VERSION "component-test"
!define BUILD_RESOURCES_DIR "${path.join(root,'desktop/assets')}"
!define MEDIASAIL_COMPONENT_CONSENT_ROOT "${data}"
!include "${path.join(root,'scripts/installer-component-license.nsh')}"
Name "MediaSail isolated component fixture"
OutFile "${path.join(run,name+'.exe')}"
RequestExecutionLevel user
Function .onInit
${guard?'!insertmacro MediaSailComponentConsentInit':''}
FunctionEnd
${guard?'!insertmacro MediaSailComponentLicensePage':''}
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"
Section
FileOpen $0 "${installed}" w
FileWrite $0 "installed"
FileClose $0
SectionEnd
`;
 const file=path.join(run,name+'.nsi');fs.writeFileSync(file,'\ufeff'+script);
 cp.execFileSync(compiler,['-V2',file],{windowsHide:true,stdio:'pipe'});return path.join(run,name+'.exe');
}
const call=(exe,args)=>{const r=cp.spawnSync(exe,args,{windowsHide:true,timeout:30000});assert.ifError(r.error);return r.status;};
const before=compile('before',false);assert.equal(call(before,['/S']),0);assert.equal(fs.existsSync(installed),true);fs.unlinkSync(installed);
const fixed=compile('fixed',true);
if(process.argv.includes('--visible')){
 const child=cp.spawn(fixed,[],{windowsHide:false,stdio:'ignore'});
 fs.writeFileSync(path.join(run,'visible.json'),JSON.stringify({pid:child.pid,exe:fixed,run,installed}));
 console.log(JSON.stringify({visible:true,pid:child.pid,run}));
 child.on('exit',code=>{assert.equal(fs.existsSync(installed),false,'Cancel must not reach installation');fs.writeFileSync(path.join(run,'cancel-result.json'),JSON.stringify({canceled:true,exit:code,installed:false}));});
 return;
}
assert.equal(call(fixed,['/S']),3);assert.equal(fs.existsSync(installed),false);
assert.equal(call(fixed,['/S','/ACCEPT_MS_D3D_LICENSE=wrong']),3);assert.equal(fs.existsSync(installed),false);
assert.equal(call(fixed,['/S','/ACCEPT_MS_D3D_LICENSE='+hash]),0);assert.equal(fs.readFileSync(installed,'utf8'),'installed');
assert.match(fs.readFileSync(path.join(data,'component-consent.ini'),'utf8'),new RegExp(hash));
assert.equal(call(fixed,['/S']),0);
const result={passed:true,baselineSilentInstalledWithoutConsent:true,missingOrWrongConsent:'exit 3 before install',versionedConsent:'accepted',identicalTermsReused:true,run};
fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));

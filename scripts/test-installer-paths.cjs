const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),testRoot=path.join(root,'.test-data');
fs.mkdirSync(testRoot,{recursive:true});
const fixture=fs.mkdtempSync(path.join(testRoot,'NSIS 中文长路径 ')),appDir=path.join(fixture,'application');
const relative='resources/'+('dependency-'.repeat(8))+'/'+('declaration-'.repeat(8))+'.js.map';
const longFile=path.join(appDir,relative);assert.ok(longFile.length>260);
fs.mkdirSync(path.dirname(longFile),{recursive:true});fs.writeFileSync(longFile,'disposable regression fixture');
const compiler=process.env.EASEL_TEST_NSIS;if(!compiler)throw new Error('Set EASEL_TEST_NSIS to makensis.exe');
const nsis=String.raw`Unicode true
!include "LogicLib.nsh"
!define INSTALL_REGISTRY_KEY "Software\ElectronEasel-Disposable-Path-Test"
!define UNINSTALL_REGISTRY_KEY "Software\ElectronEasel-Disposable-Path-Test"
!include "${path.join(root,'scripts/installer.nsh')}"
LangString uninstallFailed 1033 "Disposable fixture failed"
Name "ElectronEasel disposable path test"
OutFile "${path.join(fixture,'fixture-bootstrap.exe')}"
InstallDir "${appDir}"
RequestExecutionLevel user
SilentInstall silent
Section
!insertmacro customInit
StrCpy $R0 0
ClearErrors
!insertmacro customUnInstallCheck
WriteUninstaller "$EXEDIR\uninstall.exe"
SectionEnd
Function un.onInit
!insertmacro customUnInit
FunctionEnd
Section Uninstall
ClearErrors
Rename "$INSTDIR${'\\'}${relative.split('/').join('\\')}" "$INSTDIR\renamed.txt"
IfErrors 0 +3
SetErrorLevel 8
Quit
Delete "$INSTDIR\renamed.txt"
SetOutPath $TEMP
RMDir /r "$INSTDIR"
SectionEnd
`;
fs.writeFileSync(path.join(fixture,'fixture.nsi'),'\ufeff'+nsis);
try{
 cp.execFileSync(compiler,['-V2',path.join(fixture,'fixture.nsi')],{stdio:'inherit',windowsHide:true});
 cp.execFileSync(path.join(fixture,'fixture-bootstrap.exe'),['/S'],{windowsHide:true});
 cp.execFileSync(path.join(fixture,'uninstall.exe'),['/S',`_?=${appDir}`],{windowsHide:true,windowsVerbatimArguments:true});
 assert.equal(fs.existsSync(appDir),false);
 console.log('NSIS LONG-PATH RENAME AND UNINSTALL PASSED without changing Windows policy');
}finally{
 if(!path.resolve(fixture).startsWith(path.resolve(testRoot)+path.sep))throw new Error('Unsafe test fixture cleanup');
 fs.rmSync(fixture,{recursive:true,force:true});
}

const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const run=script=>cp.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{encoding:'utf8',windowsHide:true});
const quote=value=>"'"+value.replaceAll("'","''")+"'";

test('unregistered update recovery validates identities and Unicode paths without changing registration',{skip:process.platform!=='win32'},()=>{
 const fixtures=path.join(root,'.test-data');fs.mkdirSync(fixtures,{recursive:true});const dir=fs.mkdtempSync(path.join(fixtures,'登记校验 中文 '));
 const program=path.join(dir,'自选 软件'),data=path.join(dir,'独立 用户数据');fs.mkdirSync(path.join(program,'resources'),{recursive:true});fs.mkdirSync(data,{recursive:true});
 // A tiny system executable is only a disposable identity fixture, never executed.
 fs.copyFileSync(path.join(process.env.WINDIR,'System32/cmd.exe'),path.join(program,'MediaSail.exe'));
 fs.writeFileSync(path.join(program,'Uninstall MediaSail.exe'),'fixture uninstaller, never executed');fs.writeFileSync(path.join(program,'resources/app.asar'),'fixture application archive');
 const linked=path.join(dir,'拒绝链接');fs.symlinkSync(program,linked,'junction');
 try{
 const result=run(`$ErrorActionPreference='Stop'; . ${quote(path.join(root,'scripts/installer-recovery.ps1'))} -LibraryOnly
 $program=${quote(program)};$data=${quote(data)};$descriptor=Join-Path $data 'agent-connection.json'
 $version=(Get-Item -LiteralPath (Join-Path $program 'MediaSail.exe')).VersionInfo.ProductVersion
 $sha=@{};foreach($entry in @(@('MediaSail.exe','executable'),@('Uninstall MediaSail.exe','uninstaller'),@('resources\\app.asar','asar'))){$sha[$entry[1]]=Get-RecoveryHash (Join-Path $program $entry[0])}
 $identities=@{releases=@(@{version=$version;sha256=$sha})}
 $connection=@{schema=1;product='MediaSail';version=$version;dataDir=$data;executable=(Join-Path $program 'MediaSail.exe')}
 function Save-Descriptor { [IO.File]::WriteAllText($descriptor,($connection|ConvertTo-Json),[Text.Encoding]::UTF8) }
 function Reject($block){$failed=$false;try{&$block|Out-Null}catch{$failed=$true};if(-not $failed){throw 'Expected identity rejection'}}
 Save-Descriptor
 $candidate=Get-RecoveryCandidate $descriptor $identities
 if($candidate.directory -cne $program){throw 'Unicode installation path changed'}
 Assert-RecoveryRegistration '' '' $candidate
 Assert-RecoveryRegistration $program '' $candidate
 Assert-RecoveryRegistration '' ('"'+$candidate.uninstaller+'" /currentuser') $candidate
 Reject { Assert-RecoveryRegistration $data '' $candidate }
 Reject { Assert-RecoveryRegistration '' 'unrelated.exe /S' $candidate }
 $connection.product='Other';Save-Descriptor;Reject{Get-RecoveryCandidate $descriptor $identities}
 $connection.product='MediaSail';$connection.version='unverified';Save-Descriptor;Reject{Get-RecoveryCandidate $descriptor $identities}
 $connection.version=$version;$connection.dataDir=$program;Save-Descriptor;Reject{Get-RecoveryCandidate $descriptor $identities}
 $connection.dataDir=$data;Save-Descriptor
 [IO.File]::AppendAllText((Join-Path $program 'resources\\app.asar'),'changed');Reject{Get-RecoveryCandidate $descriptor $identities}
 [IO.File]::WriteAllText((Join-Path $program 'resources\\app.asar'),'fixture application archive')
 $connection.executable=${quote(path.join(linked,'MediaSail.exe'))};Save-Descriptor;Reject{Get-RecoveryCandidate $descriptor $identities}
 $connection.executable=Join-Path $program 'MediaSail.exe';Save-Descriptor
 Reject{Assert-PlainPath ([IO.Path]::GetPathRoot($program))}
 Assert-RecoveryDirectory $program $data
 Reject{Assert-RecoveryDirectory ([IO.Path]::GetPathRoot($program)) $data}
 Reject{Assert-RecoveryDirectory $env:WINDIR $data}
 Reject{Assert-RecoveryDirectory (Join-Path $env:WINDIR 'not-created\\application') $data}
 foreach($folder in @('UserProfile','DesktopDirectory','MyDocuments','LocalApplicationData','ApplicationData','CommonApplicationData','ProgramFiles','ProgramFilesX86','CommonProgramFiles','CommonProgramFilesX86','Programs','CommonPrograms','StartMenu','CommonStartMenu')){$protected=[Environment]::GetFolderPath([Environment+SpecialFolder]$folder);if($protected){Reject{Assert-RecoveryDirectory $protected $data}}}
 Reject{Assert-RecoveryDirectory (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs') $data}
 # A migrated library keeps a complete public discovery mirror at the old path.
 $library=Join-Path $data '完整资料库';$runtime=Join-Path $library 'runtime';[IO.Directory]::CreateDirectory($runtime)|Out-Null
 $libraryId='installer-fixture-library-id'
 $location=@{schema=1;product='MediaSail';state='ready';libraryRoot=$library;libraryId=$libraryId}
 [IO.File]::WriteAllText((Join-Path $data 'library-location.json'),($location|ConvertTo-Json),[Text.Encoding]::UTF8)
 [IO.File]::WriteAllText((Join-Path $library '.mediasail-library.json'),(@{schema=1;product='MediaSail';state='ready';libraryId=$libraryId}|ConvertTo-Json),[Text.Encoding]::UTF8)
 $migrated=$connection.Clone();$migrated.dataDir=$runtime;$migrated.libraryRoot=$library;$migrated.libraryId=$libraryId;$migrated.instanceId='fixture-instance';$migrated.connectionFile=Join-Path $runtime 'agent-connection.json'
 [IO.File]::WriteAllText($migrated.connectionFile,($migrated|ConvertTo-Json),[Text.Encoding]::UTF8)
 [IO.File]::WriteAllText($descriptor,($migrated|ConvertTo-Json),[Text.Encoding]::UTF8)
 $migratedCandidate=Get-RecoveryCandidate $descriptor $identities
 if($migratedCandidate.directory -cne $program){throw 'Migrated library changed installation recovery'}
 $migrated.libraryId='wrong-library';[IO.File]::WriteAllText($descriptor,($migrated|ConvertTo-Json),[Text.Encoding]::UTF8);Reject{Get-RecoveryCandidate $descriptor $identities}
 $migrated.libraryId=$libraryId;$migrated.instanceId='different-instance';[IO.File]::WriteAllText($descriptor,($migrated|ConvertTo-Json),[Text.Encoding]::UTF8);Reject{Get-RecoveryCandidate $descriptor $identities}
 $ResultFile=Join-Path $data 'result.ini';Write-RecoveryResult 'verified' $candidate ''
 $ini=[IO.File]::ReadAllText($ResultFile);if(-not $ini.Contains('directory='+$program) -or -not $ini.Contains('version='+$version)){throw 'Broken NSIS result format'}
 'IDENTITY, PARTIAL REGISTRATION, TAMPERING, ROOT AND UNICODE CHECKS PASSED'`);
 assert.match(result,/CHECKS PASSED/);
 }finally{assert.ok(dir.startsWith(fixtures+path.sep));fs.rmSync(dir,{recursive:true,force:true});}
});

test('installer stages recovery immediately before native uninstall and rolls back failures',()=>{
 const template=fs.readFileSync(path.join(root,'scripts/prepare-installer.cjs'),'utf8');
 assert.match(template,/mediaSailBeforeOldUninstall/);
 const nsis=fs.readFileSync(path.join(root,'scripts/installer-recovery.nsh'),'utf8');
 assert.match(nsis,/Function MediaSailRecoveryProbe/);assert.match(nsis,/Function MediaSailRecoveryStage/);assert.match(nsis,/Function MediaSailRecoveryRollback/);
 // System::Call .r9 writes $9. A mismatched $R9 produced the same "true"
 // journal for separate installers and blocked a genuine retry after rollback.
 const pidJournal=nsis.match(/GetCurrentProcessId\(\) i \.r(\d+)'[\s\S]*?StrCpy \$mediaSailRecoveryBackup "([^"\r\n]+)"/);
 assert.ok(pidJournal,'PID-backed recovery journal is required');
 assert.ok(pidJournal[2].endsWith('-$'+pidJournal[1]+'.json'),'Recovery journal must use the actual System plug-in PID register');
 const installer=fs.readFileSync(path.join(root,'scripts/installer.nsh'),'utf8');
 assert.match(installer,/Call MediaSailRecoveryProbe/);assert.match(installer,/StrCpy \$INSTDIR "\$mediaSailRecoveryPath"/);assert.match(installer,/Call MediaSailRecoveryRollback/);
 assert.doesNotMatch(nsis,/RMDir\s+\/r/i);
 const helper=fs.readFileSync(path.join(root,'scripts/installer-recovery.ps1'),'utf8');
 assert.match(helper,/ReparsePoint/);assert.match(helper,/SHA256/);assert.match(helper,/Registry64/);assert.match(helper,/Get-RegistrySnapshot/);assert.match(helper,/Set-RegistrySnapshot/);
});

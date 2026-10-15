; No installation registration is changed while the wizard is idle. A verified
; recovery is staged immediately before electron-builder's original uninstaller.
Var mediaSailRecoveryPath
Var mediaSailRecoveryState
Var mediaSailRecoveryResult
Var mediaSailRecoveryBackup

; The custom include is parsed before builder registry, logic and plugin setup.
; Expand functions at the supported customHeader hook after those are available.
!macro customHeader
Function MediaSailRecoveryRun
  Pop $R8
  Delete "$mediaSailRecoveryResult"
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\installer-recovery.ps1" -Mode "$R8" -ConnectionFile "$LOCALAPPDATA\ElectronEasel\agent-connection.json" -ResultFile "$mediaSailRecoveryResult" -StateFile "$mediaSailRecoveryBackup" -InstallKey "${INSTALL_REGISTRY_KEY}" -UninstallKey "${UNINSTALL_REGISTRY_KEY}" -ExpectedDirectory "$mediaSailRecoveryPath"'
  Pop $R0
  Pop $R1
FunctionEnd

Function MediaSailRecoveryProbe
  StrCpy $mediaSailRecoveryState ""
  ${IfNot} ${isUpdated}
    Return
  ${EndIf}
  ReadRegStr $R7 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $R8 HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
  ${If} $R7 != ""
  ${AndIf} $R8 != ""
    Return
  ${EndIf}
  ; An update from an unregistered old client must not become a fresh install.
  InitPluginsDir
  File "/oname=$PLUGINSDIR\installer-recovery.ps1" "${BUILD_RESOURCES_DIR}\..\..\scripts\installer-recovery.ps1"
  File "/oname=$PLUGINSDIR\installer-identities.json" "${BUILD_RESOURCES_DIR}\..\..\scripts\installer-identities.json"
  CreateDirectory "$LOCALAPPDATA\ElectronEasel\logs"
  StrCpy $mediaSailRecoveryResult "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}-recovery.ini"
  System::Call 'kernel32::GetCurrentProcessId() i .r9'
  StrCpy $mediaSailRecoveryBackup "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}-recovery-$R9.json"
  StrCpy $mediaSailRecoveryPath ""
  Push "Probe"
  Call MediaSailRecoveryRun
  ${If} $R0 != 0
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "recovery-validation-failed"
    MessageBox MB_OK|MB_ICONSTOP "无法确认旧版 MediaSail 的安装位置，更新已停止，未删除程序或数据。$\n请保留日志：$mediaSailRecoveryResult" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
  ReadINIStr $mediaSailRecoveryPath "$mediaSailRecoveryResult" "recovery" "directory"
  ${If} $mediaSailRecoveryPath == ""
    SetErrorLevel 2
    Quit
  ${EndIf}
  StrCpy $mediaSailRecoveryState "verified"
  StrCpy $INSTDIR "$mediaSailRecoveryPath"
FunctionEnd

Function MediaSailRecoveryStage
  ${If} $mediaSailRecoveryState != "verified"
    Return
  ${EndIf}
  StrCpy $INSTDIR "$mediaSailRecoveryPath"
  Push "Stage"
  Call MediaSailRecoveryRun
  ${If} $R0 != 0
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "recovery-stage-failed"
    MessageBox MB_OK|MB_ICONSTOP "无法恢复旧版安装登记，更新已停止，用户数据保留。$\n日志：$mediaSailRecoveryResult" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
  StrCpy $mediaSailRecoveryState "staged"
  ClearErrors
FunctionEnd

Function MediaSailRecoveryRollback
  ${If} $mediaSailRecoveryState != "staged"
    Return
  ${EndIf}
  Push "Rollback"
  Call MediaSailRecoveryRun
  ${If} $R0 != 0
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "recoveryRollback" "failed"
    MessageBox MB_OK|MB_ICONSTOP "旧版卸载失败，恢复安装登记也未完成。用户数据保留，请保留备份及日志：$mediaSailRecoveryResult" /SD IDOK
  ${Else}
    StrCpy $mediaSailRecoveryState "rolled-back"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "recoveryRollback" "succeeded"
  ${EndIf}
FunctionEnd
!macroend

!macro mediaSailBeforeOldUninstall
  ${If} $rootKey == "SHELL_CONTEXT"
    Call MediaSailRecoveryStage
  ${EndIf}
!macroend

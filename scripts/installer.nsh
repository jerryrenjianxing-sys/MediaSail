; Keep long dependency paths usable without changing Windows long-path policy.
; The old 0.1.0 uninstaller predates customUnInit. Give only that uninstaller
; an extended-length form of its existing, registered application directory.
!ifndef BUILD_UNINSTALLER
  !include nsDialogs.nsh
  !include "${BUILD_RESOURCES_DIR}\..\..\scripts\installer-legacy-temp.nsh"
  Var legacyInstallPath
  Var mediaSailVisibleUpdate
  Var mediaSailLibraryPath
  Var mediaSailLibraryDialog
  Var mediaSailLibraryInput
  Var mediaSailLibraryBrowse
  Var mediaSailLibraryResult
  !include "${BUILD_RESOURCES_DIR}\..\..\scripts\installer-recovery.nsh"
  !define MUI_INSTFILESPAGE_TEXT "正在安装 MediaSail，请稍候。正在替换旧程序，用户数据将保留。"
!endif

!macro customInit
  StrCpy $mediaSailVisibleUpdate "0"
  StrCpy $mediaSailLibraryPath ""
  ${IfNot} ${isUpdated}
    IfFileExists "$LOCALAPPDATA\ElectronEasel\library-location.json" mediaSailLibraryInitDone
    IfFileExists "$LOCALAPPDATA\ElectronEasel\library-selection.ini" mediaSailLibraryInitDone
    IfFileExists "$LOCALAPPDATA\ElectronEasel\workspace\*.*" mediaSailLibraryInitDone
    StrCpy $mediaSailLibraryPath "$DOCUMENTS\MediaSail资料库"
    mediaSailLibraryInitDone:
  ${EndIf}
  ${If} ${isUpdated}
  ${AndIf} ${isForceRun}
    ; Older clients pass /S. The incoming installer owns the visible update flow.
    StrCpy $mediaSailVisibleUpdate "1"
    SetSilent normal
    CreateDirectory "$LOCALAPPDATA\ElectronEasel\logs"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "started"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "directory" "$INSTDIR"
  ${EndIf}
  Call MediaSailRecoveryProbe
  ${If} $mediaSailRecoveryState == "verified"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "directory" "$INSTDIR"
  ${EndIf}
  ; Recover a readable normal path after an interrupted legacy upgrade.
  StrCpy $R7 $INSTDIR 4
  StrCpy $R8 $INSTDIR 2 5
  ${If} $R7 == "\\?\"
  ${AndIf} $R8 == ":\"
    StrCpy $INSTDIR $INSTDIR "" 4
  ${EndIf}
!macroend

!macro customInstallMode
  !ifndef BUILD_UNINSTALLER
  ${If} $mediaSailVisibleUpdate == "1"
    StrCpy $isForceCurrentInstall "1"
  ${EndIf}
  !endif
!macroend

!macro customPageAfterChangeDir
  Page custom MediaSailLibraryPage MediaSailLibraryLeave
  Function MediaSailLibraryPage
    ${If} $mediaSailLibraryPath == ""
      Abort
    ${EndIf}
    !insertmacro MUI_HEADER_TEXT "选择 MediaSail 资料库" "画像、方法、工具、素材与运行资料保存在这里；升级和卸载保留。"
    nsDialogs::Create 1018
    Pop $mediaSailLibraryDialog
    ${If} $mediaSailLibraryDialog == error
      Abort
    ${EndIf}
    ${NSD_CreateLabel} 0 0 100% 34u "选择软件与外部 Agent 共用的资料库。程序与运行环境仍安装在上一页的位置；以后可以在设置中迁移资料库。"
    Pop $R0
    ${NSD_CreateDirRequest} 0 46u 82% 13u "$mediaSailLibraryPath"
    Pop $mediaSailLibraryInput
    ${NSD_CreateBrowseButton} 84% 46u 16% 13u "浏览…"
    Pop $mediaSailLibraryBrowse
    ${NSD_OnClick} $mediaSailLibraryBrowse MediaSailLibraryBrowse
    nsDialogs::Show
  FunctionEnd
  Function MediaSailLibraryBrowse
    Pop $R0
    nsDialogs::SelectFolderDialog "选择 MediaSail 资料库" "$mediaSailLibraryPath"
    Pop $R0
    ${If} $R0 != error
      ${NSD_SetText} $mediaSailLibraryInput $R0
    ${EndIf}
  FunctionEnd
  Function MediaSailLibraryCheck
    Pop $R8
    InitPluginsDir
    File "/oname=$PLUGINSDIR\installer-library.ps1" "${BUILD_RESOURCES_DIR}\..\..\scripts\installer-library.ps1"
    StrCpy $mediaSailLibraryResult "$PLUGINSDIR\library-result.ini"
    Delete "$mediaSailLibraryResult"
    nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\installer-library.ps1" -Mode "$R8" -Root "$mediaSailLibraryPath" -BootstrapRoot "$LOCALAPPDATA\ElectronEasel" -InstallDirectory "$INSTDIR" -InstallerFile "$EXEPATH" -ResultFile "$mediaSailLibraryResult"'
    Pop $R0
    Pop $R1
  FunctionEnd
  Function MediaSailLibraryLeave
    ${If} $mediaSailLibraryPath == ""
      Return
    ${EndIf}
    ${NSD_GetText} $mediaSailLibraryInput $mediaSailLibraryPath
    Push "Validate"
    Call MediaSailLibraryCheck
    ${If} $R0 != 0
      ReadINIStr $R1 "$mediaSailLibraryResult" "library" "message"
      MessageBox MB_OK|MB_ICONEXCLAMATION "无法使用这个资料库位置。$\n$R1"
      Abort
    ${EndIf}
  FunctionEnd
  ; The default visible page sanitizes arbitrary folders, even on update.
  ; Preserve the exact registered installation path when skipping that page.
  !ifdef MUI_PAGE_CUSTOMFUNCTION_PRE
    !undef MUI_PAGE_CUSTOMFUNCTION_PRE
  !endif
  Function MediaSailInstFilesPre
    ${If} $mediaSailRecoveryState == "verified"
      ; The per-user mode page recomputes INSTDIR from the still-unmodified
      ; registry. Restore the verified original location after that page.
      StrCpy $INSTDIR "$mediaSailRecoveryPath"
    ${EndIf}
    ${IfNot} ${isUpdated}
      Call instFilesPre
    ${EndIf}
  FunctionEnd
  Function MediaSailInstFilesShow
    ${If} $mediaSailVisibleUpdate == "1"
      WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "installing"
      !insertmacro MUI_HEADER_TEXT "正在安装 MediaSail" "请稍候，完成后会自动重新打开。"
    ${EndIf}
  FunctionEnd
  !define MUI_PAGE_CUSTOMFUNCTION_PRE MediaSailInstFilesPre
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW MediaSailInstFilesShow
!macroend

!macro customFinishPage
  Function MediaSailFinishPre
    ${If} $mediaSailVisibleUpdate == "1"
      WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "succeeded"
      HideWindow
      ; StartApp also expands in installSection.nsh and declares a global variable.
      ; Use its launch operation here without declaring that variable twice.
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
      SetErrorLevel 0
      Quit
    ${EndIf}
  FunctionEnd
  !define MUI_PAGE_CUSTOMFUNCTION_PRE MediaSailFinishPre
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customInstall
  ; This runs after extraction/registration and before any successful launch.
  ${IfNot} ${FileExists} "$INSTDIR\MediaSail.exe"
  ${OrIfNot} ${FileExists} "$INSTDIR\resources\app.asar"
  ${OrIfNot} ${FileExists} "$INSTDIR\resources\runtime-lock.json"
  ${OrIfNot} ${FileExists} "$INSTDIR\resources\runtime\python\cpython-3.11.15-windows-x86_64-none\python.exe"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "incomplete-files"
    MessageBox MB_OK|MB_ICONSTOP "MediaSail 安装文件不完整。请保留安装包，检查磁盘空间后重新安装。" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
  ${If} $mediaSailLibraryPath != ""
  ${AndIfNot} ${isUpdated}
    Push "Commit"
    Call MediaSailLibraryCheck
    ${If} $R0 != 0
      ReadINIStr $R1 "$mediaSailLibraryResult" "library" "message"
      MessageBox MB_OK|MB_ICONSTOP "资料库位置未能保存，请重新运行安装器。$\n$R1" /SD IDOK
      SetErrorLevel 2
      Quit
    ${EndIf}
  ${EndIf}
  Push "Cache"
  Call MediaSailLibraryCheck
  ${If} $R0 != 0
    ReadINIStr $R1 "$mediaSailLibraryResult" "library" "message"
    MessageBox MB_OK|MB_ICONSTOP "安装包缓存未能核验保存，请保留安装包并重新安装。$\n$R1" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customUnInstallCheck
  ${If} $mediaSailRecoveryState == "staged"
  ${AndIf} $R0 == 0
  ${AndIf} ${FileExists} "$mediaSailRecoveryPath\MediaSail.exe"
    ; Do not report a skipped or incomplete old uninstallation as success.
    StrCpy $R0 2
  ${EndIf}
  ${If} ${Errors}
    StrCpy $R0 2
  ${EndIf}
  ${If} $R0 != 0
    ReadRegStr $R7 HKCU "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
    ${If} $R7 == "0.1.0"
      ReadRegStr $legacyInstallPath HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
      StrCpy $R8 $legacyInstallPath 2 1
      ${If} $R8 == ":\"
      ${AndIf} ${FileExists} "$legacyInstallPath\ElectronEasel.exe"
      ${AndIf} ${FileExists} "$legacyInstallPath\resources\runtime-lock.json"
      ${AndIf} ${FileExists} "$PLUGINSDIR\old-uninstaller.exe"
        ; No registry changes are made while the installation wizard is idle.
        ; Retry only the known legacy uninstaller and retain its atomic rollback.
        WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "\\?\$legacyInstallPath"
        ClearErrors
        !insertmacro mediaSailLegacyExec '"$PLUGINSDIR\old-uninstaller.exe" /S /KEEP_APP_DATA /currentuser --updated _?=\\?\$legacyInstallPath'
        ${If} ${Errors}
          StrCpy $R0 2
        ${EndIf}
        ${If} $R0 != 0
          WriteRegStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$legacyInstallPath"
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
  ${If} $R0 != 0
    Push $R0
    Call MediaSailRecoveryRollback
    Pop $R0
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(uninstallFailed): $R0" /SD IDOK
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "old-uninstall-failed"
    SetErrorLevel 2
    Quit
  ${EndIf}
  ${If} $mediaSailVisibleUpdate == "1"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "old-version-removed"
  ${EndIf}
!macroend

!macro customUnInit
  ; NSIS filesystem calls support the Win32 extended-length prefix. This
  ; affects this registered application's files only, never user data.
  StrCpy $R8 $INSTDIR 2 1
  ${If} $R8 == ":\"
    StrCpy $INSTDIR "\\?\$INSTDIR"
  ${EndIf}
!macroend

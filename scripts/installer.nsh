; Keep long dependency paths usable without changing Windows long-path policy.
; The old 0.1.0 uninstaller predates customUnInit. Give only that uninstaller
; an extended-length form of its existing, registered application directory.
!ifndef BUILD_UNINSTALLER
  Var legacyInstallPath
  Var mediaSailVisibleUpdate
  !define MUI_INSTFILESPAGE_TEXT "正在安装 MediaSail，请稍候。完整运行环境需要解压，可能持续数分钟。"
!endif

!macro customInit
  StrCpy $mediaSailVisibleUpdate "0"
  ${If} ${isUpdated}
  ${AndIf} ${isForceRun}
    ; Older clients pass /S. The incoming installer owns the visible update flow.
    StrCpy $mediaSailVisibleUpdate "1"
    SetSilent normal
    CreateDirectory "$LOCALAPPDATA\ElectronEasel\logs"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "started"
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
  ; The default visible page sanitizes arbitrary folders, even on update.
  ; Preserve the exact registered installation path when skipping that page.
  !ifdef MUI_PAGE_CUSTOMFUNCTION_PRE
    !undef MUI_PAGE_CUSTOMFUNCTION_PRE
  !endif
  Function MediaSailInstFilesPre
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
  ${OrIfNot} ${FileExists} "$INSTDIR\resources\runtime\node\node.exe"
    WriteINIStr "$LOCALAPPDATA\ElectronEasel\logs\installer-${VERSION}.ini" "install" "state" "incomplete-files"
    MessageBox MB_OK|MB_ICONSTOP "MediaSail 安装文件不完整。请保留安装包，检查磁盘空间后重新安装。" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customUnInstallCheck
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
        ExecWait '"$PLUGINSDIR\old-uninstaller.exe" /S /KEEP_APP_DATA /currentuser --updated _?=\\?\$legacyInstallPath' $R0
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

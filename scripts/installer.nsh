; Keep long dependency paths usable without changing Windows long-path policy.
; The old 0.1.0 uninstaller predates customUnInit. Give only that uninstaller
; an extended-length form of its existing, registered application directory.
!ifndef BUILD_UNINSTALLER
  Var legacyInstallPath
!endif

!macro customInit
  ; Recover a readable normal path after an interrupted legacy upgrade.
  StrCpy $R7 $INSTDIR 4
  StrCpy $R8 $INSTDIR 2 5
  ${If} $R7 == "\\?\"
  ${AndIf} $R8 == ":\"
    StrCpy $INSTDIR $INSTDIR "" 4
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
    SetErrorLevel 2
    Quit
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

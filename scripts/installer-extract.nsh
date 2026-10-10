!ifndef MEDIA_SAIL_INSTALL_LOG_DIR
!define MEDIA_SAIL_INSTALL_LOG_DIR "$LOCALAPPDATA\ElectronEasel\logs"
!endif
; Replaces electron-builder 26.15.3's Shell CopyFiles step. Shell directory
; copying stops on deep dependency paths and reports an unrelated app-close error.
; Robocopy supports long Unicode paths and provides a checked result and log.
!macro extractUsing7za FILE
  InitPluginsDir
  Push $OUTDIR
  CreateDirectory "$PLUGINSDIR\7z-out"
  ClearErrors
  SetOutPath "$PLUGINSDIR\7z-out"
  Nsis7z::Extract "${FILE}"
  Pop $R0
  SetOutPath $R0
  ${If} ${Errors}
    CreateDirectory "${MEDIA_SAIL_INSTALL_LOG_DIR}"
    WriteINIStr "${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}.ini" "install" "state" "extract-failed"
    MessageBox MB_OK|MB_ICONSTOP "MediaSail 解压失败。请检查磁盘空间，保留安装包后重试。" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
  !ifmacrodef MUI_HEADER_TEXT
    !insertmacro MUI_HEADER_TEXT "正在安装 MediaSail" "正在复制文件，完成后会自动重新打开。"
  !endif
  !insertmacro mediaSailCopyExtracted "$PLUGINSDIR\7z-out" "$OUTDIR"
!macroend

!macro mediaSailCopyExtracted SOURCE DESTINATION
  CreateDirectory "${MEDIA_SAIL_INSTALL_LOG_DIR}"
  WriteINIStr "${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}.ini" "install" "state" "copying-files"
  DetailPrint "正在复制 MediaSail 文件，请稍候。"
  mediaSailCopyRetry:
  nsExec::ExecToStack '"$SYSDIR\robocopy.exe" "${SOURCE}" "${DESTINATION}" /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XJ /NP /NFL /NDL /UNILOG:"${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}-copy.log"'
  Pop $R0
  Pop $R1
  ${If} $R0 == "error"
  ${OrIf} $R0 == "timeout"
    StrCpy $R0 16
  ${EndIf}
  ${If} $R0 >= 8
    WriteINIStr "${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}.ini" "install" "state" "copy-failed"
    WriteINIStr "${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}.ini" "install" "copyExitCode" "$R0"
    MessageBox MB_RETRYCANCEL|MB_ICONSTOP "MediaSail 文件复制失败（代码 $R0）。请检查磁盘空间或文件占用。$\n日志：${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}-copy.log" /SD IDCANCEL IDRETRY mediaSailCopyRetry
    SetErrorLevel 2
    Quit
  ${EndIf}
  WriteINIStr "${MEDIA_SAIL_INSTALL_LOG_DIR}\installer-${VERSION}.ini" "install" "state" "files-copied"
!macroend

; Old uninstallers use $PLUGINSDIR for atomic rollback. An extended TEMP/TMP
; inherited by that child makes both ends of its Rename operation long-path safe.
; No persistent environment or registry setting is changed.
Var mediaSailOldTemp
Var mediaSailOldTmp
Var mediaSailChildTemp
Var mediaSailExecError

!macro mediaSailLegacyExec COMMAND
  ReadEnvStr $mediaSailOldTemp "TEMP"
  ReadEnvStr $mediaSailOldTmp "TMP"
  StrCpy $mediaSailChildTemp $TEMP
  StrCpy $R1 $TEMP 4
  ${If} $R1 != "\\?\"
    StrCpy $R1 $TEMP 2 1
    ${If} $R1 == ":\"
      StrCpy $mediaSailChildTemp "\\?\$TEMP"
    ${Else}
      StrCpy $R1 $TEMP 2
      ${If} $R1 == "\\"
        StrCpy $mediaSailChildTemp $TEMP "" 2
        StrCpy $mediaSailChildTemp "\\?\UNC\$mediaSailChildTemp"
      ${EndIf}
    ${EndIf}
  ${EndIf}
  System::Call 'kernel32::SetEnvironmentVariableW(w "TEMP", w "$mediaSailChildTemp") i .r1'
  System::Call 'kernel32::SetEnvironmentVariableW(w "TMP", w "$mediaSailChildTemp") i .r1'
  ClearErrors
  ExecWait '${COMMAND}' $R0
  StrCpy $mediaSailExecError 0
  IfErrors 0 +2
    StrCpy $mediaSailExecError 1
  ${If} $mediaSailOldTemp == ""
    System::Call 'kernel32::SetEnvironmentVariableW(w "TEMP", p 0) i .r1'
  ${Else}
    System::Call 'kernel32::SetEnvironmentVariableW(w "TEMP", w "$mediaSailOldTemp") i .r1'
  ${EndIf}
  ${If} $mediaSailOldTmp == ""
    System::Call 'kernel32::SetEnvironmentVariableW(w "TMP", p 0) i .r1'
  ${Else}
    System::Call 'kernel32::SetEnvironmentVariableW(w "TMP", w "$mediaSailOldTmp") i .r1'
  ${EndIf}
  ClearErrors
  ${If} $mediaSailExecError == 1
    SetErrors
  ${EndIf}
!macroend

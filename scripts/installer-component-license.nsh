; Only Microsoft's unchanged D3D compiler DLL is covered by this page.
!define MEDIASAIL_MS_D3D_LICENSE_SHA "0f4a26ac9dc50066f8a1bfeaaf3f092d1b9e4791df5487b9f3c31e7c3dc4d7f5"
!ifndef MEDIASAIL_COMPONENT_CONSENT_ROOT
  !define MEDIASAIL_COMPONENT_CONSENT_ROOT "$LOCALAPPDATA\ElectronEasel"
!endif
Var mediaSailComponentConsent

!macro MediaSailComponentConsentInit
  ReadINIStr $mediaSailComponentConsent "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\component-consent.ini" "Microsoft-d3dcompiler_47.dll" "license-sha256"
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/ACCEPT_MS_D3D_LICENSE=" $R1
  ${IfNot} ${Errors}
  ${AndIf} $R1 == "${MEDIASAIL_MS_D3D_LICENSE_SHA}"
    ; Explicit versioned consent for an administrator's attended/read deployment.
    StrCpy $mediaSailComponentConsent "${MEDIASAIL_MS_D3D_LICENSE_SHA}"
    CreateDirectory "${MEDIASAIL_COMPONENT_CONSENT_ROOT}"
    WriteINIStr "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\component-consent.ini" "Microsoft-d3dcompiler_47.dll" "license-sha256" "$mediaSailComponentConsent"
  ${EndIf}
  ${If} ${Silent}
  ${AndIf} $mediaSailComponentConsent != "${MEDIASAIL_MS_D3D_LICENSE_SHA}"
    ; Never infer consent from /S. Stop before any existing program is uninstalled.
    CreateDirectory "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\logs"
    WriteINIStr "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\logs\installer-${VERSION}.ini" "install" "state" "component-license-required"
    SetErrorLevel 3
    Quit
  ${EndIf}
!macroend

!macro MediaSailComponentLicensePage
  Function MediaSailComponentLicensePre
    ${If} $mediaSailComponentConsent == "${MEDIASAIL_MS_D3D_LICENSE_SHA}"
      Abort
    ${EndIf}
    CreateDirectory "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\logs"
    WriteINIStr "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\logs\installer-${VERSION}.ini" "install" "state" "awaiting-component-license"
  FunctionEnd
  Function MediaSailComponentLicenseLeave
    CreateDirectory "${MEDIASAIL_COMPONENT_CONSENT_ROOT}"
    StrCpy $mediaSailComponentConsent "${MEDIASAIL_MS_D3D_LICENSE_SHA}"
    WriteINIStr "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\component-consent.ini" "Microsoft-d3dcompiler_47.dll" "license-sha256" "$mediaSailComponentConsent"
    WriteINIStr "${MEDIASAIL_COMPONENT_CONSENT_ROOT}\component-consent.ini" "Microsoft-d3dcompiler_47.dll" "accepted-in-version" "${VERSION}"
  FunctionEnd
  !ifdef MUI_PAGE_CUSTOMFUNCTION_PRE
    !undef MUI_PAGE_CUSTOMFUNCTION_PRE
  !endif
  !define MUI_PAGE_CUSTOMFUNCTION_PRE MediaSailComponentLicensePre
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE MediaSailComponentLicenseLeave
  !define MUI_PAGE_HEADER_TEXT "Microsoft 浏览器组件许可"
  !define MUI_PAGE_HEADER_SUBTEXT "仅适用于随包的 Microsoft d3dcompiler_47.dll，不改变其他开源组件许可。"
  !define MUI_LICENSEPAGE_TEXT_TOP "请阅读该 Microsoft DLL 适用的 SDK 条款原文。MediaSail、Chromium、BrowserSkill 等开源部分的源码、修改及调试修改权利仍按各自许可证保留。"
  !define MUI_LICENSEPAGE_CHECKBOX
  !define MUI_LICENSEPAGE_CHECKBOX_TEXT "我同意仅适用于该 Microsoft DLL 的相关条款"
  !define MUI_LICENSEPAGE_TEXT_BOTTOM "本软件不安装完整 SDK。不同意可取消，旧程序与资料将保留。相同条款以后不重复询问。"
  ; Deliberately no skipPageIfUpdated: older clients have not agreed to this DLL.
  !insertmacro MUI_PAGE_LICENSE "${BUILD_RESOURCES_DIR}\..\..\licenses\browser-tools\Microsoft-Windows-SDK-10.0.28000-LICENSE.rtf"
!macroend

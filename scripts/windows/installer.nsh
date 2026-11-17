; FlexHubs Desktop — electron-builder NSIS hooks (see electron-builder.win.yml).

!ifndef FLEXHUBS_AUMID
  !define FLEXHUBS_AUMID "com.flexodyn.flexhubs"
!endif

!ifndef FLEXHUBS_NOTIFICATION_NAME
  !define FLEXHUBS_NOTIFICATION_NAME "FlexHubs"
!endif

!macro FlexHubsRegisterNotificationIdentity
  WriteRegStr HKCU "Software\Classes\AppUserModelId\${FLEXHUBS_AUMID}" "" "${FLEXHUBS_NOTIFICATION_NAME}"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\${FLEXHUBS_AUMID}" "DisplayName" "${FLEXHUBS_NOTIFICATION_NAME}"
  WriteRegStr HKCU "Software\Classes\AppUserModelId\${FLEXHUBS_AUMID}" "IconResource" "$INSTDIR\${PRODUCT_FILENAME}.exe,0"
  WriteRegStr HKCU "Software\RegisteredApplications" "${FLEXHUBS_NOTIFICATION_NAME}" "Software\Classes\AppUserModelId\${FLEXHUBS_AUMID}"
!macroend

!macro FlexHubsApplyShortcutAppId shortcutPath
  IfFileExists "$INSTDIR\resources\assets\windows\set-lnk-aumid.ps1" 0 FlexHubsApplyShortcutAppIdDone
    ExecWait '"$WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\resources\assets\windows\set-lnk-aumid.ps1" -ShortcutPath "${shortcutPath}" -TargetPath "$INSTDIR\${PRODUCT_FILENAME}.exe" -WorkingDirectory "$INSTDIR" -AppUserModelId "${FLEXHUBS_AUMID}" -Description "${FLEXHUBS_NOTIFICATION_NAME}"'
  FlexHubsApplyShortcutAppIdDone:
!macroend

!macro FlexHubsEnsureShellShortcut
  CreateDirectory "$SMPROGRAMS\FlexHubs"
  CreateShortCut "$SMPROGRAMS\FlexHubs\FlexHubs.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0 SW_SHOWNORMAL "" "" "${APP_DESCRIPTION}"
  !insertmacro FlexHubsApplyShortcutAppId "$SMPROGRAMS\FlexHubs\FlexHubs.lnk"
!macroend

!macro customInit
  !insertmacro FlexHubsRegisterNotificationIdentity
!macroend

!macro customInstall
  !insertmacro FlexHubsRegisterNotificationIdentity
  !insertmacro FlexHubsEnsureShellShortcut
  ReadEnvStr $0 LOCALAPPDATA
  IfFileExists "$0\FlexHubsDesktop\Update.exe" 0 flexhubsLegacyDone
    IfSilent flexhubsLegacyRemove
      MessageBox MB_YESNO|MB_ICONQUESTION "An older FlexHubs install was found (previous installer).$\r$\n$\r$\nRemove it now? Your account data in AppData is not deleted." IDYES flexhubsLegacyRemove IDNO flexhubsLegacyDone
  flexhubsLegacyRemove:
    RMDir /r "$0\FlexHubsDesktop"
  flexhubsLegacyDone:
!macroend

!ifndef BUILD_UNINSTALLER
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; Do not reference $newStartMenuLink / $appExe / $launchLink here — those Var
; names are declared later in electron-builder's template (-WX warns at compile time).
; Custom include is parsed before !addplugindir — no WinShell::, StdUtils::, or ${isUpdated} here.

Var FlexHubsLaunchLink
Var FlexHubsDesktopShortcutCheckbox
Var FlexHubsStartMenuShortcutCheckbox
Var FlexHubsDesktopShortcutState
Var FlexHubsStartMenuShortcutState

!macro FlexHubsStartMenuLinkPath out
  !ifdef MENU_FILENAME
    StrCpy ${out} "$SMPROGRAMS\${MENU_FILENAME}\${SHORTCUT_NAME}.lnk"
  !else
    StrCpy ${out} "$SMPROGRAMS\${SHORTCUT_NAME}.lnk"
  !endif
!macroend

Function FlexHubsCreateStartMenuShortcut
  !ifdef MENU_FILENAME
    CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
    ClearErrors
  !endif
  !insertmacro FlexHubsStartMenuLinkPath $R8
  CreateShortCut "$R8" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  !insertmacro FlexHubsApplyShortcutAppId "$R8"
  StrCpy $FlexHubsLaunchLink "$R8"
FunctionEnd

Function FlexHubsCreateDesktopShortcut
  CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe" "" "$INSTDIR\${PRODUCT_FILENAME}.exe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  !insertmacro FlexHubsApplyShortcutAppId "$DESKTOP\${SHORTCUT_NAME}.lnk"
FunctionEnd

Function FlexHubsFinishPageShowShortcutOptions
  ; Skip finish-page options during silent in-app updates (electron-updater /S).
  IfSilent FlexHubsFinishPageShowShortcutOptionsDone
  StrCpy $FlexHubsLaunchLink "$INSTDIR\${PRODUCT_FILENAME}.exe"
  ${NSD_CreateCheckbox} 120u 105u 240u 10u "Add a shortcut on the Desktop"
  Pop $FlexHubsDesktopShortcutCheckbox
  ${NSD_SetState} $FlexHubsDesktopShortcutCheckbox ${BST_CHECKED}

  ${NSD_CreateCheckbox} 120u 120u 240u 10u "Add a shortcut to the Start Menu"
  Pop $FlexHubsStartMenuShortcutCheckbox
  ${NSD_SetState} $FlexHubsStartMenuShortcutCheckbox ${BST_CHECKED}
  FlexHubsFinishPageShowShortcutOptionsDone:
FunctionEnd

Function FlexHubsFinishPageLeaveShortcutOptions
  IfSilent FlexHubsFinishPageLeaveShortcutOptionsDone
  StrCpy $FlexHubsLaunchLink "$INSTDIR\${PRODUCT_FILENAME}.exe"

  ${NSD_GetState} $FlexHubsStartMenuShortcutCheckbox $FlexHubsStartMenuShortcutState
  ${If} $FlexHubsStartMenuShortcutState == ${BST_CHECKED}
    Call FlexHubsCreateStartMenuShortcut
  ${EndIf}

  ${NSD_GetState} $FlexHubsDesktopShortcutCheckbox $FlexHubsDesktopShortcutState
  ${If} $FlexHubsDesktopShortcutState == ${BST_CHECKED}
    Call FlexHubsCreateDesktopShortcut
  ${EndIf}
  FlexHubsFinishPageLeaveShortcutOptionsDone:
FunctionEnd

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ; ExecShell only — StdUtils/isUpdated cannot be used in this early include (see header comment).
      ExecShell "open" "$FlexHubsLaunchLink"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "Launch FlexHubs Desktop"
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !define MUI_PAGE_CUSTOMFUNCTION_SHOW FlexHubsFinishPageShowShortcutOptions
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE FlexHubsFinishPageLeaveShortcutOptions
  !insertmacro MUI_PAGE_FINISH
!macroend
!endif

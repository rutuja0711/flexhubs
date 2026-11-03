; FlexHubs Desktop — electron-builder NSIS hooks (see electron-builder.win.yml).

!macro customInstall
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
  CreateShortCut "$R8" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$R8" "${APP_ID}"
  StrCpy $FlexHubsLaunchLink "$R8"
FunctionEnd

Function FlexHubsCreateDesktopShortcut
  CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$DESKTOP\${SHORTCUT_NAME}.lnk" "${APP_ID}"
  System::Call 'Shell32::SHChangeNotify(i 0x1002, i 0, i 0, i 0)'
FunctionEnd

Function FlexHubsFinishPageShowShortcutOptions
  StrCpy $FlexHubsLaunchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${NSD_CreateCheckbox} 120u 105u 240u 10u "Add a shortcut on the Desktop"
  Pop $FlexHubsDesktopShortcutCheckbox
  ${NSD_SetState} $FlexHubsDesktopShortcutCheckbox ${BST_CHECKED}

  ${NSD_CreateCheckbox} 120u 120u 240u 10u "Add a shortcut to the Start Menu"
  Pop $FlexHubsStartMenuShortcutCheckbox
  ${NSD_SetState} $FlexHubsStartMenuShortcutCheckbox ${BST_CHECKED}
FunctionEnd

Function FlexHubsFinishPageLeaveShortcutOptions
  StrCpy $FlexHubsLaunchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"

  ${NSD_GetState} $FlexHubsStartMenuShortcutCheckbox $FlexHubsStartMenuShortcutState
  ${If} $FlexHubsStartMenuShortcutState == ${BST_CHECKED}
    Call FlexHubsCreateStartMenuShortcut
  ${EndIf}

  ${NSD_GetState} $FlexHubsDesktopShortcutCheckbox $FlexHubsDesktopShortcutState
  ${If} $FlexHubsDesktopShortcutState == ${BST_CHECKED}
    Call FlexHubsCreateDesktopShortcut
  ${EndIf}
FunctionEnd

Function FlexHubsFinishPagePreCheck
  ${If} ${isUpdated}
    !insertmacro FlexHubsStartMenuLinkPath $R8
    ${IfNot} ${FileExists} "$R8"
      Call FlexHubsCreateStartMenuShortcut
    ${Else}
      StrCpy $FlexHubsLaunchLink "$R8"
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$FlexHubsLaunchLink" "open" "--updated"
    Abort
  ${EndIf}
FunctionEnd

!macro customFinishPage
  !ifndef HIDE_RUN_AFTER_FINISH
    Function StartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$FlexHubsLaunchLink" "open" "$1"
    FunctionEnd

    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_TEXT "Launch FlexHubs Desktop"
    !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !endif

  !define MUI_PAGE_CUSTOMFUNCTION_PRE FlexHubsFinishPagePreCheck
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW FlexHubsFinishPageShowShortcutOptions
  !define MUI_PAGE_CUSTOMFUNCTION_LEAVE FlexHubsFinishPageLeaveShortcutOptions
  !insertmacro MUI_PAGE_FINISH
!macroend
!endif

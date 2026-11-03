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

; Finish-page shortcuts use electron-builder link vars ($appExe, $newStartMenuLink, …).
; Those are not defined while BUILD_UNINSTALLER compiles the uninstaller stub (-WX treats warn 6000 as error).
!ifndef BUILD_UNINSTALLER
!include "LogicLib.nsh"
!include "nsDialogs.nsh"

Function FlexHubsCreateStartMenuShortcut
  !ifdef MENU_FILENAME
    CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
    ClearErrors
  !endif
  CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  StrCpy $launchLink "$newStartMenuLink"
FunctionEnd

Function FlexHubsCreateDesktopShortcut
  CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
  ClearErrors
  WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
  System::Call 'Shell32::SHChangeNotify(i 0x1002, i 0, i 0, i 0)'
FunctionEnd

Var FlexHubsDesktopShortcutCheckbox
Var FlexHubsStartMenuShortcutCheckbox
Var FlexHubsDesktopShortcutState
Var FlexHubsStartMenuShortcutState

Function FlexHubsFinishPageShowShortcutOptions
  ${NSD_CreateCheckbox} 120u 105u 240u 10u "Add a shortcut on the Desktop"
  Pop $FlexHubsDesktopShortcutCheckbox
  ${NSD_SetState} $FlexHubsDesktopShortcutCheckbox ${BST_CHECKED}

  ${NSD_CreateCheckbox} 120u 120u 240u 10u "Add a shortcut to the Start Menu"
  Pop $FlexHubsStartMenuShortcutCheckbox
  ${NSD_SetState} $FlexHubsStartMenuShortcutCheckbox ${BST_CHECKED}
FunctionEnd

Function FlexHubsFinishPageLeaveShortcutOptions
  ${NSD_GetState} $FlexHubsStartMenuShortcutCheckbox $FlexHubsStartMenuShortcutState
  ${If} $FlexHubsStartMenuShortcutState == ${BST_CHECKED}
    Call FlexHubsCreateStartMenuShortcut
  ${Else}
    StrCpy $launchLink "$appExe"
  ${EndIf}

  ${NSD_GetState} $FlexHubsDesktopShortcutCheckbox $FlexHubsDesktopShortcutState
  ${If} $FlexHubsDesktopShortcutState == ${BST_CHECKED}
    Call FlexHubsCreateDesktopShortcut
  ${EndIf}
FunctionEnd

Function FlexHubsFinishPagePreCheck
  ${If} ${isUpdated}
    ${IfNot} ${FileExists} "$newStartMenuLink"
      Call FlexHubsCreateStartMenuShortcut
    ${EndIf}
    ${If} ${FileExists} "$newStartMenuLink"
      StrCpy $launchLink "$newStartMenuLink"
    ${Else}
      StrCpy $launchLink "$appExe"
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "--updated"
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
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
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

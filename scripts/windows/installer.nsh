; FlexHubs Desktop — electron-builder NSIS hooks (see electron-builder.win.yml).

!macro customInstall
  ; Remove legacy Squirrel install folder only (userData in AppData\Roaming is kept).
  ReadEnvStr $0 LOCALAPPDATA
  IfFileExists "$0\FlexHubsDesktop\Update.exe" 0 legacyDone
    IfSilent silentLegacy interactiveLegacy
    silentLegacy:
      RMDir /r "$0\FlexHubsDesktop"
      Goto legacyDone
    interactiveLegacy:
      MessageBox MB_YESNO|MB_ICONQUESTION "An older FlexHubs install was found (previous installer).$\r$\n$\r$\nRemove it now? Your account data in AppData is not deleted." IDYES removeLegacy IDNO legacyDone
      removeLegacy:
        RMDir /r "$0\FlexHubsDesktop"
  legacyDone:
!macroend

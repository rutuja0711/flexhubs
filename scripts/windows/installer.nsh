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

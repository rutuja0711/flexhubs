# Installing FlexHubs Desktop (test / unsigned builds)

Unsigned builds trigger macOS Gatekeeper and Windows SmartScreen. **Right-click → Open** often fails if the file is still quarantined or the wrong file was opened.

Send testers **both** the build **and** the helper script from this repo.

---

## Mac — reliable method

### Before sending the app

1. From GitHub Actions, download **FlexHubs-Desktop-mac-universal** (zip).
2. Unzip on your Mac. Inside you should see **`FlexHubs Desktop.app`** (sometimes inside a folder like `FlexHubs Desktop-darwin-universal/`).
3. Zip **`FlexHubs Desktop.app`** + **`scripts/macos/open-flexhubs.command`** together and send that zip.

### Tester steps

1. **Unzip completely** — do not double-click the app while it is still inside the download zip.
2. Double-click **`open-flexhubs.command`** (not the app).
   - First time: **System Settings → Privacy & Security → Allow** running the helper script if asked.
3. If the app still will not open:
   - Open **System Settings → Privacy & Security**
   - Scroll down — click **Open Anyway** next to FlexHubs Desktop (appears after a blocked attempt).
4. **Manual fallback** (Terminal):

```bash
xattr -cr "/path/to/FlexHubs Desktop.app"
open "/path/to/FlexHubs Desktop.app"
```

Replace the path with where they unzipped the app (often `~/Downloads/FlexHubs Desktop.app`).

### Common Mac mistakes

| Mistake | Fix |
|--------|-----|
| Opening the `.zip` instead of unzipping | Unzip first |
| Right-clicking the zip | Right-click **`FlexHubs Desktop.app`** |
| App still quarantined | Run `xattr -cr` or use `open-flexhubs.command` |
| Only "Move to Bin" on dialog | Use helper script or **Open Anyway** in Settings |

---

## Windows — reliable method (Setup.exe)

### Before sending the app

1. Download **FlexHubs-Desktop-windows-x64** from GitHub Actions.
2. Send **`FlexHubs-Desktop-Setup.exe`** — a one-click Squirrel installer (no MSI “Change / Repair / Remove” wizard).
3. Optional portable build: **`win32-x64.zip`** in the same artifact (unzip and run `FlexHubs Desktop.exe` — no install).

### Tester steps

1. Download **`FlexHubs-Desktop-Setup.exe`**.
2. Double-click it and wait for install to finish (short splash, then FlexHubs opens).
3. Re-running the same installer **upgrades** the app in place — you will not see an MSI maintenance screen.
4. On the blue SmartScreen screen: **More info → Run anyway** (unsigned builds only).
5. If blocked by antivirus: add an exception for the installer or `%LocalAppData%\FlexHubsDesktop`.

### Windows Properties unblock

1. Right-click **`FlexHubs-Desktop-Setup.exe` → Properties**
2. On **General**, tick **Unblock** (if shown) → **OK**
3. Run the installer again.

### Common Windows mistakes

| Mistake | Fix |
|--------|-----|
| Using an old **`.msi`** from a previous build | Use **`FlexHubs-Desktop-Setup.exe`** from the latest CI artifact |
| “Change, repair, or remove” MSI screen | That is the old MSI installer — uninstall from Settings → Apps, then use **Setup.exe** |
| Company PC with strict policy | IT must allow the app, or use web app at flexhubs.in |
| SmartScreen with no "Run anyway" | Unblock in Properties; run as administrator |

---

## If nothing works for a tester

**Use the web app:** https://flexhubs.in — no install, no Gatekeeper/SmartScreen.

**Developers only:** clone the repo and run `npm install && npm start` — no packaged app needed.

---

## Permanent fix (no warnings for all users)

Sign and notarize Mac builds (Apple Developer, $99/yr) and sign Windows `Setup.exe` (code signing cert, ~$200–400/yr). Until then, use the helper scripts above.

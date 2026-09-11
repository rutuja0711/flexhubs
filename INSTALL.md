# Installing FlexHubs Desktop (test / unsigned builds)

Unsigned builds trigger macOS Gatekeeper and Windows SmartScreen. **Right-click → Open** often fails if the file is still quarantined or the wrong file was opened.

Official installers: **`FlexHubs-Desktop.dmg`** (Mac) and **`FlexHubs-Desktop-Setup.exe`** (Windows).

---

## Mac — DMG installer

### Download

GitHub → **Releases** → `desktop-latest` → **`FlexHubs-Desktop.dmg`**

### Tester steps

1. Open **`FlexHubs-Desktop.dmg`**.
2. Drag **FlexHubs Desktop** into **Applications**.
3. Open from **Applications** (first launch may show Gatekeeper).
4. If blocked: **System Settings → Privacy & Security → Open Anyway**.
5. **Manual fallback** (Terminal):

```bash
xattr -cr "/Applications/FlexHubs Desktop.app"
open "/Applications/FlexHubs Desktop.app"
```

### Common Mac mistakes

| Mistake | Fix |
|--------|-----|
| Running the app from inside the mounted DMG | Drag to **Applications** first |
| App still quarantined | Run `xattr -cr` on the installed app |
| Only "Move to Bin" on dialog | Use **Open Anyway** in Settings |

---

## Windows — reliable method (Setup.exe)

### Before sending the app

1. Open **GitHub → Releases → `desktop-latest`** (pre-release).
2. Download **`FlexHubs-Desktop-Setup.exe`** directly from the release assets (**recommended** — avoids Chrome blocking Actions artifact zips).
3. Fallback: GitHub Actions artifact **`FlexHubs-Desktop-Setup.exe`** (single installer file, not a portable zip).

Use **`FlexHubs-Desktop-Setup.exe`** only — no portable zip builds.

### Tester steps

1. Download **`FlexHubs-Desktop-Setup.exe`** from the **Releases** page (best) or the Actions artifact.
2. Double-click it and wait for install to finish (short splash, then FlexHubs opens).
3. Re-running the same installer **upgrades** the app in place.
4. On the blue SmartScreen screen: **More info → Run anyway** (unsigned builds only).
5. If blocked by antivirus: add an exception for the installer or `%LocalAppData%\FlexHubsDesktop`.

### Chrome says “Dangerous download blocked”

| Fix | How |
|-----|-----|
| **Use Releases (recommended)** | Repo → **Releases** → `desktop-latest` → download **FlexHubs-Desktop-Setup.exe** (direct file, not the Actions zip) |
| Use Edge or Firefox | Often allows the download when Chrome blocks it |
| Use GitHub CLI | `gh release download desktop-latest -p FlexHubs-Desktop-Setup.exe` |
| Permanent fix | **Code-sign** the Windows installer (paid cert) — then browsers trust it |

### Windows Properties unblock

1. Right-click **`FlexHubs-Desktop-Setup.exe` → Properties**
2. On **General**, tick **Unblock** (if shown) → **OK**
3. Run the installer again.

### Common Windows mistakes

| Mistake | Fix |
|--------|-----|
| Downloading **`FlexHubs-Desktop-windows-x64.zip`** from old builds | Use **`FlexHubs-Desktop-Setup.exe`** from Releases |
| Using an old **`.msi`** | Uninstall from Settings → Apps, then use **Setup.exe** |
| “Change, repair, or remove” MSI screen | Old MSI installer — use **Setup.exe** instead |
| Company PC with strict policy | IT must allow the app, or use web app at flexhubs.in |
| SmartScreen with no "Run anyway" | Unblock in Properties; run as administrator |

---

## If nothing works for a tester

**Use the web app:** https://flexhubs.in — no install, no Gatekeeper/SmartScreen.

**Developers only:** clone the repo and run `npm install && npm start` — no packaged app needed.

---

## Permanent fix (no warnings for all users)

Follow **[SIGNING.md](./SIGNING.md)** to add Apple + Windows code signing secrets to GitHub Actions. CI will then publish signed `FlexHubs-Desktop.dmg` and `FlexHubs-Desktop-Setup.exe` without Gatekeeper/SmartScreen warnings.

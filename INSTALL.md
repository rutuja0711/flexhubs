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
2. Double-click it and wait for install to finish (FlexHubs-branded splash, then FlexHubs opens).
3. The installer adds **Start Menu** and **Desktop** shortcuts automatically.
4. Re-running the same installer **upgrades** the app in place.
5. On the blue SmartScreen screen: **More info → Run anyway** (unsigned builds only).
6. If blocked by antivirus: add an exception for the installer or `%LocalAppData%\FlexHubsDesktop`.

**Note:** Squirrel installs per-user to `%LocalAppData%\FlexHubsDesktop`. There is no custom install-path wizard.

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

---

## Production install experience

| Platform | Installer | Terms & path |
|----------|-----------|----------------|
| **macOS** | `FlexHubs-Desktop.dmg` — drag to Applications | No separate installer wizard. **First app launch** shows FlexHubs Terms & Privacy acceptance (packaged builds only). |
| **Windows** | `FlexHubs-Desktop-Setup.exe` (Squirrel) | Per-user install to `%LocalAppData%\FlexHubsDesktop` — **no custom install folder wizard** (Squirrel limitation). **First app launch** shows the same terms acceptance. |

## Build installers (developers)

### Prerequisites

- **Node.js 20** and **npm**
- Repo cloned, then from the project root:

```bash
npm ci
```

Optional (CI / production API): set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the environment before `make` if your build pipeline requires them (GitHub Actions uses repository secrets).

### Mac DMG (on a Mac)

```bash
npm run make:mac
```

**Output:** `out/make/FlexHubs-Desktop.dmg` (~190 MB, universal Intel + Apple Silicon)

**Share with testers:** send only the `.dmg` file. They drag **FlexHubs Desktop** into **Applications** (see Mac steps above). First launch shows in-app Terms & Privacy (packaged builds).

Unsigned builds: testers may need **Open Anyway** or `xattr -cr` (see Mac table above). For no Gatekeeper prompts, configure signing per **[SIGNING.md](./SIGNING.md)**.

### Windows Setup.exe (cannot be built on Mac)

Squirrel.Windows installers must be built on **Windows** or in **GitHub Actions**:

**On a Windows PC:**

```bash
npm ci
npm run make:win
```

**Output:** `out/make/squirrel.windows/x64/FlexHubs-Desktop-Setup.exe` (name may match `setupExe` in `forge.config.ts`)

**From CI (recommended):** push to **`main`** (or run **Build Desktop App** workflow manually). Artifacts are uploaded to the GitHub Release tag **`desktop-latest`**:

| File | Platform |
|------|----------|
| `FlexHubs-Desktop.dmg` | macOS |
| `FlexHubs-Desktop-Setup.exe` | Windows |

Download from: **GitHub → Releases → `desktop-latest`**.

### What a proper release includes

1. **Mac:** `FlexHubs-Desktop.dmg` only (not the `.app` from `out/` alone).
2. **Windows:** `FlexHubs-Desktop-Setup.exe` only (not old `.msi` or portable zips).
3. **First run:** legal gate + login; mic/camera/screen permissions when using calls.
4. **Updates:** app checks for updates via `electron-updater` (GitHub releases when configured).

Legal copy for installers is in `assets/desktop-eula.txt`.

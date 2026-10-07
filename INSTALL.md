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
| `FlexHubs-Desktop.dmg` | macOS (manual install) |
| `FlexHubs-Desktop-mac.zip` | macOS (in-app auto-update) |
| `latest-mac.yml` | macOS update metadata |
| `FlexHubs-Desktop-Setup.exe` | Windows |
| `latest.yml` | Windows update metadata |

Download from: **GitHub → Releases → `desktop-latest`**.

### What a proper release includes

1. **Mac:** `FlexHubs-Desktop.dmg` for first install; CI also uploads `FlexHubs-Desktop-mac.zip` + `latest-mac.yml` for Update Center.
2. **Windows:** `FlexHubs-Desktop-Setup.exe` + `latest.yml` (not old `.msi` or portable zips).
3. **First run:** legal gate + login; mic/camera/screen permissions when using calls.
4. **Updates:** installed builds check **`desktop-latest`** on GitHub via `electron-updater`. Bump **`version`** in `package.json` before merging when you want users to see a new version (same version → “up to date” even if CI rebuilt).

CI generates `latest-mac.yml` / `latest.yml` with `scripts/ci/generate-updater-metadata.mjs` after each successful `make`.

---

## Voice & video calls (production vs `npm start`)

Calls need **two** things that `npm start` often has but a **downloaded DMG/Setup.exe** may not:

| Requirement | Local dev (`npm start`) | Production installer |
|-------------|-------------------------|---------------------|
| **Supabase realtime (call invites / ringing)** | Usually from your repo **`.env`**: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (same as the web app’s `NEXT_PUBLIC_SUPABASE_*`) | Baked in at **build time**. GitHub Actions must set repository secrets **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** before `npm run make:mac` / `make:win`. If those secrets are missing, chat may work but **calls fail** with a generic error. |
| **Call media token** | `POST https://flexhubs.in/api/calls/token` (or your `VITE_API_BASE_URL`) | Same API — production app uses `https://flexhubs.in/api` unless the build injected another base URL. |
| **Microphone / camera** | macOS prompts **Electron** | Packaged app prompts **FlexHubs Desktop** — enable in **System Settings → Privacy & Security → Microphone / Camera**. |

**If calls work locally but not from the installed app:**

1. Confirm GitHub repo **Settings → Secrets and variables → Actions** includes `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (copy from the web app env).
2. Push to `main` (or re-run **Build Desktop App**) so a **new** `desktop-latest` release is produced, then reinstall.
3. On Mac, allow **FlexHubs Desktop** (not Electron) for mic/camera.
4. Optional: your API can return `supabaseUrl` and `supabaseAnonKey` in the **`GET /realtime/token`** JSON so desktop builds work even without baked-in env vars.

**Quick local production test:** `VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... npm run make:mac` and install that DMG — if calls work, CI secrets were the issue.

Legal copy for installers is in `assets/desktop-eula.txt`.

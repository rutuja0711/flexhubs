# Code signing (remove install warnings)

macOS Gatekeeper and Windows SmartScreen **only trust signed builds**. There is no code-only workaround — you must sign the app in CI.

After you add the GitHub secrets below, CI builds **`FlexHubs-Desktop.dmg`** and **`FlexHubs-Desktop-Setup.exe`** as signed (Mac also notarized).

## 1. Apple (Mac DMG)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Create a **Developer ID Application** certificate in Xcode or [Certificates portal](https://developer.apple.com/account/resources/certificates/list).
3. Export it as **`.p12`** from Keychain Access (remember the export password).
4. Create an [App Store Connect API key](https://appstoreconnect.apple.com/access/integrations/api) (recommended) **or** an [app-specific password](https://appleid.apple.com) for notarization.

### GitHub secrets (Mac)

| Secret | Value |
|--------|--------|
| `MACOS_CERTIFICATE` | Base64 of your `.p12` file: `base64 -i cert.p12 \| pbcopy` |
| `MACOS_CERTIFICATE_PASSWORD` | Password you set when exporting `.p12` |
| `KEYCHAIN_PASSWORD` | Any random string (e.g. `actions`) |
| `APPLE_KEY_ID` | App Store Connect API Key ID |
| `APPLE_ISSUER_ID` | App Store Connect Issuer ID |
| `APPLE_API_KEY_BASE64` | Base64 of the `.p8` API key file |

**Alternative (Apple ID notarization):** use `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` instead of the API key trio.

Optional: `MAC_DEVELOPER_IDENTITY` = exact cert name, e.g. `Developer ID Application: Flexodyn Solutions (TEAMID)`.

## 2. Windows (Setup.exe)

1. Buy a **Code Signing** certificate (Standard or EV) from DigiCert, Sectigo, etc.
2. Export as **`.pfx`** with a password.

### GitHub secrets (Windows)

| Secret | Value |
|--------|--------|
| `WINDOWS_CERTIFICATE` | Base64 of your `.pfx`: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('cert.pfx'))` |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX export password |

SmartScreen reputation may take time with a new cert; **EV** certs get trust faster.

## 3. Enable signed releases

1. Repo → **Settings → Secrets and variables → Actions** → add the secrets above.
2. Push to `main` (or run **Build Desktop App** workflow manually).
3. Download from **Releases → `desktop-latest`**.

CI verifies signatures before publishing. If secrets are missing, builds stay **unsigned** and users still see warnings.

## Local signed build

```bash
# Mac — import cert to Keychain first, then:
export APPLE_API_KEY=/path/to/AuthKey.p8
export APPLE_KEY_ID=...
export APPLE_ISSUER_ID=...
npm run make:mac

# Windows — set cert path:
set WINDOWS_CERTIFICATE_FILE=C:\path\to\cert.pfx
set WINDOWS_CERTIFICATE_PASSWORD=...
npm run make:win
```

Skip signing locally: `SKIP_CODE_SIGNING=true npm run make`

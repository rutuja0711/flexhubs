# Copies the NSIS installer (FlexHubs-Setup.exe), never the app exe (FlexHubs Desktop.exe).
$ErrorActionPreference = "Stop"

$setupDir = Join-Path $PWD "out/make/nsis"
$dest = Join-Path $PWD "out/FlexHubs-Setup.exe"

if (-not (Test-Path $setupDir)) {
  throw "NSIS output not found at $setupDir — run npm run make:win first."
}

$installerName = "FlexHubs-Setup.exe"
$installer = Join-Path $setupDir $installerName

if (-not (Test-Path $installer)) {
  $fallback = Get-ChildItem -Path $setupDir -Filter "*Setup*.exe" -File |
    Where-Object { $_.Name -ne "FlexHubs Desktop.exe" } |
    Select-Object -First 1
  if ($fallback) {
    $installer = $fallback.FullName
    Write-Host "Using installer: $($fallback.Name)"
  } else {
    Get-ChildItem -Path $setupDir -Filter "*.exe" | ForEach-Object { Write-Host "  found: $($_.Name)" }
    throw "Installer not found. Expected $installerName under $setupDir"
  }
}

$leaf = Split-Path -Leaf $installer
if ($leaf -eq "FlexHubs Desktop.exe" -or $leaf -eq "Update.exe") {
  throw "Refusing to stage app/update exe as installer: $leaf"
}

New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
Copy-Item -Path $installer -Destination $dest -Force
Write-Host "Staged installer: $installer -> $dest"

$prepackaged = Get-ChildItem -Path (Join-Path $PWD "out") -Directory |
  Where-Object { $_.Name -match "win32" } |
  Select-Object -First 1

if ($prepackaged) {
  $appExe = Join-Path $prepackaged.FullName "FlexHubs Desktop.exe"
  if (Test-Path $appExe) {
    $setupSize = (Get-Item $dest).Length
    $appSize = (Get-Item $appExe).Length
    $minSetupBytes = 20MB

    if ($setupSize -lt $minSetupBytes) {
      throw "Staged file looks too small to be NSIS Setup.exe (setup=$setupSize bytes, minimum=$minSetupBytes). Wrong file copied?"
    }

    # NSIS Setup.exe is LZMA-compressed; it is often well under half the raw app exe size.
    if ($setupSize -lt ($appSize * 0.15)) {
      throw "Staged installer is suspiciously small vs app exe (setup=$setupSize app=$appSize). Wrong file copied?"
    }

    Write-Host "Installer size check OK (setup=$setupSize appExe=$appSize)"
  }
}

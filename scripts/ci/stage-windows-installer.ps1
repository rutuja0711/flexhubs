# Copies the Squirrel *installer* (FlexHubs-Desktop-Setup.exe), never the app exe (FlexHubs Desktop.exe).
$ErrorActionPreference = "Stop"

$setupDir = Join-Path $PWD "out/make/squirrel.windows/x64"
$dest = Join-Path $PWD "out/FlexHubs-Desktop-Setup.exe"

if (-not (Test-Path $setupDir)) {
  throw "Squirrel output not found at $setupDir — run npm run make:win first."
}

$installerName = "FlexHubs-Desktop-Setup.exe"
$installer = Join-Path $setupDir $installerName

if (-not (Test-Path $installer)) {
  $fallback = Get-ChildItem -Path $setupDir -Filter "*-Setup.exe" -File |
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

$appExe = Join-Path $setupDir "FlexHubs Desktop.exe"
if (Test-Path $appExe) {
  $setupSize = (Get-Item $dest).Length
  $appSize = (Get-Item $appExe).Length
  if ($setupSize -lt ($appSize * 0.5)) {
    throw "Staged file looks too small to be Squirrel Setup.exe (setup=$setupSize app=$appSize). Wrong file copied?"
  }
}

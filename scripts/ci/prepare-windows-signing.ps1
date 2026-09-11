if (-not $env:WINDOWS_CERTIFICATE) {
  Write-Host "WINDOWS_CERTIFICATE secret is not set — Windows build will be unsigned."
  exit 0
}

if (-not $env:WINDOWS_CERTIFICATE_PASSWORD) {
  Write-Error "WINDOWS_CERTIFICATE_PASSWORD secret is not set."
  exit 1
}

$pfxPath = Join-Path $PWD "certificate.pfx"
[IO.File]::WriteAllBytes($pfxPath, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE))
Add-Content -Path $env:GITHUB_ENV -Value "WINDOWS_CERTIFICATE_FILE=$pfxPath"
Add-Content -Path $env:GITHUB_ENV -Value "WINDOWS_CERTIFICATE_PASSWORD=$($env:WINDOWS_CERTIFICATE_PASSWORD)"
Write-Host "Windows signing certificate staged at $pfxPath"

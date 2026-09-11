$installer = Join-Path $PWD "out/FlexHubs-Desktop-Setup.exe"

if (-not (Test-Path $installer)) {
  Write-Error "Installer not found at $installer"
  exit 1
}

$signature = Get-AuthenticodeSignature -FilePath $installer
Write-Host "Signature status: $($signature.Status)"
Write-Host "Signer: $($signature.SignerCertificate.Subject)"

if ($signature.Status -ne "Valid") {
  Write-Error "Windows installer is unsigned or signature is invalid. Add signing secrets from SIGNING.md."
  exit 1
}

Write-Host "Windows installer is Authenticode signed."

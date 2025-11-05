# PowerShell script to create self-signed certificate for localhost
# Run as Administrator: Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

Write-Host "Creating self-signed certificate for localhost..." -ForegroundColor Green

# Create certificate
$cert = New-SelfSignedCertificate `
    -DnsName "localhost" `
    -CertStoreLocation "cert:\CurrentUser\My" `
    -FriendlyName "Finance Manager Local Dev" `
    -NotAfter (Get-Date).AddYears(1) `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -KeyUsage DigitalSignature, KeyEncipherment

Write-Host "Certificate created: $($cert.Thumbprint)" -ForegroundColor Green

# Export certificate and private key to PEM format
$certPath = "$PSScriptRoot\localhost.pfx"
$password = ConvertTo-SecureString -String "finance123" -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $certPath -Password $password

Write-Host "Certificate exported to: $certPath" -ForegroundColor Green
Write-Host ""
Write-Host "To convert to .crt and .key format, you can use OpenSSL:" -ForegroundColor Yellow
Write-Host "openssl pkcs12 -in localhost.pfx -nocerts -nodes -out localhost.key -passin pass:finance123" -ForegroundColor Cyan
Write-Host "openssl pkcs12 -in localhost.pfx -clcerts -nokeys -out localhost.crt -passin pass:finance123" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or use the alternative method with OpenSSL directly..." -ForegroundColor Yellow


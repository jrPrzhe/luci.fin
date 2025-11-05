"""
Run backend with HTTPS for Telegram Mini App development
"""
import uvicorn
import ssl
import os
from pathlib import Path

if __name__ == "__main__":
    # Path to certificate files
    cert_dir = Path(__file__).parent
    cert_file = cert_dir / "localhost.crt"
    key_file = cert_dir / "localhost.key"
    
    # Check if certificate files exist
    if not cert_file.exists() or not key_file.exists():
        print("❌ SSL certificate files not found!")
        print(f"   Expected: {cert_file}")
        print(f"   Expected: {key_file}")
        print()
        print("To create certificates, run:")
        print("   Windows (PowerShell as Admin):")
        print("      .\\create_cert.ps1")
        print()
        print("   Or use OpenSSL:")
        print("      create_cert_openssl.bat")
        print("      (or manually: openssl req -x509 -newkey rsa:2048 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj '/CN=localhost')")
        exit(1)
    
    print("🔒 Starting backend with HTTPS...")
    print(f"📍 Certificate: {cert_file}")
    print(f"🔑 Key file: {key_file}")
    print()
    print("⚠️  Browser will show security warning - this is normal for self-signed certificates")
    print("   Click 'Advanced' -> 'Proceed to localhost' to continue")
    print()
    print("🌐 Backend will be available at: https://localhost:8443")
    print("📚 API docs: https://localhost:8443/docs")
    print()
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8443,
        ssl_keyfile=str(key_file),
        ssl_certfile=str(cert_file),
        reload=True,
        log_level="info"
    )


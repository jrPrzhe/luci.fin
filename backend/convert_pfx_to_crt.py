"""
Convert .pfx certificate to .crt and .key files for uvicorn
"""
import sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography import x509
except ImportError:
    print("Installing cryptography library...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cryptography"])
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.serialization import pkcs12
    from cryptography import x509

def convert_pfx_to_crt_key(pfx_path: str, password: str, output_dir: str = None):
    """Convert .pfx file to .crt and .key files"""
    pfx_file = Path(pfx_path)
    
    if not pfx_file.exists():
        print(f"ERROR: File not found: {pfx_path}")
        return False
    
    if output_dir is None:
        output_dir = pfx_file.parent
    else:
        output_dir = Path(output_dir)
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Read PFX file
    with open(pfx_file, 'rb') as f:
        pfx_data = f.read()
    
    # Load PFX
    try:
        private_key, certificate, additional_certificates = pkcs12.load_key_and_certificates(
            pfx_data,
            password.encode('utf-8')
        )
    except Exception as e:
        print(f"ERROR: Error loading PFX file: {e}")
        print("   Make sure the password is correct")
        return False
    
    if certificate is None or private_key is None:
        print("ERROR: Could not extract certificate or private key from PFX")
        return False
    
    # Write certificate (.crt)
    cert_path = output_dir / "localhost.crt"
    with open(cert_path, 'wb') as f:
        f.write(certificate.public_bytes(serialization.Encoding.PEM))
    
    # Write private key (.key)
    key_path = output_dir / "localhost.key"
    with open(key_path, 'wb') as f:
        f.write(private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ))
    
    print("Certificate converted successfully!")
    print(f"   Certificate: {cert_path}")
    print(f"   Private key: {key_path}")
    return True

if __name__ == "__main__":
    pfx_file = "localhost.pfx"
    password = "finance123"
    
    if len(sys.argv) > 1:
        pfx_file = sys.argv[1]
    if len(sys.argv) > 2:
        password = sys.argv[2]
    
    success = convert_pfx_to_crt_key(pfx_file, password)
    sys.exit(0 if success else 1)


#!/usr/bin/env python3
"""
Скрипт для применения миграций Alembic
Работает как локально, так и в Railway
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from alembic import command
from alembic.config import Config

def main():
    # Find alembic.ini - try multiple locations
    alembic_ini_paths = [
        "alembic.ini",  # Current directory (Railway: /app)
        "backend/alembic.ini",  # From project root
        os.path.join(os.path.dirname(__file__), "alembic.ini"),  # Relative to script
    ]
    
    alembic_ini = None
    for path in alembic_ini_paths:
        if os.path.exists(path):
            alembic_ini = path
            print(f"✅ Found alembic.ini at: {path}")
            break
    
    if not alembic_ini:
        print("❌ Could not find alembic.ini")
        print(f"   Searched in: {alembic_ini_paths}")
        print(f"   Current directory: {os.getcwd()}")
        print(f"   Script directory: {os.path.dirname(__file__)}")
        sys.exit(1)
    
    # Create config
    cfg = Config(alembic_ini)
    
    # Override script location if needed
    script_location = cfg.get_main_option("script_location")
    if script_location == "alembic":
        # Check if alembic directory exists relative to alembic.ini
        alembic_dir = os.path.join(os.path.dirname(alembic_ini), "alembic")
        if os.path.exists(alembic_dir):
            cfg.set_main_option("script_location", alembic_dir)
            print(f"✅ Using script location: {alembic_dir}")
        else:
            # Try backend/alembic
            backend_alembic = os.path.join(os.path.dirname(os.path.dirname(alembic_ini)), "backend", "alembic")
            if os.path.exists(backend_alembic):
                cfg.set_main_option("script_location", backend_alembic)
                print(f"✅ Using script location: {backend_alembic}")
    
    print("🚀 Running database migrations...")
    try:
        command.upgrade(cfg, "head")
        print("✅ Migrations applied successfully!")
    except Exception as e:
        print(f"❌ Error applying migrations: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()








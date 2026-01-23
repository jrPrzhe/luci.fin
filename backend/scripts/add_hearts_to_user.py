"""
Добавляет сердца пользователю до максимума 100.
Usage:
  python backend/scripts/add_hearts_to_user.py @username
  python backend/scripts/add_hearts_to_user.py telegram_username
  python backend/scripts/add_hearts_to_user.py user@example.com
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from typing import Optional
from sqlalchemy import or_
from app.core.database import SessionLocal
from app.models.user import User
from app.api.v1.gamification import get_or_create_profile


def find_user(db, identifier: str) -> Optional[User]:
    value = identifier.strip()
    if value.startswith("@"):
        value = value[1:]

    return db.query(User).filter(
        or_(
            User.telegram_username == value,
            User.username == value,
            User.email == value,
        )
    ).first()


def main() -> None:
    identifier = None
    if len(sys.argv) >= 2:
        identifier = sys.argv[1]
    else:
        # PowerShell treats @name specially; allow interactive input
        identifier = input("Enter @username or email: ").strip()
        if not identifier:
            print("Usage: python backend/scripts/add_hearts_to_user.py <@username|email>")
            sys.exit(1)
    db = SessionLocal()
    try:
        user = find_user(db, identifier)
        if not user:
            print(f"❌ User not found: {identifier}")
            sys.exit(1)

        profile = get_or_create_profile(user.id, db)
        before = profile.heart_level or 0
        target = 100
        after = target if before < target else before
        profile.heart_level = after
        db.commit()

        added = max(0, after - before)
        print(
            f"✅ Updated hearts for user {user.id} ({user.telegram_username or user.username or user.email}) "
            f"from {before} to {after} (+{added})"
        )
    except Exception as exc:
        db.rollback()
        print(f"❌ Error: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Delete user(s) and related data from the database.

Usage examples:
  python backend/scripts/delete_user.py --vk-id 144352158 --yes
  python backend/scripts/delete_user.py --telegram-id 123456789 --yes
  python backend/scripts/delete_user.py --email user@example.com --yes
  python backend/scripts/delete_user.py --user-id 42 --yes
  python backend/scripts/delete_user.py --vk-id 144352158 --dry-run
"""
import argparse
import sys
from typing import List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models.user import User
from app.models.transaction import Transaction, transaction_tags
from app.models.account import Account
from app.models.category import Category
from app.models.tag import Tag
from app.models.report import Report
from app.models.goal import Goal
from app.models.notification import Notification
from app.models.biography import Biography, BiographyCategoryLimit, QuestionnaireResponse
from app.models.gamification import UserGamificationProfile, UserAchievement, UserDailyQuest
from app.models.shared_budget import SharedBudgetMember, SharedBudget


def find_users(db: Session, args: argparse.Namespace) -> List[User]:
    query = db.query(User)
    filters = []

    if args.user_id:
        filters.append(User.id == args.user_id)
    if args.email:
        filters.append(User.email == args.email)
    if args.username:
        filters.append(User.username == args.username)
    if args.vk_id:
        filters.append(User.vk_id == str(args.vk_id))
    if args.telegram_id:
        filters.append(User.telegram_id == str(args.telegram_id))

    if not filters:
        raise ValueError("At least one filter must be provided.")

    # Combine filters with OR to allow any matching identifier
    from sqlalchemy import or_
    return query.filter(or_(*filters)).all()


def delete_user_data(db: Session, user_id: int) -> None:
    # Delete transaction tags first (many-to-many)
    db.execute(
        transaction_tags.delete().where(
            transaction_tags.c.transaction_id.in_(
                select(Transaction.id).where(Transaction.user_id == user_id)
            )
        )
    )

    # Delete dependent data
    db.query(Transaction).filter(Transaction.user_id == user_id).delete(synchronize_session=False)
    db.query(Report).filter(Report.user_id == user_id).delete(synchronize_session=False)
    db.query(Goal).filter(Goal.user_id == user_id).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)

    # Biography and related
    biography_ids = select(Biography.id).where(Biography.user_id == user_id)
    db.query(BiographyCategoryLimit).filter(
        BiographyCategoryLimit.biography_id.in_(biography_ids)
    ).delete(synchronize_session=False)
    db.query(QuestionnaireResponse).filter(
        QuestionnaireResponse.biography_id.in_(biography_ids)
    ).delete(synchronize_session=False)
    db.query(Biography).filter(Biography.user_id == user_id).delete(synchronize_session=False)

    # Gamification
    profile_ids = select(UserGamificationProfile.id).where(UserGamificationProfile.user_id == user_id)
    db.query(UserAchievement).filter(UserAchievement.profile_id.in_(profile_ids)).delete(synchronize_session=False)
    db.query(UserDailyQuest).filter(UserDailyQuest.profile_id.in_(profile_ids)).delete(synchronize_session=False)
    db.query(UserGamificationProfile).filter(UserGamificationProfile.user_id == user_id).delete(synchronize_session=False)

    # Categories, tags, accounts
    db.query(Category).filter(Category.user_id == user_id).delete(synchronize_session=False)
    db.query(Tag).filter(Tag.user_id == user_id).delete(synchronize_session=False)
    db.query(Account).filter(Account.user_id == user_id).delete(synchronize_session=False)

    # Shared budgets (membership and created budgets)
    db.query(SharedBudgetMember).filter(SharedBudgetMember.user_id == user_id).delete(synchronize_session=False)
    db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id.in_(
            select(SharedBudget.id).where(SharedBudget.created_by == user_id)
        )
    ).delete(synchronize_session=False)
    db.query(SharedBudget).filter(SharedBudget.created_by == user_id).delete(synchronize_session=False)

    # Finally, delete user
    db.query(User).filter(User.id == user_id).delete(synchronize_session=False)


def main() -> int:
    parser = argparse.ArgumentParser(description="Delete user(s) and related data")
    parser.add_argument("--user-id", type=int, help="User ID")
    parser.add_argument("--email", type=str, help="User email")
    parser.add_argument("--username", type=str, help="Username")
    parser.add_argument("--vk-id", type=str, help="VK ID")
    parser.add_argument("--telegram-id", type=str, help="Telegram ID")
    parser.add_argument("--dry-run", action="store_true", help="Only show users to delete")
    parser.add_argument("--yes", action="store_true", help="Confirm deletion")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        users = find_users(db, args)
        if not users:
            print("No users matched the provided filters.")
            return 0

        print("Matched users:")
        for user in users:
            print(
                f"- id={user.id} email={user.email} username={user.username} "
                f"telegram_id={user.telegram_id} vk_id={user.vk_id}"
            )

        if args.dry_run:
            print("Dry run enabled. No changes were made.")
            return 0

        if not args.yes:
            print("Refusing to delete without --yes.")
            return 2

        for user in users:
            delete_user_data(db, user.id)

        db.commit()
        print(f"Deleted {len(users)} user(s) and related data.")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Error while deleting user(s): {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())


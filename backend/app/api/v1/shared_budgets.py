from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_db
from app.api.v1.auth import get_current_user
from app.models.user import User
from app.models.shared_budget import SharedBudget, SharedBudgetMember, MemberRole
from app.models.invitation import Invitation, InvitationStatus
from app.models.transaction import Transaction
from app.schemas.shared_budget import (
    SharedBudgetCreate, 
    SharedBudgetUpdate, 
    SharedBudgetResponse,
    AddMemberRequest,
    MemberResponse
)
from app.core.config import settings
import logging
import httpx
import secrets
import string
from datetime import datetime, timedelta

router = APIRouter()
logger = logging.getLogger(__name__)


class InvitationResponse(BaseModel):
    id: int
    token: str
    shared_budget_id: int
    shared_budget_name: str
    invited_by_user_id: int
    invited_by_name: str
    email: Optional[str] = None
    telegram_id: Optional[str] = None
    role: str
    status: str
    message: Optional[str] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class InvitationAcceptRequest(BaseModel):
    token: Optional[str] = None
    invite_code: Optional[str] = None  # Can accept by token (old way) or invite_code (new way)


def generate_invite_code(length: int = 6) -> str:
    """Generate a short, user-friendly invite code"""
    # Use uppercase letters and numbers, excluding confusing characters (0, O, I, 1)
    alphabet = string.ascii_uppercase.replace('O', '').replace('I', '') + string.digits.replace('0', '').replace('1', '')
    return ''.join(secrets.choice(alphabet) for _ in range(length))


async def send_telegram_message(telegram_id: str, message: str) -> bool:
    """Send message to Telegram user via Bot API"""
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN not configured, cannot send Telegram message")
        return False
    
    try:
        url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": telegram_id,
            "text": message,
            "parse_mode": "HTML"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            if response.status_code == 200:
                logger.info(f"Telegram message sent to {telegram_id}")
                return True
            else:
                logger.error(f"Failed to send Telegram message: {response.status_code}, {response.text}")
                return False
    except Exception as e:
        logger.error(f"Error sending Telegram message: {e}", exc_info=True)
        return False


@router.get("/", response_model=List[SharedBudgetResponse])
async def get_shared_budgets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all shared budgets where current user is a member"""
    memberships = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.user_id == current_user.id
    ).all()
    
    budget_ids = [m.shared_budget_id for m in memberships]
    budgets = db.query(SharedBudget).filter(
        SharedBudget.id.in_(budget_ids),
        SharedBudget.is_active == True
    ).all()
    
    result = []
    for budget in budgets:
        # Generate invite_code if missing (for old records)
        if not budget.invite_code:
            invite_code = generate_invite_code()
            while db.query(SharedBudget).filter(SharedBudget.invite_code == invite_code).first():
                invite_code = generate_invite_code()
            budget.invite_code = invite_code
            db.commit()
            db.refresh(budget)
        
        member_count = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget.id
        ).count()
        
        result.append({
            "id": budget.id,
            "name": budget.name,
            "description": budget.description,
            "currency": budget.currency,
            "created_by": budget.created_by,
            "invite_code": budget.invite_code,
            "is_active": budget.is_active,
            "created_at": budget.created_at,
            "updated_at": budget.updated_at,
            "member_count": member_count
        })
    
    return result


@router.post("/", response_model=SharedBudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_shared_budget(
    budget_data: SharedBudgetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new shared budget"""
    # Generate unique invite code
    invite_code = generate_invite_code()
    # Ensure uniqueness
    while db.query(SharedBudget).filter(SharedBudget.invite_code == invite_code).first():
        invite_code = generate_invite_code()
    
    budget = SharedBudget(
        created_by=current_user.id,
        name=budget_data.name,
        description=budget_data.description,
        currency=budget_data.currency,
        invite_code=invite_code,
        is_active=True
    )
    
    db.add(budget)
    db.flush()  # Flush to get budget.id
    
    # Add creator as admin member
    creator_member = SharedBudgetMember(
        shared_budget_id=budget.id,
        user_id=current_user.id,
        role=MemberRole.ADMIN,
        can_view_private_transactions=True
    )
    db.add(creator_member)
    db.commit()
    db.refresh(budget)
    
    member_count = 1
    return {
        "id": budget.id,
        "name": budget.name,
        "description": budget.description,
        "currency": budget.currency,
        "created_by": budget.created_by,
        "invite_code": budget.invite_code,
        "is_active": budget.is_active,
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
        "member_count": member_count
    }


@router.get("/{budget_id}", response_model=SharedBudgetResponse)
async def get_shared_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get shared budget details"""
    # Check if user is a member
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этому бюджету"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Generate invite_code if missing (for old records)
    if not budget.invite_code:
        invite_code = generate_invite_code()
        while db.query(SharedBudget).filter(SharedBudget.invite_code == invite_code).first():
            invite_code = generate_invite_code()
        budget.invite_code = invite_code
        db.commit()
        db.refresh(budget)
    
    member_count = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget.id
    ).count()
    
    return {
        "id": budget.id,
        "name": budget.name,
        "description": budget.description,
        "currency": budget.currency,
        "created_by": budget.created_by,
        "invite_code": budget.invite_code,
        "is_active": budget.is_active,
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
        "member_count": member_count
    }


@router.get("/{budget_id}/members", response_model=List[MemberResponse])
async def get_budget_members(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all members of a shared budget"""
    # Check if user is a member
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="У вас нет доступа к этому бюджету"
        )
    
    members = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id
    ).all()
    
    result = []
    for member in members:
        user = db.query(User).filter(User.id == member.user_id).first()
        result.append({
            "id": member.id,
            "shared_budget_id": member.shared_budget_id,
            "user_id": member.user_id,
            "role": member.role.value,
            "joined_at": member.joined_at,
            "user_email": user.email if user else None,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username if user else None
        })
    
    return result


@router.get("/{budget_id}/invite-code", response_model=dict)
async def get_invite_code(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get invite code for a budget"""
    # Check if user is admin
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not membership or membership.role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут просматривать код приглашения"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    return {
        "invite_code": budget.invite_code,
        "budget_name": budget.name
    }


@router.post("/{budget_id}/regenerate-invite-code", response_model=dict)
async def regenerate_invite_code(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Regenerate invite code for a budget"""
    # Check if user is admin
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not membership or membership.role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут перегенерировать код приглашения"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Generate new unique code
    invite_code = generate_invite_code()
    while db.query(SharedBudget).filter(SharedBudget.invite_code == invite_code).first():
        invite_code = generate_invite_code()
    
    budget.invite_code = invite_code
    db.commit()
    db.refresh(budget)
    
    return {
        "invite_code": budget.invite_code,
        "budget_name": budget.name
    }


@router.post("/{budget_id}/invite", response_model=InvitationResponse)
async def invite_member(
    budget_id: int,
    invite_data: AddMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Invite a user to join the shared budget"""
    # Check if current user is admin
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not membership or membership.role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут приглашать участников"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Find user by email or telegram_id
    invited_user = None
    if invite_data.email:
        invited_user = db.query(User).filter(User.email == invite_data.email).first()
    elif invite_data.telegram_id:
        invited_user = db.query(User).filter(User.telegram_id == invite_data.telegram_id).first()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо указать email или telegram_id"
        )
    
    # Check if user is already a member
    if invited_user:
        existing_member = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id,
            SharedBudgetMember.user_id == invited_user.id
        ).first()
        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь уже является участником этого бюджета"
            )
    
    # Create invitation
    invitation = Invitation(
        shared_budget_id=budget_id,
        invited_by_user_id=current_user.id,
        invited_user_id=invited_user.id if invited_user else None,
        email=invite_data.email,
        telegram_id=invite_data.telegram_id,
        role=invite_data.role or "member",
        status=InvitationStatus.PENDING,
        expires_at=datetime.utcnow() + timedelta(days=7)  # Expires in 7 days
    )
    
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    
    # Send Telegram notification if user has telegram_id
    if invited_user and invited_user.telegram_id:
        inviter_name = f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.username or "Пользователь"
        message = f"""
🎯 <b>Приглашение в совместный бюджет</b>

<b>{inviter_name}</b> приглашает вас присоединиться к бюджету "<b>{budget.name}</b>".

💬 Для принятия или отклонения приглашения откройте приложение.

🔑 Код приглашения: <code>{invitation.token}</code>
"""
        await send_telegram_message(invited_user.telegram_id, message)
    elif invite_data.telegram_id and not invited_user:
        # User not found, but we have telegram_id - send invitation anyway
        # They might register later
        message = f"""
🎯 <b>Приглашение в совместный бюджет</b>

<b>{current_user.first_name or 'Пользователь'}</b> приглашает вас присоединиться к бюджету "<b>{budget.name}</b>".

💬 Зарегистрируйтесь в приложении и используйте код для принятия приглашения.

🔑 Код приглашения: <code>{invitation.token}</code>
"""
        await send_telegram_message(invite_data.telegram_id, message)
    
    inviter = db.query(User).filter(User.id == current_user.id).first()
    inviter_name = f"{inviter.first_name or ''} {inviter.last_name or ''}".strip() or inviter.username or "Пользователь"
    
    return {
        "id": invitation.id,
        "token": invitation.token,
        "shared_budget_id": invitation.shared_budget_id,
        "shared_budget_name": budget.name,
        "invited_by_user_id": invitation.invited_by_user_id,
        "invited_by_name": inviter_name,
        "email": invitation.email,
        "telegram_id": invitation.telegram_id,
        "role": invitation.role,
        "status": invitation.status.value,
        "message": invitation.message,
        "created_at": invitation.created_at,
        "expires_at": invitation.expires_at,
        "responded_at": invitation.responded_at
    }


@router.post("/invitations/accept", response_model=dict)
async def accept_invitation(
    invite_data: InvitationAcceptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept an invitation to join a shared budget by token or invite code"""
    budget = None
    
    # Try by invite_code first (new, simpler way)
    if invite_data.invite_code:
        budget = db.query(SharedBudget).filter(
            SharedBudget.invite_code == invite_data.invite_code.upper(),
            SharedBudget.is_active == True
        ).first()
        
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Неверный код приглашения"
            )
        
        # Check if user is already a member
        existing_member = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget.id,
            SharedBudgetMember.user_id == current_user.id
        ).first()
        
        if existing_member:
            return {"message": "You are already a member of this budget", "budget_id": budget.id}
        
        # Add user as member (default role: member)
        member = SharedBudgetMember(
            shared_budget_id=budget.id,
            user_id=current_user.id,
            role=MemberRole.MEMBER,
            can_view_private_transactions=False
        )
        
        db.add(member)
        db.commit()
        
        return {"message": "Successfully joined the budget", "budget_id": budget.id}
    
    # Fallback to old token-based invitation system
    if not invite_data.token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Необходимо указать код приглашения или токен"
        )
    
    invitation = db.query(Invitation).filter(
        Invitation.token == invite_data.token,
        Invitation.status == InvitationStatus.PENDING
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Приглашение не найдено или уже использовано"
        )
    
    # Check expiration
    if invitation.expires_at and invitation.expires_at < datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Приглашение истекло"
        )
    
    # Check if invitation is for this user (by email or telegram_id)
    if invitation.email and current_user.email != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Это приглашение не для вашего аккаунта"
        )
    
    if invitation.telegram_id and current_user.telegram_id != invitation.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Это приглашение не для вашего аккаунта"
        )
    
    # Check if user is already a member
    existing_member = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == invitation.shared_budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if existing_member:
        invitation.status = InvitationStatus.ACCEPTED
        invitation.responded_at = datetime.utcnow()
        invitation.invited_user_id = current_user.id
        db.commit()
        return {"message": "You are already a member of this budget", "budget_id": invitation.shared_budget_id}
    
    # Add user as member
    role = MemberRole.ADMIN if invitation.role == "admin" else MemberRole.MEMBER
    member = SharedBudgetMember(
        shared_budget_id=invitation.shared_budget_id,
        user_id=current_user.id,
        role=role,
        can_view_private_transactions=False
    )
    
    db.add(member)
    invitation.status = InvitationStatus.ACCEPTED
    invitation.responded_at = datetime.utcnow()
    invitation.invited_user_id = current_user.id
    db.commit()
    
    return {"message": "Invitation accepted", "budget_id": invitation.shared_budget_id}


@router.post("/invitations/{invitation_id}/decline", response_model=dict)
async def decline_invitation(
    invitation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Decline an invitation"""
    invitation = db.query(Invitation).filter(
        Invitation.id == invitation_id,
        Invitation.status == InvitationStatus.PENDING
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Приглашение не найдено"
        )
    
    # Check if invitation is for this user
    if invitation.email and current_user.email != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Это приглашение не для вашего аккаунта"
        )
    
    if invitation.telegram_id and current_user.telegram_id != invitation.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Это приглашение не для вашего аккаунта"
        )
    
    invitation.status = InvitationStatus.DECLINED
    invitation.responded_at = datetime.utcnow()
    invitation.invited_user_id = current_user.id
    db.commit()
    
    return {"message": "Invitation declined"}


@router.get("/invitations/pending", response_model=List[InvitationResponse])
async def get_pending_invitations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all pending invitations for current user"""
    invitations = db.query(Invitation).filter(
        (Invitation.email == current_user.email) | (Invitation.telegram_id == current_user.telegram_id),
        Invitation.status == InvitationStatus.PENDING
    ).all()
    
    result = []
    for invitation in invitations:
        budget = db.query(SharedBudget).filter(SharedBudget.id == invitation.shared_budget_id).first()
        inviter = db.query(User).filter(User.id == invitation.invited_by_user_id).first()
        inviter_name = f"{inviter.first_name or ''} {inviter.last_name or ''}".strip() or inviter.username or "Пользователь"
        
        result.append({
            "id": invitation.id,
            "token": invitation.token,
            "shared_budget_id": invitation.shared_budget_id,
            "shared_budget_name": budget.name if budget else "Unknown",
            "invited_by_user_id": invitation.invited_by_user_id,
            "invited_by_name": inviter_name,
            "email": invitation.email,
            "telegram_id": invitation.telegram_id,
            "role": invitation.role,
            "status": invitation.status.value,
            "message": invitation.message,
            "created_at": invitation.created_at,
            "expires_at": invitation.expires_at,
            "responded_at": invitation.responded_at
        })
    
    return result


@router.put("/{budget_id}", response_model=SharedBudgetResponse)
async def update_shared_budget(
    budget_id: int,
    budget_data: SharedBudgetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update shared budget (admin only)"""
    # Check if user is admin
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id,
        SharedBudgetMember.role == MemberRole.ADMIN
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут обновлять бюджет"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    if budget_data.name is not None:
        budget.name = budget_data.name
    if budget_data.description is not None:
        budget.description = budget_data.description
    if budget_data.is_active is not None:
        budget.is_active = budget_data.is_active
    
    db.commit()
    db.refresh(budget)
    
    # Generate invite_code if missing (for old records)
    if not budget.invite_code:
        invite_code = generate_invite_code()
        while db.query(SharedBudget).filter(SharedBudget.invite_code == invite_code).first():
            invite_code = generate_invite_code()
        budget.invite_code = invite_code
        db.commit()
        db.refresh(budget)
    
    member_count = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget.id
    ).count()
    
    return {
        "id": budget.id,
        "name": budget.name,
        "description": budget.description,
        "currency": budget.currency,
        "created_by": budget.created_by,
        "invite_code": budget.invite_code,
        "is_active": budget.is_active,
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
        "member_count": member_count
    }


class UpdateRoleRequest(BaseModel):
    new_role: str


@router.patch("/{budget_id}/members/{user_id}/role", response_model=MemberResponse)
async def update_member_role(
    budget_id: int,
    user_id: int,
    role_data: UpdateRoleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update member role (only admins can promote/demote members)"""
    new_role_str = role_data.new_role
    if new_role_str not in ["admin", "member"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="new_role должен быть 'admin' или 'member'"
        )
    
    new_role = MemberRole.ADMIN if new_role_str == "admin" else MemberRole.MEMBER
    
    # Check if current user is admin
    current_membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not current_membership or current_membership.role != MemberRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут изменять роли участников"
        )
    
    # Get budget to check creator
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Check if target member exists
    target_membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == user_id
    ).first()
    
    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Участник не найден"
        )
    
    # Prevent demoting or removing the budget creator
    if user_id == budget.created_by:
        if new_role == MemberRole.MEMBER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Создатель бюджета не может быть понижен до участника"
            )
        # Creator should always remain admin, but we allow keeping admin role
    
    # Check if trying to change own role (admins can't demote themselves if they're the only admin)
    if user_id == current_user.id:
        admin_count = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id,
            SharedBudgetMember.role == MemberRole.ADMIN
        ).count()
        
        if admin_count == 1 and new_role != MemberRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя удалить последнего администратора. Сначала назначьте другого участника администратором."
            )
    
    # Update role
    target_membership.role = new_role
    db.commit()
    db.refresh(target_membership)
    
    user = db.query(User).filter(User.id == user_id).first()
    return {
        "id": target_membership.id,
        "shared_budget_id": target_membership.shared_budget_id,
        "user_id": target_membership.user_id,
        "role": target_membership.role.value,
        "joined_at": target_membership.joined_at,
        "user_email": user.email if user else None,
        "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username if user else None
    }


@router.delete("/{budget_id}/members/{user_id}", response_model=dict)
async def remove_member(
    budget_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a member from shared budget (admin only)"""
    # Check if current user is admin
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id,
        SharedBudgetMember.role == MemberRole.ADMIN
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только администраторы могут удалять участников"
        )
    
    # Get budget to check creator
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Cannot remove yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить самого себя"
        )
    
    # Prevent removing the budget creator
    if user_id == budget.created_by:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Создатель бюджета не может быть удален из бюджета"
        )
    
    member = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Участник не найден"
        )
    
    db.delete(member)
    db.commit()
    
    return {"message": "Member removed"}


@router.post("/{budget_id}/leave", response_model=dict)
async def leave_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Leave a shared budget (remove yourself as a member)"""
    # Check if user is a member
    membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Вы не являетесь участником этого бюджета"
        )
    
    # Check if user is an admin and there are other members
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Prevent the budget creator from leaving the budget
    if current_user.id == budget.created_by:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Создатель бюджета не может покинуть бюджет"
        )
    
    # Check if user is an admin (not just the creator - role matters!)
    if membership.role == MemberRole.ADMIN:
        # Count other admins
        other_admins = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id,
            SharedBudgetMember.user_id != current_user.id,
            SharedBudgetMember.role == MemberRole.ADMIN
        ).count()
        
        # Count other members (any role)
        other_members = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id,
            SharedBudgetMember.user_id != current_user.id
        ).count()
        
        # If user is the last admin and there are other members, prevent leaving
        if other_admins == 0 and other_members > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="LAST_ADMIN_CANNOT_LEAVE"
            )
    
    # Remove membership
    db.delete(membership)
    db.commit()
    
    return {"message": "Successfully left the budget"}


@router.delete("/{budget_id}", response_model=dict)
async def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a shared budget (only creator can delete)"""
    # Get budget
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Бюджет не найден"
        )
    
    # Only the creator can delete the budget
    if budget.created_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только создатель бюджета может удалить бюджет"
        )
    
    try:
        # Get all accounts for this budget
        from app.models.account import Account
        from app.models.transaction import Transaction
        
        budget_accounts = db.query(Account).filter(
            Account.shared_budget_id == budget_id
        ).all()
        
        account_ids = [acc.id for acc in budget_accounts]
        
        # Delete all transactions for these accounts
        if account_ids:
            # Delete transactions where account is source
            transactions = db.query(Transaction).filter(
                Transaction.account_id.in_(account_ids)
            ).all()
            
            # Also get transfer destination transactions
            transfer_transactions = db.query(Transaction).filter(
                Transaction.to_account_id.in_(account_ids)
            ).all()
            
            all_transactions = transactions + transfer_transactions
            
            # Delete transfer pairs properly
            for transaction in transactions:
                if transaction.transaction_type == 'transfer' and transaction.to_account_id:
                    dest_transaction = db.query(Transaction).filter(
                        Transaction.account_id == transaction.to_account_id,
                        Transaction.transaction_type == 'income',
                        Transaction.amount == transaction.amount,
                        Transaction.transaction_date == transaction.transaction_date
                    ).first()
                    if dest_transaction:
                        db.delete(dest_transaction)
                db.delete(transaction)
            
            # Delete remaining transfer destination transactions
            for transaction in transfer_transactions:
                if transaction not in all_transactions or transaction.transaction_type == 'income':
                    db.delete(transaction)
            
            # Delete all accounts
            for account in budget_accounts:
                db.delete(account)
        
        # Delete all invitations for this budget
        invitations = db.query(Invitation).filter(
            Invitation.shared_budget_id == budget_id
        ).all()
        for invitation in invitations:
            db.delete(invitation)
        
        # Delete all members
        members = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id
        ).all()
        for member in members:
            db.delete(member)
        
        # Delete the budget itself
        db.delete(budget)
        
        db.commit()
        
        logger.info(f"Budget {budget_id} deleted by user {current_user.id}")
        
        return {
            "message": "Бюджет успешно удален",
            "budget_id": budget_id,
            "accounts_deleted": len(budget_accounts),
            "members_deleted": len(members),
            "invitations_deleted": len(invitations)
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting budget {budget_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Ошибка при удалении бюджета"
        )


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
            detail="You don't have access to this budget"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
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
            detail="You don't have access to this budget"
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
            detail="Only admins can view invite code"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
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
            detail="Only admins can regenerate invite code"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
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
            detail="Only admins can invite members"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
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
            detail="Either email or telegram_id must be provided"
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
                detail="User is already a member of this budget"
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
                detail="Invalid invite code"
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
            detail="Either invite_code or token must be provided"
        )
    
    invitation = db.query(Invitation).filter(
        Invitation.token == invite_data.token,
        Invitation.status == InvitationStatus.PENDING
    ).first()
    
    if not invitation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found or already used"
        )
    
    # Check expiration
    if invitation.expires_at and invitation.expires_at < datetime.utcnow():
        invitation.status = InvitationStatus.EXPIRED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired"
        )
    
    # Check if invitation is for this user (by email or telegram_id)
    if invitation.email and current_user.email != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for your account"
        )
    
    if invitation.telegram_id and current_user.telegram_id != invitation.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for your account"
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
            detail="Invitation not found"
        )
    
    # Check if invitation is for this user
    if invitation.email and current_user.email != invitation.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for your account"
        )
    
    if invitation.telegram_id and current_user.telegram_id != invitation.telegram_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation is not for your account"
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
            detail="Only admins can update budget"
        )
    
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
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
            detail="new_role must be 'admin' or 'member'"
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
            detail="Only admins can change member roles"
        )
    
    # Check if target member exists
    target_membership = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == user_id
    ).first()
    
    if not target_membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # Check if trying to change own role (admins can't demote themselves if they're the only admin)
    if user_id == current_user.id:
        admin_count = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id,
            SharedBudgetMember.role == MemberRole.ADMIN
        ).count()
        
        if admin_count == 1 and new_role != MemberRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last admin. Promote another member to admin first."
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
            detail="Only admins can remove members"
        )
    
    # Cannot remove yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself"
        )
    
    member = db.query(SharedBudgetMember).filter(
        SharedBudgetMember.shared_budget_id == budget_id,
        SharedBudgetMember.user_id == user_id
    ).first()
    
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
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
            detail="You are not a member of this budget"
        )
    
    # Check if user is the creator/admin and there are other members
    budget = db.query(SharedBudget).filter(SharedBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Budget not found"
        )
    
    # Check if user is the creator
    if budget.created_by == current_user.id:
        # Count other members
        other_members = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.shared_budget_id == budget_id,
            SharedBudgetMember.user_id != current_user.id
        ).count()
        
        if other_members > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot leave budget as creator while other members exist. Transfer ownership or remove all members first."
            )
    
    # Remove membership
    db.delete(membership)
    db.commit()
    
    return {"message": "Successfully left the budget"}


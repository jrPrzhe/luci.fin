from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, TokenResponse, LoginRequest, UserUpdate

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Логирование для отладки
    logger.info(f"get_current_user called, token length: {len(token) if token else 0}, token preview: {token[:20] + '...' if token and len(token) > 20 else token}")
    
    if not token:
        logger.warning("No token provided in get_current_user")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token)
    if payload is None:
        logger.warning(f"Failed to decode token. Token length: {len(token) if token else 0}, Token value: {token[:100] if token else 'None'}...")
        # Проверяем формат токена
        if token and '.' in token:
            parts = token.split('.')
            logger.warning(f"Token has {len(parts)} parts (should be 3 for JWT)")
            if len(parts) != 3:
                logger.warning(f"Token format incorrect: expected 3 parts separated by '.', got {len(parts)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        logger.warning(f"No 'sub' in token payload: {payload}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    # user_id из JWT payload всегда строка, нужно преобразовать в int
    try:
        user_id = int(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        logger.warning(f"Invalid user_id format in token: {user_id} (type: {type(user_id)})")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    logger.info(f"Token decoded successfully, user_id: {user_id}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning(f"User not found for id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    logger.info(f"User found: id={user.id}, email={user.email}, telegram_id={user.telegram_id}")
    return user


def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify admin status"""
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    db_user = User(
        email=user_data.email,
        username=user_data.username or user_data.email.split("@")[0],
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        hashed_password=get_password_hash(user_data.password),
        timezone=user_data.timezone,
        default_currency=user_data.default_currency,
        language=user_data.language,
        is_active=True,
        is_verified=False,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create default categories for new user
    try:
        from app.models.category import Category, TransactionType
        # Расширенный список категорий расходов для экономии и финансов
        DEFAULT_EXPENSE_CATEGORIES = [
            # Основные расходы
            {"name": "Продукты", "icon": "🛒", "color": "#4CAF50", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Транспорт", "icon": "🚗", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Коммунальные услуги", "icon": "💡", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Связь и интернет", "icon": "📱", "color": "#00BCD4", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Еда вне дома
            {"name": "Кафе и рестораны", "icon": "🍽️", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Доставка еды", "icon": "🍕", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Здоровье и красота
            {"name": "Здоровье", "icon": "🏥", "color": "#F44336", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Аптека", "icon": "💊", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Красота и уход", "icon": "💅", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Одежда и покупки
            {"name": "Одежда", "icon": "👕", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Обувь", "icon": "👟", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Бытовая техника", "icon": "🏠", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Развлечения и хобби
            {"name": "Развлечения", "icon": "🎬", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Кино и театр", "icon": "🎭", "color": "#673AB7", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Хобби", "icon": "🎨", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Образование и развитие
            {"name": "Образование", "icon": "📚", "color": "#3F51B5", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Курсы", "icon": "🎓", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Подарки и праздники
            {"name": "Подарки", "icon": "🎁", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Праздники", "icon": "🎉", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Дети и семья
            {"name": "Дети", "icon": "👶", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Домашние животные", "icon": "🐾", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            # Другое
            {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
        ]
        # Расширенный список категорий доходов
        DEFAULT_INCOME_CATEGORIES = [
            {"name": "Зарплата", "icon": "💰", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": True},
            {"name": "Премия", "icon": "🎯", "color": "#FFC107", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Фриланс", "icon": "💼", "color": "#9C27B0", "transaction_type": TransactionType.INCOME, "is_favorite": True},
            {"name": "Подработка", "icon": "⚡", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Инвестиции", "icon": "📈", "color": "#2196F3", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Дивиденды", "icon": "💹", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Подарки", "icon": "🎁", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Возврат покупки", "icon": "↩️", "color": "#00BCD4", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Кэшбэк", "icon": "💳", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.INCOME, "is_favorite": False},
        ]
        
        categories = []
        for cat_data in DEFAULT_EXPENSE_CATEGORIES + DEFAULT_INCOME_CATEGORIES:
            # Убеждаемся, что строки правильно кодированы в UTF-8
            name = str(cat_data["name"]).encode('utf-8').decode('utf-8')
            icon = str(cat_data["icon"]).encode('utf-8').decode('utf-8')
            
            categories.append(Category(
                user_id=db_user.id,
                name=name,
                transaction_type=cat_data["transaction_type"],
                icon=icon,
                color=cat_data["color"],
                is_system=True,
                is_active=True,
                is_favorite=cat_data.get("is_favorite", False)
            ))
        
        # Используем add_all вместо bulk_save_objects для лучшей поддержки UTF-8
        db.add_all(categories)
        db.commit()
    except Exception as e:
        # Log error but don't fail registration
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Failed to create default categories: {e}")
    
    # Create tokens
    access_token = create_access_token(data={"sub": db_user.id})
    refresh_token = create_refresh_token(data={"sub": db_user.id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(db_user)
    )


@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    user = db.query(User).filter(User.email == login_data.email).first()
    
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user)
    )


class RefreshTokenRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_request: RefreshTokenRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    import logging
    logger = logging.getLogger(__name__)
    
    refresh_token_str = refresh_request.refresh_token
    
    if not refresh_token_str:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refresh token is required"
        )
    
    # Decode refresh token
    payload = decode_token(refresh_token_str)
    if payload is None:
        logger.warning("Failed to decode refresh token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if token type is refresh
    token_type = payload.get("type")
    if token_type != "refresh":
        logger.warning(f"Token type is not 'refresh': {token_type}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user ID from token
    user_id = payload.get("sub")
    if user_id is None:
        logger.warning(f"No 'sub' in refresh token payload: {payload}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    # Convert user_id to int
    try:
        user_id = int(user_id) if isinstance(user_id, str) else user_id
    except (ValueError, TypeError):
        logger.warning(f"Invalid user_id format in refresh token: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    # Verify user exists and is active
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning(f"User not found for id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create new tokens
    access_token = create_access_token(data={"sub": user.id})
    new_refresh_token = create_refresh_token(data={"sub": user.id})
    
    logger.info(f"Tokens refreshed for user {user.id}")
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user)
    )


class TelegramLoginRequest(BaseModel):
    init_data: str


@router.post("/telegram", response_model=TokenResponse)
async def login_telegram(
    request: TelegramLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login via Telegram Mini App
    Accepts Telegram initData from window.Telegram.WebApp.initData
    Creates user automatically by telegram_id if doesn't exist
    Each user has isolated data based on their telegram_id
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        import json
        import urllib.parse
        
        init_data = request.init_data
        
        # Log for debugging (without sensitive data)
        logger.info(f"Received Telegram login request, initData length: {len(init_data) if init_data else 0}")
        
        if not init_data or len(init_data) == 0:
            logger.warning("Empty initData received")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty initData"
            )
        
        # Parse initData - Format: key1=value1&key2=value2&hash=...
        params = {}
        for param in init_data.split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                params[key] = urllib.parse.unquote(value)
        
        logger.info(f"Parsed initData params: {list(params.keys())}")
        
        # Extract and parse user data from initData
        user_str = params.get('user', '')
        if not user_str:
            logger.warning(f"No 'user' param in initData. Available params: {list(params.keys())}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telegram user data not found in initData"
            )
        
        # Parse JSON user data
        try:
            user_obj = json.loads(user_str)
            logger.info(f"Parsed user object, telegram_id: {user_obj.get('id')}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse user JSON: {e}, user_str: {user_str[:100]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid Telegram user data format: {str(e)}"
            )
        
        # Normalize telegram_id - ensure consistent format
        telegram_id_raw = user_obj.get('id')
        telegram_id = str(telegram_id_raw).strip() if telegram_id_raw is not None else None
        
        if not telegram_id or telegram_id == 'None' or telegram_id == '':
            logger.error(f"No telegram_id in user object: {user_obj}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Telegram user ID not found"
            )
        
        logger.info(f"Mini App login - telegram_id: '{telegram_id}' (type: {type(telegram_id)}, length: {len(telegram_id)})")
        
        telegram_username = user_obj.get('username')
        first_name = user_obj.get('first_name', '')
        last_name = user_obj.get('last_name', '')
        
        # Find or create user by telegram_id (exact match)
        user = db.query(User).filter(User.telegram_id == telegram_id).first()
        
        # If not found, try alternative formats
        if not user:
            try:
                telegram_id_int = int(telegram_id)
                for alt_id in [str(telegram_id_int), f"{telegram_id_int}"]:
                    alt_user = db.query(User).filter(User.telegram_id == alt_id).first()
                    if alt_user:
                        logger.info(f"Found existing user with alternative telegram_id format: '{alt_id}', updating to '{telegram_id}'")
                        alt_user.telegram_id = telegram_id  # Update to normalized format
                        user = alt_user
                        break
            except (ValueError, TypeError):
                pass
        
        # If still not found, try to link to existing VK account
        # This allows users to use both platforms with the same account
        # Strategy: If user logged in via VK first, then via Telegram, link them
        if not user:
            # Check if there's exactly one user with vk_id but no telegram_id
            # This is a simple heuristic: if only one VK user exists, assume it's the same person
            existing_vk_users = db.query(User).filter(
                User.vk_id.isnot(None),
                User.telegram_id.is_(None)
            ).all()
            
            if len(existing_vk_users) == 1:
                existing_vk_user = existing_vk_users[0]
                logger.info(f"Found single existing user with vk_id '{existing_vk_user.vk_id}' but no telegram_id. Linking Telegram account.")
                user = existing_vk_user
                user.telegram_id = telegram_id
                user.telegram_username = telegram_username
                # Update name if available and not set
                if first_name and not user.first_name:
                    user.first_name = first_name
                if last_name and not user.last_name:
                    user.last_name = last_name
                is_new_user = False
            elif len(existing_vk_users) > 1:
                logger.info(f"Found {len(existing_vk_users)} users with vk_id but no telegram_id. Cannot auto-link, will create new user.")
            else:
                logger.info(f"No existing VK user found to link. Will create new user with telegram_id '{telegram_id}'")
        
        is_new_user = False
        
        if not user:
            # Create new user - ensure unique email
            username = telegram_username or f"tg_{telegram_id}"
            
            # Create unique email based on telegram_id
            base_email = f"tg_{telegram_id}@telegram.local"
            email = base_email
            
            # If email exists (shouldn't happen with telegram_id, but just in case)
            counter = 1
            while db.query(User).filter(User.email == email).first():
                email = f"tg_{telegram_id}_{counter}@telegram.local"
                counter += 1
            
            # Check if user is admin
            from app.core.config import settings
            is_admin = str(telegram_id) in settings.ADMIN_TELEGRAM_IDS
            logger.info("=" * 60)
            logger.info("ADMIN STATUS CHECK (New User)")
            logger.info("=" * 60)
            logger.info(f"telegram_id = {telegram_id} (type: {type(telegram_id)})")
            logger.info(f"ADMIN_TELEGRAM_IDS = {settings.ADMIN_TELEGRAM_IDS} (type: {type(settings.ADMIN_TELEGRAM_IDS)})")
            logger.info(f"str(telegram_id) in ADMIN_TELEGRAM_IDS = {is_admin}")
            logger.info(f"✅ New user will be created with is_admin = {is_admin}")
            logger.info("=" * 60)
            
            user = User(
                email=email,
                username=username,
                telegram_id=telegram_id,
                telegram_username=telegram_username,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_verified=True,  # Telegram users are considered verified
                is_admin=is_admin,  # Set admin status based on config
                default_currency="RUB",  # Default currency for Telegram users
            )
            db.add(user)
            db.flush()  # Flush to get user.id
            is_new_user = True
        else:
            # Update existing user info if needed
            updated = False
            if telegram_username and user.telegram_username != telegram_username:
                user.telegram_username = telegram_username
                updated = True
            if first_name and user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updated = True
            
            # Update admin status based on config
            from app.core.config import settings
            should_be_admin = str(telegram_id) in settings.ADMIN_TELEGRAM_IDS
            logger.info("=" * 60)
            logger.info("ADMIN STATUS CHECK (Existing User)")
            logger.info("=" * 60)
            logger.info(f"telegram_id = {telegram_id} (type: {type(telegram_id)})")
            logger.info(f"ADMIN_TELEGRAM_IDS = {settings.ADMIN_TELEGRAM_IDS} (type: {type(settings.ADMIN_TELEGRAM_IDS)})")
            logger.info(f"str(telegram_id) in ADMIN_TELEGRAM_IDS = {should_be_admin}")
            logger.info(f"current_is_admin = {user.is_admin}")
            logger.info(f"should_be_admin = {should_be_admin}")
            if user.is_admin != should_be_admin:
                user.is_admin = should_be_admin
                updated = True
                logger.info(f"✅ UPDATED: User {user.id} is_admin changed to {should_be_admin}")
            else:
                logger.info(f"ℹ️  No change needed: is_admin already {user.is_admin}")
            logger.info("=" * 60)
        
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        
        logger.info(f"User processed: id={user.id}, telegram_id={user.telegram_id}, is_new={is_new_user}")
        
        # Create default account and categories for new users
        if is_new_user:
            try:
                from app.models.account import Account, AccountType
                from app.models.category import Category, TransactionType
                
                # Create default account
                default_account = Account(
                    user_id=user.id,
                    name="Основной счёт",
                    account_type=AccountType.CASH,
                    currency=user.default_currency,
                    initial_balance=0.0,
                    is_active=True,
                    description="Автоматически созданный счёт"
                )
                db.add(default_account)
                
                # Create default categories (базовые категории для всех пользователей)
                DEFAULT_EXPENSE_CATEGORIES = [
                    {"name": "Продукты", "icon": "🛒", "color": "#4CAF50", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Транспорт", "icon": "🚗", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Коммунальные услуги", "icon": "💡", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Связь и интернет", "icon": "📱", "color": "#00BCD4", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Кафе и рестораны", "icon": "🍽️", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Доставка еды", "icon": "🍕", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Здоровье", "icon": "🏥", "color": "#F44336", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Аптека", "icon": "💊", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Красота и уход", "icon": "💅", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Одежда", "icon": "👕", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Обувь", "icon": "👟", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Бытовая техника", "icon": "🏠", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Развлечения", "icon": "🎬", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Кино и театр", "icon": "🎭", "color": "#673AB7", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Хобби", "icon": "🎨", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Образование", "icon": "📚", "color": "#3F51B5", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Курсы", "icon": "🎓", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Подарки", "icon": "🎁", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Праздники", "icon": "🎉", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Дети", "icon": "👶", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Домашние животные", "icon": "🐾", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                ]
                DEFAULT_INCOME_CATEGORIES = [
                    {"name": "Зарплата", "icon": "💰", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": True},
                    {"name": "Премия", "icon": "🎯", "color": "#FFC107", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Фриланс", "icon": "💼", "color": "#9C27B0", "transaction_type": TransactionType.INCOME, "is_favorite": True},
                    {"name": "Подработка", "icon": "⚡", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Инвестиции", "icon": "📈", "color": "#2196F3", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Дивиденды", "icon": "💹", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Подарки", "icon": "🎁", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Возврат покупки", "icon": "↩️", "color": "#00BCD4", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Кэшбэк", "icon": "💳", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                ]
                
                categories = []
                for cat_data in DEFAULT_EXPENSE_CATEGORIES + DEFAULT_INCOME_CATEGORIES:
                    # Убеждаемся, что строки правильно кодированы в UTF-8
                    name = str(cat_data["name"]).encode('utf-8').decode('utf-8')
                    icon = str(cat_data["icon"]).encode('utf-8').decode('utf-8')
                    
                    categories.append(Category(
                        user_id=user.id,
                        name=name,
                        transaction_type=cat_data["transaction_type"],
                        icon=icon,
                        color=cat_data["color"],
                        is_system=True,  # Базовые категории помечаются как системные
                        is_active=True,
                        is_favorite=cat_data.get("is_favorite", False)
                    ))
                
                # Используем add_all вместо bulk_save_objects для лучшей поддержки UTF-8
                db.add_all(categories)
                db.commit()
                logger.info(f"Default account and categories created for user {user.id}")
            except Exception as e:
                logger.error(f"Failed to create default account/categories: {e}", exc_info=True)
                # Don't fail the login if account creation fails
                db.rollback()
        
        # Create tokens
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})
        
        # Логирование токена для отладки (только начало, не весь токен)
        logger.info(f"Tokens created for user {user.id}, access_token length: {len(access_token)}, preview: {access_token[:50]}...")
        
        # Проверяем, что токен можно декодировать сразу после создания
        from app.core.security import decode_token as decode_token_check
        test_decode = decode_token_check(access_token)
        if test_decode:
            logger.info(f"Token validation: SUCCESS, user_id in token: {test_decode.get('sub')}")
        else:
            logger.error(f"Token validation: FAILED - token cannot be decoded immediately after creation!")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Telegram auth error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Telegram authentication: {str(e)}"
        )


class VKLoginRequest(BaseModel):
    launch_params: str  # URL query string with vk_* parameters


@router.post("/vk", response_model=TokenResponse)
async def login_vk(
    request: VKLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Login via VK Mini App
    Accepts VK launch params from URL query string
    Creates user automatically by vk_id if doesn't exist
    Each user has isolated data based on their vk_id
    """
    import logging
    import urllib.parse
    logger = logging.getLogger(__name__)
    
    try:
        launch_params = request.launch_params
        
        # Log for debugging (without sensitive data)
        logger.info(f"Received VK login request, launch_params length: {len(launch_params) if launch_params else 0}")
        
        if not launch_params or len(launch_params) == 0:
            logger.warning("Empty launch_params received")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Empty launch_params"
            )
        
        # Parse launch params - Format: ?vk_user_id=123&vk_app_id=456&sign=...
        # Remove leading ? if present
        if launch_params.startswith('?'):
            launch_params = launch_params[1:]
        
        params = {}
        for param in launch_params.split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                params[key] = urllib.parse.unquote(value)
        
        logger.info(f"Parsed launch params: {list(params.keys())}")
        
        # Extract vk_user_id
        vk_user_id_raw = params.get('vk_user_id')
        if not vk_user_id_raw:
            logger.warning(f"No 'vk_user_id' in launch params. Available params: {list(params.keys())}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="VK user ID not found in launch params"
            )
        
        # Normalize vk_id - ensure consistent format
        vk_id = str(vk_user_id_raw).strip()
        
        if not vk_id or vk_id == 'None' or vk_id == '':
            logger.error(f"Invalid vk_id: {vk_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid VK user ID"
            )
        
        logger.info(f"VK Mini App login - vk_id: '{vk_id}' (type: {type(vk_id)}, length: {len(vk_id)})")
        
        # Note: VK launch params don't include user name/photo by default
        # We'll need to get it via VK API if needed, but for now we'll use empty strings
        first_name = params.get('first_name', '')
        last_name = params.get('last_name', '')
        
        # Find or create user by vk_id (exact match)
        user = db.query(User).filter(User.vk_id == vk_id).first()
        
        # If not found, try alternative formats
        if not user:
            try:
                vk_id_int = int(vk_id)
                for alt_id in [str(vk_id_int), f"{vk_id_int}"]:
                    alt_user = db.query(User).filter(User.vk_id == alt_id).first()
                    if alt_user:
                        logger.info(f"Found existing user with alternative vk_id format: '{alt_id}', updating to '{vk_id}'")
                        alt_user.vk_id = vk_id  # Update to normalized format
                        user = alt_user
                        break
            except (ValueError, TypeError):
                pass
        
        # If still not found, try to link to existing Telegram account
        # This allows users to use both platforms with the same account
        # Strategy: If user logged in via Telegram first, then via VK, link them
        if not user:
            # Check if there's exactly one user with telegram_id but no vk_id
            # This is a simple heuristic: if only one Telegram user exists, assume it's the same person
            existing_tg_users = db.query(User).filter(
                User.telegram_id.isnot(None),
                User.vk_id.is_(None)
            ).all()
            
            if len(existing_tg_users) == 1:
                existing_tg_user = existing_tg_users[0]
                logger.info(f"Found single existing user with telegram_id '{existing_tg_user.telegram_id}' but no vk_id. Linking VK account.")
                user = existing_tg_user
                user.vk_id = vk_id
                # Update name if available and not set
                if first_name and not user.first_name:
                    user.first_name = first_name
                if last_name and not user.last_name:
                    user.last_name = last_name
                is_new_user = False
            elif len(existing_tg_users) > 1:
                logger.info(f"Found {len(existing_tg_users)} users with telegram_id but no vk_id. Cannot auto-link, will create new user.")
            else:
                logger.info(f"No existing Telegram user found to link. Will create new user with vk_id '{vk_id}'")
        
        is_new_user = False
        
        if not user:
            # Create new user - ensure unique email
            username = f"vk_{vk_id}"
            
            # Create unique email based on vk_id
            base_email = f"vk_{vk_id}@vk.local"
            email = base_email
            
            # If email exists (shouldn't happen with vk_id, but just in case)
            counter = 1
            while db.query(User).filter(User.email == email).first():
                email = f"vk_{vk_id}_{counter}@vk.local"
                counter += 1
            
            # Check if user is admin (can add VK admin IDs to config if needed)
            from app.core.config import settings
            # For now, VK users are not admins by default
            # Can add ADMIN_VK_IDS to settings if needed
            is_admin = False
            
            user = User(
                email=email,
                username=username,
                vk_id=vk_id,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
                is_verified=True,  # VK users are considered verified
                is_admin=is_admin,
                default_currency="RUB",  # Default currency for VK users
            )
            db.add(user)
            db.flush()  # Flush to get user.id
            is_new_user = True
        else:
            # Update existing user info if needed
            updated = False
            if first_name and user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if last_name and user.last_name != last_name:
                user.last_name = last_name
                updated = True
        
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        
        logger.info(f"User processed: id={user.id}, vk_id={user.vk_id}, is_new={is_new_user}")
        
        # Create default account and categories for new users
        if is_new_user:
            try:
                from app.models.account import Account, AccountType
                from app.models.category import Category, TransactionType
                
                # Create default account
                default_account = Account(
                    user_id=user.id,
                    name="Основной счёт",
                    account_type=AccountType.CASH,
                    currency=user.default_currency,
                    initial_balance=0.0,
                    is_active=True,
                    description="Автоматически созданный счёт"
                )
                db.add(default_account)
                
                # Create default categories (same as Telegram)
                DEFAULT_EXPENSE_CATEGORIES = [
                    {"name": "Продукты", "icon": "🛒", "color": "#4CAF50", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Транспорт", "icon": "🚗", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Коммунальные услуги", "icon": "💡", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Связь и интернет", "icon": "📱", "color": "#00BCD4", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Кафе и рестораны", "icon": "🍽️", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
                    {"name": "Доставка еды", "icon": "🍕", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Здоровье", "icon": "🏥", "color": "#F44336", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Аптека", "icon": "💊", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Красота и уход", "icon": "💅", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Одежда", "icon": "👕", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Обувь", "icon": "👟", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Бытовая техника", "icon": "🏠", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Развлечения", "icon": "🎬", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Кино и театр", "icon": "🎭", "color": "#673AB7", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Хобби", "icon": "🎨", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Образование", "icon": "📚", "color": "#3F51B5", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Курсы", "icon": "🎓", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Подарки", "icon": "🎁", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Праздники", "icon": "🎉", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Дети", "icon": "👶", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Домашние животные", "icon": "🐾", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                    {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
                ]
                DEFAULT_INCOME_CATEGORIES = [
                    {"name": "Зарплата", "icon": "💰", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": True},
                    {"name": "Премия", "icon": "🎯", "color": "#FFC107", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Фриланс", "icon": "💼", "color": "#9C27B0", "transaction_type": TransactionType.INCOME, "is_favorite": True},
                    {"name": "Подработка", "icon": "⚡", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Инвестиции", "icon": "📈", "color": "#2196F3", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Дивиденды", "icon": "💹", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Подарки", "icon": "🎁", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Возврат покупки", "icon": "↩️", "color": "#00BCD4", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Кэшбэк", "icon": "💳", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                    {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.INCOME, "is_favorite": False},
                ]
                
                categories = []
                for cat_data in DEFAULT_EXPENSE_CATEGORIES + DEFAULT_INCOME_CATEGORIES:
                    name = str(cat_data["name"]).encode('utf-8').decode('utf-8')
                    icon = str(cat_data["icon"]).encode('utf-8').decode('utf-8')
                    
                    categories.append(Category(
                        user_id=user.id,
                        name=name,
                        transaction_type=cat_data["transaction_type"],
                        icon=icon,
                        color=cat_data["color"],
                        is_system=True,
                        is_active=True,
                        is_favorite=cat_data.get("is_favorite", False)
                    ))
                
                db.add_all(categories)
                db.commit()
                logger.info(f"Default account and categories created for user {user.id}")
            except Exception as e:
                logger.error(f"Failed to create default account/categories: {e}", exc_info=True)
                db.rollback()
        
        # Create tokens
        access_token = create_access_token(data={"sub": user.id})
        refresh_token = create_refresh_token(data={"sub": user.id})
        
        logger.info(f"Tokens created for user {user.id}, access_token length: {len(access_token)}")
        
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserResponse.model_validate(user)
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VK auth error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid VK authentication: {str(e)}"
        )


class BotTokenRequest(BaseModel):
    telegram_id: str


@router.post("/bot-token")
async def get_bot_token(
    request: BotTokenRequest,
    db: Session = Depends(get_db)
):
    """Get JWT token for Telegram bot by telegram_id"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Normalize telegram_id - ensure it's a string without whitespace
    telegram_id = str(request.telegram_id).strip()
    logger.info(f"Bot token request for telegram_id: '{telegram_id}' (type: {type(telegram_id)}, length: {len(telegram_id)})")
    
    # Try to find user by telegram_id (exact match)
    user = db.query(User).filter(User.telegram_id == telegram_id).first()
    
    # If not found, try to find by converting to int and back (in case of type mismatch)
    if not user:
        try:
            # Sometimes telegram_id might be stored as string representation of int
            telegram_id_int = int(telegram_id)
            # Try searching with different string representations
            for alt_id in [str(telegram_id_int), f"{telegram_id_int}"]:
                alt_user = db.query(User).filter(User.telegram_id == alt_id).first()
                if alt_user:
                    logger.info(f"Found user with alternative telegram_id format: '{alt_id}'")
                    user = alt_user
                    break
        except (ValueError, TypeError):
            pass
    
    # Debug: log all users with telegram_id to see what's in database
    if not user:
        all_users_with_telegram = db.query(User).filter(User.telegram_id.isnot(None)).all()
        logger.warning(f"User not found for telegram_id: '{telegram_id}'. Found {len(all_users_with_telegram)} users with telegram_id in database:")
        for u in all_users_with_telegram[:5]:  # Log first 5
            logger.warning(f"  - User ID: {u.id}, telegram_id: '{u.telegram_id}' (type: {type(u.telegram_id)}, repr: {repr(u.telegram_id)})")
    
    if not user:
        logger.warning(f"User not found for telegram_id: {telegram_id}, creating new user")
        
        # Auto-create user if not exists (for cases when user authorized via Mini App but wasn't saved properly)
        # This ensures bot can work even if user was created through Mini App but record is missing
        try:
            # Create new user with minimal data
            username = f"tg_{telegram_id}"
            email = f"tg_{telegram_id}@telegram.local"
            
            # Ensure unique email
            counter = 1
            while db.query(User).filter(User.email == email).first():
                email = f"tg_{telegram_id}_{counter}@telegram.local"
                counter += 1
            
            user = User(
                email=email,
                username=username,
                telegram_id=telegram_id,
                is_active=True,
                is_verified=True,  # Telegram users are considered verified
                default_currency="RUB",
            )
            db.add(user)
            db.flush()  # Flush to get user.id
            db.commit()
            db.refresh(user)
            
            logger.info(f"Auto-created user for telegram_id: {telegram_id}, user_id: {user.id}")
            
            # Create default account for new user
            try:
                from app.models.account import Account, AccountType
                default_account = Account(
                    user_id=user.id,
                    name="Основной счёт",
                    account_type=AccountType.CASH,
                    currency=user.default_currency,
                    initial_balance=0.0,
                    is_active=True,
                    description="Автоматически созданный счёт"
                )
                db.add(default_account)
                db.commit()
                logger.info(f"Created default account for user {user.id}")
            except Exception as e:
                logger.error(f"Failed to create default account: {e}")
                db.rollback()
                
        except Exception as e:
            logger.error(f"Failed to auto-create user: {e}", exc_info=True)
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create user: {str(e)}"
            )
    
    if not user.is_active:
        logger.warning(f"User {user.id} (telegram_id: {telegram_id}) is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    logger.info(f"Token created for user {user.id} (telegram_id: {telegram_id})")
    
    return {"access_token": access_token}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Get current user information"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Логирование заголовков для отладки
    auth_header = request.headers.get("authorization")
    logger.info(f"/me endpoint called, Authorization header present: {bool(auth_header)}, value: {auth_header[:50] + '...' if auth_header and len(auth_header) > 50 else auth_header}")
    
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user information"""
    # Update only provided fields
    if user_update.first_name is not None:
        current_user.first_name = user_update.first_name
    if user_update.last_name is not None:
        current_user.last_name = user_update.last_name
    if user_update.timezone is not None:
        current_user.timezone = user_update.timezone
    if user_update.default_currency is not None:
        current_user.default_currency = user_update.default_currency
    if user_update.language is not None:
        current_user.language = user_update.language
    
    # Note: username and telegram_username cannot be changed via API
    # telegram_username is updated automatically via Telegram login
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse.model_validate(current_user)


@router.post("/reset-account", response_model=UserResponse)
async def reset_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reset all user data to factory defaults
    Deletes all accounts, transactions, categories, tags, goals, reports
    Removes user from shared budgets
    Resets user settings to defaults
    Creates default account and categories
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        from app.models.account import Account, AccountType
        from app.models.category import Category, TransactionType
        from app.models.shared_budget import SharedBudgetMember, SharedBudget
        
        logger.info(f"Starting account reset for user {current_user.id}")
        
        # Get user's accounts first to get account IDs
        user_accounts = db.query(Account).filter(Account.user_id == current_user.id).all()
        account_ids = [acc.id for acc in user_accounts]
        accounts_count = len(account_ids)
        
        # Delete all transactions first (by user_id to catch all transactions)
        from app.models.transaction import Transaction
        transactions_count = db.query(Transaction).filter(
            Transaction.user_id == current_user.id
        ).count()
        db.query(Transaction).filter(
            Transaction.user_id == current_user.id
        ).delete(synchronize_session=False)
        logger.info(f"Deleted {transactions_count} transactions")
        
        # Delete all accounts
        if account_ids:
            db.query(Account).filter(Account.id.in_(account_ids)).delete(synchronize_session=False)
        logger.info(f"Deleted {accounts_count} accounts")
        
        # Delete all categories
        categories_count = db.query(Category).filter(Category.user_id == current_user.id).count()
        db.query(Category).filter(Category.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {categories_count} categories")
        
        # Delete all tags (transaction_tags associations are deleted automatically when transactions are deleted)
        from app.models.tag import Tag
        tags_count = db.query(Tag).filter(Tag.user_id == current_user.id).count()
        db.query(Tag).filter(Tag.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {tags_count} tags")
        
        # Delete all goals
        from app.models.goal import Goal
        goals_count = db.query(Goal).filter(Goal.user_id == current_user.id).count()
        db.query(Goal).filter(Goal.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {goals_count} goals")
        
        # Delete all reports
        from app.models.report import Report
        reports_count = db.query(Report).filter(Report.user_id == current_user.id).count()
        db.query(Report).filter(Report.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {reports_count} reports")
        
        # Remove user from shared budgets (but don't delete the budgets themselves)
        # If user is the creator, we need to handle it - remove from all budgets
        shared_budget_members = db.query(SharedBudgetMember).filter(
            SharedBudgetMember.user_id == current_user.id
        ).all()
        
        for member in shared_budget_members:
            budget = db.query(SharedBudget).filter(SharedBudget.id == member.shared_budget_id).first()
            if budget and budget.created_by == current_user.id:
                # If user created the budget, delete the entire budget
                db.query(SharedBudgetMember).filter(
                    SharedBudgetMember.shared_budget_id == budget.id
                ).delete()
                db.query(SharedBudget).filter(SharedBudget.id == budget.id).delete()
                logger.info(f"Deleted shared budget {budget.id} (user was creator)")
            else:
                # Just remove user from the budget
                db.delete(member)
                logger.info(f"Removed user from shared budget {member.shared_budget_id}")
        
        # Reset user settings to defaults (but keep authentication data)
        current_user.first_name = None
        current_user.last_name = None
        current_user.timezone = "UTC"
        current_user.default_currency = "RUB" if current_user.telegram_id else "USD"
        current_user.language = "en"
        current_user.is_2fa_enabled = False
        current_user.two_factor_secret = None
        current_user.backup_codes = None
        
        # Commit all deletions first
        db.commit()
        logger.info("All deletions committed")
        
        # Create default account
        default_account = Account(
            user_id=current_user.id,
            name="Основной счёт",
            account_type=AccountType.CASH,
            currency=current_user.default_currency,
            initial_balance=0.0,
            is_active=True,
            description="Автоматически созданный счёт"
        )
        db.add(default_account)
        db.flush()  # Flush to get account ID if needed
        logger.info(f"Created default account: {default_account.name}")
        
        # Create default categories
        DEFAULT_EXPENSE_CATEGORIES = [
            {"name": "Продукты", "icon": "🛒", "color": "#4CAF50", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Транспорт", "icon": "🚗", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Коммунальные услуги", "icon": "💡", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Связь и интернет", "icon": "📱", "color": "#00BCD4", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Кафе и рестораны", "icon": "🍽️", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": True},
            {"name": "Доставка еды", "icon": "🍕", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Здоровье", "icon": "🏥", "color": "#F44336", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Аптека", "icon": "💊", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Красота и уход", "icon": "💅", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Одежда", "icon": "👕", "color": "#E91E63", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Обувь", "icon": "👟", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Бытовая техника", "icon": "🏠", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Развлечения", "icon": "🎬", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Кино и театр", "icon": "🎭", "color": "#673AB7", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Хобби", "icon": "🎨", "color": "#9C27B0", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Образование", "icon": "📚", "color": "#3F51B5", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Курсы", "icon": "🎓", "color": "#2196F3", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Подарки", "icon": "🎁", "color": "#FF5722", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Праздники", "icon": "🎉", "color": "#FF9800", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Дети", "icon": "👶", "color": "#FFC107", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Домашние животные", "icon": "🐾", "color": "#795548", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
            {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.EXPENSE, "is_favorite": False},
        ]
        DEFAULT_INCOME_CATEGORIES = [
            {"name": "Зарплата", "icon": "💰", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": True},
            {"name": "Премия", "icon": "🎯", "color": "#FFC107", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Фриланс", "icon": "💼", "color": "#9C27B0", "transaction_type": TransactionType.INCOME, "is_favorite": True},
            {"name": "Подработка", "icon": "⚡", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Инвестиции", "icon": "📈", "color": "#2196F3", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Дивиденды", "icon": "💹", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Подарки", "icon": "🎁", "color": "#FF9800", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Возврат покупки", "icon": "↩️", "color": "#00BCD4", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Кэшбэк", "icon": "💳", "color": "#4CAF50", "transaction_type": TransactionType.INCOME, "is_favorite": False},
            {"name": "Прочее", "icon": "📦", "color": "#607D8B", "transaction_type": TransactionType.INCOME, "is_favorite": False},
        ]
        
        categories = []
        for cat_data in DEFAULT_EXPENSE_CATEGORIES + DEFAULT_INCOME_CATEGORIES:
            categories.append(Category(
                user_id=current_user.id,
                name=cat_data["name"],
                transaction_type=cat_data["transaction_type"],
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_system=True,
                is_active=True,
                is_favorite=cat_data.get("is_favorite", False)
            ))
        
        db.bulk_save_objects(categories)
        db.flush()
        logger.info(f"Created {len(categories)} default categories")
        
        # Final commit
        db.commit()
        db.refresh(current_user)
        
        logger.info(f"Account reset completed for user {current_user.id}. Default account and {len(categories)} categories created.")
        
        return UserResponse.model_validate(current_user)
        
    except Exception as e:
        logger.error(f"Error resetting account for user {current_user.id}: {e}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ошибка при сбросе данных: {str(e)}"
        )


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


def verify_telegram_signature(params: dict, bot_token: str) -> bool:
    """
    Verify Telegram Mini App initData hash signature
    
    Algorithm (Telegram uses HMAC-SHA256 with hex encoding):
    1. Extract all parameters except 'hash'
    2. Sort parameters by key in alphabetical order
    3. Create string: 'key1=value1\nkey2=value2\n...' (with newlines, not &)
    4. Calculate secret_key = HMAC-SHA256("WebAppData", bot_token)
    5. Calculate HMAC-SHA256(data_check_string, secret_key)
    6. Encode result in hex
    7. Compare with provided 'hash' parameter using constant-time comparison
    
    Args:
        params: Dictionary of parsed initData params
        bot_token: Telegram Bot Token (from TELEGRAM_BOT_TOKEN env var)
    
    Returns:
        True if signature is valid, False otherwise
    """
    import hmac
    import hashlib
    import logging
    logger = logging.getLogger(__name__)
    
    if not bot_token:
        logger.error("TELEGRAM_BOT_TOKEN is not configured. Cannot verify signature.")
        return False
    
    # Get hash parameter
    provided_hash = params.get('hash', '')
    if not provided_hash:
        logger.warning("No 'hash' parameter found in initData")
        return False
    
    # Extract all parameters except 'hash'
    data_params = {}
    for key, value in params.items():
        if key != 'hash':
            data_params[key] = value
    
    if not data_params:
        logger.warning("No parameters found in initData (except hash)")
        return False
    
    # Sort parameters by key in alphabetical order
    sorted_keys = sorted(data_params.keys())
    
    # Create string: 'key1=value1\nkey2=value2\n...' (Telegram uses newlines, not &)
    data_check_string = '\n'.join([f"{key}={data_params[key]}" for key in sorted_keys])
    
    # Calculate HMAC-SHA256 using bot_token as secret
    # Telegram uses the bot token as the HMAC secret key
    secret_key = hmac.new(
        "WebAppData".encode('utf-8'),
        bot_token.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    hmac_digest = hmac.new(
        secret_key,
        data_check_string.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Encode in hex
    calculated_hash = hmac_digest.hex()
    
    # Compare hashes using constant-time comparison to prevent timing attacks
    is_valid = hmac.compare_digest(calculated_hash, provided_hash)
    
    if is_valid:
        logger.info("Telegram signature verification passed")
    else:
        logger.error(f"Telegram signature verification failed. Expected: {calculated_hash}, Got: {provided_hash}")
        logger.error(f"Data check string: {data_check_string}")
    
    return is_valid


def verify_vk_signature(params: dict, secret_key: str) -> bool:
    """
    Verify VK Mini App launch params signature
    
    Algorithm (VK uses HMAC-SHA256 with base64 encoding):
    1. Extract all parameters starting with 'vk_' (except 'sign')
    2. Sort parameters by key in alphabetical order
    3. Create string: 'vk_key1=value1&vk_key2=value2&...'
    4. Calculate HMAC-SHA256 using secret_key
    5. Encode result in base64
    6. Compare with provided 'sign' parameter
    
    Args:
        params: Dictionary of parsed launch params
        secret_key: VK App Secret Key (from VK_APP_SECRET env var)
    
    Returns:
        True if signature is valid, False otherwise
    """
    import hmac
    import hashlib
    import base64
    import logging
    logger = logging.getLogger(__name__)
    
    if not secret_key:
        logger.error("VK_APP_SECRET is not configured. Cannot verify signature.")
        return False
    
    # Get sign parameter
    provided_sign = params.get('sign', '')
    if not provided_sign:
        logger.warning("No 'sign' parameter found in launch params")
        return False
    
    # Extract all vk_* parameters except 'sign'
    vk_params = {}
    for key, value in params.items():
        if key.startswith('vk_') and key != 'sign':
            vk_params[key] = value
    
    if not vk_params:
        logger.warning("No vk_* parameters found in launch params")
        return False
    
    # Sort parameters by key in alphabetical order
    sorted_keys = sorted(vk_params.keys())
    
    # Create string: 'vk_key1=value1&vk_key2=value2&...'
    param_string = '&'.join([f"{key}={vk_params[key]}" for key in sorted_keys])
    
    # Calculate HMAC-SHA256 using secret_key
    # Note: VK uses the param_string directly (without appending secret_key to the string)
    # The secret_key is used as the HMAC key
    hmac_digest = hmac.new(
        secret_key.encode('utf-8'),
        param_string.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    # Encode in URL-safe base64 (VK uses URL-safe base64 encoding)
    # URL-safe base64 uses '-' instead of '+' and '_' instead of '/'
    calculated_sign = base64.urlsafe_b64encode(hmac_digest).decode('utf-8')
    
    # Remove padding if present (VK signatures don't include padding)
    calculated_sign = calculated_sign.rstrip('=')
    
    # Compare signatures using constant-time comparison to prevent timing attacks
    # Also try URL-safe variant in case of encoding differences
    is_valid = hmac.compare_digest(calculated_sign, provided_sign)
    
    # If direct comparison fails, try URL-safe variant
    if not is_valid:
        url_safe_calculated = calculated_sign.replace('+', '-').replace('/', '_')
        is_valid = hmac.compare_digest(url_safe_calculated, provided_sign)
    
    if is_valid:
        logger.info("VK signature verification passed")
    else:
        logger.error(f"VK signature verification failed. Expected: {calculated_sign}, Got: {provided_sign}")
        logger.error(f"Sign string: {param_string}")
        logger.error(f"URL-safe expected: {calculated_sign.replace('+', '-').replace('/', '_')}")
        # Log security warning
        logger.warning("SECURITY: Potential VK signature tampering attempt detected!")
    
    return is_valid


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
            detail="Не авторизован",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_token(token)
    if payload is None:
        # decode_token уже логирует детальную информацию об ошибке
        # Здесь логируем только общее предупреждение
        if token and '.' in token:
            parts = token.split('.')
            if len(parts) != 3:
                logger.warning(f"Token format incorrect: expected 3 parts separated by '.', got {len(parts)} parts")
            # Если токен имеет 3 части, но decode_token вернул None - это может быть истекший токен или неверная подпись
            # Детали уже залогированы в decode_token
        else:
            logger.warning(f"Token format invalid: no '.' found, token length: {len(token) if token else 0}")
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные",
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
            detail="Неверные учетные данные",
        )
    
    logger.info(f"Token decoded successfully, user_id: {user_id}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        logger.warning(f"User not found for id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )
    
    logger.info(f"User found: id={user.id}, email={user.email}, telegram_id={user.telegram_id}")
    return user


def get_current_admin(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """Get current user and verify admin status"""
    # Auto-sync admin status for Telegram users before checking admin access
    if current_user.telegram_id:
        try:
            # Check by telegram_id (ADMIN_TELEGRAM_IDS)
            is_admin_by_id = str(current_user.telegram_id) in (settings.ADMIN_TELEGRAM_IDS or [])
            
            # Check by username (ADMIN_TELEGRAM_USERNAMES) if username exists
            is_admin_by_username = False
            if current_user.telegram_username:
                username_lower = current_user.telegram_username.lower().lstrip('@')
                is_admin_by_username = username_lower in (settings.ADMIN_TELEGRAM_USERNAMES or [])
            
            # User should be admin if they are in either list
            should_be_admin = is_admin_by_id or is_admin_by_username
            
            if current_user.is_admin != should_be_admin:
                logger.info(f"Auto-syncing admin status in get_current_admin for user {current_user.id} (telegram_id={current_user.telegram_id}): {current_user.is_admin} -> {should_be_admin}")
                current_user.is_admin = should_be_admin
                db.commit()
                db.refresh(current_user)
        except Exception as e:
            logger.error(f"Error auto-syncing admin status in get_current_admin: {e}", exc_info=True)
            # Don't fail the request if sync fails, but log the error
    
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуется доступ администратора"
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
            detail="Email уже зарегистрирован"
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
            
            # Convert enum to string value to avoid type mismatch in bulk operations
            transaction_type_value = cat_data["transaction_type"]
            if isinstance(transaction_type_value, TransactionType):
                transaction_type_value = transaction_type_value.value  # Get "income", "expense", or "both"
            elif isinstance(transaction_type_value, str):
                transaction_type_value = transaction_type_value.lower()
            
            categories.append(Category(
                user_id=db_user.id,
                name=name,
                transaction_type=transaction_type_value,  # Use string value instead of enum
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
            detail="Неверный email или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт пользователя неактивен"
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
    current_token: Optional[str] = None  # Optional token to link to existing account


@router.post("/telegram", response_model=TokenResponse)
async def login_telegram(
    request: TelegramLoginRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = None
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
        logger.info(f"InitData preview (first 200 chars): {init_data[:200] if init_data else 'empty'}")
        logger.info(f"InitData contains 'user=': {init_data and 'user=' in init_data}")
        logger.info(f"InitData contains 'hash=': {init_data and 'hash=' in init_data}")
        
        if not init_data or len(init_data) == 0:
            logger.warning("Empty initData received")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Не получены данные Telegram. Убедитесь, что открыто через Telegram Mini App."
            )
        
        # Parse initData - Format: key1=value1&key2=value2&hash=...
        params = {}
        try:
            for param in init_data.split('&'):
                if '=' in param:
                    key, value = param.split('=', 1)
                    params[key] = urllib.parse.unquote(value)
        except Exception as parse_error:
            logger.error(f"Error parsing initData: {parse_error}, initData: {init_data[:500]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ошибка парсинга данных Telegram: {str(parse_error)}"
            )
        
        logger.info(f"Parsed initData params: {list(params.keys())}")
        logger.info(f"Has 'user' param: {'user' in params}, Has 'hash' param: {'hash' in params}")
        
        # Verify Telegram signature to prevent parameter tampering
        if not settings.TELEGRAM_BOT_TOKEN:
            logger.error("TELEGRAM_BOT_TOKEN is not configured. Telegram authentication is disabled for security.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Telegram authentication is not properly configured. Please contact support."
            )
        
        if not verify_telegram_signature(params, settings.TELEGRAM_BOT_TOKEN):
            logger.error("Invalid Telegram signature. InitData may be tampered with.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверная подпись авторизации Telegram. Убедитесь, что вы открыли приложение через Telegram Mini App."
            )
        
        # Extract and parse user data from initData
        user_str = params.get('user', '')
        if not user_str:
            logger.warning(f"No 'user' param in initData. Available params: {list(params.keys())}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Данные пользователя Telegram не найдены. Убедитесь, что открыто через Telegram Mini App."
            )
        
        # Parse JSON user data
        try:
            user_obj = json.loads(user_str)
            logger.info(f"Parsed user object, telegram_id: {user_obj.get('id')}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse user JSON: {e}, user_str: {user_str[:100]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Неверный формат данных пользователя Telegram: {str(e)}"
            )
        
        # Normalize telegram_id - ensure consistent format
        telegram_id_raw = user_obj.get('id')
        telegram_id = str(telegram_id_raw).strip() if telegram_id_raw is not None else None
        
        if not telegram_id or telegram_id == 'None' or telegram_id == '':
            logger.error(f"No telegram_id in user object: {user_obj}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="ID пользователя Telegram не найден"
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
        
        # If still not found, try to link to existing account
        # Strategy 1: If user provided current_token, link to that account
        if not user and request.current_token:
            try:
                payload = decode_token(request.current_token)
                if payload and payload.get("sub"):
                    current_user_id = int(payload.get("sub"))
                    current_user = db.query(User).filter(User.id == current_user_id).first()
                    if current_user:
                        logger.info(f"Linking Telegram account to existing user {current_user.id} (from token)")
                        user = current_user
                        user.telegram_id = telegram_id
                        user.telegram_username = telegram_username
                        # Update name if available and not set
                        if first_name and not user.first_name:
                            user.first_name = first_name
                        if last_name and not user.last_name:
                            user.last_name = last_name
                        is_new_user = False
            except Exception as e:
                logger.warning(f"Failed to decode current_token for account linking: {e}")
        
        # Strategy 2: If no token, try to link to existing VK account
        # Check if there's exactly one user with vk_id but no telegram_id
        if not user:
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
                    
                    # Convert enum to string value to avoid type mismatch in bulk operations
                    transaction_type_value = cat_data["transaction_type"]
                    if isinstance(transaction_type_value, TransactionType):
                        transaction_type_value = transaction_type_value.value  # Get "income", "expense", or "both"
                    elif isinstance(transaction_type_value, str):
                        transaction_type_value = transaction_type_value.lower()
                    
                    categories.append(Category(
                        user_id=user.id,
                        name=name,
                        transaction_type=transaction_type_value,  # Use string value instead of enum
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
            detail=f"Ошибка авторизации через Telegram: {str(e)}"
        )


class VKLoginRequest(BaseModel):
    launch_params: str  # URL query string with vk_* parameters
    current_token: Optional[str] = None  # Optional token to link to existing account
    first_name: Optional[str] = None  # User's first name from VK profile
    last_name: Optional[str] = None  # User's last name from VK profile


@router.post("/vk", response_model=TokenResponse)
async def login_vk(
    request: VKLoginRequest,
    db: Session = Depends(get_db),
    authorization: Optional[str] = None
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
        
        # Log raw launch_params for debugging
        logger.info(f"Raw launch_params (first 500 chars): {launch_params[:500]}")
        
        # Parse launch params - Format: ?vk_user_id=123&vk_app_id=456&sign=...
        # Remove leading ? if present
        if launch_params.startswith('?'):
            launch_params = launch_params[1:]
        
        params = {}
        for param in launch_params.split('&'):
            if '=' in param:
                key, value = param.split('=', 1)
                params[key] = urllib.parse.unquote(value)
        
        logger.info(f"Parsed launch params keys: {list(params.keys())}")
        logger.info(f"Parsed launch params values (first 200 chars each): {[(k, str(v)[:200]) for k, v in params.items()]}")
        
        # Verify VK signature to prevent parameter tampering
        if not settings.VK_APP_SECRET:
            logger.error("VK_APP_SECRET is not configured. VK authentication is disabled for security.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="VK authentication is not properly configured. Please contact support."
            )
        
        if not verify_vk_signature(params, settings.VK_APP_SECRET):
            logger.error("Invalid VK signature. Launch params may be tampered with.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверная подпись авторизации VK. Убедитесь, что вы открыли приложение через VK Mini App."
            )
        
        # Extract vk_user_id - try different possible keys
        vk_user_id_raw = params.get('vk_user_id') or params.get('user_id') or params.get('uid')
        
        if not vk_user_id_raw:
            # Log all params for debugging
            logger.error(f"VK user ID not found. All params: {params}")
            logger.error(f"Launch params string: {launch_params[:500]}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"VK user ID not found in launch params. Available keys: {list(params.keys())}"
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
        
        # Get user name from request (sent from frontend via VKWebAppGetUserInfo)
        # Fallback to launch params if not provided
        first_name = request.first_name or params.get('first_name', '') or ''
        last_name = request.last_name or params.get('last_name', '') or ''
        
        logger.info(f"VK user name: first_name='{first_name}', last_name='{last_name}'")
        
        # Get VK language from launch params (vk_language)
        vk_language = params.get('vk_language', '').lower()
        if vk_language:
            # Map VK language codes to app languages
            # VK uses language codes like 'ru', 'en', 'uk', 'kk', 'be', etc.
            if vk_language.startswith('ru'):
                app_language = 'ru'
                default_currency = 'RUB'
            elif vk_language.startswith('en'):
                app_language = 'en'
                default_currency = 'USD'
            else:
                # For other languages (uk, kk, be, etc.), default to Russian/RUB
                app_language = 'ru'
                default_currency = 'RUB'
        else:
            # No vk_language in params, use default (Russian/RUB)
            app_language = 'ru'
            default_currency = 'RUB'
        
        logger.info(f"VK language: vk_language='{vk_language}', app_language='{app_language}', default_currency='{default_currency}'")
        
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
        
        # If still not found, try to link to existing account
        # Strategy 1: If user provided current_token, link to that account
        if not user and request.current_token:
            try:
                payload = decode_token(request.current_token)
                if payload and payload.get("sub"):
                    current_user_id = int(payload.get("sub"))
                    current_user = db.query(User).filter(User.id == current_user_id).first()
                    if current_user:
                        logger.info(f"Linking VK account to existing user {current_user.id} (from token)")
                        user = current_user
                        user.vk_id = vk_id
                        # Update name if available and not set
                        if first_name and not user.first_name:
                            user.first_name = first_name
                        if last_name and not user.last_name:
                            user.last_name = last_name
                        is_new_user = False
            except Exception as e:
                logger.warning(f"Failed to decode current_token for account linking: {e}")
        
        # Strategy 2: If no token, try to link to existing Telegram account
        # Check if there's exactly one user with telegram_id but no vk_id
        if not user:
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
                default_currency=default_currency,  # Set currency based on VK language
                language=app_language,  # Set language based on VK language
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
            # Update language and currency based on VK language
            if app_language and user.language != app_language:
                user.language = app_language
                updated = True
            if default_currency and user.default_currency != default_currency:
                user.default_currency = default_currency
                updated = True
        
        user.last_login = datetime.utcnow()
        db.commit()
        db.refresh(user)
        
        logger.info(f"User processed: id={user.id}, vk_id={user.vk_id}, is_new={is_new_user}")
        
        # Check if user has categories (for both new and existing users)
        from app.models.category import Category
        category_count = db.query(Category).filter(Category.user_id == user.id).count()
        has_categories = category_count > 0
        
        # Create default account and categories for new users or users without categories
        if is_new_user or not has_categories:
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
                    
                    # Convert enum to string value to avoid type mismatch in bulk operations
                    transaction_type_value = cat_data["transaction_type"]
                    if isinstance(transaction_type_value, TransactionType):
                        transaction_type_value = transaction_type_value.value  # Get "income", "expense", or "both"
                    elif isinstance(transaction_type_value, str):
                        transaction_type_value = transaction_type_value.lower()
                    
                    categories.append(Category(
                        user_id=user.id,
                        name=name,
                        transaction_type=transaction_type_value,  # Use string value instead of enum
                        icon=icon,
                        color=cat_data["color"],
                        is_system=True,
                        is_active=True,
                        is_favorite=cat_data.get("is_favorite", False)
                    ))
                
                db.add_all(categories)
                try:
                    db.commit()
                    logger.info(f"Default account and categories created for user {user.id}")
                except Exception as e:
                    logger.error(f"Failed to commit default account/categories: {e}", exc_info=True)
                    db.rollback()
                    # Try to create categories separately if account creation succeeded
                    try:
                        # Check if account was created
                        account_exists = db.query(Account).filter(Account.user_id == user.id).first()
                        if account_exists:
                            # Try to create categories again
                            categories_retry = []
                            for cat_data in DEFAULT_EXPENSE_CATEGORIES + DEFAULT_INCOME_CATEGORIES:
                                name = str(cat_data["name"]).encode('utf-8').decode('utf-8')
                                icon = str(cat_data["icon"]).encode('utf-8').decode('utf-8')
                                
                                # Convert enum to string value to avoid type mismatch in bulk operations
                                transaction_type_value = cat_data["transaction_type"]
                                if isinstance(transaction_type_value, TransactionType):
                                    transaction_type_value = transaction_type_value.value  # Get "income", "expense", or "both"
                                elif isinstance(transaction_type_value, str):
                                    transaction_type_value = transaction_type_value.lower()
                                
                                categories_retry.append(Category(
                                    user_id=user.id,
                                    name=name,
                                    transaction_type=transaction_type_value,  # Use string value instead of enum
                                    icon=icon,
                                    color=cat_data["color"],
                                    is_system=True,
                                    is_active=True,
                                    is_favorite=cat_data.get("is_favorite", False)
                                ))
                            
                            db.add_all(categories_retry)
                            db.commit()
                            logger.info(f"Categories created separately for user {user.id}")
                    except Exception as e2:
                        logger.error(f"Failed to create categories separately: {e2}", exc_info=True)
                        db.rollback()
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


class VKBotTokenRequest(BaseModel):
    vk_id: str


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


@router.post("/bot-token-vk")
async def get_bot_token_vk(
    request: VKBotTokenRequest,
    db: Session = Depends(get_db)
):
    """Get JWT token for VK bot by vk_id"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Normalize vk_id - ensure it's a string without whitespace
    vk_id = str(request.vk_id).strip()
    logger.info(f"VK bot token request for vk_id: '{vk_id}' (type: {type(vk_id)}, length: {len(vk_id)})")
    
    # Try to find user by vk_id (exact match)
    user = db.query(User).filter(User.vk_id == vk_id).first()
    
    # If not found, try to find by converting to int and back (in case of type mismatch)
    if not user:
        try:
            vk_id_int = int(vk_id)
            for alt_id in [str(vk_id_int), f"{vk_id_int}"]:
                alt_user = db.query(User).filter(User.vk_id == alt_id).first()
                if alt_user:
                    logger.info(f"Found user with alternative vk_id format: '{alt_id}'")
                    user = alt_user
                    break
        except (ValueError, TypeError):
            pass
    
    # Debug: log all users with vk_id to see what's in database
    if not user:
        all_users_with_vk = db.query(User).filter(User.vk_id.isnot(None)).all()
        logger.warning(f"User not found for vk_id: '{vk_id}'. Found {len(all_users_with_vk)} users with vk_id in database:")
        for u in all_users_with_vk[:5]:
            logger.warning(f"  - User ID: {u.id}, vk_id: '{u.vk_id}' (type: {type(u.vk_id)}, repr: {repr(u.vk_id)})")
    
    if not user:
        logger.warning(f"User not found for vk_id: {vk_id}, creating new user")
        
        # Auto-create user if not exists
        try:
            username = f"vk_{vk_id}"
            email = f"vk_{vk_id}@vk.local"
            
            # Ensure unique email
            counter = 1
            while db.query(User).filter(User.email == email).first():
                email = f"vk_{vk_id}_{counter}@vk.local"
                counter += 1
            
            user = User(
                email=email,
                username=username,
                vk_id=vk_id,
                is_active=True,
                is_verified=True,  # VK users are considered verified
                default_currency="RUB",
            )
            db.add(user)
            db.flush()
            db.commit()
            db.refresh(user)
            
            logger.info(f"Auto-created user for vk_id: {vk_id}, user_id: {user.id}")
            
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
        logger.warning(f"User {user.id} (vk_id: {vk_id}) is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    # Create token
    access_token = create_access_token(data={"sub": user.id})
    logger.info(f"Token created for user {user.id} (vk_id: {vk_id})")
    
    return {"access_token": access_token}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    import logging
    logger = logging.getLogger(__name__)
    
    # Логирование заголовков для отладки
    auth_header = request.headers.get("authorization")
    logger.info(f"/me endpoint called, Authorization header present: {bool(auth_header)}, value: {auth_header[:50] + '...' if auth_header and len(auth_header) > 50 else auth_header}")
    
    # Auto-sync admin status for Telegram users based on ADMIN_TELEGRAM_IDS
    if current_user.telegram_id:
        try:
            # Check by telegram_id (ADMIN_TELEGRAM_IDS)
            is_admin_by_id = str(current_user.telegram_id) in (settings.ADMIN_TELEGRAM_IDS or [])
            
            # Check by username (ADMIN_TELEGRAM_USERNAMES) if username exists
            is_admin_by_username = False
            if current_user.telegram_username:
                username_lower = current_user.telegram_username.lower().lstrip('@')
                is_admin_by_username = username_lower in (settings.ADMIN_TELEGRAM_USERNAMES or [])
            
            # User should be admin if they are in either list
            should_be_admin = is_admin_by_id or is_admin_by_username
            
            if current_user.is_admin != should_be_admin:
                logger.info(f"Auto-syncing admin status for user {current_user.id} (telegram_id={current_user.telegram_id}): {current_user.is_admin} -> {should_be_admin}")
                current_user.is_admin = should_be_admin
                db.commit()
                db.refresh(current_user)
        except Exception as e:
            logger.error(f"Error auto-syncing admin status: {e}", exc_info=True)
            # Don't fail the request if sync fails
    
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
        
        # Commit transaction deletion to ensure it's applied before deleting categories
        # This prevents foreign key constraint violations
        db.commit()
        logger.info("Transaction deletions committed")
        
        # Delete all goals BEFORE accounts (goals have foreign key to accounts)
        from app.models.goal import Goal
        goals_count = db.query(Goal).filter(Goal.user_id == current_user.id).count()
        db.query(Goal).filter(Goal.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {goals_count} goals")
        
        # Delete all accounts (after goals are deleted)
        if account_ids:
            db.query(Account).filter(Account.id.in_(account_ids)).delete(synchronize_session=False)
        logger.info(f"Deleted {accounts_count} accounts")
        
        # Before deleting categories, ensure no transactions reference them
        # Update any remaining transactions to set category_id to NULL
        # (This is a safety measure in case some transactions weren't deleted)
        remaining_transactions = db.query(Transaction).filter(
            Transaction.category_id.in_(
                db.query(Category.id).filter(Category.user_id == current_user.id)
            )
        ).all()
        if remaining_transactions:
            logger.warning(f"Found {len(remaining_transactions)} transactions still referencing categories, setting category_id to NULL")
            for trans in remaining_transactions:
                trans.category_id = None
            db.flush()
        
        # Delete all categories (now safe since transactions are deleted or have NULL category_id)
        categories_count = db.query(Category).filter(Category.user_id == current_user.id).count()
        db.query(Category).filter(Category.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {categories_count} categories")
        
        # Delete all tags (transaction_tags associations are deleted automatically when transactions are deleted)
        from app.models.tag import Tag
        tags_count = db.query(Tag).filter(Tag.user_id == current_user.id).count()
        db.query(Tag).filter(Tag.user_id == current_user.id).delete(synchronize_session=False)
        logger.info(f"Deleted {tags_count} tags")
        
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
            # Convert enum to string value explicitly to avoid type mismatch in bulk operations
            transaction_type_value = cat_data["transaction_type"]
            if isinstance(transaction_type_value, TransactionType):
                transaction_type_value = transaction_type_value.value  # Get "income", "expense", or "both"
            elif isinstance(transaction_type_value, str):
                transaction_type_value = transaction_type_value.lower()
            
            categories.append(Category(
                user_id=current_user.id,
                name=cat_data["name"],
                transaction_type=transaction_type_value,  # Use string value instead of enum
                icon=cat_data["icon"],
                color=cat_data["color"],
                is_system=True,
                is_active=True,
                is_favorite=cat_data.get("is_favorite", False)
            ))
        
        # Use add_all instead of bulk_save_objects to ensure TypeDecorator is applied
        db.add_all(categories)
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


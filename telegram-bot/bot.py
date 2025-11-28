import logging
import asyncio
import sys
import requests
import base64
import json
import httpx
from datetime import datetime, timezone
from decouple import config
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler, CallbackQueryHandler
from typing import Dict, Optional, TYPE_CHECKING

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot configuration
TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")
BACKEND_URL_RAW = config("BACKEND_URL", default="http://localhost:8000")
TELEGRAM_WEBHOOK_URL = config("TELEGRAM_WEBHOOK_URL", default="")
# Railway automatically provides HTTPS URL via RAILWAY_PUBLIC_DOMAIN
RAILWAY_PUBLIC_DOMAIN = config("RAILWAY_PUBLIC_DOMAIN", default="")
RAILWAY_STATIC_URL = config("RAILWAY_STATIC_URL", default="")

# Normalize BACKEND_URL - remove trailing slash and ensure proper format
BACKEND_URL = BACKEND_URL_RAW.rstrip("/")

# Validate BACKEND_URL
if "your-backend" in BACKEND_URL.lower() or "localhost" in BACKEND_URL.lower():
    logger.warning(f"⚠️ BACKEND_URL seems to be a placeholder: {BACKEND_URL}")
    logger.warning("⚠️ Please set BACKEND_URL environment variable to your actual Railway backend URL")
    
if not BACKEND_URL.startswith(("http://", "https://")):
    logger.error(f"❌ Invalid BACKEND_URL format: {BACKEND_URL}. Must start with http:// or https://")
    BACKEND_URL = "http://localhost:8000"  # Fallback to localhost
    
logger.info(f"Backend URL configured: {BACKEND_URL}")

# Conversation states
WAITING_AMOUNT, WAITING_DESCRIPTION, WAITING_ACCOUNT, WAITING_CATEGORY = range(4)
WAITING_GOAL_INFO, WAITING_GOAL_CONFIRMATION = range(4, 6)
WAITING_LUCY_QUESTION = 6

# Store user tokens
user_tokens: Dict[int, str] = {}

# Import translations
from locales.ru import ru
from locales.en import en

# Translations dictionary
translations = {
    "ru": ru,
    "en": en,
}

# Default language
DEFAULT_LANGUAGE = "ru"


def is_token_expired(token: str) -> bool:
    """Check if JWT token is expired"""
    try:
        # JWT format: header.payload.signature
        parts = token.split('.')
        if len(parts) != 3:
            return True  # Invalid format, consider expired
        
        # Decode payload (second part)
        payload_b64 = parts[1]
        # Add padding if needed
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes)
        
        # Check expiration
        exp = payload.get('exp')
        if not exp:
            return True  # No expiration, consider expired for safety
        
        # Compare with current time (exp is in UTC seconds)
        current_time = datetime.now(timezone.utc).timestamp()
        
        # Add 5 minute buffer - refresh token if it expires in less than 5 minutes
        if exp < (current_time + 300):
            logger.debug(f"Token expires soon (exp: {exp}, current: {current_time}, diff: {exp - current_time}s)")
            return True
        
        return False
    except Exception as e:
        logger.warning(f"Error checking token expiration: {e}, considering expired")
        return True  # On error, consider expired for safety


async def get_user_token(telegram_id: str, force_refresh: bool = False) -> str:
    """Get or refresh user token with expiration check"""
    user_id = int(telegram_id)
    
    # Check if we have cached token and it's not expired
    if not force_refresh and user_id in user_tokens:
        cached_token = user_tokens[user_id]
        if cached_token and len(cached_token) > 50:  # JWT tokens are usually long
            # Check if token is expired
            if not is_token_expired(cached_token):
                logger.debug(f"Using cached token for user {user_id}")
                return cached_token
            else:
                logger.info(f"Cached token expired for user {user_id}, fetching new one")
                del user_tokens[user_id]
        else:
            # Invalid cached token, remove it
            logger.warning(f"Invalid cached token for user {user_id}, fetching new one")
            del user_tokens[user_id]
    
    # Get new token
    import httpx
    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"Fetching token for telegram_id: {telegram_id}")
            response = await client.post(
                f"{BACKEND_URL}/api/v1/auth/bot-token",
                json={"telegram_id": telegram_id},
                timeout=5.0
            )
            
            logger.info(f"Token response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                
                if not token:
                    logger.error(f"No access_token in response: {data}")
                    raise Exception("No access_token in response")
                
                if len(token) < 50:
                    logger.error(f"Token too short, might be invalid: {len(token)} chars")
                    raise Exception(f"Invalid token received: {token[:20]}...")
                
                logger.info(f"Successfully fetched token (length: {len(token)})")
                user_tokens[user_id] = token
                return token
            else:
                error_text = response.text
                logger.error(f"Failed to get token: {response.status_code} - {error_text}")
                raise Exception(f"Failed to get token: {response.status_code} - {error_text}")
        except Exception as e:
            logger.error(f"Error getting token for {telegram_id}: {e}", exc_info=True)
            raise


async def make_authenticated_request(
    method: str,
    url: str,
    telegram_id: str,
    json_data: Optional[dict] = None,
    params: Optional[dict] = None,
    timeout: float = 5.0,
    retry_on_401: bool = True
):
    """
    Make an authenticated HTTP request with automatic token refresh on 401
    
    Args:
        method: HTTP method (GET, POST, PUT, DELETE, etc.)
        url: Full URL to request
        telegram_id: Telegram user ID for authentication
        json_data: Optional JSON data for POST/PUT requests
        params: Optional query parameters
        timeout: Request timeout in seconds
        retry_on_401: Whether to retry once with a fresh token on 401 error
    
    Returns:
        httpx.Response object
    """
    import httpx
    
    # Get token
    token = await get_user_token(telegram_id)
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        
        # Make request
        if method.upper() == "GET":
            response = await client.get(url, headers=headers, params=params, timeout=timeout)
        elif method.upper() == "POST":
            response = await client.post(url, headers=headers, json=json_data, params=params, timeout=timeout)
        elif method.upper() == "PUT":
            response = await client.put(url, headers=headers, json=json_data, params=params, timeout=timeout)
        elif method.upper() == "DELETE":
            response = await client.delete(url, headers=headers, params=params, timeout=timeout)
        elif method.upper() == "PATCH":
            response = await client.patch(url, headers=headers, json=json_data, params=params, timeout=timeout)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # If 401 and retry enabled, refresh token and retry once
        if response.status_code == 401 and retry_on_401:
            logger.warning(f"Got 401 Unauthorized, refreshing token and retrying for user {telegram_id}")
            # Clear cached token
            user_id = int(telegram_id)
            if user_id in user_tokens:
                del user_tokens[user_id]
            
            # Get fresh token (cache already cleared, so it will fetch new one)
            token = await get_user_token(telegram_id)
            headers = {"Authorization": f"Bearer {token}"}
            
            # Retry request
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=params, timeout=timeout)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=json_data, params=params, timeout=timeout)
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers, json=json_data, params=params, timeout=timeout)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers, params=params, timeout=timeout)
            elif method.upper() == "PATCH":
                response = await client.patch(url, headers=headers, json=json_data, params=params, timeout=timeout)
        
        return response


async def get_user_language(telegram_id: str) -> str:
    """Get user language from profile, default to 'ru'"""
    try:
        user_response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/auth/me",
            telegram_id,
            timeout=5.0
        )
        if user_response.status_code == 200:
            user_data = user_response.json()
            lang = user_data.get('language', DEFAULT_LANGUAGE)
            # Normalize language code
            lang = lang.lower() if lang else DEFAULT_LANGUAGE
            if lang not in translations:
                lang = DEFAULT_LANGUAGE
            return lang
    except Exception as e:
        logger.warning(f"Could not get user language: {e}, using default")
    return DEFAULT_LANGUAGE


def t(key: str, language: str = "ru", **kwargs) -> str:
    """
    Get translated text
    
    Args:
        key: Translation key in format "section.key" (e.g., "start.greeting")
        language: Language code ("ru" or "en")
        **kwargs: Format arguments for the translation string
    
    Returns:
        Translated and formatted string
    """
    if language not in translations:
        language = DEFAULT_LANGUAGE
    
    try:
        # Split key into section and key
        parts = key.split(".", 1)
        if len(parts) != 2:
            logger.warning(f"Invalid translation key format: {key}")
            return key
        
        section, item = parts
        translation = translations[language].get(section, {}).get(item, key)
        
        # Format with kwargs if provided
        if kwargs:
            try:
                return translation.format(**kwargs)
            except KeyError as e:
                logger.warning(f"Missing format argument {e} for key {key}")
                return translation
        
        return translation
    except Exception as e:
        logger.error(f"Error getting translation for key {key}: {e}")
        return key


def escape_markdown(text: str) -> str:
    """Escape special Markdown characters to prevent parsing errors"""
    if not text:
        return text
    # Characters that need to be escaped in Markdown: _ * [ ] ( ) ` ~
    special_chars = ['_', '*', '[', ']', '(', ')', '`', '~']
    escaped = text
    for char in special_chars:
        escaped = escaped.replace(char, '\\' + char)
    return escaped


def get_transaction_description(transaction: dict, language: str = "ru") -> str:
    """Get transaction description, using category_name if description is missing"""
    description = transaction.get('description')
    category_name = transaction.get('category_name')
    
    # Use description if available and valid
    if description and str(description).strip() and str(description).strip() not in ('None', 'null'):
        return str(description).strip()
    # Use category_name if available and valid
    elif category_name and str(category_name).strip() and str(category_name).strip() not in ('None', 'null'):
        return str(category_name).strip()
    # Default fallback
    else:
        return t("common.no_description", language)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.effective_user
    telegram_id = str(user.id)
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    # Escape user's first name to prevent Markdown parsing errors
    safe_name = escape_markdown(user.first_name or "Пользователь")
    
    # Build message
    message = (
        t("start.greeting", lang, name=safe_name) +
        t("start.commands", lang) +
        t("start.balance", lang) +
        t("start.transactions", lang) +
        t("start.add_expense", lang) +
        t("start.add_income", lang) +
        t("start.report", lang) +
        t("start.goal", lang) +
        t("start.ask_lucy", lang) +
        t("start.help", lang) +
        t("start.language", lang) +
        t("start.important", lang)
    )
    
    await update.message.reply_text(message, parse_mode='Markdown')


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    user = update.effective_user
    telegram_id = str(user.id)
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    # Build help text
    help_text = (
        t("help.title", lang) +
        t("help.start", lang) +
        t("help.balance", lang) +
        t("help.transactions", lang) +
        t("help.add_expense", lang) +
        t("help.add_income", lang) +
        t("help.report", lang) +
        t("help.goal", lang) +
        t("help.ask_lucy", lang) +
        t("help.language", lang) +
        t("help.cancel", lang) +
        t("help.help", lang) +
        t("help.usage", lang) +
        t("help.usage_expense", lang) +
        t("help.usage_report", lang) +
        t("help.usage_goal", lang) +
        t("help.usage_ask_lucy", lang)
    )
    
    await update.message.reply_text(help_text, parse_mode='Markdown')


async def language_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /language command - change user language"""
    user = update.effective_user
    telegram_id = str(user.id)
    
    # Get current language
    current_lang = await get_user_language(telegram_id)
    lang_display = "Русский" if current_lang == "ru" else "English"
    
    # Create keyboard with language options
    keyboard = [
        [
            InlineKeyboardButton("🇷🇺 Русский", callback_data="lang_ru"),
            InlineKeyboardButton("🇬🇧 English", callback_data="lang_en"),
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Get language for message (use current language)
    lang = current_lang
    message = (
        t("language.select", lang) +
        t("language.current", lang, lang=lang_display)
    )
    
    await update.message.reply_text(message, reply_markup=reply_markup, parse_mode='Markdown')


async def language_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle language selection callback"""
    query = update.callback_query
    await query.answer()
    
    telegram_id = str(query.from_user.id)
    selected_lang = query.data.split("_")[1]  # lang_ru or lang_en
    
    if selected_lang not in ["ru", "en"]:
        await query.edit_message_text(t("language.error", "ru"))
        return
    
    try:
        # Update user language in backend
        response = await make_authenticated_request(
            "PUT",
            f"{BACKEND_URL}/api/v1/auth/me",
            telegram_id,
            json_data={"language": selected_lang},
            timeout=5.0
        )
        
        if response.status_code == 200:
            lang_display = "Русский" if selected_lang == "ru" else "English"
            message = t("language.changed", selected_lang, lang=lang_display)
            await query.edit_message_text(message, parse_mode='Markdown')
        else:
            await query.edit_message_text(t("language.error", selected_lang))
    except Exception as e:
        logger.error(f"Error changing language: {e}")
        await query.edit_message_text(t("language.error", selected_lang))


async def notifications_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /notifications command - manage Telegram notification settings only"""
    user = update.effective_user
    telegram_id = str(user.id)
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    try:
        # Удаляем предыдущее сообщение с настройками уведомлений, если оно есть
        previous_message_id = context.user_data.get('notifications_message_id')
        if previous_message_id:
            try:
                await update.message.bot.delete_message(
                    chat_id=update.effective_chat.id,
                    message_id=previous_message_id
                )
                logger.debug(f"Deleted previous notifications message {previous_message_id} for user {user.id}")
            except Exception as e:
                # Сообщение уже удалено или не найдено - это нормально
                logger.debug(f"Could not delete previous notifications message: {e}")
        
        # Get current user settings
        response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/auth/me",
            telegram_id,
            timeout=5.0
        )
        
        if response.status_code != 200:
            await update.message.reply_text(t("notifications.error", lang))
            return
        
        user_data = response.json()
        telegram_enabled = user_data.get('telegram_notifications_enabled', True)
        
        # Build status text - only Telegram notifications
        telegram_status = t("notifications.enabled", lang) if telegram_enabled else t("notifications.disabled", lang)
        
        message_text = (
            t("notifications.title", lang) +
            t("notifications.telegram_status", lang, status=telegram_status)
        )
        
        # Create keyboard with toggle button - only Telegram
        keyboard = []
        
        # Telegram toggle button
        telegram_button_text = t("notifications.telegram_toggle", lang, 
            status="✅" if telegram_enabled else "❌")
        keyboard.append([InlineKeyboardButton(
            telegram_button_text,
            callback_data=f"notif_tg_{not telegram_enabled}"
        )])
        
        reply_markup = InlineKeyboardMarkup(keyboard)
        sent_message = await update.message.reply_text(message_text, reply_markup=reply_markup, parse_mode='Markdown')
        
        # Сохраняем ID сообщения для последующего удаления
        if sent_message:
            context.user_data['notifications_message_id'] = sent_message.message_id
        
    except Exception as e:
        logger.error(f"Error getting notification settings: {e}")
        await update.message.reply_text(t("notifications.error", lang))


async def notifications_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle notification toggle callback - only Telegram notifications"""
    query = update.callback_query
    await query.answer()
    
    telegram_id = str(query.from_user.id)
    lang = await get_user_language(telegram_id)
    
    try:
        # Parse callback data: notif_tg_True or notif_tg_False
        parts = query.data.split("_")
        if len(parts) != 3:
            await query.edit_message_text(t("notifications.error", lang))
            return
        
        platform = parts[1]  # "tg"
        new_value = parts[2] == "True"  # Convert string to bool
        
        # Only Telegram notifications in Telegram bot
        if platform != "tg":
            await query.edit_message_text(t("notifications.error", lang))
            return
        
        # Prepare update data
        update_data = {"telegram_notifications_enabled": new_value}
        
        # Update settings in backend
        response = await make_authenticated_request(
            "PUT",
            f"{BACKEND_URL}/api/v1/auth/me",
            telegram_id,
            json_data=update_data,
            timeout=5.0
        )
        
        if response.status_code == 200:
            # Get updated settings to refresh the message
            user_response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/auth/me",
                telegram_id,
                timeout=5.0
            )
            
            if user_response.status_code == 200:
                user_data = user_response.json()
                telegram_enabled = user_data.get('telegram_notifications_enabled', True)
                
                # Build updated message
                telegram_status = t("notifications.enabled", lang) if telegram_enabled else t("notifications.disabled", lang)
                message_text = (
                    t("notifications.title", lang) +
                    t("notifications.telegram_status", lang, status=telegram_status)
                )
                
                # Create updated keyboard
                keyboard = []
                telegram_button_text = t("notifications.telegram_toggle", lang, 
                    status="✅" if telegram_enabled else "❌")
                keyboard.append([InlineKeyboardButton(
                    telegram_button_text,
                    callback_data=f"notif_tg_{not telegram_enabled}"
                )])
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                # Edit the message instead of calling notifications_command
                await query.edit_message_text(
                    message_text, 
                    reply_markup=reply_markup, 
                    parse_mode='Markdown'
                )
            else:
                # If can't get updated settings, just show success
                await query.edit_message_text(t("notifications.updated", lang))
        else:
            logger.error(f"Failed to update notification settings: {response.status_code} - {response.text}")
            await query.edit_message_text(t("notifications.error", lang))
            
    except Exception as e:
        logger.error(f"Error updating notification settings: {e}", exc_info=True)
        await query.edit_message_text(t("notifications.error", lang))


async def get_user_token(telegram_id: str) -> str:
    """Get or refresh user token"""
    user_id = int(telegram_id)
    
    # Check if we have cached token
    if user_id in user_tokens:
        cached_token = user_tokens[user_id]
        if cached_token and len(cached_token) > 50:  # JWT tokens are usually long
            logger.debug(f"Using cached token for user {user_id}")
            return cached_token
        else:
            # Invalid cached token, remove it
            logger.warning(f"Invalid cached token for user {user_id}, fetching new one")
            del user_tokens[user_id]
    
    # Get new token
    import httpx
    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"Fetching token for telegram_id: {telegram_id}")
            response = await client.post(
                f"{BACKEND_URL}/api/v1/auth/bot-token",
                json={"telegram_id": telegram_id},
                timeout=5.0
            )
            
            logger.info(f"Token response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                
                if not token:
                    logger.error(f"No access_token in response: {data}")
                    raise Exception("No access_token in response")
                
                if len(token) < 50:
                    logger.error(f"Token too short, might be invalid: {len(token)} chars")
                    raise Exception(f"Invalid token received: {token[:20]}...")
                
                logger.info(f"Successfully fetched token (length: {len(token)})")
                user_tokens[user_id] = token
                return token
            else:
                error_text = response.text
                logger.error(f"Failed to get token: {response.status_code} - {error_text}")
                raise Exception(f"Failed to get token: {response.status_code} - {error_text}")
        except Exception as e:
            logger.error(f"Error getting token for {telegram_id}: {e}", exc_info=True)
            raise


async def get_balance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /balance command"""
    try:
        telegram_id = str(update.effective_user.id)
        
        # Get user language
        lang = await get_user_language(telegram_id)
        
        # Use authenticated request helper with automatic token refresh
        try:
            response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/accounts/balance",
                telegram_id
            )
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            await update.message.reply_text(t("auth.failed", lang))
            return
        
        if response.status_code == 200:
            data = response.json()
            total = data.get("total", 0)
            currency = data.get("currency", "RUB")
            
            # Format message
            message = t("balance.title", lang)
            message += t("balance.total", lang, amount=f"{int(round(total)):,}", currency=currency)
            
            # Add accounts breakdown
            accounts = data.get("accounts", [])
            if accounts:
                message += t("balance.accounts", lang)
                for acc in accounts[:5]:  # Show first 5 accounts
                    acc_name = escape_markdown(acc.get("name", t("common.account", lang)))
                    acc_balance = acc.get("balance", 0)
                    message += t("balance.account_item", lang, name=acc_name, amount=f"{int(round(acc_balance)):,}", currency=currency)
            
            await update.message.reply_text(message, parse_mode='Markdown')
        elif response.status_code == 401:
            await update.message.reply_text(t("auth.failed", lang))
        else:
            logger.error(f"Failed to get balance: {response.status_code} - {response.text}")
            await update.message.reply_text(t("balance.error", lang))
    except Exception as e:
        logger.error(f"Error getting balance: {e}", exc_info=True)
        await update.message.reply_text(t("balance.error", lang))


async def get_transactions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /transactions command"""
    try:
        telegram_id = str(update.effective_user.id)
        
        # Get user language
        lang = await get_user_language(telegram_id)
        
        # Use authenticated request helper with automatic token refresh
        try:
            response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/transactions/",
                telegram_id,
                params={"limit": 10}
            )
        except Exception as e:
            logger.error(f"Error getting token in get_transactions: {e}")
            await update.message.reply_text(t("auth.failed", lang))
            return
        
        if response.status_code == 200:
            transactions = response.json()
            
            if not transactions:
                await update.message.reply_text(t("transactions.empty", lang))
                return
            
            message = t("transactions.title", lang)
            
            for trans in transactions[:10]:
                trans_type = trans.get("transaction_type", "")
                amount = trans.get("amount", 0)
                currency = trans.get("currency", "RUB")
                description = escape_markdown(get_transaction_description(trans, lang))
                date = trans.get("transaction_date", "")[:10]
                
                icon = "💰" if trans_type == "income" else "💸" if trans_type == "expense" else "↔️"
                sign = "+" if trans_type == "income" else "-"
                
                message += t("transactions.item", lang, 
                           icon=icon, 
                           description=description,
                           date=date,
                           amount=f"{sign}{int(round(amount)):,}",
                           currency=currency)
            
            await update.message.reply_text(message, parse_mode='Markdown')
        elif response.status_code == 401:
            await update.message.reply_text(t("auth.failed", lang))
        else:
            logger.error(f"Failed to get transactions: {response.status_code} - {response.text}")
            await update.message.reply_text(t("transactions.error", lang))
    except Exception as e:
        logger.error(f"Error getting transactions: {e}", exc_info=True)
        await update.message.reply_text(t("transactions.error", lang))


async def add_expense_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /add_expense command"""
    telegram_id = str(update.effective_user.id)
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    # Get user accounts using authenticated request helper
    try:
        response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/accounts/",
            telegram_id
        )
        
        if response.status_code == 200:
            accounts = response.json()
            if not accounts:
                await update.message.reply_text(t("expense.error", lang))
                return ConversationHandler.END
            
            # Store accounts in context
            context.user_data['accounts'] = accounts
            context.user_data['type'] = 'expense'  # Set transaction type
            context.user_data['language'] = lang  # Store language for later use
            
            # Create keyboard with accounts
            keyboard = []
            for acc in accounts[:5]:  # Limit to 5 accounts
                keyboard.append([InlineKeyboardButton(
                    f"{acc['name']} ({int(round(acc['balance'])):,} {acc['currency']})",
                    callback_data=f"account_{acc['id']}"
                )])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            message = t("expense.title", lang) + t("expense.select_account", lang)
            sent_message = await update.message.reply_text(
                message,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
            # Сохраняем ID сообщения для последующего удаления
            if sent_message:
                context.user_data['selection_message_id'] = sent_message.message_id
            
            return WAITING_AMOUNT
        elif response.status_code == 401:
            await update.message.reply_text(t("auth.failed", lang))
            return ConversationHandler.END
        else:
            await update.message.reply_text(t("expense.error", lang))
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Error in add_expense_start: {e}", exc_info=True)
        await update.message.reply_text(t("expense.error", lang))
        return ConversationHandler.END


async def account_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle account selection"""
    query = update.callback_query
    await query.answer()
    
    account_id = int(query.data.split('_')[1])
    context.user_data['account_id'] = account_id
    
    # Get language from context or fetch it
    lang = context.user_data.get('language', 'ru')
    if not lang:
        telegram_id = str(query.from_user.id)
        lang = await get_user_language(telegram_id)
        context.user_data['language'] = lang
    
    # Find account name
    accounts = context.user_data.get('accounts', [])
    account = next((a for a in accounts if a['id'] == account_id), None)
    account_name = account['name'] if account else t("common.account", lang)
    
    trans_type = context.user_data.get('type', 'expense')
    type_text = "income" if trans_type == "income" else "expense"
    icon = "💰" if trans_type == "income" else "💸"
    
    # For expense/income, load categories first
    if trans_type in ['expense', 'income']:
        telegram_id = str(query.from_user.id)
        
        # Show typing indicator while loading categories
        try:
            await query.message.reply_chat_action("typing")
        except:
            pass
        
        try:
            # Load categories with increased timeout
            response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/categories/",
                telegram_id,
                params={"transaction_type": trans_type},
                timeout=10.0  # Increased timeout
            )
            
            if response.status_code == 200:
                categories = response.json()
                if categories:
                    context.user_data['categories'] = categories
                    
                    # Create keyboard with categories in 2 columns grid (limit to 10)
                    keyboard = []
                    # Group categories in pairs (2 columns)
                    for i in range(0, min(len(categories), 10), 2):
                        row = []
                        # First category in row
                        cat = categories[i]
                        cat_name = cat.get('name', t("common.category", lang))
                        cat_icon = cat.get('icon', '📦')
                        # Truncate long names (max 15 chars)
                        if len(cat_name) > 15:
                            cat_name = cat_name[:12] + '...'
                        row.append(InlineKeyboardButton(
                            f"{cat_icon} {cat_name}",
                            callback_data=f"category_{cat['id']}"
                        ))
                        # Second category in row (if exists)
                        if i + 1 < len(categories) and i + 1 < 10:
                            cat = categories[i + 1]
                            cat_name = cat.get('name', t("common.category", lang))
                            cat_icon = cat.get('icon', '📦')
                            if len(cat_name) > 15:
                                cat_name = cat_name[:12] + '...'
                            row.append(InlineKeyboardButton(
                                f"{cat_icon} {cat_name}",
                                callback_data=f"category_{cat['id']}"
                            ))
                        keyboard.append(row)
                    
                    # Add "Skip category" button (full width)
                    skip_text = t("expense.skip_category", lang) if trans_type == "expense" else t("income.skip_category", lang)
                    keyboard.append([InlineKeyboardButton(
                        skip_text,
                        callback_data="category_skip"
                    )])
                    
                    reply_markup = InlineKeyboardMarkup(keyboard)
                    
                    title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
                    select_cat_text = t("expense.select_category", lang) if trans_type == "expense" else t("income.select_category", lang)
                    
                    edited_message = await query.edit_message_text(
                        f"{title_text}\n"
                        f"{t('common.account', lang)}: *{account_name}*\n\n"
                        f"{select_cat_text}",
                        reply_markup=reply_markup,
                        parse_mode='Markdown'
                    )
                    
                    # Сохраняем ID сообщения для последующего удаления
                    if edited_message:
                        context.user_data['selection_message_id'] = edited_message.message_id
                    
                    return WAITING_CATEGORY
                else:
                    # No categories, skip to amount
                    title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
                    enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
                    edited_message = await query.edit_message_text(
                        f"{title_text}\n"
                        f"{t('common.account', lang)}: *{account_name}*\n\n"
                        f"{enter_amount_text}",
                        parse_mode='Markdown'
                    )
                    
                    # Сохраняем ID сообщения для последующего удаления
                    if edited_message:
                        context.user_data['selection_message_id'] = edited_message.message_id
                    
                    return WAITING_AMOUNT
            else:
                # Error loading categories, skip to amount
                title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
                enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
                edited_message = await query.edit_message_text(
                    f"{title_text}\n"
                    f"{t('common.account', lang)}: *{account_name}*\n\n"
                    f"{enter_amount_text}",
                    parse_mode='Markdown'
                )
                
                # Сохраняем ID сообщения для последующего удаления
                if edited_message:
                    context.user_data['selection_message_id'] = edited_message.message_id
                
                return WAITING_AMOUNT
        except Exception as e:
            logger.error(f"Error loading categories: {e}")
            # On error, skip to amount
            title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
            enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
            await query.edit_message_text(
                f"{title_text}\n"
                f"{t('common.account', lang)}: *{account_name}*\n\n"
                f"{enter_amount_text}",
                parse_mode='Markdown'
            )
            return WAITING_AMOUNT
    else:
        # For transfer, go directly to amount
            edited_message = await query.edit_message_text(
                f"{icon} Добавление {type_text}\n\n"
                f"Счет: *{account_name}*\n\n"
                f"Введите сумму {type_text}:",
                parse_mode='Markdown'
            )
            
            # Сохраняем ID сообщения для последующего удаления
            if edited_message:
                context.user_data['selection_message_id'] = edited_message.message_id
            
            return WAITING_AMOUNT


async def category_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle category selection"""
    query = update.callback_query
    await query.answer()
    
    # Get language from context
    lang = context.user_data.get('language', 'ru')
    
    if query.data == "category_skip":
        context.user_data['category_id'] = None
    else:
        category_id = int(query.data.split('_')[1])
        context.user_data['category_id'] = category_id
        
        # Find category name for display
        categories = context.user_data.get('categories', [])
        category = next((c for c in categories if c['id'] == category_id), None)
        if category:
            category_name = f"{category.get('icon', '📦')} {category.get('name', t('common.category', lang))}"
            context.user_data['category_name'] = category_name
    
    trans_type = context.user_data.get('type', 'expense')
    icon = "💰" if trans_type == "income" else "💸"
    
    title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
    enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
    
    category_info = ""
    if context.user_data.get('category_id'):
        category_name = context.user_data.get('category_name', '')
        safe_category_name = escape_markdown(category_name) if category_name else ''
        category_info = f"{t('common.category', lang)}: {safe_category_name}\n\n"
    
    edited_message = await query.edit_message_text(
        f"{title_text}\n"
        f"{category_info}{enter_amount_text}",
        parse_mode='Markdown'
    )
    
    # Сохраняем ID сообщения для последующего удаления
    if edited_message:
        context.user_data['selection_message_id'] = edited_message.message_id
    
    return WAITING_AMOUNT


async def amount_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle amount input"""
    # Get language from context
    lang = context.user_data.get('language', 'ru')
    
    try:
        amount = float(update.message.text.replace(',', '.'))
        if amount <= 0:
            enter_amount_text = t("expense.enter_amount", lang) if context.user_data.get('type') == "expense" else t("income.enter_amount", lang)
            await update.message.reply_text(f"{t('common.error', lang)} {enter_amount_text}")
            return WAITING_AMOUNT
        
        context.user_data['amount'] = amount
        
        trans_type = context.user_data.get('type', 'expense')
        icon = "💰" if trans_type == "income" else "💸"
        
        title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
        enter_desc_text = t("expense.enter_description", lang) if trans_type == "expense" else t("income.enter_description", lang)
        
        category_info = ""
        if context.user_data.get('category_id'):
            category_info = f"{t('common.category', lang)}: {context.user_data.get('category_name', '')}\n\n"
        
        await update.message.reply_text(
            f"{title_text}\n"
            f"{category_info}{t('common.amount', lang)}: *{int(round(amount)):,}*\n\n"
            f"{enter_desc_text}",
            parse_mode='Markdown'
        )
        
        return WAITING_DESCRIPTION
    except ValueError:
        enter_amount_text = t("expense.enter_amount", lang) if context.user_data.get('type') == "expense" else t("income.enter_amount", lang)
        await update.message.reply_text(f"{t('common.error', lang)} {enter_amount_text}")
        return WAITING_AMOUNT


async def description_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle description input and create transaction"""
    # Get language from context
    lang = context.user_data.get('language', 'ru')
    
    description = update.message.text.strip()
    if description == '—' or description.lower() in ['нет', 'no', 'skip']:
        description = None
    
    account_id = context.user_data.get('account_id')
    amount = context.user_data.get('amount')
    transaction_type = context.user_data.get('type', 'expense')  # Default to expense if not set
    
    if not account_id or not amount:
        cmd = "/add_expense" if transaction_type == "expense" else "/add_income"
        await update.message.reply_text(f"{t('common.error', lang)} {cmd}")
        return ConversationHandler.END
    
    # Show typing indicator immediately
    try:
        await update.message.reply_chat_action("typing")
    except:
        pass
    
    # Send processing message immediately
    processing_msg = None
    try:
        icon = "💰" if transaction_type == "income" else "💸"
        processing_msg = await update.message.reply_text(
            f"{icon} {t('common.processing', lang)}",
            parse_mode='Markdown'
        )
    except:
        pass
    
    try:
        telegram_id = str(update.effective_user.id)
        
        # Get account currency
        accounts = context.user_data.get('accounts', [])
        account = next((a for a in accounts if a['id'] == account_id), None)
        currency = account['currency'] if account else 'RUB'
        
        # Get user timezone from backend to convert time properly
        user_timezone = "UTC"  # Default
        try:
            user_response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/auth/me",
                telegram_id,
                timeout=5.0
            )
            if user_response.status_code == 200:
                user_data = user_response.json()
                user_timezone = user_data.get('timezone', 'UTC')
        except Exception as e:
            logger.warning(f"Could not get user timezone: {e}, using UTC")
        
        # Use message date which represents when user sent the message
        # Telegram sends message.date as timezone-aware datetime (usually UTC)
        message_date = update.message.date
        # Ensure it's timezone-aware (if not, assume UTC)
        if message_date.tzinfo is None:
            message_date = message_date.replace(tzinfo=timezone.utc)
        
        # Convert to user's timezone if not UTC
        if user_timezone and user_timezone != "UTC":
            try:
                # Try using zoneinfo (Python 3.9+)
                try:
                    from zoneinfo import ZoneInfo
                    user_tz = ZoneInfo(user_timezone)
                except ImportError:
                    # Fallback to pytz if zoneinfo not available
                    import pytz
                    user_tz = pytz.timezone(user_timezone)
                
                # Convert UTC message date to user's local time
                local_time = message_date.astimezone(user_tz)
                transaction_date = local_time.isoformat()
            except Exception as e:
                logger.warning(f"Could not convert to timezone {user_timezone}: {e}, using UTC")
                transaction_date = message_date.isoformat()
        else:
            # Use message date as-is (already UTC)
            transaction_date = message_date.isoformat()
        
        # Prepare transaction data
        transaction_data = {
            "account_id": account_id,
            "transaction_type": transaction_type,
            "amount": amount,
            "currency": currency,
            "description": description,
            "transaction_date": transaction_date,
        }
        
        # Add category_id if selected
        category_id = context.user_data.get('category_id')
        if category_id:
            transaction_data["category_id"] = category_id
        
        # Use authenticated request helper with increased timeout
        response = await make_authenticated_request(
            "POST",
            f"{BACKEND_URL}/api/v1/transactions/",
            telegram_id,
            json_data=transaction_data,
            timeout=15.0  # Increased timeout for transaction creation
        )
        
        if response.status_code == 201:
            icon = "💰" if transaction_type == "income" else "💸"
            # Get account and category names for success message
            accounts = context.user_data.get('accounts', [])
            account = next((a for a in accounts if a['id'] == account_id), None)
            account_name = escape_markdown(account['name'] if account else t("common.account", lang))
            category_name = escape_markdown(context.user_data.get('category_name', '') or t("common.category", lang))
            safe_description = escape_markdown(description or t("common.no_description", lang))
            
            success_text = t("expense.created", lang, 
                           amount=f"{int(round(amount)):,}",
                           currency=currency,
                           account=account_name,
                           category=category_name,
                           description=safe_description) if transaction_type == "expense" else t("income.created", lang,
                           amount=f"{int(round(amount)):,}",
                           currency=currency,
                           account=account_name,
                           category=category_name,
                           description=safe_description)
            
            # Удаляем промежуточные сообщения (выбор счета/категории)
            selection_message_id = context.user_data.get('selection_message_id')
            if selection_message_id:
                try:
                    await update.message.bot.delete_message(
                        chat_id=update.effective_chat.id,
                        message_id=selection_message_id
                    )
                    logger.debug(f"Deleted selection message {selection_message_id} after transaction creation")
                except Exception as e:
                    # Сообщение уже удалено или не найдено - это нормально
                    logger.debug(f"Could not delete selection message: {e}")
            
            # Edit processing message or send new one
            if processing_msg:
                try:
                    await processing_msg.edit_text(success_text, parse_mode='Markdown')
                except:
                    try:
                        await processing_msg.delete()
                        await update.message.reply_text(success_text, parse_mode='Markdown')
                    except:
                        await update.message.reply_text(success_text, parse_mode='Markdown')
            else:
                await update.message.reply_text(success_text, parse_mode='Markdown')
        elif response.status_code == 401:
            # Удаляем промежуточные сообщения при ошибке
            selection_message_id = context.user_data.get('selection_message_id')
            if selection_message_id:
                try:
                    await update.message.bot.delete_message(
                        chat_id=update.effective_chat.id,
                        message_id=selection_message_id
                    )
                    logger.debug(f"Deleted selection message {selection_message_id} after auth error")
                except Exception as e:
                    logger.debug(f"Could not delete selection message: {e}")
            
            error_text = t("auth.failed", lang)
            if processing_msg:
                try:
                    await processing_msg.edit_text(error_text)
                except:
                    try:
                        await processing_msg.delete()
                        await update.message.reply_text(error_text)
                    except:
                        await update.message.reply_text(error_text)
            else:
                await update.message.reply_text(error_text)
        else:
            # Удаляем промежуточные сообщения при ошибке
            selection_message_id = context.user_data.get('selection_message_id')
            if selection_message_id:
                try:
                    await update.message.bot.delete_message(
                        chat_id=update.effective_chat.id,
                        message_id=selection_message_id
                    )
                    logger.debug(f"Deleted selection message {selection_message_id} after transaction error")
                except Exception as e:
                    logger.debug(f"Could not delete selection message: {e}")
            
            try:
                error_msg = response.json().get("detail", t("common.error", lang))
            except:
                error_msg = t("expense.error", lang) if transaction_type == "expense" else t("income.error", lang)
            error_text = f"{t('common.error', lang)}: {error_msg}"
            if processing_msg:
                try:
                    await processing_msg.edit_text(error_text)
                except:
                    try:
                        await processing_msg.delete()
                        await update.message.reply_text(error_text)
                    except:
                        await update.message.reply_text(error_text)
            else:
                await update.message.reply_text(error_text)
    except Exception as e:
        logger.error(f"Error creating transaction: {e}", exc_info=True)
        error_text = t("expense.error", lang) if transaction_type == "expense" else t("income.error", lang)
        
        # Удаляем промежуточные сообщения при ошибке
        selection_message_id = context.user_data.get('selection_message_id')
        if selection_message_id:
            try:
                await update.message.bot.delete_message(
                    chat_id=update.effective_chat.id,
                    message_id=selection_message_id
                )
                logger.debug(f"Deleted selection message {selection_message_id} after transaction error")
            except Exception as e:
                # Сообщение уже удалено или не найдено - это нормально
                logger.debug(f"Could not delete selection message: {e}")
        
        if processing_msg:
            try:
                await processing_msg.edit_text(error_text)
            except:
                try:
                    await processing_msg.delete()
                    await update.message.reply_text(error_text)
                except:
                    await update.message.reply_text(error_text)
        else:
            await update.message.reply_text(error_text)
    
    # Clear context
    context.user_data.clear()
    return ConversationHandler.END


async def add_income_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /add_income command"""
    telegram_id = str(update.effective_user.id)
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    # Get user accounts using authenticated request helper
    try:
        response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/accounts/",
            telegram_id
        )
        
        if response.status_code == 200:
            accounts = response.json()
            if not accounts:
                await update.message.reply_text(t("income.error", lang))
                return ConversationHandler.END
            
            context.user_data['accounts'] = accounts
            context.user_data['type'] = 'income'
            context.user_data['language'] = lang  # Store language for later use
            
            keyboard = []
            for acc in accounts[:5]:
                keyboard.append([InlineKeyboardButton(
                    f"{acc['name']} ({int(round(acc['balance'])):,} {acc['currency']})",
                    callback_data=f"account_{acc['id']}"
                )])
            
            reply_markup = InlineKeyboardMarkup(keyboard)
            
            message = t("income.title", lang) + t("income.select_account", lang)
            sent_message = await update.message.reply_text(
                message,
                reply_markup=reply_markup,
                parse_mode='Markdown'
            )
            
            # Сохраняем ID сообщения для последующего удаления
            if sent_message:
                context.user_data['selection_message_id'] = sent_message.message_id
            
            return WAITING_AMOUNT
        elif response.status_code == 401:
            await update.message.reply_text(t("auth.failed", lang))
            return ConversationHandler.END
        else:
            await update.message.reply_text(t("income.error", lang))
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"Error in add_income_start: {e}", exc_info=True)
        await update.message.reply_text(t("income.error", lang))
        return ConversationHandler.END


async def report_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /report command - generate AI-powered financial report"""
    thinking_msg = None
    try:
        telegram_id = str(update.effective_user.id)
        
        # Get token
        try:
            token = await get_user_token(telegram_id)
            # Validate token format
            if not token or len(token) < 50 or '.' not in token:
                raise Exception("Invalid token format")
        except Exception as e:
            logger.error(f"Error getting token in report_command: {e}")
            # Clear invalid token from cache
            user_id = int(telegram_id)
            if user_id in user_tokens:
                del user_tokens[user_id]
            lang = await get_user_language(telegram_id)
            await update.message.reply_text(t("auth.failed", lang))
            return
        
        # Get user language
        lang = await get_user_language(telegram_id)
        
        # Send "thinking" message
        thinking_msg = await update.message.reply_text(t("report.generating", lang))
        
        # Get transactions using authenticated request helper
        transactions_response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/transactions/",
            telegram_id,
            params={"limit": 100}
        )
        
        # Get balance using authenticated request helper
        balance_response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/accounts/balance",
            telegram_id
        )
        
        if transactions_response.status_code != 200 or balance_response.status_code != 200:
            await thinking_msg.edit_text(t("report.error_data", lang))
            return
        
        transactions = transactions_response.json()
        balance_data = balance_response.json()
        
        # Prepare data for AI
        total_balance = balance_data.get("total", 0)
        currency = balance_data.get("currency", "RUB")
        
        # Calculate stats
        income_total = sum(t['amount'] for t in transactions if t['transaction_type'] == 'income')
        expense_total = sum(t['amount'] for t in transactions if t['transaction_type'] == 'expense')
        transaction_count = len(transactions)
        
        # Group expenses by description (simple categorization)
        expense_by_desc = {}
        for t in transactions:
            if t['transaction_type'] == 'expense':
                desc = get_transaction_description(t)
                if desc not in expense_by_desc:
                    expense_by_desc[desc] = 0
                expense_by_desc[desc] += t['amount']
        
        top_expenses = sorted(expense_by_desc.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Create report prompt
        report_text = f"""📊 *Финансовый отчет*\n\n"""
        report_text += f"💰 *Общий баланс:* {int(round(total_balance)):,} {currency}\n\n"
        report_text += f"📈 *Статистика:*\n"
        report_text += f"• Всего транзакций: {transaction_count}\n"
        report_text += f"• Доходы: +{int(round(income_total)):,} {currency}\n"
        report_text += f"• Расходы: -{int(round(expense_total)):,} {currency}\n"
        report_text += f"• Баланс: {int(round(income_total - expense_total)):,} {currency}\n\n"
        
        if top_expenses:
            report_text += f"💸 *Топ расходов:*\n"
            for i, (desc, amount) in enumerate(top_expenses, 1):
                safe_desc = escape_markdown(desc)
                report_text += f"{i}. {safe_desc}: {int(round(amount)):,} {currency}\n"
            report_text += "\n"
        
        # AI Analysis
        try:
            ai_response = await make_authenticated_request(
                "POST",
                f"{BACKEND_URL}/api/v1/ai/analyze",
                telegram_id,
                json_data={
                    "transactions": transactions[:50],  # Limit for AI
                    "balance": total_balance,
                    "currency": currency,
                },
                timeout=30.0
            )
            
            if ai_response.status_code == 200:
                ai_data = ai_response.json()
                insights = ai_data.get("insights", "")
                if insights:
                    safe_insights = escape_markdown(insights)
                    report_text += f"🤖 *Анализ ИИ:*\n{safe_insights}\n"
        except Exception as e:
            logger.error(f"AI analysis error: {e}")
            # Fallback analysis
            if expense_total > income_total:
                report_text += f"⚠️ *Рекомендация:* Расходы превышают доходы. Рекомендуется сократить траты.\n"
            elif expense_total > income_total * 0.8:
                report_text += f"💡 *Рекомендация:* Расходы составляют более 80% от доходов. Есть возможность для оптимизации.\n"
            else:
                report_text += f"✅ *Рекомендация:* Финансовое положение стабильное. Продолжайте в том же духе!\n"
        
        await thinking_msg.edit_text(report_text, parse_mode='Markdown')
        
    except Exception as e:
        logger.error(f"Error generating report: {e}", exc_info=True)
        try:
            if thinking_msg:
                await thinking_msg.edit_text("❌ Ошибка при генерации отчета.")
            else:
                await update.message.reply_text("❌ Ошибка при генерации отчета.")
        except:
            await update.message.reply_text("❌ Ошибка при генерации отчета.")


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation"""
    context.user_data.clear()
    await update.message.reply_text("❌ Операция отменена.")
    return ConversationHandler.END


async def ask_lucy_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /ask_lucy command - start asking Lucy about budget"""
    telegram_id = str(update.effective_user.id)
    
    # Get token
    try:
        token = await get_user_token(telegram_id)
        if not token or len(token) < 50 or '.' not in token:
            raise Exception("Invalid token format")
    except Exception as e:
        logger.error(f"Error getting token in ask_lucy_command: {e}")
        user_id = int(telegram_id)
        if user_id in user_tokens:
            del user_tokens[user_id]
        lang = await get_user_language(telegram_id)
        await update.message.reply_text(t("auth.failed", lang))
        return ConversationHandler.END
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    await update.message.reply_text(
        "💬 Задайте вопрос Люсе о вашем бюджете, финансах или транзакциях.\n\n"
        "Например:\n"
        "• На что я трачу больше всего?\n"
        "• Как мне сэкономить деньги?\n"
        "• Сколько я потратил в этом месяце?\n\n"
        "Используйте /cancel для отмены."
    )
    
    return WAITING_LUCY_QUESTION


async def lucy_question_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle user's question to Lucy"""
    telegram_id = str(update.effective_user.id)
    question = update.message.text.strip()
    
    # Get token
    try:
        token = await get_user_token(telegram_id)
        if not token or len(token) < 50 or '.' not in token:
            raise Exception("Invalid token format")
    except Exception as e:
        logger.error(f"Error getting token in lucy_question_received: {e}")
        user_id = int(telegram_id)
        if user_id in user_tokens:
            del user_tokens[user_id]
        lang = await get_user_language(telegram_id)
        await update.message.reply_text(t("auth.failed", lang))
        return ConversationHandler.END
    
    # Get user language
    lang = await get_user_language(telegram_id)
    
    # Send "thinking" message
    thinking_msg = await update.message.reply_text("🤔 Люся думает...")
    
    try:
        # Send question to API
        logger.info(f"Sending question to API for user {telegram_id}: {question[:100]}")
        response = await make_authenticated_request(
            "POST",
            f"{BACKEND_URL}/api/v1/ai/ask-lucy",
            telegram_id,
            json_data={"question": question},
            timeout=30.0
        )
        
        logger.info(f"API response status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                answer = data.get("answer", "Извините, не удалось получить ответ.")
                quest_completed = data.get("quest_completed", False)
                
                logger.info(f"Answer received, length: {len(answer)}, quest_completed: {quest_completed}")
                
                # Escape answer to prevent Markdown parsing errors
                safe_answer = escape_markdown(answer)
                
                # Format response
                response_text = f"💬 *Люся:*\n\n{safe_answer}\n"
                
                if quest_completed:
                    response_text += "\n✅ *Квест выполнен!* Вы получили XP за задание 'Спроси Люсю'."
                
                await thinking_msg.edit_text(response_text, parse_mode='Markdown')
            except Exception as json_error:
                logger.error(f"Error parsing response JSON: {json_error}")
                logger.error(f"Response text: {response.text[:500]}")
                await thinking_msg.edit_text("❌ Ошибка при обработке ответа от сервера. Попробуйте позже.")
        elif response.status_code == 400:
            try:
                error_data = response.json()
                error_msg = error_data.get("detail", "Неверный запрос.")
                logger.warning(f"API returned 400: {error_msg}")
                await thinking_msg.edit_text(f"❌ {error_msg}")
            except:
                logger.error(f"Error parsing 400 response: {response.text[:500]}")
                await thinking_msg.edit_text("❌ Неверный запрос. Попробуйте переформулировать вопрос.")
        elif response.status_code == 401:
            logger.error("Unauthorized - token issue")
            await thinking_msg.edit_text("❌ Ошибка авторизации. Попробуйте позже.")
        elif response.status_code == 500:
            logger.error(f"Server error: {response.text[:500]}")
            await thinking_msg.edit_text("❌ Ошибка на сервере. Попробуйте позже или обратитесь в поддержку.")
        else:
            logger.error(f"Unexpected status code {response.status_code}: {response.text[:500]}")
            await thinking_msg.edit_text("❌ Произошла ошибка при обработке вопроса. Попробуйте позже.")
            
    except httpx.TimeoutException:
        logger.error("Request timeout")
        try:
            await thinking_msg.edit_text("❌ Превышено время ожидания ответа. Попробуйте позже.")
        except:
            await update.message.reply_text("❌ Превышено время ожидания ответа. Попробуйте позже.")
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}", exc_info=True)
        try:
            await thinking_msg.edit_text("❌ Ошибка подключения к серверу. Проверьте интернет-соединение.")
        except:
            await update.message.reply_text("❌ Ошибка подключения к серверу.")
    except Exception as e:
        logger.error(f"Error asking Lucy: {e}", exc_info=True)
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        try:
            await thinking_msg.edit_text("❌ Произошла ошибка при обработке вопроса. Попробуйте позже.")
        except:
            await update.message.reply_text("❌ Произошла ошибка при обработке вопроса. Попробуйте позже.")
    
    return ConversationHandler.END


async def goal_command_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /цель command - start goal creation"""
    telegram_id = str(update.effective_user.id)
    
    # Get token to verify user exists
    try:
        token = await get_user_token(telegram_id)
        if not token or len(token) < 50 or '.' not in token:
            raise Exception("Invalid token format")
    except Exception as e:
        logger.error(f"Error getting token in goal_command_start: {e}")
        user_id = int(telegram_id)
        if user_id in user_tokens:
            del user_tokens[user_id]
        await update.message.reply_text(
            "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь."
        )
        return ConversationHandler.END
    
    await update.message.reply_text(
        "🎯 *Создание финансовой цели*\n\n"
        "Укажите название цели и ориентировочную стоимость в произвольной форме.\n\n"
        "Пример: Машина 2млн рублей\n"
        "Или: Квартира 5 миллионов рублей\n\n"
        "Напишите вашу цель:",
        parse_mode='Markdown'
    )
    
    return WAITING_GOAL_INFO


async def goal_info_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Parse goal name and amount from user input"""
    import re
    text = update.message.text.strip()
    
    # Try to extract amount and name
    # Pattern: find numbers with possible "млн", "мл", "тыс", "руб", etc.
    amount_pattern = r'(\d+(?:[.,]\d+)?)\s*(?:млн|мл|миллион|миллионов|тыс|тысяч|руб|рублей|usd|доллар|долларов)?'
    matches = re.findall(amount_pattern, text, re.IGNORECASE)
    
    if not matches:
        await update.message.reply_text(
            "❌ Не удалось распознать сумму. Пожалуйста, укажите сумму числом.\n"
            "Пример: Машина 2000000 рублей"
        )
        return WAITING_GOAL_INFO
    
    # Get the largest number found (likely the amount)
    amounts = []
    for match in matches:
        num_str = match.replace(',', '.')
        try:
            amount = float(num_str)
            amounts.append(amount)
        except:
            pass
    
    if not amounts:
        await update.message.reply_text(
            "❌ Не удалось распознать сумму. Пожалуйста, укажите сумму числом."
        )
        return WAITING_GOAL_INFO
    
    # Check for "млн" or "миллион" to multiply by 1,000,000
    text_lower = text.lower()
    if 'млн' in text_lower or 'миллион' in text_lower:
        target_amount = max(amounts) * 1000000
    elif 'тыс' in text_lower or 'тысяч' in text_lower:
        target_amount = max(amounts) * 1000
    else:
        target_amount = max(amounts)
    
    # Extract goal name (remove amount and common words)
    goal_name = text
    for match in matches:
        goal_name = goal_name.replace(match, '', 1)
    goal_name = re.sub(r'\s*(млн|мл|миллион|миллионов|тыс|тысяч|руб|рублей|usd|доллар|долларов)\s*', ' ', goal_name, flags=re.IGNORECASE)
    goal_name = goal_name.strip()
    
    if not goal_name or len(goal_name) < 2:
        goal_name = "Финансовая цель"
    
    # Store in context (currency will be updated from balance data)
    context.user_data['goal_name'] = goal_name
    context.user_data['target_amount'] = target_amount
    context.user_data['currency'] = 'RUB'  # Default, will be updated from balance
    
    # Show what we understood
    safe_goal_name = escape_markdown(goal_name)
    await update.message.reply_text(
        f"✅ *Понял вашу цель:*\n\n"
        f"🎯 Название: {safe_goal_name}\n"
        f"💰 Стоимость: {int(round(target_amount)):,} {context.user_data['currency']}\n\n"
        f"Анализирую ваши транзакции и создаю индивидуальный план...\n"
        f"⏳ Пожалуйста, подождите...",
        parse_mode='Markdown'
    )
    
    # Generate roadmap
    try:
        telegram_id = str(update.effective_user.id)
        
        # Get transactions using authenticated request helper
        transactions_response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/transactions/",
            telegram_id,
            params={"limit": 100},
            timeout=10.0
        )
        
        # Get balance using authenticated request helper
        balance_response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/accounts/balance",
            telegram_id,
            timeout=10.0
        )
        
        if transactions_response.status_code != 200 or balance_response.status_code != 200:
            await update.message.reply_text("❌ Не удалось получить данные о транзакциях.")
            return ConversationHandler.END
        
        transactions = transactions_response.json()
        balance_data = balance_response.json()
        
        # Calculate totals
        income_total = sum(t.get('amount', 0) for t in transactions if t.get('transaction_type') == 'income')
        expense_total = sum(t.get('amount', 0) for t in transactions if t.get('transaction_type') == 'expense')
        balance = balance_data.get('total', 0)
        currency = balance_data.get('currency', 'RUB')
        
        # Update currency in context
        context.user_data['currency'] = currency
        
        # Generate roadmap using authenticated request helper
        try:
            roadmap_response = await make_authenticated_request(
                "POST",
                f"{BACKEND_URL}/api/v1/goals/generate-roadmap",
                telegram_id,
                json_data={
                    "goal_name": goal_name,
                    "target_amount": float(target_amount),
                    "currency": currency,
                    "transactions": transactions[:50],
                    "balance": float(balance),
                    "income_total": float(income_total),
                    "expense_total": float(expense_total)
                },
                timeout=60.0  # Increased timeout for AI generation
            )
        except Exception as e:
            logger.error(f"Error generating roadmap: {e}", exc_info=True)
            if "ReadTimeout" in str(type(e).__name__) or "timeout" in str(e).lower():
                await update.message.reply_text(
                    "⏱️ Генерация плана занимает больше времени, чем ожидалось.\n\n"
                    "Попробуйте позже или упростите запрос."
                )
            else:
                await update.message.reply_text("❌ Ошибка при создании плана. Попробуйте позже.")
            return ConversationHandler.END
        
        if roadmap_response.status_code != 200:
            error_msg = "❌ Не удалось создать план."
            try:
                error_data = roadmap_response.json()
                detail = error_data.get("detail", "")
                if detail:
                    error_msg += f"\n{detail}"
            except:
                pass
            await update.message.reply_text(error_msg)
            return ConversationHandler.END
        
        roadmap_data = roadmap_response.json()
        roadmap_json = roadmap_data.get('roadmap', '{}')
        
        # Parse roadmap
        import json
        roadmap = json.loads(roadmap_json) if isinstance(roadmap_json, str) else roadmap_json
        
        # Store roadmap data
        context.user_data['roadmap'] = roadmap_json
        context.user_data['monthly_savings'] = roadmap_data.get('monthly_savings_needed', 0)
        context.user_data['feasibility'] = roadmap_data.get('feasibility', 'feasible')
        context.user_data['estimated_months'] = roadmap_data.get('estimated_months', 12)
        context.user_data['recommendations'] = roadmap_data.get('recommendations', [])
        context.user_data['savings_by_category'] = roadmap_data.get('savings_by_category', {})
        
        # Format roadmap message
        roadmap_text = roadmap.get('roadmap_text', '')
        safe_goal_name = escape_markdown(goal_name)
        if not roadmap_text:
            roadmap_text = f"""🗺️ *Дорожная карта для достижения цели*

🎯 Цель: {safe_goal_name}
💰 Стоимость: {int(round(target_amount)):,} {currency}
📅 Оценка времени: {roadmap_data.get('estimated_months', 12)} месяцев
💵 Ежемесячные накопления: {int(round(roadmap_data.get('monthly_savings_needed', 0))):,} {currency}

📋 Рекомендации:"""
            for rec in roadmap_data.get('recommendations', [])[:3]:
                safe_rec = escape_markdown(str(rec))
                roadmap_text += f"\n• {safe_rec}"
        
        feasibility_emoji = {
            'feasible': '✅',
            'challenging': '⚠️',
            'difficult': '❌'
        }
        feasibility_text = {
            'feasible': 'Достижимо',
            'challenging': 'Сложно, но возможно',
            'difficult': 'Очень сложно'
        }
        
        feasibility = roadmap_data.get('feasibility', 'feasible')
        
        message = f"{feasibility_emoji.get(feasibility, '✅')} *{feasibility_text.get(feasibility, 'Достижимо')}*\n\n"
        message += roadmap_text[:3000]  # Telegram message limit
        
        if len(roadmap_text) > 3000:
            message += "\n\n... (план будет сохранен полностью)"
        
        # Add confirmation buttons
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup
        keyboard = [
            [InlineKeyboardButton("✅ Создать цель", callback_data="goal_confirm")],
            [InlineKeyboardButton("❌ Отмена", callback_data="goal_cancel")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            message,
            parse_mode='Markdown',
            reply_markup=reply_markup
        )
        
        return WAITING_GOAL_CONFIRMATION
            
    except Exception as e:
        logger.error(f"Error generating roadmap: {e}", exc_info=True)
        await update.message.reply_text(
            f"❌ Ошибка при создании плана: {str(e)[:200]}\n\nПопробуйте позже или введите цель снова."
        )
        return ConversationHandler.END


async def goal_confirmation_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle goal confirmation button"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "goal_cancel":
        context.user_data.clear()
        await query.edit_message_text("❌ Создание цели отменено.")
        return ConversationHandler.END
    
    if query.data == "goal_confirm":
        # Create the goal
        try:
            telegram_id = str(update.effective_user.id)
            
            goal_name = context.user_data.get('goal_name')
            target_amount = context.user_data.get('target_amount')
            currency = context.user_data.get('currency', 'RUB')
            roadmap = context.user_data.get('roadmap')
            
            # Create goal using authenticated request helper
            goal_response = await make_authenticated_request(
                "POST",
                f"{BACKEND_URL}/api/v1/goals/",
                telegram_id,
                json_data={
                    "name": goal_name,
                    "target_amount": float(target_amount),
                    "currency": currency,
                    "goal_type": "save",
                    "roadmap": roadmap
                },
                timeout=10.0
            )
            
            if goal_response.status_code == 201:
                goal_data = goal_response.json()
                await query.edit_message_text(
                    f"✅ *Цель создана!*\n\n"
                    f"🎯 {goal_name}\n"
                    f"💰 {int(round(target_amount)):,} {currency}\n"
                    f"📊 Прогресс: 0%\n\n"
                    f"Система будет отслеживать ваш прогресс и уведомлять вас о статусе.",
                    parse_mode='Markdown'
                )
            elif goal_response.status_code == 401:
                await query.edit_message_text(
                    "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь."
                )
            else:
                try:
                    error_msg = goal_response.json().get("detail", "Ошибка")
                except:
                    error_msg = "Ошибка при создании цели"
                await query.edit_message_text(f"❌ Ошибка при создании цели: {error_msg}")
        except Exception as e:
            logger.error(f"Error creating goal: {e}", exc_info=True)
            await query.edit_message_text("❌ Ошибка при создании цели. Попробуйте позже.")
    
    context.user_data.clear()
    return ConversationHandler.END


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle regular messages"""
    await update.message.reply_text("Я не понимаю. Используйте /help для списка команд.")


def main():
    """Start the bot"""
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN is not set!")
        logger.error("Please set TELEGRAM_BOT_TOKEN in .env file")
        return
    
    # Create application
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Add handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("balance", get_balance))
    application.add_handler(CommandHandler("transactions", get_transactions))
    application.add_handler(CommandHandler("report", report_command))
    application.add_handler(CommandHandler("language", language_command))
    application.add_handler(CallbackQueryHandler(language_callback, pattern="^lang_"))
    application.add_handler(CommandHandler("notifications", notifications_command))
    application.add_handler(CallbackQueryHandler(notifications_callback, pattern="^notif_"))
    
    # Ask Lucy conversation handler
    ask_lucy_handler = ConversationHandler(
        entry_points=[CommandHandler("ask_lucy", ask_lucy_command)],
        states={
            WAITING_LUCY_QUESTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, lucy_question_received),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    application.add_handler(ask_lucy_handler)
    
    # Goal creation conversation handler
    goal_handler = ConversationHandler(
        entry_points=[CommandHandler("goal", goal_command_start)],
        states={
            WAITING_GOAL_INFO: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, goal_info_received),
            ],
            WAITING_GOAL_CONFIRMATION: [
                CallbackQueryHandler(goal_confirmation_handler, pattern="^goal_"),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    application.add_handler(goal_handler)
    
    # Conversation handler for expense
    expense_handler = ConversationHandler(
        entry_points=[CommandHandler("add_expense", add_expense_start)],
        states={
            WAITING_CATEGORY: [
                CallbackQueryHandler(category_selected, pattern="^category_"),
            ],
            WAITING_AMOUNT: [
                CallbackQueryHandler(account_selected, pattern="^account_"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, amount_received),
            ],
            WAITING_DESCRIPTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, description_received),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    application.add_handler(expense_handler)
    
    # Conversation handler for income
    income_handler = ConversationHandler(
        entry_points=[CommandHandler("add_income", add_income_start)],
        states={
            WAITING_CATEGORY: [
                CallbackQueryHandler(category_selected, pattern="^category_"),
            ],
            WAITING_AMOUNT: [
                CallbackQueryHandler(account_selected, pattern="^account_"),
                MessageHandler(filters.TEXT & ~filters.COMMAND, amount_received),
            ],
            WAITING_DESCRIPTION: [
                MessageHandler(filters.TEXT & ~filters.COMMAND, description_received),
            ],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
    )
    application.add_handler(income_handler)
    
    # Handle all other messages
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    
    # Determine webhook URL
    webhook_url = None
    
    # Priority 1: Explicitly set webhook URL (but validate it's not a placeholder)
    if TELEGRAM_WEBHOOK_URL and "your-domain.com" not in TELEGRAM_WEBHOOK_URL.lower() and "example.com" not in TELEGRAM_WEBHOOK_URL.lower():
        webhook_url = TELEGRAM_WEBHOOK_URL.rstrip("/")
        logger.info(f"Using explicit webhook URL: {webhook_url}")
    elif TELEGRAM_WEBHOOK_URL:
        logger.warning(f"Ignoring placeholder webhook URL: {TELEGRAM_WEBHOOK_URL}")
        webhook_url = None
    
    # Priority 2: Railway public domain (automatic HTTPS)
    elif RAILWAY_PUBLIC_DOMAIN:
        webhook_url = f"https://{RAILWAY_PUBLIC_DOMAIN}"
        logger.info(f"Using Railway public domain: {webhook_url}")
    
    # Priority 3: Railway static URL (alternative)
    elif RAILWAY_STATIC_URL:
        webhook_url = RAILWAY_STATIC_URL.rstrip("/")
        logger.info(f"Using Railway static URL: {webhook_url}")
    
    # If webhook URL is available, use webhook mode
    if webhook_url:
        # Ensure webhook URL has /webhook path
        if not webhook_url.endswith("/webhook"):
            webhook_url = f"{webhook_url}/webhook"
        
        logger.info(f"🚀 Starting Telegram bot in WEBHOOK mode...")
        logger.info(f"📡 Webhook URL: {webhook_url}")
        
        # Delete any existing webhook first
        try:
            delete_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook"
            params = {"drop_pending_updates": "true"}
            response = requests.get(delete_url, params=params, timeout=5)
            if response.status_code == 200:
                logger.info("Old webhook deleted (if existed)")
        except Exception as e:
            logger.warning(f"Error deleting old webhook: {e}")
        
        # Set webhook
        try:
            set_webhook_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook"
            webhook_params = {
                "url": webhook_url,
                "drop_pending_updates": "true",
                "allowed_updates": ["message", "callback_query", "inline_query"]
            }
            response = requests.post(set_webhook_url, json=webhook_params, timeout=10)
            
            if response.status_code == 200:
                result = response.json()
                if result.get("ok"):
                    logger.info(f"✅ Webhook set successfully: {webhook_url}")
                    logger.info("✅ Bot is ready to receive updates via webhook")
                else:
                    logger.error(f"❌ Failed to set webhook: {result.get('description')}")
                    logger.info("⚠️ Falling back to polling mode...")
                    webhook_url = None
            else:
                logger.error(f"❌ Failed to set webhook: {response.status_code} - {response.text}")
                logger.info("⚠️ Falling back to polling mode...")
                webhook_url = None
        except Exception as e:
            logger.error(f"❌ Error setting webhook: {e}")
            logger.info("⚠️ Falling back to polling mode...")
            webhook_url = None
    
    # If webhook is not available or failed, use polling
    if not webhook_url:
        logger.info("🔄 Starting Telegram bot in POLLING mode...")
        logger.info("ℹ️ Polling mode works on HTTP (no HTTPS required)")
        logger.info("💡 To use webhook mode, set TELEGRAM_WEBHOOK_URL or RAILWAY_PUBLIC_DOMAIN")
        
        # Delete webhook if exists (to avoid conflicts)
        try:
            delete_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook"
            params = {"drop_pending_updates": "true"}
            response = requests.get(delete_url, params=params, timeout=5)
            if response.status_code == 200:
                logger.info("Webhook deleted (if existed)")
        except Exception as e:
            logger.warning(f"Error deleting webhook: {e}")
        
        # Create event loop for Python 3.12+ compatibility
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                raise RuntimeError("Event loop is closed")
        except RuntimeError:
            if sys.platform == 'win32':
                loop = asyncio.SelectorEventLoop()
            else:
                loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        try:
            application.run_polling(
                allowed_updates=Update.ALL_TYPES,
                drop_pending_updates=True,
                close_loop=False,
                poll_interval=2.0  # Poll every 2 seconds
            )
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")
    else:
        # Webhook mode - need to run webhook server
        # Get port from environment (Railway provides PORT)
        port = int(config("PORT", default="8000"))
        
        logger.info(f"🌐 Starting webhook server on port {port}...")
        logger.info(f"📡 Listening for webhook updates at: /webhook")
        
        # Run webhook
        try:
            application.run_webhook(
                listen="0.0.0.0",
                port=port,
                webhook_url=webhook_url,
                url_path="webhook",
                drop_pending_updates=True,
                allowed_updates=Update.ALL_TYPES
            )
        except KeyboardInterrupt:
            logger.info("Bot stopped by user")


if __name__ == "__main__":
    main()


import logging
import asyncio
import sys
import base64
import json
from datetime import datetime, timezone
from decouple import config
from typing import Dict, Optional
from vkbottle import Bot
from vkbottle.bot import Message
from vkbottle.dispatch.rules.base import CommandRule
from vkbottle import Keyboard, Text, OpenLink
import httpx

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot configuration
VK_BOT_TOKEN = config("VK_BOT_TOKEN", default="")
BACKEND_URL_RAW = config("BACKEND_URL", default="http://localhost:8000")
GROUP_ID = config("VK_GROUP_ID", default="")

# Normalize BACKEND_URL
BACKEND_URL = BACKEND_URL_RAW.rstrip("/")

if not BACKEND_URL.startswith(("http://", "https://")):
    logger.error(f"❌ Invalid BACKEND_URL format: {BACKEND_URL}")
    BACKEND_URL = "http://localhost:8000"

logger.info(f"Backend URL configured: {BACKEND_URL}")

# Conversation states
WAITING_AMOUNT, WAITING_DESCRIPTION, WAITING_ACCOUNT, WAITING_CATEGORY = range(4)
WAITING_GOAL_INFO, WAITING_GOAL_CONFIRMATION = range(4, 6)

# Store user tokens and conversation states
user_tokens: Dict[int, str] = {}
user_states: Dict[int, dict] = {}  # Store conversation state per user

# Import translations
from locales.ru import ru
from locales.en import en

translations = {
    "ru": ru,
    "en": en,
}

DEFAULT_LANGUAGE = "ru"

# Initialize bot
if not VK_BOT_TOKEN:
    logger.error("VK_BOT_TOKEN is not set!")
    sys.exit(1)

# Initialize bot
# IMPORTANT: VK_BOT_TOKEN must be a COMMUNITY token, not user token!
# Get it from: Community Settings -> Work with API -> Create Key
# In vkbottle 4.x, group_id is handled automatically via token
bot = Bot(token=VK_BOT_TOKEN)

if GROUP_ID:
    try:
        group_id = int(GROUP_ID)
        # Remove minus sign if present (VK group IDs can be negative)
        if group_id < 0:
            group_id = abs(group_id)
        logger.info(f"VK_GROUP_ID configured: {group_id} (used for reference, bot auto-detects from token)")
    except ValueError:
        logger.warning(f"Invalid GROUP_ID format: {GROUP_ID}")
else:
    logger.warning("VK_GROUP_ID not set. Bot should work, but group_id helps with debugging.")


def is_token_expired(token: str) -> bool:
    """Check if JWT token is expired"""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return True
        
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64)
        payload = json.loads(payload_bytes)
        
        exp = payload.get('exp')
        if not exp:
            return True
        
        current_time = datetime.now(timezone.utc).timestamp()
        if exp < (current_time + 300):
            return True
        
        return False
    except Exception as e:
        logger.warning(f"Error checking token expiration: {e}")
        return True


async def get_user_token(vk_id: str, force_refresh: bool = False) -> str:
    """Get or refresh user token with expiration check"""
    user_id = int(vk_id)
    
    if not force_refresh and user_id in user_tokens:
        cached_token = user_tokens[user_id]
        if cached_token and len(cached_token) > 50:
            if not is_token_expired(cached_token):
                logger.debug(f"Using cached token for user {user_id}")
                return cached_token
            else:
                logger.info(f"Cached token expired for user {user_id}, fetching new one")
                del user_tokens[user_id]
        else:
            del user_tokens[user_id]
    
    async with httpx.AsyncClient() as client:
        try:
            logger.info(f"Fetching token for vk_id: {vk_id}")
            response = await client.post(
                f"{BACKEND_URL}/api/v1/auth/bot-token-vk",
                json={"vk_id": vk_id},
                timeout=5.0
            )
            
            if response.status_code == 200:
                data = response.json()
                token = data.get("access_token")
                
                if not token or len(token) < 50:
                    raise Exception("Invalid token received")
                
                logger.info(f"Successfully fetched token (length: {len(token)})")
                user_tokens[user_id] = token
                return token
            else:
                error_text = response.text
                logger.error(f"Failed to get token: {response.status_code} - {error_text}")
                raise Exception(f"Failed to get token: {response.status_code}")
        except Exception as e:
            logger.error(f"Error getting token for {vk_id}: {e}", exc_info=True)
            raise


async def track_analytics_event(
    vk_id: str,
    event_type: str,
    event_name: str,
    metadata: Optional[dict] = None
):
    """Отследить событие аналитики"""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{BACKEND_URL}/api/v1/analytics/track",
                json={
                    "event_type": event_type,
                    "event_name": event_name,
                    "platform": "vk_bot",
                    "metadata": metadata or {}
                },
                timeout=2.0  # Короткий таймаут, чтобы не блокировать основной поток
            )
    except Exception as e:
        # Не логируем ошибки аналитики, чтобы не засорять логи
        logger.debug(f"Failed to track analytics event: {e}")


async def make_authenticated_request(
    method: str,
    url: str,
    vk_id: str,
    json_data: Optional[dict] = None,
    params: Optional[dict] = None,
    timeout: float = 5.0,
    retry_on_401: bool = True
):
    """Make an authenticated HTTP request with automatic token refresh on 401"""
    token = await get_user_token(vk_id)
    
    async with httpx.AsyncClient() as client:
        headers = {"Authorization": f"Bearer {token}"}
        
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
        
        if response.status_code == 401 and retry_on_401:
            logger.warning(f"Got 401 Unauthorized, refreshing token and retrying for user {vk_id}")
            user_id = int(vk_id)
            if user_id in user_tokens:
                del user_tokens[user_id]
            
            token = await get_user_token(vk_id, force_refresh=True)
            headers = {"Authorization": f"Bearer {token}"}
            
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


async def get_user_language(vk_id: str) -> str:
    """Get user language from profile, default to 'ru'"""
    try:
        user_response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/auth/me",
            vk_id,
            timeout=5.0
        )
        if user_response.status_code == 200:
            user_data = user_response.json()
            lang = user_data.get('language', DEFAULT_LANGUAGE)
            lang = lang.lower() if lang else DEFAULT_LANGUAGE
            if lang not in translations:
                lang = DEFAULT_LANGUAGE
            return lang
    except Exception as e:
        logger.warning(f"Could not get user language: {e}, using default")
    return DEFAULT_LANGUAGE


def t(key: str, language: str = "ru", **kwargs) -> str:
    """Get translated text"""
    if language not in translations:
        language = DEFAULT_LANGUAGE
    
    try:
        parts = key.split(".", 1)
        if len(parts) != 2:
            logger.warning(f"Invalid translation key format: {key}")
            return key
        
        section, item = parts
        translation = translations[language].get(section, {}).get(item, key)
        
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


def get_transaction_description(transaction: dict, language: str = "ru") -> str:
    """Get transaction description, using category_name if description is missing"""
    description = transaction.get('description')
    category_name = transaction.get('category_name')
    
    if description and str(description).strip() and str(description).strip() not in ('None', 'null'):
        return str(description).strip()
    elif category_name and str(category_name).strip() and str(category_name).strip() not in ('None', 'null'):
        return str(category_name).strip()
    else:
        return t("common.no_description", language)


def create_inline_keyboard(buttons: list, one_time: bool = False):
    """Create VK inline keyboard from button list"""
    keyboard = Keyboard(one_time=one_time)
    for row in buttons:
        for btn in row:
            keyboard.add(Text(btn['label'], payload={"action": btn['action'], "data": btn.get('data', {})}))
        keyboard.row()
    return keyboard.get_json()


@bot.on.message(CommandRule("start", ["начать", "старт"]))
async def start_handler(message: Message):
    """Handle /start command"""
    logger.info(f"✅ Received /start command from user {message.from_id}")
    logger.info(f"   Message text: '{message.text}'")
    logger.info(f"   Message payload: {message.payload}")
    vk_id = str(message.from_id)
    
    # Отслеживаем событие
    await track_analytics_event(
        vk_id=vk_id,
        event_type="bot_click",
        event_name="start",
        metadata={"command": "start", "payload": message.payload}
    )
    try:
        user_info = await bot.api.users.get(message.from_id)
        user_name = user_info[0].first_name if user_info else "Пользователь"
    except Exception as e:
        logger.warning(f"Failed to get user info: {e}")
        user_name = "Пользователь"
    
    try:
        lang = await get_user_language(vk_id)
        
        message_text = (
            t("start.greeting", lang, name=user_name) +
            t("start.commands", lang) +
            t("start.balance", lang) +
            t("start.transactions", lang) +
            t("start.add_expense", lang) +
            t("start.add_income", lang) +
            t("start.report", lang) +
            t("start.goal", lang) +
            t("start.help", lang) +
            t("start.language", lang) +
            t("start.important", lang)
        )
        
        # Create keyboard with buttons (localized)
        keyboard = Keyboard(one_time=False)
        
        # First row: Balance and Transactions
        keyboard.add(Text(t("buttons.balance", lang), payload=json.dumps({"command": "balance"})))
        keyboard.add(Text(t("buttons.transactions", lang), payload=json.dumps({"command": "transactions"})))
        keyboard.row()
        
        # Second row: Add Expense and Add Income
        keyboard.add(Text(t("buttons.expense", lang), payload=json.dumps({"command": "expense"})))
        keyboard.add(Text(t("buttons.income", lang), payload=json.dumps({"command": "income"})))
        keyboard.row()
        
        # Third row: Report and Goal
        keyboard.add(Text(t("buttons.report", lang), payload=json.dumps({"command": "report"})))
        keyboard.add(Text(t("buttons.goal", lang), payload=json.dumps({"command": "goal"})))
        keyboard.row()
        
        # Fourth row: Help and Language
        keyboard.add(Text(t("buttons.help", lang), payload=json.dumps({"command": "help"})))
        keyboard.add(Text(t("buttons.language", lang), payload=json.dumps({"command": "language"})))
        keyboard.row()
        
        # Fifth row: Application button
        keyboard.add(OpenLink("https://vk.com/app54321962_144352158", t("buttons.app", lang)))
        
        await message.answer(message_text, keyboard=keyboard)
        logger.info(f"Sent start message with keyboard to user {message.from_id}")
    except Exception as e:
        logger.error(f"Error in start_handler: {e}", exc_info=True)
        await message.answer("❌ Ошибка при обработке команды. Попробуйте позже.")


@bot.on.message(CommandRule("cancel", ["отмена"]))
async def cancel_handler(message: Message):
    """Handle /cancel command - cancel current operation"""
    vk_id = str(message.from_id)
    user_id = int(vk_id)
    lang = await get_user_language(vk_id)
    
    if user_id in user_states:
        del user_states[user_id]
        await message.answer(t("cancel.cancelled", lang))
    else:
        await message.answer(t("cancel.cancelled", lang))


@bot.on.message(CommandRule("help", ["помощь", "справка"]))
async def help_handler(message: Message):
    """Handle /help command"""
    vk_id = str(message.from_id)
    
    # Отслеживаем событие
    await track_analytics_event(
        vk_id=vk_id,
        event_type="bot_click",
        event_name="help",
        metadata={"command": "help"}
    )
    
    lang = await get_user_language(vk_id)
    
    help_text = (
        t("help.title", lang) +
        t("help.start", lang) +
        t("help.balance", lang) +
        t("help.transactions", lang) +
        t("help.add_expense", lang) +
        t("help.add_income", lang) +
        t("help.report", lang) +
        t("help.goal", lang) +
        t("help.language", lang) +
        t("help.cancel", lang) +
        t("help.help", lang) +
        t("help.usage", lang) +
        t("help.usage_expense", lang) +
        t("help.usage_report", lang) +
        t("help.usage_goal", lang)
    )
    
    await message.answer(help_text)


@bot.on.message(CommandRule("balance", ["баланс"]))
async def balance_handler(message: Message):
    """Handle /balance command"""
    try:
        vk_id = str(message.from_id)
        
        # Отслеживаем событие
        await track_analytics_event(
            vk_id=vk_id,
            event_type="bot_click",
            event_name="balance",
            metadata={"command": "balance"}
        )
        
        lang = await get_user_language(vk_id)
        
        try:
            response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/accounts/balance",
                vk_id
            )
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            await message.answer(t("auth.failed", lang))
            return
        
        if response.status_code == 200:
            data = response.json()
            total = data.get("total", 0)
            currency = data.get("currency", "RUB")
            
            message_text = t("balance.title", lang)
            message_text += t("balance.total", lang, amount=f"{int(round(total)):,}", currency=currency)
            
            accounts = data.get("accounts", [])
            if accounts:
                message_text += t("balance.accounts", lang)
                for acc in accounts[:5]:
                    acc_name = acc.get("name", t("common.account", lang))
                    acc_balance = acc.get("balance", 0)
                    message_text += t("balance.account_item", lang, name=acc_name, amount=f"{int(round(acc_balance)):,}", currency=currency)
            
            await message.answer(message_text)
        elif response.status_code == 401:
            await message.answer(t("auth.failed", lang))
        else:
            logger.error(f"Failed to get balance: {response.status_code} - {response.text}")
            await message.answer(t("balance.error", lang))
    except Exception as e:
        logger.error(f"Error getting balance: {e}", exc_info=True)
        await message.answer(t("balance.error", "ru"))


async def language_selection_handler(message: Message):
    """Handle language selection - show keyboard with language options"""
    vk_id = str(message.from_id)
    lang = await get_user_language(vk_id)
    current_lang_display = "Русский" if lang == "ru" else "English"
    
    # Create keyboard with language options
    keyboard = Keyboard(one_time=True)
    keyboard.add(Text("🇷🇺 Русский", payload=json.dumps({"command": "lang_ru"})))
    keyboard.add(Text("🇬🇧 English", payload=json.dumps({"command": "lang_en"})))
    keyboard.row()
    
    message_text = (
        t("language.select", lang) +
        t("language.current", lang, lang=current_lang_display)
    )
    
    await message.answer(message_text, keyboard=keyboard)


async def language_selected_handler(message: Message, selected_lang: str):
    """Handle language selection"""
    vk_id = str(message.from_id)
    
    try:
        # Update user language via API
        response = await make_authenticated_request(
            "PATCH",
            f"{BACKEND_URL}/api/v1/auth/me",
            vk_id,
            json_data={"language": selected_lang},
            timeout=5.0
        )
        
        if response.status_code == 200:
            lang_display = "Русский" if selected_lang == "ru" else "English"
            lang = selected_lang  # Use selected language for response
            
            message_text = t("language.changed", lang, lang=lang_display)
            await message.answer(message_text)
        else:
            lang = await get_user_language(vk_id)
            await message.answer(t("language.error", lang))
    except Exception as e:
        logger.error(f"Error changing language: {e}", exc_info=True)
        lang = await get_user_language(vk_id)
        await message.answer(t("language.error", lang))


async def add_expense_start(message: Message):
    """Handle expense start - show account selection"""
    vk_id = str(message.from_id)
    lang = await get_user_language(vk_id)
    
    try:
        response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/accounts/",
            vk_id
        )
        
        if response.status_code == 200:
            accounts = response.json()
            if not accounts:
                await message.answer(t("expense.error", lang))
                return
            
            # Store accounts and state
            user_id = int(vk_id)
            user_states[user_id] = {
                "type": WAITING_ACCOUNT,
                "transaction_type": "expense",
                "accounts": accounts,
                "language": lang
            }
            
            # Create keyboard with accounts
            keyboard = Keyboard(one_time=True)
            for acc in accounts[:5]:  # Limit to 5 accounts
                acc_label = f"{acc['name']} ({int(round(acc['balance'])):,} {acc['currency']})"
                # Truncate if too long (VK has button label length limit)
                if len(acc_label) > 40:
                    acc_label = acc_label[:37] + "..."
                keyboard.add(Text(
                    acc_label,
                    payload=json.dumps({"command": f"account_{acc['id']}"})
                ))
                keyboard.row()
            
            message_text = t("expense.title", lang) + t("expense.select_account", lang)
            await message.answer(message_text, keyboard=keyboard)
        elif response.status_code == 401:
            await message.answer(t("auth.failed", lang))
        else:
            await message.answer(t("expense.error", lang))
    except Exception as e:
        logger.error(f"Error in add_expense_start: {e}", exc_info=True)
        await message.answer(t("expense.error", lang))


async def add_income_start(message: Message):
    """Handle income start - show account selection"""
    vk_id = str(message.from_id)
    lang = await get_user_language(vk_id)
    
    try:
        response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/accounts/",
            vk_id
        )
        
        if response.status_code == 200:
            accounts = response.json()
            if not accounts:
                await message.answer(t("income.error", lang))
                return
            
            # Store accounts and state
            user_id = int(vk_id)
            user_states[user_id] = {
                "type": WAITING_ACCOUNT,
                "transaction_type": "income",
                "accounts": accounts,
                "language": lang
            }
            
            # Create keyboard with accounts
            keyboard = Keyboard(one_time=True)
            for acc in accounts[:5]:  # Limit to 5 accounts
                acc_label = f"{acc['name']} ({int(round(acc['balance'])):,} {acc['currency']})"
                # Truncate if too long
                if len(acc_label) > 40:
                    acc_label = acc_label[:37] + "..."
                keyboard.add(Text(
                    acc_label,
                    payload=json.dumps({"command": f"account_{acc['id']}"})
                ))
                keyboard.row()
            
            message_text = t("income.title", lang) + t("income.select_account", lang)
            await message.answer(message_text, keyboard=keyboard)
        elif response.status_code == 401:
            await message.answer(t("auth.failed", lang))
        else:
            await message.answer(t("income.error", lang))
    except Exception as e:
        logger.error(f"Error in add_income_start: {e}", exc_info=True)
        await message.answer(t("income.error", lang))


async def account_selected_handler(message: Message, account_id: int):
    """Handle account selection"""
    vk_id = str(message.from_id)
    user_id = int(vk_id)
    
    if user_id not in user_states:
        lang = await get_user_language(vk_id)
        await message.answer(t("common.error", lang))
        return
    
    state = user_states[user_id]
    state["account_id"] = account_id
    trans_type = state.get("transaction_type", "expense")
    lang = state.get("language", "ru")
    
    # Find account name
    accounts = state.get("accounts", [])
    account = next((a for a in accounts if a['id'] == account_id), None)
    account_name = account['name'] if account else t("common.account", lang)
    
    try:
        # Load categories
        response = await make_authenticated_request(
            "GET",
            f"{BACKEND_URL}/api/v1/categories/",
            vk_id,
            params={"transaction_type": trans_type},
            timeout=10.0
        )
        
        if response.status_code == 200:
            categories = response.json()
            if categories:
                state["categories"] = categories
                
                # Create keyboard with categories
                keyboard = Keyboard(one_time=True)
                for cat in categories[:10]:  # Limit to 10 categories
                    cat_name = cat.get('name', t("common.category", lang))
                    cat_icon = cat.get('icon', '📦')
                    cat_label = f"{cat_icon} {cat_name}"
                    # Truncate if too long
                    if len(cat_label) > 40:
                        cat_label = cat_label[:37] + "..."
                    keyboard.add(Text(
                        cat_label,
                        payload=json.dumps({"command": f"category_{cat['id']}"})
                    ))
                    keyboard.row()
                
                # Add skip button
                skip_text = t("expense.skip_category", lang) if trans_type == "expense" else t("income.skip_category", lang)
                keyboard.add(Text(
                    skip_text,
                    payload=json.dumps({"command": "category_skip"})
                ))
                
                title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
                select_cat_text = t("expense.select_category", lang) if trans_type == "expense" else t("income.select_category", lang)
                
                message_text = (
                    f"{title_text}"
                    f"{t('common.account', lang)}: {account_name}\n\n"
                    f"{select_cat_text}"
                )
                
                state["type"] = WAITING_CATEGORY
                await message.answer(message_text, keyboard=keyboard)
                return
        
        # No categories or error, skip to amount
        title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
        enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
        
        message_text = (
            f"{title_text}"
            f"{t('common.account', lang)}: {account_name}\n\n"
            f"{enter_amount_text}"
        )
        
        state["type"] = WAITING_AMOUNT
        await message.answer(message_text)
    except Exception as e:
        logger.error(f"Error loading categories: {e}", exc_info=True)
        # On error, skip to amount
        title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
        enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
        
        message_text = (
            f"{title_text}"
            f"{t('common.account', lang)}: {account_name}\n\n"
            f"{enter_amount_text}"
        )
        
        state["type"] = WAITING_AMOUNT
        await message.answer(message_text)


async def category_selected_handler(message: Message, category_id: Optional[int]):
    """Handle category selection"""
    vk_id = str(message.from_id)
    user_id = int(vk_id)
    
    if user_id not in user_states:
        lang = await get_user_language(vk_id)
        await message.answer(t("common.error", lang))
        return
    
    state = user_states[user_id]
    state["category_id"] = category_id
    trans_type = state.get("transaction_type", "expense")
    lang = state.get("language", "ru")
    
    if category_id:
        # Find category name
        categories = state.get("categories", [])
        category = next((c for c in categories if c['id'] == category_id), None)
        if category:
            category_name = f"{category.get('icon', '📦')} {category.get('name', t('common.category', lang))}"
            state["category_name"] = category_name
    
    title_text = t("expense.title", lang) if trans_type == "expense" else t("income.title", lang)
    enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
    
    category_info = ""
    if state.get("category_id") and state.get("category_name"):
        category_info = f"{t('common.category', lang)}: {state.get('category_name')}\n\n"
    
    message_text = f"{title_text}{category_info}{enter_amount_text}"
    
    state["type"] = WAITING_AMOUNT
    await message.answer(message_text)


async def amount_received_handler(message: Message, state: dict):
    """Handle amount input"""
    vk_id = str(message.from_id)
    user_id = int(vk_id)
    lang = state.get("language", "ru")
    trans_type = state.get("transaction_type", "expense")
    
    try:
        amount_text = message.text.replace(',', '.').strip()
        amount = float(amount_text)
        
        if amount <= 0:
            enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
            await message.answer(f"{t('common.error', lang)} {enter_amount_text}")
            return
        
        state["amount"] = amount
        state["type"] = WAITING_DESCRIPTION
        
        enter_desc_text = t("expense.enter_description", lang) if trans_type == "expense" else t("income.enter_description", lang)
        await message.answer(enter_desc_text)
    except ValueError:
        enter_amount_text = t("expense.enter_amount", lang) if trans_type == "expense" else t("income.enter_amount", lang)
        await message.answer(f"{t('common.error', lang)} {enter_amount_text}")


async def description_received_handler(message: Message, state: dict):
    """Handle description input and create transaction"""
    vk_id = str(message.from_id)
    user_id = int(vk_id)
    lang = state.get("language", "ru")
    trans_type = state.get("transaction_type", "expense")
    
    description = message.text.strip()
    
    # Check for skip commands
    skip_commands = ["пропустить", "skip", "пропустить описание", "skip description"]
    if description.lower() in skip_commands:
        description = ""
    
    # Get transaction data
    account_id = state.get("account_id")
    amount = state.get("amount")
    category_id = state.get("category_id")
    
    if not account_id or not amount:
        await message.answer(t("common.error", lang))
        # Clear state
        if user_id in user_states:
            del user_states[user_id]
        return
    
    try:
        # Create transaction
        transaction_data = {
            "account_id": account_id,
            "amount": amount,
            "transaction_type": trans_type,
            "description": description if description else None,
            "category_id": category_id if category_id else None
        }
        
        response = await make_authenticated_request(
            "POST",
            f"{BACKEND_URL}/api/v1/transactions/",
            vk_id,
            json_data=transaction_data,
            timeout=10.0
        )
        
        if response.status_code == 201:
            # Get account and category names for confirmation
            accounts = state.get("accounts", [])
            account = next((a for a in accounts if a['id'] == account_id), None)
            account_name = account['name'] if account else t("common.account", lang)
            
            category_name = state.get("category_name", t("common.no_description", lang))
            if not category_id:
                category_name = t("common.no_description", lang)
            
            currency = account.get('currency', 'RUB') if account else 'RUB'
            
            created_text = t("expense.created", lang) if trans_type == "expense" else t("income.created", lang)
            message_text = created_text.format(
                amount=f"{int(round(amount)):,}",
                currency=currency,
                account=account_name,
                category=category_name,
                description=description if description else t("common.no_description", lang)
            )
            
            await message.answer(message_text)
        elif response.status_code == 401:
            await message.answer(t("auth.failed", lang))
        else:
            error_text = t("expense.error", lang) if trans_type == "expense" else t("income.error", lang)
            await message.answer(error_text)
    except Exception as e:
        logger.error(f"Error creating transaction: {e}", exc_info=True)
        error_text = t("expense.error", lang) if trans_type == "expense" else t("income.error", lang)
        await message.answer(error_text)
    finally:
        # Clear state
        if user_id in user_states:
            del user_states[user_id]


@bot.on.message(CommandRule("transactions", ["транзакции"]))
async def transactions_handler(message: Message):
    """Handle /transactions command"""
    try:
        vk_id = str(message.from_id)
        
        # Отслеживаем событие
        await track_analytics_event(
            vk_id=vk_id,
            event_type="bot_click",
            event_name="transactions",
            metadata={"command": "transactions"}
        )
        
        lang = await get_user_language(vk_id)
        
        try:
            response = await make_authenticated_request(
                "GET",
                f"{BACKEND_URL}/api/v1/transactions/",
                vk_id,
                params={"limit": 10}
            )
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            await message.answer(t("auth.failed", lang))
            return
        
        if response.status_code == 200:
            transactions = response.json()
            
            if not transactions:
                await message.answer(t("transactions.empty", lang))
                return
            
            message_text = t("transactions.title", lang)
            
            for trans in transactions[:10]:
                trans_type = trans.get("transaction_type", "")
                amount = trans.get("amount", 0)
                currency = trans.get("currency", "RUB")
                description = get_transaction_description(trans, lang)
                date = trans.get("transaction_date", "")[:10]
                
                icon = "💰" if trans_type == "income" else "💸" if trans_type == "expense" else "↔️"
                sign = "+" if trans_type == "income" else "-"
                
                message_text += t("transactions.item", lang,
                               icon=icon,
                               description=description,
                               date=date,
                               amount=f"{sign}{int(round(amount)):,}",
                               currency=currency)
            
            await message.answer(message_text)
        elif response.status_code == 401:
            await message.answer(t("auth.failed", lang))
        else:
            logger.error(f"Failed to get transactions: {response.status_code} - {response.text}")
            await message.answer(t("transactions.error", lang))
    except Exception as e:
        logger.error(f"Error getting transactions: {e}", exc_info=True)
        await message.answer(t("transactions.error", "ru"))


# Handler for button clicks (payload messages) and text commands
# This should be last to not interfere with command handlers
@bot.on.message()
async def button_handler(message: Message):
    """Handle button clicks and text commands"""
    text = message.text or ""
    payload = message.payload
    logger.info(f"📨 Received message from {message.from_id}: text='{text[:50]}', payload={payload}")
    
    # Handle button clicks (payload messages)
    if payload:
        try:
            # In vkbottle, payload can be a string (JSON) or already parsed dict
            if isinstance(payload, str):
                try:
                    payload_data = json.loads(payload)
                except json.JSONDecodeError:
                    # If it's not valid JSON, try to use it as-is
                    logger.warning(f"Invalid JSON payload: {payload}")
                    payload_data = {"command": payload}
            else:
                payload_data = payload
            
            command = payload_data.get("command")
            logger.info(f"Received button click: {command} from user {message.from_id}")
            
            vk_id = str(message.from_id)
            
            # Отслеживаем клик по кнопке
            await track_analytics_event(
                vk_id=vk_id,
                event_type="bot_click",
                event_name=f"button_{command}",
                metadata={"command": command, "source": "button"}
            )
            
            if command == "balance":
                await balance_handler(message)
                return
            elif command == "transactions":
                await transactions_handler(message)
                return
            elif command == "expense":
                await add_expense_start(message)
                return
            elif command == "income":
                await add_income_start(message)
                return
            elif command == "report":
                lang = await get_user_language(vk_id)
                await message.answer(t("report.generating", lang))
                return
            elif command == "goal":
                lang = await get_user_language(vk_id)
                await message.answer(t("goal.enter_info", lang))
                return
            elif command == "help":
                await help_handler(message)
                return
            elif command == "language":
                await language_selection_handler(message)
                return
            elif command == "lang_ru" or command == "lang_en":
                await language_selected_handler(message, command.split("_")[1])
                return
            elif command and command.startswith("account_"):
                account_id = int(command.split("_")[1])
                await account_selected_handler(message, account_id)
                return
            elif command and command.startswith("category_"):
                if command == "category_skip":
                    await category_selected_handler(message, None)
                else:
                    category_id = int(command.split("_")[1])
                    await category_selected_handler(message, category_id)
                return
            elif command == "cancel":
                await cancel_handler(message)
                return
        except Exception as e:
            logger.error(f"Error handling button payload: {e}", exc_info=True)
            vk_id = str(message.from_id)
            lang = await get_user_language(vk_id)
            await message.answer(t("common.error", lang))
            return
    
    # Handle text commands that don't match CommandRule
    # Check if it's a known command without /
    text_lower = text.lower().strip()
    if text_lower in ["баланс", "balance"]:
        await balance_handler(message)
        return
    elif text_lower in ["транзакции", "transactions"]:
        await transactions_handler(message)
        return
    elif text_lower in ["помощь", "справка", "help"]:
        await help_handler(message)
        return
    elif text_lower in ["начать", "старт", "start"]:
        await start_handler(message)
        return
    elif text_lower in ["отмена", "cancel"]:
        await cancel_handler(message)
        return
    
    # Handle conversation states (amount, description input)
    vk_id = str(message.from_id)
    user_id = int(vk_id)
    
    # Check for cancel command first
    text_lower = text.lower().strip()
    if text_lower in ["отмена", "cancel"]:
        await cancel_handler(message)
        return
    
    if user_id in user_states:
        state = user_states[user_id]
        state_type = state.get("type")
        
        if state_type == WAITING_AMOUNT:
            await amount_received_handler(message, state)
            return
        elif state_type == WAITING_DESCRIPTION:
            await description_received_handler(message, state)
            return
    
    # Only log and respond to unknown non-command messages
    if not text.startswith("/") and text.strip():
        logger.info(f"Received unknown message from {message.from_id}: {text[:100]}")
        lang = await get_user_language(vk_id)
        await message.answer(t("common.unknown_command", lang))


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Starting VK bot...")
    logger.info("=" * 60)
    logger.info(f"VK_BOT_TOKEN: {'✅ Set' if VK_BOT_TOKEN else '❌ NOT SET'}")
    logger.info(f"BACKEND_URL: {BACKEND_URL}")
    logger.info(f"VK_GROUP_ID: {GROUP_ID if GROUP_ID else 'Not set'}")
    logger.info("=" * 60)
    logger.info("Bot is ready to receive messages!")
    logger.info("Make sure Long Poll API is enabled in your VK community settings:")
    logger.info("  - Community Settings -> Work with API -> Long Poll API -> Enable")
    logger.info("  - Enable 'Incoming messages' event type")
    logger.info("=" * 60)
    
    try:
        bot.run_forever()
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Bot error: {e}", exc_info=True)
        raise


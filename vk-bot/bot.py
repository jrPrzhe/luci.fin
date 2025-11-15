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
from vkbottle import Keyboard, Text, KeyboardButtonColor
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

bot = Bot(token=VK_BOT_TOKEN)


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
    vk_id = str(message.from_id)
    try:
        user_info = await bot.api.users.get(message.from_id)
        user_name = user_info[0].first_name if user_info else "Пользователь"
    except:
        user_name = "Пользователь"
    
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
    
    await message.answer(message_text)


@bot.on.message(CommandRule("help", ["помощь", "справка"]))
async def help_handler(message: Message):
    """Handle /help command"""
    vk_id = str(message.from_id)
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


@bot.on.message(CommandRule("transactions", ["транзакции"]))
async def transactions_handler(message: Message):
    """Handle /transactions command"""
    try:
        vk_id = str(message.from_id)
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


if __name__ == "__main__":
    logger.info("Starting VK bot...")
    bot.run_forever()


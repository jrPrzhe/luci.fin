import logging
import asyncio
import sys
import requests
from decouple import config
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, ConversationHandler
from typing import Dict

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Bot configuration
TELEGRAM_BOT_TOKEN = config("TELEGRAM_BOT_TOKEN", default="")
BACKEND_URL = config("BACKEND_URL", default="http://localhost:8000")

# Conversation states
WAITING_AMOUNT, WAITING_DESCRIPTION, WAITING_ACCOUNT = range(3)
WAITING_GOAL_INFO, WAITING_GOAL_CONFIRMATION = range(3, 5)

# Store user tokens
user_tokens: Dict[int, str] = {}


def get_transaction_description(transaction: dict) -> str:
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
        return 'Без описания'


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command"""
    user = update.effective_user
    await update.message.reply_text(
        f"Привет, {user.first_name}! 👋\n\n"
        f"Я помогу тебе управлять финансами через Telegram.\n\n"
        f"📋 *Доступные команды:*\n"
        f"💰 /balance - текущий баланс\n"
        f"📝 /transactions - последние транзакции\n"
        f"💸 /add_expense - добавить расход\n"
        f"💰 /add_income - добавить доход\n"
        f"📊 /report - получить AI-отчёт\n"
        f"🎯 /goal - создать финансовую цель\n"
        f"❓ /help - справка\n\n"
        f"*Важно:* Для работы бота необходимо сначала зарегистрироваться через веб-интерфейс или Mini App.",
        parse_mode='Markdown'
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help command"""
    help_text = """📊 *Доступные команды:*

/start - начать работу с ботом
💰 /balance - показать текущий баланс по всем счетам
📝 /transactions - показать последние транзакции
💸 /add_expense - добавить новый расход
💰 /add_income - добавить новый доход
📊 /report - получить AI-анализ финансов
🎯 /goal - создать финансовую цель с AI-планом
/cancel - отменить текущую операцию
❓ /help - эта справка

*Использование:*
• После команды /add_expense или /add_income выберите счет и следуйте инструкциям
• Команда /report анализирует ваши транзакции и дает рекомендации
• Команда /goal создаст индивидуальный план для достижения вашей финансовой цели"""
    await update.message.reply_text(help_text, parse_mode='Markdown')


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
        import httpx
        telegram_id = str(update.effective_user.id)
        
        # Get token
        try:
            token = await get_user_token(telegram_id)
            logger.debug(f"Got token for balance request, length: {len(token) if token else 0}")
            
            # Validate token format
            if not token or len(token) < 50 or '.' not in token:
                logger.error(f"Invalid token format: {token[:50] if token else 'None'}...")
                raise Exception("Invalid token format")
        except Exception as e:
            logger.error(f"Error getting token: {e}")
            # Clear invalid token from cache
            user_id = int(telegram_id)
            if user_id in user_tokens:
                logger.warning(f"Clearing invalid token from cache for user {user_id}")
                del user_tokens[user_id]
            await update.message.reply_text(
                "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь через веб-интерфейс или Mini App."
            )
            return
        
        async with httpx.AsyncClient() as client:
            auth_header = f"Bearer {token}"
            logger.debug(f"Making balance request with Authorization header (token length: {len(token)})")
            
            response = await client.get(
                f"{BACKEND_URL}/api/v1/accounts/balance",
                headers={"Authorization": auth_header},
                timeout=5.0
            )
            
            if response.status_code == 200:
                data = response.json()
                total = data.get("total", 0)
                currency = data.get("currency", "RUB")
                
                # Format message
                message = f"💰 *Ваш баланс*\n\n"
                message += f"💵 Всего: *{int(round(total)):,} {currency}*\n\n"
                
                # Add accounts breakdown
                accounts = data.get("accounts", [])
                if accounts:
                    message += "*По счетам:*\n"
                    for acc in accounts[:5]:  # Show first 5 accounts
                        acc_name = acc.get("name", "Счет")
                        acc_balance = acc.get("balance", 0)
                        message += f"• {acc_name}: {int(round(acc_balance)):,} {currency}\n"
                
                await update.message.reply_text(message, parse_mode='Markdown')
            else:
                await update.message.reply_text(
                    "❌ Не удалось получить баланс."
                )
    except Exception as e:
        logger.error(f"Error getting balance: {e}")
        await update.message.reply_text(
            "❌ Ошибка при получении баланса."
        )


async def get_transactions(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /transactions command"""
    try:
        import httpx
        telegram_id = str(update.effective_user.id)
        
        # Get token
        try:
            token = await get_user_token(telegram_id)
            # Validate token format
            if not token or len(token) < 50 or '.' not in token:
                logger.error(f"Invalid token format in get_transactions")
                raise Exception("Invalid token format")
        except Exception as e:
            logger.error(f"Error getting token in get_transactions: {e}")
            # Clear invalid token from cache
            user_id = int(telegram_id)
            if user_id in user_tokens:
                del user_tokens[user_id]
            await update.message.reply_text(
                "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь через веб-интерфейс или Mini App."
            )
            return
        
        async with httpx.AsyncClient() as client:
            auth_header = f"Bearer {token}"
            logger.debug(f"Making transactions request with Authorization header")
            
            response = await client.get(
                f"{BACKEND_URL}/api/v1/transactions/?limit=10",
                headers={"Authorization": auth_header},
                timeout=5.0
            )
            
            if response.status_code == 200:
                transactions = response.json()
                
                if not transactions:
                    await update.message.reply_text("📝 У вас пока нет транзакций.")
                    return
                
                message = "📝 *Последние транзакции:*\n\n"
                
                for trans in transactions[:10]:
                    trans_type = trans.get("transaction_type", "")
                    amount = trans.get("amount", 0)
                    currency = trans.get("currency", "RUB")
                    description = get_transaction_description(trans)
                    date = trans.get("transaction_date", "")[:10]
                    
                    icon = "💰" if trans_type == "income" else "💸" if trans_type == "expense" else "↔️"
                    sign = "+" if trans_type == "income" else "-"
                    
                    message += f"{icon} *{sign}{int(round(amount)):,} {currency}*\n"
                    message += f"   {description}\n"
                    message += f"   📅 {date}\n\n"
                
                await update.message.reply_text(message, parse_mode='Markdown')
            else:
                await update.message.reply_text("❌ Не удалось получить транзакции.")
    except Exception as e:
        logger.error(f"Error getting transactions: {e}")
        await update.message.reply_text("❌ Ошибка при получении транзакций.")


async def add_expense_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /add_expense command"""
    telegram_id = str(update.effective_user.id)
    
    # Get token to verify user exists
    try:
        token = await get_user_token(telegram_id)
        # Validate token format
        if not token or len(token) < 50 or '.' not in token:
            raise Exception("Invalid token format")
    except Exception as e:
        logger.error(f"Error getting token in add_expense_start: {e}")
        # Clear invalid token from cache
        user_id = int(telegram_id)
        if user_id in user_tokens:
            del user_tokens[user_id]
        await update.message.reply_text(
            "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь."
        )
        return ConversationHandler.END
    
    # Get user accounts
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BACKEND_URL}/api/v1/accounts/",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
            
            if response.status_code == 200:
                accounts = response.json()
                if not accounts:
                    await update.message.reply_text(
                        "❌ У вас нет счетов. Сначала создайте счет через веб-интерфейс."
                    )
                    return ConversationHandler.END
                
                # Store accounts in context
                context.user_data['accounts'] = accounts
                context.user_data['type'] = 'expense'  # Set transaction type
                
                # Create keyboard with accounts
                keyboard = []
                for acc in accounts[:5]:  # Limit to 5 accounts
                    keyboard.append([InlineKeyboardButton(
                        f"{acc['name']} ({int(round(acc['balance'])):,} {acc['currency']})",
                        callback_data=f"account_{acc['id']}"
                    )])
                
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await update.message.reply_text(
                    "💸 *Добавление расхода*\n\n"
                    "Выберите счет:",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                
                return WAITING_AMOUNT
            else:
                await update.message.reply_text("❌ Не удалось загрузить счета.")
                return ConversationHandler.END
    except Exception as e:
        logger.error(f"Error in add_expense_start: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке счетов.")
        return ConversationHandler.END


async def account_selected(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle account selection"""
    query = update.callback_query
    await query.answer()
    
    account_id = int(query.data.split('_')[1])
    context.user_data['account_id'] = account_id
    
    # Find account name
    accounts = context.user_data.get('accounts', [])
    account = next((a for a in accounts if a['id'] == account_id), None)
    account_name = account['name'] if account else "счет"
    
    trans_type = context.user_data.get('type', 'expense')
    type_text = "дохода" if trans_type == "income" else "расхода"
    icon = "💰" if trans_type == "income" else "💸"
    
    await query.edit_message_text(
        f"{icon} Добавление {type_text}\n\n"
        f"Счет: *{account_name}*\n\n"
        f"Введите сумму {type_text}:",
        parse_mode='Markdown'
    )
    
    return WAITING_AMOUNT


async def amount_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle amount input"""
    try:
        amount = float(update.message.text.replace(',', '.'))
        if amount <= 0:
            await update.message.reply_text("❌ Сумма должна быть больше 0. Введите сумму:")
            return WAITING_AMOUNT
        
        context.user_data['amount'] = amount
        
        trans_type = context.user_data.get('type', 'expense')
        type_text = "дохода" if trans_type == "income" else "расхода"
        icon = "💰" if trans_type == "income" else "💸"
        
        await update.message.reply_text(
            f"{icon} Добавление {type_text}\n\n"
            f"Сумма: *{int(round(amount)):,}*\n\n"
            f"Введите описание (или отправьте '—' чтобы пропустить):",
            parse_mode='Markdown'
        )
        
        return WAITING_DESCRIPTION
    except ValueError:
        await update.message.reply_text("❌ Неверный формат суммы. Введите число:")
        return WAITING_AMOUNT


async def description_received(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle description input and create transaction"""
    description = update.message.text.strip()
    if description == '—' or description.lower() == 'нет':
        description = None
    
    account_id = context.user_data.get('account_id')
    amount = context.user_data.get('amount')
    transaction_type = context.user_data.get('type', 'expense')  # Default to expense if not set
    
    if not account_id or not amount:
        cmd = "/add_expense" if transaction_type == "expense" else "/add_income"
        await update.message.reply_text(f"❌ Ошибка. Попробуйте снова: {cmd}")
        return ConversationHandler.END
    
    try:
        import httpx
        telegram_id = str(update.effective_user.id)
        token = await get_user_token(telegram_id)
        
        # Get account currency
        accounts = context.user_data.get('accounts', [])
        account = next((a for a in accounts if a['id'] == account_id), None)
        currency = account['currency'] if account else 'RUB'
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{BACKEND_URL}/api/v1/transactions/",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "account_id": account_id,
                    "transaction_type": transaction_type,
                    "amount": amount,
                    "currency": currency,
                    "description": description,
                },
                timeout=5.0
            )
            
            if response.status_code == 201:
                icon = "💰" if transaction_type == "income" else "💸"
                type_text = "Доход" if transaction_type == "income" else "Расход"
                await update.message.reply_text(
                    f"✅ *{type_text} добавлен!*\n\n"
                    f"{icon} {int(round(amount)):,} {currency}\n"
                    f"📝 {description or 'Без описания'}",
                    parse_mode='Markdown'
                )
            else:
                error_msg = response.json().get("detail", "Ошибка")
                await update.message.reply_text(f"❌ Ошибка: {error_msg}")
    except Exception as e:
        logger.error(f"Error creating transaction: {e}")
        type_text = "дохода" if transaction_type == "income" else "расхода"
        await update.message.reply_text(f"❌ Ошибка при создании {type_text}.")
    
    # Clear context
    context.user_data.clear()
    return ConversationHandler.END


async def add_income_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /add_income command"""
    telegram_id = str(update.effective_user.id)
    
    try:
        token = await get_user_token(telegram_id)
        # Validate token format
        if not token or len(token) < 50 or '.' not in token:
            raise Exception("Invalid token format")
    except Exception as e:
        logger.error(f"Error getting token in add_income_start: {e}")
        # Clear invalid token from cache
        user_id = int(telegram_id)
        if user_id in user_tokens:
            del user_tokens[user_id]
        await update.message.reply_text(
            "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь."
        )
        return ConversationHandler.END
    
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{BACKEND_URL}/api/v1/accounts/",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
            
            if response.status_code == 200:
                accounts = response.json()
                if not accounts:
                    await update.message.reply_text(
                        "❌ У вас нет счетов. Сначала создайте счет через веб-интерфейс."
                    )
                    return ConversationHandler.END
                
                context.user_data['accounts'] = accounts
                context.user_data['type'] = 'income'
                
                keyboard = []
                for acc in accounts[:5]:
                    keyboard.append([InlineKeyboardButton(
                        f"{acc['name']} ({int(round(acc['balance'])):,} {acc['currency']})",
                        callback_data=f"account_{acc['id']}"
                    )])
                
                reply_markup = InlineKeyboardMarkup(keyboard)
                
                await update.message.reply_text(
                    "💰 *Добавление дохода*\n\n"
                    "Выберите счет:",
                    reply_markup=reply_markup,
                    parse_mode='Markdown'
                )
                
                return WAITING_AMOUNT
            else:
                await update.message.reply_text("❌ Не удалось загрузить счета.")
                return ConversationHandler.END
    except Exception as e:
        logger.error(f"Error in add_income_start: {e}")
        await update.message.reply_text("❌ Ошибка при загрузке счетов.")
        return ConversationHandler.END


async def report_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /report command - generate AI-powered financial report"""
    try:
        import httpx
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
            await update.message.reply_text(
                "❌ Не удалось авторизоваться. Пожалуйста, сначала зарегистрируйтесь."
            )
            return
        
        # Send "thinking" message
        thinking_msg = await update.message.reply_text("🤖 Генерация отчета... Пожалуйста, подождите.")
        
        async with httpx.AsyncClient() as client:
            # Get transactions
            transactions_response = await client.get(
                f"{BACKEND_URL}/api/v1/transactions/?limit=100",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
            
            # Get balance
            balance_response = await client.get(
                f"{BACKEND_URL}/api/v1/accounts/balance",
                headers={"Authorization": f"Bearer {token}"},
                timeout=5.0
            )
            
            if transactions_response.status_code != 200 or balance_response.status_code != 200:
                await thinking_msg.edit_text("❌ Не удалось получить данные.")
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
                    report_text += f"{i}. {desc}: {int(round(amount)):,} {currency}\n"
                report_text += "\n"
            
            # AI Analysis
            try:
                ai_response = await client.post(
                    f"{BACKEND_URL}/api/v1/ai/analyze",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
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
                        report_text += f"🤖 *Анализ ИИ:*\n{insights}\n"
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
        logger.error(f"Error generating report: {e}")
        try:
            await thinking_msg.edit_text("❌ Ошибка при генерации отчета.")
        except:
            await update.message.reply_text("❌ Ошибка при генерации отчета.")


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Cancel conversation"""
    context.user_data.clear()
    await update.message.reply_text("❌ Операция отменена.")
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
    await update.message.reply_text(
        f"✅ *Понял вашу цель:*\n\n"
        f"🎯 Название: {goal_name}\n"
        f"💰 Стоимость: {int(round(target_amount)):,} {context.user_data['currency']}\n\n"
        f"Анализирую ваши транзакции и создаю индивидуальный план...\n"
        f"⏳ Пожалуйста, подождите...",
        parse_mode='Markdown'
    )
    
    # Generate roadmap
    try:
        import httpx
        telegram_id = str(update.effective_user.id)
        token = await get_user_token(telegram_id)
        
        async with httpx.AsyncClient() as client:
            # Get transactions
            transactions_response = await client.get(
                f"{BACKEND_URL}/api/v1/transactions/?limit=100",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            
            # Get balance
            balance_response = await client.get(
                f"{BACKEND_URL}/api/v1/accounts/balance",
                headers={"Authorization": f"Bearer {token}"},
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
            
            # Generate roadmap
            roadmap_response = await client.post(
                f"{BACKEND_URL}/api/v1/goals/generate-roadmap",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "goal_name": goal_name,
                    "target_amount": float(target_amount),
                    "currency": currency,
                    "transactions": transactions[:50],
                    "balance": float(balance),
                    "income_total": float(income_total),
                    "expense_total": float(expense_total)
                },
                timeout=30.0
            )
            
            if roadmap_response.status_code != 200:
                await update.message.reply_text("❌ Не удалось создать план. Попробуйте позже.")
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
            if not roadmap_text:
                roadmap_text = f"""🗺️ *Дорожная карта для достижения цели*

🎯 Цель: {goal_name}
💰 Стоимость: {int(round(target_amount)):,} {currency}
📅 Оценка времени: {roadmap_data.get('estimated_months', 12)} месяцев
💵 Ежемесячные накопления: {int(round(roadmap_data.get('monthly_savings_needed', 0))):,} {currency}

📋 Рекомендации:"""
                for rec in roadmap_data.get('recommendations', [])[:3]:
                    roadmap_text += f"\n• {rec}"
            
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
            import httpx
            telegram_id = str(update.effective_user.id)
            token = await get_user_token(telegram_id)
            
            goal_name = context.user_data.get('goal_name')
            target_amount = context.user_data.get('target_amount')
            currency = context.user_data.get('currency', 'RUB')
            roadmap = context.user_data.get('roadmap')
            
            async with httpx.AsyncClient() as client:
                # Create goal
                goal_response = await client.post(
                    f"{BACKEND_URL}/api/v1/goals/",
                    headers={"Authorization": f"Bearer {token}"},
                    json={
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
                else:
                    error_msg = goal_response.json().get("detail", "Ошибка")
                    await query.edit_message_text(f"❌ Ошибка при создании цели: {error_msg}")
        except Exception as e:
            logger.error(f"Error creating goal: {e}")
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
    
    # Goal creation conversation handler
    from telegram.ext import CallbackQueryHandler
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
    
    # Delete webhook synchronously to avoid event loop issues
    try:
        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook"
        params = {"drop_pending_updates": "true"}
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            logger.info("Webhook deleted (if existed)")
        else:
            logger.warning(f"Could not delete webhook: {response.status_code}")
    except Exception as e:
        logger.warning(f"Error deleting webhook: {e}")
    
    # Create event loop for Python 3.12+ compatibility
    # run_polling() needs an event loop to exist, but Python 3.12+ doesn't create one automatically
    try:
        # Try to get existing event loop
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("Event loop is closed")
    except RuntimeError:
        # Create new event loop if none exists
        if sys.platform == 'win32':
            # Windows needs SelectorEventLoop
            loop = asyncio.SelectorEventLoop()
        else:
            loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    # Start polling - run_polling() will use the existing event loop
    logger.info("Starting Telegram bot in polling mode...")
    logger.info("Polling mode works on HTTP (no HTTPS required)")
    
    try:
        application.run_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=True,
            close_loop=False
        )
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")


if __name__ == "__main__":
    main()


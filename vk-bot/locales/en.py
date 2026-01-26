# English translations for VK bot

en = {
    "start": {
        "greeting": "Hello, {name}! 👋\n\nI'm Lucy — your helper in VK.\n\n⚠️ Important: all main actions (record expenses/income, categories, plans) happen in the *Mini App*.\nI'm here to remind you and quickly open the app.\n\n",
        "commands": "📌 *What I can do in chat:*\n",
        "balance": "💰 balance — check total balance\n",
        "transactions": "📝 transactions — recent records\n",
        "help": "❓ help — tips\n\n",
        "important": "👇 Tap the button below to open the Mini App.",
    },
    "help": {
        "title": "📊 *Available commands:*\n\n",
        "start": "start - start working with the bot\n",
        "balance": "💰 balance - show current balance across all accounts\n",
        "transactions": "📝 transactions - show recent transactions\n",
        "cancel": "cancel - cancel current operation\n",
        "help": "❓ help - this help\n\n",
        "usage": "*Usage:*\n",
        "usage_expense": "• To record expenses/income, open the Mini App using the «📱 Open Mini App» button\n",
        "usage_report": "• Reports and plans are also available in the Mini App\n",
        "usage_goal": "• Goals are created in the Mini App — it's easier to fill details there",
    },
    "language": {
        "select": "🌍 *Select Language / Выберите язык*\n\n",
        "current": "Current language: *{lang}*\n\n",
        "changed": "✅ Language changed to *{lang}*",
        "error": "❌ Error changing language",
    },
    "common": {
        "no_description": "No description",
        "loading": "Loading...",
        "error": "❌ Error",
        "cancel": "Cancel",
        "skip": "Skip",
        "select": "Select",
        "account": "Account",
        "amount": "Amount",
        "description": "Description",
        "category": "Category",
        "processing": "Processing...",
        "success": "✅ Success",
        "failed": "❌ Failed",
        "unknown_command": "I don't understand this command. Use /help for a list of commands.",
    },
    "buttons": {
        "balance": "💰 Balance",
        "transactions": "📝 Transactions",
        "report": "📊 Report",
        "goal": "🎯 Goal",
        "help": "❓ Help",
        "language": "🌍 Language",
        "app": "📱 Open Mini App",
        "app_expense": "💸 Record expense",
        "app_income": "💰 Record income",
    },
    "auth": {
        "failed": "❌ Failed to authenticate. Please register first.",
    },
    "balance": {
        "title": "💰 *Current Balance*\n\n",
        "total": "Total balance: *{amount} {currency}*\n\n",
        "accounts": "*Accounts:*\n",
        "account_item": "• {name}: {amount} {currency}\n",
        "error": "❌ Failed to get balance",
    },
    "transactions": {
        "title": "📝 *Recent Transactions*\n\n",
        "empty": "No transactions",
        "item": "{icon} *{description}*\n{date} • {amount} {currency}\n",
        "error": "❌ Failed to get transactions",
    },
    "expense": {
        # New funnel behavior (preferred)
        "redirect": "💸 Record expenses in the Mini App — it's faster and has categories/budget groups.\n\nTap the button below 👇",
        # Legacy keys kept for backward compatibility (old in-chat flow)
        "title": "💸 *Adding Expense*\n\n",
        "select_account": "Select account:",
        "enter_amount": "Enter expense amount:",
        "enter_description": "Enter description (or send \"skip\" to skip):",
        "select_category": "Select category:",
        "skip_category": "⏭️ Skip category",
        "created": "✅ Expense successfully added!\n\n*Amount:* {amount} {currency}\n*Account:* {account}\n*Category:* {category}\n*Description:* {description}",
        "error": "❌ Error adding expense",
    },
    "income": {
        # New funnel behavior (preferred)
        "redirect": "💰 Record income in the Mini App — it's easier and nothing gets lost.\n\nTap the button below 👇",
        # Legacy keys kept for backward compatibility (old in-chat flow)
        "title": "💰 *Adding Income*\n\n",
        "select_account": "Select account:",
        "enter_amount": "Enter income amount:",
        "enter_description": "Enter description (or send \"skip\" to skip):",
        "select_category": "Select category:",
        "skip_category": "⏭️ Skip category",
        "created": "✅ Income successfully added!\n\n*Amount:* {amount} {currency}\n*Account:* {account}\n*Category:* {category}\n*Description:* {description}",
        "error": "❌ Error adding income",
    },
    "funnel": {
        "open_app_hint": "📱 Open the Mini App with the button below — that's where you manage your finances.",
        "feature_in_app": "This feature is available in the Mini App.",
    },
    "report": {
        "generating": "🤖 Generating report... Please wait.",
        "error_data": "❌ Failed to get data.",
        "error": "❌ Error generating report",
    },
    "goal": {
        "enter_info": "🎯 *Creating Financial Goal*\n\nEnter goal information in format:\n*Name | Amount | Date (YYYY-MM-DD)*\n\nExample:\n*New Laptop | 50000 | 2024-12-31*",
        "confirm": "Confirm goal creation:",
        "created": "✅ Goal successfully created!",
        "error": "❌ Error creating goal",
    },
    "cancel": {
        "cancelled": "❌ Operation cancelled",
    },
}




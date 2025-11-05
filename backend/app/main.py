from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.database import engine, Base
from app.middleware.ngrok_bypass import NgrokBypassMiddleware
from app.middleware.request_logger import RequestLoggerMiddleware

# Import all models to register them with SQLAlchemy
from app.models import User, Account, Transaction, Category, Tag, SharedBudget, SharedBudgetMember, Invitation, Report, Goal, Notification

# Create database tables
Base.metadata.create_all(bind=engine)

# Ensure invite_code column exists (migration helper)
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('shared_budgets'):
        columns = [col['name'] for col in inspector.get_columns('shared_budgets')]
        if 'invite_code' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE shared_budgets ADD COLUMN invite_code VARCHAR(10)"))
                conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_shared_budgets_invite_code ON shared_budgets(invite_code)"))
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Ensure shared_budget_id column exists in accounts table (migration helper)
try:
    if inspector.has_table('accounts'):
        columns = [col['name'] for col in inspector.get_columns('accounts')]
        if 'shared_budget_id' not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN shared_budget_id INTEGER REFERENCES shared_budgets(id)"))
except Exception:
    pass

# Ensure shared_budget_id column exists in categories table (migration helper)
try:
    if inspector.has_table('categories'):
        columns = [col['name'] for col in inspector.get_columns('categories')]
        if 'shared_budget_id' not in columns:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE categories ADD COLUMN shared_budget_id INTEGER REFERENCES shared_budgets(id)"))
except Exception:
    pass
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('accounts'):
        columns = [col['name'] for col in inspector.get_columns('accounts')]
        if 'shared_budget_id' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE accounts ADD COLUMN shared_budget_id INTEGER"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_accounts_shared_budget_id ON accounts(shared_budget_id)"))
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Ensure is_favorite column exists in categories table (migration helper)
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('categories'):
        columns = [col['name'] for col in inspector.get_columns('categories')]
        if 'is_favorite' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE categories ADD COLUMN is_favorite BOOLEAN DEFAULT 0"))
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Ensure roadmap column exists in goals table (migration helper)
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('goals'):
        columns = [col['name'] for col in inspector.get_columns('goals')]
        if 'roadmap' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE goals ADD COLUMN roadmap TEXT"))
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Ensure goal_id column exists in transactions table (migration helper)
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('transactions'):
        columns = [col['name'] for col in inspector.get_columns('transactions')]
        if 'goal_id' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE transactions ADD COLUMN goal_id INTEGER REFERENCES goals(id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_transactions_goal_id ON transactions(goal_id)"))
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Ensure account_id column exists in goals table (migration helper)
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('goals'):
        columns = [col['name'] for col in inspector.get_columns('goals')]
        if 'account_id' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE goals ADD COLUMN account_id INTEGER REFERENCES accounts(id)"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS idx_goals_account_id ON goals(account_id)"))
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Create app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG
)

# Request logger middleware (for debugging auth issues)
app.add_middleware(RequestLoggerMiddleware)

# Ngrok bypass middleware (to skip browser warning page)
app.add_middleware(NgrokBypassMiddleware)

# CORS middleware with regex for ngrok domains
# Ensure CORS_ORIGINS is a list
cors_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else list(settings.CORS_ORIGINS)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.ngrok-free\.app|https://.*\.ngrok\.app|https://.*\.ngrok\.io",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Finance Manager API",
        "version": settings.VERSION,
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Import and include routers
from app.api.v1 import auth, transactions, accounts, shared_budgets, ai, categories, reports, goals
from app.api.v1 import import_data as import_router

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["Transactions"])
app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(shared_budgets.router, prefix="/api/v1/shared-budgets", tags=["Shared Budgets"])
app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Assistant"])
app.include_router(categories.router, prefix="/api/v1/categories", tags=["Categories"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
app.include_router(goals.router, prefix="/api/v1/goals", tags=["Goals"])
app.include_router(import_router.router, prefix="/api/v1/import", tags=["Import"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


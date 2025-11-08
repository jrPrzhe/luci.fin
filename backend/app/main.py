# Раннее логирование для диагностики
import sys
print("[STARTUP] Python version:", sys.version, file=sys.stderr, flush=True)
print("[STARTUP] Starting application import...", file=sys.stderr, flush=True)

try:
    from fastapi import FastAPI
    print("[STARTUP] FastAPI imported", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR importing FastAPI: {e}", file=sys.stderr, flush=True)
    raise

from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

print("[STARTUP] Importing config...", file=sys.stderr, flush=True)
try:
    from app.core.config import settings
    print(f"[STARTUP] Config loaded, DATABASE_URL type: {type(settings.DATABASE_URL)}", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR importing config: {e}", file=sys.stderr, flush=True)
    raise

print("[STARTUP] Importing database...", file=sys.stderr, flush=True)
try:
    from app.core.database import engine, Base
    print("[STARTUP] Database engine imported", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR importing database: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc(file=sys.stderr)
    raise

from app.middleware.ngrok_bypass import NgrokBypassMiddleware
from app.middleware.request_logger import RequestLoggerMiddleware

# Import all models to register them with SQLAlchemy
print("[STARTUP] Importing models...", file=sys.stderr, flush=True)
try:
    from app.models import User, Account, Transaction, Category, Tag, SharedBudget, SharedBudgetMember, Invitation, Report, Goal, Notification
    print("[STARTUP] Models imported", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR importing models: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc(file=sys.stderr)
    raise

# DO NOT use create_all() in production - it will recreate tables and lose data!
# Use Alembic migrations instead: alembic upgrade head
# Only uncomment for initial development setup
# Base.metadata.create_all(bind=engine)

# Auto-apply migrations on startup (only in production/Railway)
# This ensures database schema is up to date without losing data
import os
import logging
migration_logger = logging.getLogger(__name__)

if os.getenv("RAILWAY_ENVIRONMENT") or os.getenv("RAILWAY_PROJECT_ID") or not os.getenv("SKIP_MIGRATIONS"):
    try:
        from alembic import command
        from alembic.config import Config
        
        migration_logger.info("Running database migrations...")
        # Try to find alembic.ini in current directory or backend directory
        alembic_ini_path = "alembic.ini"
        if not os.path.exists(alembic_ini_path):
            alembic_ini_path = "backend/alembic.ini"
        if not os.path.exists(alembic_ini_path):
            # In Railway, working directory is /app, alembic.ini should be there
            alembic_ini_path = "/app/alembic.ini" if os.path.exists("/app/alembic.ini") else "alembic.ini"
        
        migration_logger.info(f"Using alembic.ini at: {alembic_ini_path}")
        alembic_cfg = Config(alembic_ini_path)
        command.upgrade(alembic_cfg, "head")
        migration_logger.info("Database migrations applied successfully")
    except Exception as e:
        # Log but don't fail startup if migrations fail
        # This allows the app to start even if there are migration issues
        migration_logger.warning(f"Could not run migrations automatically: {e}")
        migration_logger.warning("You may need to run 'alembic upgrade head' manually")

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

# Ensure is_admin column exists in users table (migration helper)
try:
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if inspector.has_table('users'):
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'is_admin' not in columns:
            # Add column if missing
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0"))
                migration_logger.info("Added is_admin column to users table")
except Exception:
    # Column might already exist or table might not exist yet - that's ok
    pass

# Log admin configuration on startup (using print for guaranteed output)
try:
    from app.core.config import settings
    import logging
    startup_logger = logging.getLogger(__name__)
    startup_logger.setLevel(logging.INFO)
    
    # Use both print and logger for guaranteed visibility
    admin_config_msg = f"""
{'=' * 60}
ADMIN CONFIGURATION CHECK
{'=' * 60}
ADMIN_TELEGRAM_IDS = {settings.ADMIN_TELEGRAM_IDS}
Type: {type(settings.ADMIN_TELEGRAM_IDS)}
Count: {len(settings.ADMIN_TELEGRAM_IDS) if isinstance(settings.ADMIN_TELEGRAM_IDS, list) else 'N/A'}
"""
    if isinstance(settings.ADMIN_TELEGRAM_IDS, list):
        for admin_id in settings.ADMIN_TELEGRAM_IDS:
            admin_config_msg += f"  - Admin ID: {admin_id} (type: {type(admin_id)})\n"
    admin_config_msg += "=" * 60
    
    print(admin_config_msg)  # Print for guaranteed output
    startup_logger.info(admin_config_msg)
except Exception as e:
    import logging
    error_msg = f"Failed to load admin configuration: {e}"
    print(error_msg)  # Print for guaranteed output
    startup_logger = logging.getLogger(__name__)
    startup_logger.error(error_msg, exc_info=True)

# Create app
print("[STARTUP] Creating FastAPI app...", file=sys.stderr, flush=True)
try:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        debug=settings.DEBUG
    )
    print("[STARTUP] FastAPI app created", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR creating app: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc(file=sys.stderr)
    raise

# Request logger middleware (for debugging auth issues)
app.add_middleware(RequestLoggerMiddleware)

# Ngrok bypass middleware (to skip browser warning page)
app.add_middleware(NgrokBypassMiddleware)

# CORS middleware with regex for ngrok and Vercel domains
# Ensure CORS_ORIGINS is a list
cors_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else list(settings.CORS_ORIGINS)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.ngrok-free\.app|https://.*\.ngrok\.app|https://.*\.ngrok\.io|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
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
print("[STARTUP] Importing routers...", file=sys.stderr, flush=True)
try:
    from app.api.v1 import auth, transactions, accounts, shared_budgets, ai, categories, reports, goals, admin
    from app.api.v1 import import_data as import_router
    print("[STARTUP] Routers imported", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR importing routers: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc(file=sys.stderr)
    raise

print("[STARTUP] Including routers...", file=sys.stderr, flush=True)
try:
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(transactions.router, prefix="/api/v1/transactions", tags=["Transactions"])
    app.include_router(accounts.router, prefix="/api/v1/accounts", tags=["Accounts"])
    app.include_router(shared_budgets.router, prefix="/api/v1/shared-budgets", tags=["Shared Budgets"])
    app.include_router(ai.router, prefix="/api/v1/ai", tags=["AI Assistant"])
    app.include_router(categories.router, prefix="/api/v1/categories", tags=["Categories"])
    app.include_router(reports.router, prefix="/api/v1/reports", tags=["Reports"])
    app.include_router(goals.router, prefix="/api/v1/goals", tags=["Goals"])
    app.include_router(import_router.router, prefix="/api/v1/import", tags=["Import"])
    app.include_router(admin.router, prefix="/api/v1", tags=["Admin"])
    print("[STARTUP] All routers included, application ready!", file=sys.stderr, flush=True)
except Exception as e:
    print(f"[STARTUP] ERROR including routers: {e}", file=sys.stderr, flush=True)
    import traceback
    traceback.print_exc(file=sys.stderr)
    raise

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)


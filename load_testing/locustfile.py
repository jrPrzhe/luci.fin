"""
Load Testing Script for Finance Manager API
Simulates realistic user behavior patterns
"""
import random
import time
from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FinanceManagerUser(FastHttpUser):
    """
    Simulates a typical user interacting with the Finance Manager API
    """
    wait_time = between(1, 3)  # Wait 1-3 seconds between tasks
    
    def on_start(self):
        """Called when a simulated user starts"""
        self.token = None
        self.user_id = None
        self.email = f"loadtest_{random.randint(10000, 99999)}@test.com"
        self.password = "TestPassword123!"
        self.accounts = []
        self.categories = []
        
        # Try to register or login
        self.authenticate()
    
    def authenticate(self):
        """Register a new user or login if exists"""
        # Try to register first with correct schema
        full_name = f"Load Test User {random.randint(1, 1000)}"
        name_parts = full_name.rsplit(" ", 1)
        first_name = name_parts[0] if len(name_parts) > 0 else "Load Test"
        last_name = name_parts[1] if len(name_parts) > 1 else "User"
        
        register_data = {
            "email": self.email,
            "password": self.password,
            "first_name": first_name,
            "last_name": last_name,
            "username": self.email.split("@")[0]  # Use email prefix as username
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with self.client.post(
                    "/api/v1/auth/register",
                    json=register_data,
                    catch_response=True,
                    name="Register User"
                ) as response:
                    if response.status_code == 201:
                        try:
                            data = response.json()
                            self.token = data.get("access_token")
                            if self.token:
                                logger.info(f"Registered new user: {self.email}")
                                return
                            else:
                                logger.warning(f"No access_token in response: {data}")
                                response.failure("No access_token in registration response")
                        except Exception as e:
                            logger.error(f"Failed to parse registration response: {e}")
                            response.failure(f"Failed to parse response: {e}")
                            break
                    elif response.status_code == 400:
                        # User might already exist, try to login
                        break
                    elif response.status_code == 500:
                        # Server error, try again
                        if attempt < max_retries - 1:
                            logger.warning(f"Server error on registration attempt {attempt + 1}, retrying...")
                            time.sleep(1)
                            continue
                        else:
                            response.failure(f"Registration failed after {max_retries} attempts: 500")
                            break
                    else:
                        response.failure(f"Registration failed: {response.status_code}")
                        break
            except Exception as e:
                logger.error(f"Exception during registration: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    break
        
        # If registration failed or user exists, try to login
        login_data = {
            "email": self.email,
            "password": self.password
        }
        
        for attempt in range(max_retries):
            try:
                with self.client.post(
                    "/api/v1/auth/login",
                    json=login_data,
                    catch_response=True,
                    name="Login User"
                ) as login_response:
                    if login_response.status_code == 200:
                        try:
                            data = login_response.json()
                            self.token = data.get("access_token")
                            if self.token:
                                logger.info(f"Logged in existing user: {self.email}")
                                return
                            else:
                                logger.warning(f"No access_token in login response: {data}")
                                login_response.failure("No access_token in login response")
                        except Exception as e:
                            logger.error(f"Failed to parse login response: {e}")
                            login_response.failure(f"Failed to parse response: {e}")
                    elif login_response.status_code in [401, 403]:
                        login_response.failure(f"Login failed: {login_response.status_code}")
                        break
                    elif login_response.status_code == 500:
                        if attempt < max_retries - 1:
                            logger.warning(f"Server error on login attempt {attempt + 1}, retrying...")
                            time.sleep(1)
                            continue
                        else:
                            login_response.failure(f"Login failed after {max_retries} attempts: 500")
                    else:
                        login_response.failure(f"Login failed: {login_response.status_code}")
                        break
            except Exception as e:
                logger.error(f"Exception during login: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    break
        
        logger.error(f"Failed to authenticate user {self.email} after all attempts")
    
    def get_headers(self):
        """Get headers with authentication token"""
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}
    
    @task(5)
    def view_dashboard(self):
        """View dashboard - most common action"""
        if not self.token:
            return  # Skip if not authenticated
        self.client.get(
            "/api/v1/transactions",
            headers=self.get_headers(),
            params={"limit": 10, "offset": 0},
            name="View Dashboard (Transactions)"
        )
    
    @task(4)
    def view_accounts(self):
        """View user accounts"""
        if not self.token:
            return  # Skip if not authenticated
        with self.client.get(
            "/api/v1/accounts",
            headers=self.get_headers(),
            catch_response=True,
            name="View Accounts"
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.accounts = data if isinstance(data, list) else []
                except Exception as e:
                    response.failure(f"Failed to parse accounts response: {e}")
            elif response.status_code == 401:
                # Token might be invalid, try to re-authenticate
                self.authenticate()
                response.failure("Unauthorized - re-authenticated")
            else:
                response.failure(f"Failed to get accounts: {response.status_code}")
    
    @task(3)
    def view_categories(self):
        """View categories"""
        if not self.token:
            return  # Skip if not authenticated
        with self.client.get(
            "/api/v1/categories",
            headers=self.get_headers(),
            catch_response=True,
            name="View Categories"
        ) as response:
            if response.status_code == 200:
                try:
                    data = response.json()
                    self.categories = data if isinstance(data, list) else []
                except Exception as e:
                    response.failure(f"Failed to parse categories response: {e}")
            elif response.status_code == 401:
                self.authenticate()
                response.failure("Unauthorized - re-authenticated")
            else:
                response.failure(f"Failed to get categories: {response.status_code}")
    
    @task(3)
    def create_transaction(self):
        """Create a new transaction"""
        if not self.token:
            return  # Skip if not authenticated
        if not self.accounts:
            # Need to get accounts first
            self.view_accounts()
            time.sleep(0.5)
        
        if not self.accounts:
            return  # Can't create transaction without accounts
        
        account = random.choice(self.accounts)
        transaction_types = ["expense", "income"]
        transaction_type = random.choice(transaction_types)
        
        transaction_data = {
            "account_id": account.get("id", 1),
            "amount": round(random.uniform(10, 1000), 2),
            "transaction_type": transaction_type,
            "description": f"Load test transaction {random.randint(1, 10000)}",
            "date": "2024-01-15T10:00:00"
        }
        
        self.client.post(
            "/api/v1/transactions",
            json=transaction_data,
            headers=self.get_headers(),
            name="Create Transaction"
        )
    
    @task(2)
    def view_analytics(self):
        """View analytics/reports"""
        if not self.token:
            return  # Skip if not authenticated
        periods = ["week", "month", "year"]
        period = random.choice(periods)
        
        self.client.get(
            "/api/v1/reports/analytics",
            headers=self.get_headers(),
            params={"period": period},
            name="View Analytics"
        )
    
    @task(2)
    def view_goals(self):
        """View financial goals"""
        if not self.token:
            return  # Skip if not authenticated
        self.client.get(
            "/api/v1/goals",
            headers=self.get_headers(),
            name="View Goals"
        )
    
    @task(1)
    def create_account(self):
        """Create a new account"""
        if not self.token:
            return  # Skip if not authenticated
        account_types = ["cash", "card", "bank_account", "digital_wallet"]
        currencies = ["USD", "EUR", "RUB"]
        
        account_data = {
            "name": f"Test Account {random.randint(1, 1000)}",
            "account_type": random.choice(account_types),
            "currency": random.choice(currencies),
            "initial_balance": round(random.uniform(0, 5000), 2)
        }
        
        with self.client.post(
            "/api/v1/accounts",
            json=account_data,
            headers=self.get_headers(),
            catch_response=True,
            name="Create Account"
        ) as response:
            if response.status_code == 201:
                try:
                    data = response.json()
                    if data.get("id"):
                        self.accounts.append(data)
                except Exception as e:
                    response.failure(f"Failed to parse account response: {e}")
            elif response.status_code == 401:
                self.authenticate()
                response.failure("Unauthorized - re-authenticated")
    
    @task(1)
    def view_shared_budgets(self):
        """View shared budgets"""
        if not self.token:
            return  # Skip if not authenticated
        self.client.get(
            "/api/v1/shared-budgets",
            headers=self.get_headers(),
            name="View Shared Budgets"
        )
    
    @task(1)
    def ask_ai_assistant(self):
        """Interact with AI assistant"""
        if not self.token:
            return  # Skip if not authenticated
        questions = [
            "What are my expenses this month?",
            "How much did I spend on groceries?",
            "Show me my financial summary",
            "What's my balance?",
            "Analyze my spending patterns"
        ]
        
        ai_data = {
            "question": random.choice(questions)
        }
        
        self.client.post(
            "/api/v1/ai/ask-lucy",
            json=ai_data,
            headers=self.get_headers(),
            name="Ask AI Assistant"
        )
    
    @task(1)
    def get_transaction_details(self):
        """Get detailed transaction list with filters"""
        if not self.token:
            return  # Skip if not authenticated
        filters = {
            "limit": random.choice([10, 20, 50]),
            "offset": 0,
            "transaction_type": random.choice([None, "expense", "income"])
        }
        
        self.client.get(
            "/api/v1/transactions",
            headers=self.get_headers(),
            params={k: v for k, v in filters.items() if v is not None},
            name="Get Transaction Details"
        )
    
    @task(1)
    def health_check(self):
        """Health check endpoint"""
        self.client.get("/health", name="Health Check")


class ReadOnlyUser(FastHttpUser):
    """
    Simulates read-only users (viewing data only)
    """
    wait_time = between(2, 5)
    
    def on_start(self):
        """Authenticate as read-only user"""
        self.token = None
        self.email = f"readonly_{random.randint(10000, 99999)}@test.com"
        self.password = "TestPassword123!"
        self.authenticate()
    
    def authenticate(self):
        """Login or register"""
        full_name = f"ReadOnly User {random.randint(1, 1000)}"
        name_parts = full_name.rsplit(" ", 1)
        first_name = name_parts[0] if len(name_parts) > 0 else "ReadOnly"
        last_name = name_parts[1] if len(name_parts) > 1 else "User"
        
        register_data = {
            "email": self.email,
            "password": self.password,
            "first_name": first_name,
            "last_name": last_name,
            "username": self.email.split("@")[0]
        }
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                with self.client.post(
                    "/api/v1/auth/register",
                    json=register_data,
                    catch_response=True
                ) as response:
                    if response.status_code == 201:
                        try:
                            data = response.json()
                            self.token = data.get("access_token")
                            if self.token:
                                return
                        except Exception as e:
                            logger.error(f"Failed to parse registration response: {e}")
                    elif response.status_code == 400:
                        break  # User exists, try login
                    elif response.status_code == 500 and attempt < max_retries - 1:
                        time.sleep(1)
                        continue
            except Exception as e:
                logger.error(f"Exception during registration: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
        
        # Try to login
        login_data = {"email": self.email, "password": self.password}
        for attempt in range(max_retries):
            try:
                with self.client.post("/api/v1/auth/login", json=login_data, catch_response=True) as login_response:
                    if login_response.status_code == 200:
                        try:
                            data = login_response.json()
                            self.token = data.get("access_token")
                            if self.token:
                                return
                        except Exception as e:
                            logger.error(f"Failed to parse login response: {e}")
                    elif login_response.status_code == 500 and attempt < max_retries - 1:
                        time.sleep(1)
                        continue
            except Exception as e:
                logger.error(f"Exception during login: {e}")
                if attempt < max_retries - 1:
                    time.sleep(1)
                    continue
    
    def get_headers(self):
        """Get headers with authentication token"""
        if not self.token:
            return {}
        return {"Authorization": f"Bearer {self.token}"}
    
    @task(10)
    def view_transactions(self):
        """View transactions"""
        if not self.token:
            return  # Skip if not authenticated
        self.client.get(
            "/api/v1/transactions",
            headers=self.get_headers(),
            params={"limit": 20},
            name="ReadOnly: View Transactions"
        )
    
    @task(5)
    def view_accounts(self):
        """View accounts"""
        if not self.token:
            return  # Skip if not authenticated
        self.client.get(
            "/api/v1/accounts",
            headers=self.get_headers(),
            name="ReadOnly: View Accounts"
        )
    
    @task(3)
    def view_analytics(self):
        """View analytics"""
        if not self.token:
            return  # Skip if not authenticated
        self.client.get(
            "/api/v1/reports/analytics",
            headers=self.get_headers(),
            params={"period": "month"},
            name="ReadOnly: View Analytics"
        )


# Event handlers for statistics
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when the test starts"""
    logger.info("=" * 50)
    logger.info("LOAD TEST STARTED")
    logger.info("=" * 50)
    logger.info(f"Target host: {environment.host}")
    logger.info(f"Users: {environment.runner.target_user_count if hasattr(environment.runner, 'target_user_count') else 'N/A'}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when the test stops"""
    logger.info("=" * 50)
    logger.info("LOAD TEST COMPLETED")
    logger.info("=" * 50)
    
    stats = environment.stats
    logger.info(f"\nTotal Requests: {stats.total.num_requests}")
    logger.info(f"Total Failures: {stats.total.num_failures}")
    logger.info(f"Average Response Time: {stats.total.avg_response_time:.2f}ms")
    logger.info(f"Min Response Time: {stats.total.min_response_time:.2f}ms")
    logger.info(f"Max Response Time: {stats.total.max_response_time:.2f}ms")
    logger.info(f"Requests per Second: {stats.total.total_rps:.2f}")


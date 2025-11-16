"""AI Assistant using Google Gemini API"""
import asyncio
import google.generativeai as genai
from app.core.config import settings
from typing import List, Dict, Any


class AIAssistant:
    def __init__(self):
        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            # Пробуем использовать доступные модели Gemini
            # Для v1beta API правильные имена моделей:
            # - models/gemini-pro (старая модель, но работает)
            # - models/gemini-1.5-pro-latest (новая модель)
            # - models/gemini-1.5-flash-latest (быстрая модель)
            # Но GenerativeModel принимает имя без префикса "models/"
            models_to_try = [
                'gemini-pro',  # Стандартная модель, должна работать
            ]
            
            self.client = None
            for model_name in models_to_try:
                try:
                    # Создаем модель - это не делает запрос, только инициализирует
                    self.client = genai.GenerativeModel(model_name)
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(f"Using Gemini model: {model_name}")
                    break
                except Exception as e:
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f"Model {model_name} not available: {e}")
                    continue
            
            if not self.client:
                import logging
                logger = logging.getLogger(__name__)
                logger.error("No available Gemini models found. AI features will be disabled.")
        else:
            self.client = None
    
    async def ask(self, user_id: int, question: str, context: Dict[str, Any] = None) -> str:
        """
        Answer user's natural language question about their finances
        
        Args:
            user_id: User ID
            question: Natural language question
            context: Additional context (transactions, accounts, etc.)
        
        Returns:
            AI-generated answer
        """
        if not self.client:
            return "ИИ-ассистент не настроен. Добавьте GOOGLE_AI_API_KEY в настройки."
        
        # TODO: Build conversation context from user's financial data
        system_prompt = """Ты - полезный финансовый ассистент. 
        Помогай пользователям управлять их финансами, анализировать расходы 
        и давать практические советы по экономии."""
        
        try:
            prompt = f"{system_prompt}\n\nВопрос пользователя: {question}"
            # Run synchronous generate_content in executor for async compatibility
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None, 
                self.client.generate_content, 
                prompt
            )
            return response.text
        except Exception as e:
            return f"Произошла ошибка: {str(e)}"
    
    def detect_anomalies(self, transactions: List[Dict]) -> List[Dict]:
        """Detect unusual transactions"""
        # TODO: Implement anomaly detection logic
        return []
    
    def predict_expenses(self, historical_data: List[Dict], days: int = 30) -> Dict:
        """Predict future expenses"""
        # TODO: Implement ML-based prediction
        return {"predicted_amount": 0, "confidence": 0.0}
    
    def recommend_savings(self, transactions: List[Dict], income: float) -> List[str]:
        """Generate savings recommendations"""
        # TODO: Implement recommendation logic
        return []


"""AI Assistant using Google Gemini API"""
import asyncio
import google.generativeai as genai
from app.core.config import settings
from typing import List, Dict, Any


class AIAssistant:
    def __init__(self):
        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)
            # Используем актуальную модель Gemini 1.5 Flash (быстрая и бесплатная)
            # Альтернатива: 'gemini-1.5-pro' для более сложных задач
            try:
                self.client = genai.GenerativeModel('gemini-1.5-flash')
            except Exception as e:
                # Fallback на gemini-pro если flash не доступен
                try:
                    self.client = genai.GenerativeModel('gemini-pro')
                except:
                    self.client = None
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


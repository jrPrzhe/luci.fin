from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
from decimal import Decimal


# Schemas для анкетирования
class QuestionnaireCategoryLimits(BaseModel):
    """Лимиты категорий из анкетирования"""
    category_limits: Dict[str, Decimal] = Field(..., description="Словарь категория -> лимит")


class QuestionnaireSlide1(BaseModel):
    """Слайд 1: Лимиты категорий"""
    category_limits: Dict[str, Decimal] = Field(..., description="Лимиты по категориям")


class QuestionnaireSlide2(BaseModel):
    """Слайд 2: Зарплата"""
    monthly_income: Decimal = Field(..., gt=0, description="Месячный доход")


class QuestionnaireSlide3(BaseModel):
    """Слайд 3: Проблемы"""
    problems_text: Optional[str] = Field(None, description="Свободный текст о проблемах")
    problems_options: Optional[List[str]] = Field(None, description="Выбранные варианты проблем")


class QuestionnaireSlide4(BaseModel):
    """Слайд 4: Цель"""
    goal_text: Optional[str] = Field(None, description="Свободный текст о цели")
    goal_options: Optional[List[str]] = Field(None, description="Выбранные варианты целей")


class QuestionnaireRequest(BaseModel):
    """Полный запрос анкетирования"""
    category_limits: Dict[str, Decimal] = Field(..., description="Лимиты по категориям")
    monthly_income: Decimal = Field(..., gt=0, description="Месячный доход")
    problems_text: Optional[str] = Field(None, description="Текст о проблемах")
    problems_options: Optional[List[str]] = Field(None, description="Варианты проблем")
    goal_text: Optional[str] = Field(None, description="Текст о цели")
    goal_options: Optional[List[str]] = Field(None, description="Варианты целей")


# Schemas для биографии
class BiographyCategoryLimitResponse(BaseModel):
    """Ответ с лимитом категории"""
    id: int
    biography_id: int
    category_name: str
    category_id: Optional[int] = None
    user_limit: Decimal
    ai_recommended_limit: Optional[Decimal] = None
    actual_spent: Decimal
    currency: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class BiographyResponse(BaseModel):
    """Ответ с биографией пользователя"""
    id: int
    user_id: int
    monthly_income: Optional[Decimal] = None
    problems: Optional[str] = None
    goal: Optional[str] = None
    period_start: datetime
    period_end: Optional[datetime] = None
    is_current: bool
    created_at: datetime
    updated_at: datetime
    category_limits: List[BiographyCategoryLimitResponse] = []
    
    class Config:
        from_attributes = True


class QuestionnaireResponseSchema(BaseModel):
    """Схема ответа на анкетирование"""
    id: int
    biography_id: int
    category_limits: Optional[Dict[str, Decimal]] = None
    monthly_income: Optional[Decimal] = None
    problems_text: Optional[str] = None
    problems_options: Optional[List[str]] = None
    goal_text: Optional[str] = None
    goal_options: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Schemas для обновления статуса new_user
class NewUserStatusResponse(BaseModel):
    """Ответ со статусом new_user"""
    new_user: bool
    has_biography: bool = False


class MarkUserNotNewRequest(BaseModel):
    """Запрос на пометку пользователя как не нового"""
    skip_wizard: bool = Field(default=True, description="Пропустить визард")


# Schema для создания цели из биографии
class CreateGoalFromBiographyRequest(BaseModel):
    """Запрос на создание цели из биографии"""
    goal_name: str
    target_amount: Optional[Decimal] = None
    description: Optional[str] = None


# Schema для обновления ЗП
class UpdateIncomeRequest(BaseModel):
    """Запрос на обновление ЗП"""
    monthly_income: Decimal = Field(..., gt=0, description="Месячный доход")


# Schema для обновления лимитов категорий
class UpdateCategoryLimitsRequest(BaseModel):
    """Запрос на обновление лимитов категорий через ИИ"""
    pass  # Не требует параметров, использует текущие данные биографии

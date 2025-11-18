from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
import logging
from app.core.database import get_db
from app.models.analytics import AnalyticsEvent
from app.models.user import User
from app.api.v1.auth import get_current_user, get_current_admin

logger = logging.getLogger(__name__)

router = APIRouter()


class AnalyticsEventCreate(BaseModel):
    """Модель для создания события аналитики"""
    event_type: str
    event_name: str
    platform: str
    metadata: Optional[Dict[str, Any]] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None


class AnalyticsEventResponse(BaseModel):
    """Модель ответа для события аналитики"""
    id: int
    user_id: Optional[int]
    vk_id: Optional[str]
    telegram_id: Optional[str]
    event_type: str
    event_name: str
    platform: str
    event_metadata: Optional[Dict[str, Any]]
    created_at: datetime
    
    class Config:
        from_attributes = True


class AnalyticsStatsResponse(BaseModel):
    """Модель ответа для статистики"""
    total_events: int
    unique_users: int
    events_by_platform: Dict[str, int]
    events_by_type: Dict[str, int]
    events_by_name: Dict[str, int]
    events_by_hour: Dict[int, int]
    events_by_date: Dict[str, int]
    top_users: List[Dict[str, Any]]
    recent_events: List[AnalyticsEventResponse]


@router.post("/track", response_model=AnalyticsEventResponse, status_code=status.HTTP_201_CREATED)
async def track_event(
    event: AnalyticsEventCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Записать событие аналитики.
    Может быть вызвано как с авторизацией, так и без (для анонимных событий).
    """
    # Определяем user_id, vk_id, telegram_id
    user_id = None
    vk_id = None
    telegram_id = None
    
    if current_user:
        user_id = current_user.id
        vk_id = current_user.vk_id
        telegram_id = current_user.telegram_id
    
    # Если user_agent не передан, пытаемся получить из заголовков
    user_agent = event.user_agent
    if not user_agent:
        user_agent = request.headers.get("user-agent")
    
    # Если referrer не передан, пытаемся получить из заголовков
    referrer = event.referrer
    if not referrer:
        referrer = request.headers.get("referer")
    
    # Создаем событие
    analytics_event = AnalyticsEvent(
        user_id=user_id,
        vk_id=vk_id,
        telegram_id=telegram_id,
        event_type=event.event_type,
        event_name=event.event_name,
        platform=event.platform,
        event_metadata=event.metadata,
        user_agent=user_agent,
        referrer=referrer
    )
    
    db.add(analytics_event)
    db.commit()
    db.refresh(analytics_event)
    
    return AnalyticsEventResponse.model_validate(analytics_event)


@router.get("/stats", response_model=AnalyticsStatsResponse)
async def get_analytics_stats(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    platform: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Только для админов
):
    """
    Получить статистику аналитики.
    Доступно только администраторам.
    """
    # Парсим даты с улучшенной обработкой ошибок
    if start_date and start_date.strip():
        try:
            start_date = start_date.strip()
            # Поддерживаем формат YYYY-MM-DD и ISO формат
            if 'T' in start_date or '+' in start_date or 'Z' in start_date:
                # ISO формат с временем
                start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            elif len(start_date) == 10 and start_date.count('-') == 2:
                # Формат YYYY-MM-DD
                start_datetime = datetime.strptime(start_date, '%Y-%m-%d')
            else:
                raise ValueError(f"Invalid date format: {start_date}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse start_date '{start_date}': {e}")
            start_datetime = datetime.utcnow() - timedelta(days=7)
    else:
        start_datetime = datetime.utcnow() - timedelta(days=7)
    
    if end_date and end_date.strip():
        try:
            end_date = end_date.strip()
            # Поддерживаем формат YYYY-MM-DD и ISO формат
            if 'T' in end_date or '+' in end_date or 'Z' in end_date:
                # ISO формат с временем
                end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            elif len(end_date) == 10 and end_date.count('-') == 2:
                # Формат YYYY-MM-DD - добавляем время конца дня
                end_datetime = datetime.strptime(end_date, '%Y-%m-%d')
                end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            else:
                raise ValueError(f"Invalid date format: {end_date}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to parse end_date '{end_date}': {e}")
            end_datetime = datetime.utcnow()
    else:
        end_datetime = datetime.utcnow()
    
    # Базовый запрос
    query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= start_datetime,
        AnalyticsEvent.created_at <= end_datetime
    )
    
    if platform:
        query = query.filter(AnalyticsEvent.platform == platform)
    
    all_events = query.all()
    
    # Общее количество событий
    total_events = len(all_events)
    
    # Уникальные пользователи
    unique_user_ids = set(e.user_id for e in all_events if e.user_id)
    unique_users = len(unique_user_ids)
    
    # События по платформам
    events_by_platform = {}
    for event in all_events:
        events_by_platform[event.platform] = events_by_platform.get(event.platform, 0) + 1
    
    # События по типам
    events_by_type = {}
    for event in all_events:
        events_by_type[event.event_type] = events_by_type.get(event.event_type, 0) + 1
    
    # События по именам
    events_by_name = {}
    for event in all_events:
        events_by_name[event.event_name] = events_by_name.get(event.event_name, 0) + 1
    
    # События по часам
    events_by_hour = {}
    for event in all_events:
        hour = event.created_at.hour
        events_by_hour[hour] = events_by_hour.get(hour, 0) + 1
    
    # События по датам
    events_by_date = {}
    for event in all_events:
        date_str = event.created_at.date().isoformat()
        events_by_date[date_str] = events_by_date.get(date_str, 0) + 1
    
    # Топ пользователей по количеству событий
    user_event_counts = {}
    for event in all_events:
        if event.user_id:
            user_event_counts[event.user_id] = user_event_counts.get(event.user_id, 0) + 1
    
    top_users = []
    for user_id, count in sorted(user_event_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            top_users.append({
                "user_id": user_id,
                "email": user.email,
                "username": user.username,
                "vk_id": user.vk_id,
                "telegram_id": user.telegram_id,
                "event_count": count
            })
    
    # Последние события
    recent_events = query.order_by(AnalyticsEvent.created_at.desc()).limit(50).all()
    
    return AnalyticsStatsResponse(
        total_events=total_events,
        unique_users=unique_users,
        events_by_platform=events_by_platform,
        events_by_type=events_by_type,
        events_by_name=events_by_name,
        events_by_hour=events_by_hour,
        events_by_date=events_by_date,
        top_users=top_users,
        recent_events=[AnalyticsEventResponse.model_validate(e) for e in recent_events]
    )


@router.get("/events", response_model=List[AnalyticsEventResponse])
async def get_events(
    limit: int = 100,
    offset: int = 0,
    platform: Optional[str] = None,
    event_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin)  # Только для админов
):
    """
    Получить список событий с фильтрацией.
    Доступно только администраторам.
    """
    query = db.query(AnalyticsEvent)
    
    if platform:
        query = query.filter(AnalyticsEvent.platform == platform)
    
    if event_type:
        query = query.filter(AnalyticsEvent.event_type == event_type)
    
    if start_date:
        try:
            start_datetime = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            query = query.filter(AnalyticsEvent.created_at >= start_datetime)
        except:
            pass
    
    if end_date:
        try:
            end_datetime = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            query = query.filter(AnalyticsEvent.created_at <= end_datetime)
        except:
            pass
    
    events = query.order_by(AnalyticsEvent.created_at.desc()).offset(offset).limit(limit).all()
    
    return [AnalyticsEventResponse.model_validate(e) for e in events]


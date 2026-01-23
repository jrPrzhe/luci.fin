#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для анализа пользователей, которые заходили с 28 декабря 2024
Анализирует их активность, используемые функции и моменты выхода
"""
import sys
import os
from datetime import datetime, timezone, timedelta
from collections import defaultdict, Counter

# Устанавливаем кодировку для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from app.core.database import SessionLocal
from app.models.user import User
from app.models.analytics import AnalyticsEvent


def format_datetime(dt):
    """Форматирование даты и времени"""
    if dt is None:
        return "N/A"
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    return str(dt)


def analyze_user_activity(user: User, db: Session, start_date: datetime):
    """Анализ активности конкретного пользователя"""
    # Получаем все события пользователя с 28 декабря
    events_query = db.query(AnalyticsEvent).filter(
        AnalyticsEvent.created_at >= start_date
    )
    
    # Фильтруем по user_id, vk_id или telegram_id
    user_filters = []
    if user.id:
        user_filters.append(AnalyticsEvent.user_id == user.id)
    if user.vk_id:
        user_filters.append(AnalyticsEvent.vk_id == user.vk_id)
    if user.telegram_id:
        user_filters.append(AnalyticsEvent.telegram_id == user.telegram_id)
    
    if not user_filters:
        return None
    
    events_query = events_query.filter(or_(*user_filters))
    events = events_query.order_by(AnalyticsEvent.created_at).all()
    
    if not events:
        return None
    
    # Анализ событий
    platforms = Counter()
    event_types = Counter()
    event_names = Counter()
    first_event = events[0]
    last_event = events[-1]
    
    for event in events:
        platforms[event.platform] += 1
        event_types[event.event_type] += 1
        event_names[event.event_name] += 1
    
    return {
        'user': user,
        'events': events,
        'total_events': len(events),
        'platforms': platforms,
        'event_types': event_types,
        'event_names': event_names,
        'first_event': first_event,
        'last_event': last_event,
        'session_duration': (last_event.created_at - first_event.created_at).total_seconds() / 60 if len(events) > 1 else 0
    }


def analyze_users_since_dec28():
    """Основная функция анализа"""
    # Дата начала анализа: 28 декабря 2024, 00:00:00 UTC
    start_date = datetime(2024, 12, 28, 0, 0, 0, tzinfo=timezone.utc)
    
    db = SessionLocal()
    try:
        print("=" * 100)
        print("АНАЛИЗ ПОЛЬЗОВАТЕЛЕЙ С 28 ДЕКАБРЯ 2024")
        print("=" * 100)
        print(f"Дата начала анализа: {start_date.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print()
        
        # Получаем всех пользователей, которые заходили с 28 декабря
        users = db.query(User).filter(
            User.last_login >= start_date
        ).order_by(User.last_login.desc()).all()
        
        print(f"Найдено пользователей с last_login >= 28 декабря: {len(users)}")
        print()
        
        if len(users) == 0:
            print("Нет пользователей, которые заходили с 28 декабря.")
            return
        
        # Анализируем каждого пользователя
        user_analyses = []
        for user in users:
            analysis = analyze_user_activity(user, db, start_date)
            if analysis:
                user_analyses.append(analysis)
        
        print(f"Пользователей с активностью в аналитике: {len(user_analyses)}")
        print()
        
        # Общая статистика
        print("=" * 100)
        print("ОБЩАЯ СТАТИСТИКА")
        print("=" * 100)
        
        all_platforms = Counter()
        all_event_types = Counter()
        all_event_names = Counter()
        
        for analysis in user_analyses:
            all_platforms.update(analysis['platforms'])
            all_event_types.update(analysis['event_types'])
            all_event_names.update(analysis['event_names'])
        
        print("\nПлатформы (общее использование):")
        for platform, count in all_platforms.most_common():
            print(f"  {platform}: {count} событий")
        
        print("\nТипы событий:")
        for event_type, count in all_event_types.most_common():
            print(f"  {event_type}: {count} событий")
        
        print("\nТоп-20 действий пользователей:")
        for event_name, count in all_event_names.most_common(20):
            print(f"  {event_name}: {count} раз")
        
        # Детальный анализ каждого пользователя
        print("\n" + "=" * 100)
        print("ДЕТАЛЬНЫЙ АНАЛИЗ ПОЛЬЗОВАТЕЛЕЙ")
        print("=" * 100)
        
        for i, analysis in enumerate(user_analyses, 1):
            user = analysis['user']
            print(f"\n{i}. {user.first_name or ''} {user.last_name or ''} (ID: {user.id})")
            print(f"   Email: {user.email}")
            print(f"   Username: {user.username or 'N/A'}")
            print(f"   VK ID: {user.vk_id or 'N/A'}")
            print(f"   Telegram ID: {user.telegram_id or 'N/A'}")
            print(f"   Последний вход: {format_datetime(user.last_login)}")
            print(f"   Всего событий: {analysis['total_events']}")
            print(f"   Первое событие: {format_datetime(analysis['first_event'].created_at)}")
            print(f"   Последнее событие: {format_datetime(analysis['last_event'].created_at)}")
            if analysis['session_duration'] > 0:
                print(f"   Длительность сессии: {analysis['session_duration']:.1f} минут")
            
            print(f"   Платформы:")
            for platform, count in analysis['platforms'].most_common():
                print(f"     - {platform}: {count} событий")
            
            print(f"   Типы событий:")
            for event_type, count in analysis['event_types'].most_common():
                print(f"     - {event_type}: {count} событий")
            
            print(f"   Действия (топ-10):")
            for event_name, count in analysis['event_names'].most_common(10):
                print(f"     - {event_name}: {count} раз")
            
            # Последние 5 событий для понимания, где пользователь вышел
            print(f"   Последние 5 событий:")
            for event in analysis['events'][-5:]:
                print(f"     [{format_datetime(event.created_at)}] {event.platform} | {event.event_type} | {event.event_name}")
                if event.event_metadata:
                    print(f"       Метаданные: {event.event_metadata}")
            
            print("-" * 100)
        
        # Отдельный анализ для "Мартьяненко Иван"
        print("\n" + "=" * 100)
        print("ОТДЕЛЬНЫЙ АНАЛИЗ: МАРТЬЯНЕНКО ИВАН")
        print("=" * 100)
        
        martyanenko = db.query(User).filter(
            and_(
                User.first_name.ilike("%Иван%"),
                User.last_name.ilike("%Мартьяненко%")
            )
        ).first()
        
        if not martyanenko:
            # Попробуем другие варианты написания
            martyanenko = db.query(User).filter(
                or_(
                    and_(User.first_name.ilike("%Иван%"), User.last_name.ilike("%Март%")),
                    User.email.ilike("%martyanenko%"),
                    User.username.ilike("%martyanenko%")
                )
            ).first()
        
        if martyanenko:
            print(f"\nНайден пользователь:")
            print(f"  ID: {martyanenko.id}")
            print(f"  Имя: {martyanenko.first_name} {martyanenko.last_name}")
            print(f"  Email: {martyanenko.email}")
            print(f"  Username: {martyanenko.username or 'N/A'}")
            print(f"  VK ID: {martyanenko.vk_id or 'N/A'}")
            print(f"  Telegram ID: {martyanenko.telegram_id or 'N/A'}")
            print(f"  Создан: {format_datetime(martyanenko.created_at)}")
            print(f"  Последний вход: {format_datetime(martyanenko.last_login)}")
            print(f"  Активен: {martyanenko.is_active}")
            print(f"  Premium: {martyanenko.is_premium}")
            
            # Детальный анализ активности
            martyanenko_analysis = analyze_user_activity(martyanenko, db, start_date)
            
            if martyanenko_analysis:
                print(f"\nАктивность с 28 декабря:")
                print(f"  Всего событий: {martyanenko_analysis['total_events']}")
                print(f"  Первое событие: {format_datetime(martyanenko_analysis['first_event'].created_at)}")
                print(f"  Последнее событие: {format_datetime(martyanenko_analysis['last_event'].created_at)}")
                if martyanenko_analysis['session_duration'] > 0:
                    print(f"  Длительность сессии: {martyanenko_analysis['session_duration']:.1f} минут")
                
                print(f"\n  Платформы:")
                for platform, count in martyanenko_analysis['platforms'].most_common():
                    print(f"    - {platform}: {count} событий")
                
                print(f"\n  Типы событий:")
                for event_type, count in martyanenko_analysis['event_types'].most_common():
                    print(f"    - {event_type}: {count} событий")
                
                print(f"\n  Все действия:")
                for event_name, count in martyanenko_analysis['event_names'].most_common():
                    print(f"    - {event_name}: {count} раз")
                
                print(f"\n  Хронология всех событий:")
                for event in martyanenko_analysis['events']:
                    metadata_str = ""
                    if event.event_metadata:
                        metadata_str = f" | Мета: {event.event_metadata}"
                    print(f"    [{format_datetime(event.created_at)}] {event.platform} | {event.event_type} | {event.event_name}{metadata_str}")
                
                # Анализ проблемных моментов
                print(f"\n  АНАЛИЗ ПРОБЛЕМНЫХ МОМЕНТОВ:")
                events = martyanenko_analysis['events']
                if len(events) > 1:
                    # Ищем большие промежутки между событиями
                    for i in range(1, len(events)):
                        time_diff = (events[i].created_at - events[i-1].created_at).total_seconds() / 60
                        if time_diff > 5:  # Промежуток больше 5 минут
                            print(f"    ⚠️  Промежуток {time_diff:.1f} минут между событиями:")
                            print(f"       [{format_datetime(events[i-1].created_at)}] {events[i-1].event_name}")
                            print(f"       [{format_datetime(events[i].created_at)}] {events[i].event_name}")
                
                # Последнее событие - момент выхода
                last_event = martyanenko_analysis['last_event']
                print(f"\n  МОМЕНТ ВЫХОДА:")
                print(f"    Время: {format_datetime(last_event.created_at)}")
                print(f"    Платформа: {last_event.platform}")
                print(f"    Тип события: {last_event.event_type}")
                print(f"    Действие: {last_event.event_name}")
                if last_event.event_metadata:
                    print(f"    Метаданные: {last_event.event_metadata}")
                
                # Проверяем, есть ли ошибки в метаданных
                error_events = [e for e in events if e.event_metadata and (
                    'error' in str(e.event_metadata).lower() or 
                    'exception' in str(e.event_metadata).lower() or
                    'failed' in str(e.event_metadata).lower()
                )]
                if error_events:
                    print(f"\n  ⚠️  НАЙДЕНЫ СОБЫТИЯ С ОШИБКАМИ:")
                    for error_event in error_events:
                        print(f"    [{format_datetime(error_event.created_at)}] {error_event.event_name}: {error_event.event_metadata}")
            else:
                print(f"\n  ⚠️  Нет событий аналитики для этого пользователя с 28 декабря")
                print(f"  Но last_login = {format_datetime(martyanenko.last_login)}")
        else:
            print("\n⚠️  Пользователь 'Мартьяненко Иван' не найден в базе данных")
            print("Попробуем найти похожих пользователей...")
            similar_users = db.query(User).filter(
                or_(
                    User.first_name.ilike("%Иван%"),
                    User.last_name.ilike("%Март%"),
                    User.email.ilike("%mart%"),
                    User.username.ilike("%mart%")
                )
            ).all()
            if similar_users:
                print(f"\nНайдено похожих пользователей: {len(similar_users)}")
                for user in similar_users:
                    print(f"  - {user.first_name} {user.last_name} (ID: {user.id}, Email: {user.email})")
        
        print("\n" + "=" * 100)
        print("АНАЛИЗ ЗАВЕРШЕН")
        print("=" * 100)
        
    finally:
        db.close()


if __name__ == "__main__":
    analyze_users_since_dec28()


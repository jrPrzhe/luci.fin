#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для генерации обобщённой сводки о популярных категориях трат за последний месяц.
Все данные анонимизированы и представлены только в обобщённом виде.
"""
import sys
import os
from datetime import datetime, timedelta
from collections import defaultdict
from decimal import Decimal
import re
import statistics

# Настройка кодировки для Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.transaction import Transaction
from app.models.category import Category
from sqlalchemy import func, and_

# Маппинг категорий к обобщённым группам
CATEGORY_MAPPING = {
    # Питание
    'еда': 'Питание',
    'продукты': 'Питание',
    'продукт': 'Питание',
    'кафе': 'Питание',
    'ресторан': 'Питание',
    'рестораны': 'Питание',
    'столовая': 'Питание',
    'доставка': 'Питание',
    'магазин': 'Питание',
    'супермаркет': 'Питание',
    'продуктовый': 'Питание',
    'алкоголь': 'Питание',
    'бакалея': 'Питание',
    
    # Транспорт
    'транспорт': 'Транспорт',
    'такси': 'Транспорт',
    'метро': 'Транспорт',
    'автобус': 'Транспорт',
    'троллейбус': 'Транспорт',
    'трамвай': 'Транспорт',
    'маршрутка': 'Транспорт',
    'бензин': 'Транспорт',
    'топливо': 'Транспорт',
    'парковка': 'Транспорт',
    'автомобиль': 'Транспорт',
    'машина': 'Транспорт',
    'ремонт': 'Транспорт',
    'страховка': 'Транспорт',
    
    # Развлечения
    'развлечения': 'Развлечения',
    'кино': 'Развлечения',
    'театр': 'Развлечения',
    'концерт': 'Развлечения',
    'игра': 'Развлечения',
    'игры': 'Развлечения',
    'книги': 'Развлечения',
    'музыка': 'Развлечения',
    'фильмы': 'Развлечения',
    'подписка': 'Развлечения',
    'подписки': 'Развлечения',
    'стриминг': 'Развлечения',
    'игровой': 'Развлечения',
    'хобби': 'Развлечения',
    'спорт': 'Развлечения',
    'фитнес': 'Развлечения',
    
    # Жильё
    'жильё': 'Жильё',
    'коммунальные': 'Жильё',
    'коммуналка': 'Жильё',
    'квартплата': 'Жильё',
    'аренда': 'Жильё',
    'аренд': 'Жильё',
    'ипотека': 'Жильё',
    'квартира': 'Жильё',
    'дом': 'Жильё',
    'электричество': 'Жильё',
    'вода': 'Жильё',
    'газ': 'Жильё',
    'интернет': 'Жильё',
    'телефон': 'Жильё',
    'связь': 'Жильё',
    'телевидение': 'Жильё',
    'тв': 'Жильё',
    'ремонт': 'Жильё',
    'мебель': 'Жильё',
    'бытовая техника': 'Жильё',
    
    # Медицина
    'медицина': 'Медицина',
    'здоровье': 'Медицина',
    'врач': 'Медицина',
    'врачи': 'Медицина',
    'лекарства': 'Медицина',
    'аптека': 'Медицина',
    'больница': 'Медицина',
    'клиника': 'Медицина',
    'лечение': 'Медицина',
    'стоматология': 'Медицина',
    'стоматолог': 'Медицина',
    
    # Одежда
    'одежда': 'Одежда',
    'одежд': 'Одежда',
    'обувь': 'Одежда',
    'магазин одежды': 'Одежда',
    'шопинг': 'Одежда',
    
    # Образование
    'образование': 'Образование',
    'обучение': 'Образование',
    'курсы': 'Образование',
    'университет': 'Образование',
    'школа': 'Образование',
    'учебник': 'Образование',
    'учебники': 'Образование',
    
    # Красота
    'красота': 'Красота и уход',
    'косметика': 'Красота и уход',
    'парикмахер': 'Красота и уход',
    'салон': 'Красота и уход',
    'маникюр': 'Красота и уход',
    'педикюр': 'Красота и уход',
    
    # Животные
    'животные': 'Домашние питомцы',
    'питомцы': 'Домашние питомцы',
    'кот': 'Домашние питомцы',
    'кошка': 'Домашние питомцы',
    'собака': 'Домашние питомцы',
    'хомяк': 'Домашние питомцы',
    'ветеринар': 'Домашние питомцы',
    'корм': 'Домашние питомцы',
    'pet': 'Домашние питомцы',
    
    # Другое
    'подарки': 'Другое',
    'подарок': 'Другое',
    'пожертвования': 'Другое',
    'благотворительность': 'Другое',
    'прочее': 'Другое',
    'другое': 'Другое',
    'прочие': 'Другое',
    'прочие расходы': 'Другое',
    'тест': 'Другое',
}

def normalize_category_name(category_name: str) -> str:
    """Нормализует название категории для сопоставления"""
    if not category_name:
        return 'Другое'
    
    name_lower = category_name.lower().strip()
    
    # Убираем лишние символы
    name_clean = re.sub(r'[^\w\s]', ' ', name_lower)
    name_clean = ' '.join(name_clean.split())  # нормализуем пробелы
    
    # Проверяем точное совпадение
    if name_lower in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[name_lower]
    
    if name_clean in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[name_clean]
    
    # Проверяем совпадение по словам (каждое слово отдельно)
    words = name_clean.split()
    for word in words:
        if word in CATEGORY_MAPPING:
            return CATEGORY_MAPPING[word]
    
    # Проверяем частичное совпадение (ключ содержится в названии)
    for key, value in CATEGORY_MAPPING.items():
        if len(key) >= 3:  # Игнорируем слишком короткие ключи
            if key in name_clean:
                return value
    
    # Проверяем обратное (название содержится в ключе)
    for key, value in CATEGORY_MAPPING.items():
        if len(name_clean) >= 3:
            if name_clean in key or any(word in key for word in words if len(word) >= 3):
                return value
    
    # Проверка на эмодзи (автобус, машина и т.д.)
    bus_emoji = '🚌' in category_name or '🚎' in category_name
    car_emoji = '🚗' in category_name or '🚙' in category_name or '🚕' in category_name
    train_emoji = '🚆' in category_name or '🚇' in category_name or '🚊' in category_name
    
    if bus_emoji or car_emoji or train_emoji:
        return 'Транспорт'
    
    # Специальные случаи для популярных паттернов
    if any(word in name_lower for word in ['food', 'eating', 'grocery', 'restaurant', 'cafe', 'meal']):
        return 'Питание'
    if any(word in name_lower for word in ['transport', 'car', 'bus', 'taxi', 'metro', 'fuel', 'gas']):
        return 'Транспорт'
    if any(word in name_lower for word in ['entertainment', 'movie', 'game', 'hobby', 'sport', 'fitness']):
        return 'Развлечения'
    if any(word in name_lower for word in ['home', 'house', 'rent', 'utility', 'internet', 'phone', 'electricity']):
        return 'Жильё'
    if any(word in name_lower for word in ['health', 'medical', 'doctor', 'medicine', 'pharmacy']):
        return 'Медицина'
    if any(word in name_lower for word in ['clothes', 'clothing', 'shopping', 'fashion']):
        return 'Одежда'
    if any(word in name_lower for word in ['education', 'school', 'university', 'course', 'study']):
        return 'Образование'
    if any(word in name_lower for word in ['pet', 'animal', 'cat', 'dog', 'vet', 'veterinary']):
        return 'Домашние питомцы'
    
    return 'Другое'

def is_test_transaction(amount_decimal: Decimal, category_name: str = None, description: str = None) -> bool:
    """
    Определяет, является ли транзакция тестовой на основе различных критериев
    
    Args:
        amount_decimal: Сумма транзакции
        category_name: Название категории
        description: Описание транзакции
        
    Returns:
        True если транзакция считается тестовой
    """
    # 1. Фильтр по абсолютному лимиту (больше 10 миллионов - подозрительно)
    MAX_REALISTIC_AMOUNT = Decimal('10000000')  # 10 миллионов
    
    if amount_decimal > MAX_REALISTIC_AMOUNT:
        return True
    
    # 2. Фильтр по тестовым названиям категорий
    test_category_keywords = [
        'тест', 'test', 'тестовый', 'testing', 'проверка', 'check',
        'demo', 'демо', 'example', 'пример', 'sample', 'образец'
    ]
    
    if category_name:
        category_lower = category_name.lower()
        if any(keyword in category_lower for keyword in test_category_keywords):
            return True
    
    # 3. Фильтр по описанию (если содержит тестовые слова)
    if description:
        desc_lower = description.lower()
        if any(keyword in desc_lower for keyword in test_category_keywords):
            return True
    
    return False

def filter_test_transactions(expenses_data: list) -> tuple:
    """
    Фильтрует тестовые транзакции на основе статистических методов и эвристик
    
    Args:
        expenses_data: Список кортежей (amount, category_name, description)
        
    Returns:
        Кортеж (filtered_expenses, excluded_count, excluded_stats)
    """
    if not expenses_data:
        return [], 0, {}
    
    # Извлекаем суммы для статистического анализа
    amounts = []
    valid_expenses = []
    
    for expense in expenses_data:
        amount = expense[0] if expense[0] else Decimal('0')
        if amount > 0:
            amounts.append(float(amount))
            valid_expenses.append(expense)
    
    if not amounts:
        return [], 0, {}
    
    # Вычисляем статистики
    amounts_sorted = sorted(amounts)
    median_amount = statistics.median(amounts_sorted)
    q75 = statistics.quantiles(amounts_sorted, n=4)[2] if len(amounts_sorted) > 3 else amounts_sorted[-1]
    q99 = statistics.quantiles(amounts_sorted, n=100)[98] if len(amounts_sorted) > 99 else amounts_sorted[-1]
    
    # Фильтруем транзакции
    filtered = []
    excluded_count = 0
    excluded_by_reason = defaultdict(int)
    
    for expense in valid_expenses:
        amount_decimal = Decimal(str(expense[0])) if expense[0] else Decimal('0')
        category_name = expense[1] if len(expense) > 1 else None
        description = expense[2] if len(expense) > 2 else None
        
        # Проверяем различные критерии
        is_test = False
        reason = None
        
        # Критерий 1: Абсолютный лимит или явные тестовые признаки
        if is_test_transaction(amount_decimal, category_name, description):
            is_test = True
            reason = 'test_keywords_or_abs_limit'
        
        # Критерий 2: Статистический выброс (больше Q99 + 50% от диапазона)
        # Или больше чем 100 * медиана (явный выброс)
        elif amount_decimal > Decimal(str(q99)) * Decimal('1.5') or amount_decimal > Decimal(str(median_amount)) * Decimal('100'):
            is_test = True
            reason = 'statistical_outlier'
        
        # Критерий 3: Очень большие суммы (больше 1 миллиарда)
        elif amount_decimal > Decimal('1000000000'):
            is_test = True
            reason = 'very_large_amount'
        
        if is_test:
            excluded_count += 1
            excluded_by_reason[reason] += 1
        else:
            filtered.append(expense)
    
    excluded_stats = {
        'total_excluded': excluded_count,
        'by_reason': dict(excluded_by_reason),
        'median_amount': median_amount,
        'q75': q75,
        'q99': q99,
        'original_count': len(expenses_data),
        'filtered_count': len(filtered)
    }
    
    return filtered, excluded_count, excluded_stats

def generate_expense_summary(output_file=None):
    """
    Генерирует обобщённую сводку о тратах за последний месяц
    
    Args:
        output_file: Путь к файлу для сохранения сводки (опционально)
    """
    db = SessionLocal()
    
    # Если указан файл, перенаправляем вывод
    output = open(output_file, 'w', encoding='utf-8') if output_file else sys.stdout
    
    try:
        # Период: последние 30 дней
        end_date = datetime.now()
        start_date = end_date - timedelta(days=30)
        
        # Получаем все транзакции-расходы за последний месяц
        expenses = db.query(
            Transaction.amount,
            Transaction.amount_in_default_currency,
            Transaction.currency,
            Category.name.label('category_name'),
            Transaction.description
        ).join(
            Category, Transaction.category_id == Category.id
        ).filter(
            and_(
                Transaction.transaction_type == 'expense',
                Transaction.transaction_date >= start_date,
                Transaction.transaction_date <= end_date
            )
        ).all()
        
        # Функция для вывода (в файл или консоль)
        def output_print(*args, **kwargs):
            print(*args, **kwargs, file=output)
        
        if not expenses:
            output_print("=" * 80)
            output_print("ОБОБЩЁННАЯ СВОДКА О ТРАТАХ ЗА ПОСЛЕДНИЙ МЕСЯЦ")
            output_print("=" * 80)
            output_print("\nНедостаточно данных для анализа.")
            output_print("За последние 30 дней не было зафиксировано расходных транзакций.")
            output_print("\n" + "=" * 80)
            if output_file:
                output.close()
            return
        
        # Подготавливаем данные для фильтрации
        expenses_data = []
        for expense in expenses:
            amount = expense.amount_in_default_currency if expense.amount_in_default_currency else expense.amount
            if amount:
                expenses_data.append((
                    amount,
                    expense.category_name,
                    expense.description
                ))
        
        # Фильтруем тестовые транзакции
        filtered_expenses, excluded_count, excluded_stats = filter_test_transactions(expenses_data)
        
        if not filtered_expenses:
            output_print("=" * 80)
            output_print("ОБОБЩЁННАЯ СВОДКА О ТРАТАХ ЗА ПОСЛЕДНИЙ МЕСЯЦ")
            output_print("=" * 80)
            output_print("\nНедостаточно данных для анализа.")
            output_print("После фильтрации тестовых транзакций не осталось данных для анализа.")
            output_print(f"Исключено транзакций: {excluded_count}")
            output_print("\n" + "=" * 80)
            if output_file:
                output.close()
            return
        
        # Группируем по обобщённым категориям (уже отфильтрованные транзакции)
        category_totals = defaultdict(Decimal)
        category_counts = defaultdict(int)
        original_categories = defaultdict(lambda: {'total': Decimal('0'), 'count': 0})
        total_amount = Decimal('0')
        
        for expense_data in filtered_expenses:
            amount, category_name, description = expense_data
            if amount:
                amount_decimal = Decimal(str(amount))
                total_amount += amount_decimal
                
                # Сохраняем оригинальную категорию
                original_name = category_name or 'Без категории'
                original_categories[original_name]['total'] += amount_decimal
                original_categories[original_name]['count'] += 1
                
                # Нормализуем категорию
                general_category = normalize_category_name(category_name)
                category_totals[general_category] += amount_decimal
                category_counts[general_category] += 1
        
        if total_amount == 0:
            output_print("=" * 80)
            output_print("ОБОБЩЁННАЯ СВОДКА О ТРАТАХ ЗА ПОСЛЕДНИЙ МЕСЯЦ")
            output_print("=" * 80)
            output_print("\nНедостаточно данных для анализа.")
            output_print("За последние 30 дней не было зафиксировано расходных транзакций с суммами.")
            output_print("\n" + "=" * 80)
            if output_file:
                output.close()
            return
        
        # Сортируем по убыванию суммы
        sorted_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
        
        # Функция для вывода (в файл или консоль)
        def output_print(*args, **kwargs):
            print(*args, **kwargs, file=output)
        
        # Формируем сводку
        output_print("\n" + "=" * 80)
        output_print("ОБОБЩЁННАЯ СВОДКА О ПОПУЛЯРНЫХ КАТЕГОРИЯХ ТРАТ")
        output_print("Период: последние 30 дней")
        output_print("=" * 80)
        
        # Информация о фильтрации
        if excluded_count > 0:
            output_print("\n📊 ИНФОРМАЦИЯ О ФИЛЬТРАЦИИ ТЕСТОВЫХ ДАННЫХ")
            output_print("-" * 80)
            output_print(f"Всего транзакций получено: {excluded_stats['original_count']}")
            output_print(f"Исключено тестовых транзакций: {excluded_count}")
            output_print(f"Осталось транзакций для анализа: {excluded_stats['filtered_count']}")
            if excluded_stats['by_reason']:
                output_print("\nПричины исключения:")
                for reason, count in excluded_stats['by_reason'].items():
                    reason_name = {
                        'test_keywords_or_abs_limit': 'Тестовые ключевые слова / абсолютный лимит',
                        'statistical_outlier': 'Статистический выброс',
                        'very_large_amount': 'Очень большая сумма (>1 млрд)'
                    }.get(reason, reason)
                    output_print(f"  • {reason_name}: {count}")
            output_print(f"\nМедиана суммы транзакций: {excluded_stats['median_amount']:,.2f}")
            output_print(f"75-й процентиль: {excluded_stats['q75']:,.2f}")
            output_print(f"99-й процентиль: {excluded_stats['q99']:,.2f}")
        output_print("\n📊 ВВЕДЕНИЕ")
        output_print("-" * 80)
        output_print("Эта сводка представляет обобщённый анализ расходов пользователей")
        output_print("за последний месяц. Все данные полностью анонимизированы и представлены")
        output_print("только в агрегированном виде для общего понимания тенденций трат.")
        output_print("\nДанные помогут вам сравнить свои расходы с общими паттернами и")
        output_print("оптимизировать личный бюджет на основе популярных категорий трат.")
        
        output_print("\n" + "=" * 80)
        output_print("📈 ОБОБЩЁННЫЕ КАТЕГОРИИ ТРАТ")
        output_print("=" * 80)
        output_print(f"\n{'№':<4} {'Категория':<25} {'% от общих трат':<20} {'Количество транзакций':<25}")
        output_print("-" * 80)
        
        for idx, (category, amount) in enumerate(sorted_categories, 1):
            percentage = (amount / total_amount * 100).quantize(Decimal('0.01'))
            transaction_count = category_counts[category]
            # Форматируем процент: убираем нули после запятой если они незначимы
            percentage_str = f"{percentage:.2f}" if percentage < 0.01 else f"{percentage:.2f}"
            output_print(f"{idx:<4} {category:<25} {percentage_str:>15}%{'':<5} {transaction_count:>20}")
        
        # Средние значения
        avg_per_category = total_amount / len(sorted_categories) if sorted_categories else Decimal('0')
        output_print("\n" + "-" * 80)
        output_print(f"Общая сумма трат (в обобщённом виде): {total_amount:,.2f} условных единиц")
        output_print(f"Средняя сумма на категорию: {avg_per_category:,.2f} условных единиц")
        output_print(f"Всего транзакций: {sum(category_counts.values())}")
        output_print(f"Категорий активных: {len(sorted_categories)}")
        
        output_print("\n" + "=" * 80)
        output_print("🔍 КЛЮЧЕВЫЕ ВЫВОДЫ")
        output_print("=" * 80)
        
        # Анализ топ-3 категорий
        top_3 = sorted_categories[:3]
        if top_3:
            output_print(f"\n🏆 Топ-3 категории по расходам:")
            for idx, (category, amount) in enumerate(top_3, 1):
                percentage = (amount / total_amount * 100).quantize(Decimal('0.01'))
                output_print(f"   {idx}. {category} — {percentage:.2f}% от всех трат")
            
            # Анализ распределения
            top_3_total = sum(amount for _, amount in top_3)
            top_3_percentage = (top_3_total / total_amount * 100).quantize(Decimal('0.01'))
            output_print(f"\n📊 Топ-3 категории составляют {top_3_percentage:.2f}% всех трат.")
            
            if top_3_percentage > 60:
                output_print("   Это указывает на концентрированные расходы в основных категориях.")
            elif top_3_percentage > 40:
                output_print("   Расходы распределены относительно равномерно по категориям.")
            else:
                output_print("   Расходы распределены широко по многим категориям.")
        
        # Анализ категории "Другое"
        other_amount = category_totals.get('Другое', Decimal('0'))
        if other_amount > 0:
            other_percentage = (other_amount / total_amount * 100).quantize(Decimal('0.01'))
            output_print(f"\n📦 Категория 'Другое': {other_percentage:.2f}% всех трат.")
            if other_percentage > 20:
                output_print("   Рекомендуется детализировать эту категорию для лучшего контроля.")
        
        output_print("\n" + "=" * 80)
        output_print("💡 РЕКОМЕНДАЦИИ ПО ОПТИМИЗАЦИИ РАСХОДОВ")
        output_print("=" * 80)
        
        recommendations = []
        
        # Рекомендации на основе топ-категорий
        if top_3:
            top_category = top_3[0][0]
            top_percentage = (top_3[0][1] / total_amount * 100).quantize(Decimal('0.01'))
            
            if top_category == 'Питание' and top_percentage > 30:
                recommendations.append(
                    "• Питание является крупнейшей категорией расходов. Рекомендуется:\n"
                    "  - Планировать покупки заранее и составлять список\n"
                    "  - Покупать продукты оптом для экономии\n"
                    "  - Готовить дома чаще, чем заказывать доставку\n"
                    "  - Отслеживать акции и скидки в магазинах"
                )
            
            elif top_category == 'Транспорт' and top_percentage > 25:
                recommendations.append(
                    "• Транспорт занимает значительную долю расходов. Рекомендуется:\n"
                    "  - Использовать проездные билеты для регулярных поездок\n"
                    "  - Рассмотреть каршеринг вместо постоянного владения автомобилем\n"
                    "  - Использовать общественный транспорт для ежедневных поездок\n"
                    "  - Оптимизировать маршруты для экономии топлива"
                )
            
            elif top_category == 'Развлечения' and top_percentage > 20:
                recommendations.append(
                    "• Развлечения требуют внимания к бюджету. Рекомендуется:\n"
                    "  - Установить месячный лимит на развлечения\n"
                    "  - Искать бесплатные альтернативы (парки, библиотеки, мероприятия)\n"
                    "  - Объединять подписки и отменять неиспользуемые\n"
                    "  - Планировать крупные развлечения заранее для поиска скидок"
                )
            
            elif top_category == 'Жильё' and top_percentage > 30:
                recommendations.append(
                    "• Расходы на жильё — основа бюджета. Рекомендуется:\n"
                    "  - Оптимизировать потребление коммунальных услуг\n"
                    "  - Рассмотреть более выгодные тарифы на связь и интернет\n"
                    "  - Планировать ремонты заранее и искать скидки на материалы\n"
                    "  - Сравнивать предложения страховых компаний"
                )
        
        # Общие рекомендации
        recommendations.extend([
            "• Создавайте бюджеты для каждой категории и отслеживайте их выполнение",
            "• Ведите учёт всех трат для более точного анализа",
            "• Регулярно пересматривайте подписки и отменяйте неиспользуемые",
            "• Установите цели экономии для мотивации к сокращению расходов",
            "• Используйте категоризацию транзакций для лучшего понимания трат"
        ])
        
        for rec in recommendations:
            output_print(rec)
        
        output_print("\n" + "=" * 80)
        output_print("📋 ДЕТАЛИЗАЦИЯ (для улучшения категоризации)")
        output_print("=" * 80)
        output_print("\nТоп-10 нераспознанных категорий (попавших в 'Другое'):")
        output_print(f"{'Оригинальная категория':<50} {'Сумма':<20} {'Транзакций':<15}")
        output_print("-" * 85)
        
        other_categories = [(name, data) for name, data in original_categories.items() 
                           if normalize_category_name(name) == 'Другое']
        other_categories_sorted = sorted(other_categories, key=lambda x: x[1]['total'], reverse=True)[:10]
        
        for name, data in other_categories_sorted:
            output_print(f"{name[:48]:<50} {data['total']:>15,.2f}{'':<5} {data['count']:>10}")
        
        if not other_categories_sorted:
            output_print("Все категории успешно классифицированы!")
        
        output_print("\n" + "=" * 80)
        output_print("🔒 КОНФИДЕНЦИАЛЬНОСТЬ И ПРОЗРАЧНОСТЬ")
        output_print("=" * 80)
        output_print("\nВсе данные, представленные в этой сводке, полностью анонимизированы.")
        output_print("Анализ основан на агрегированных статистических данных и не содержит")
        output_print("информации, позволяющей идентифицировать отдельных пользователей.")
        output_print("\nВаши личные финансовые данные остаются конфиденциальными и")
        output_print("используются исключительно для формирования обобщённой статистики.")
        output_print("\nСпасибо за доверие и использование Люся.Бюджет для управления финансами! 💙")
        output_print("\n" + "=" * 80)
        
        if output_file:
            output.close()
            print(f"\n✅ Сводка сохранена в файл: {output_file}")
        
    except Exception as e:
        print(f"\n❌ Ошибка при генерации сводки: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Генерация обобщённой сводки о тратах')
    parser.add_argument('-o', '--output', type=str, help='Путь к файлу для сохранения сводки')
    args = parser.parse_args()
    
    generate_expense_summary(output_file=args.output)

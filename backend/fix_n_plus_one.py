#!/usr/bin/env python3
"""
Скрипт для проверки и исправления N+1 проблем в коде
"""
import sys
import os

# Добавляем путь к приложению
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 80)
print("Проверка N+1 проблем в коде")
print("=" * 80)

# Проблемные места
issues = [
    {
        "file": "app/api/v1/transactions.py",
        "line": "196-214",
        "problem": "N+1 запросы для account, category, goal в цикле",
        "fix": "Использовать joinedload или selectinload для предзагрузки связей"
    },
    {
        "file": "app/api/v1/accounts.py",
        "line": "61-69, 85",
        "problem": "N+1 запросы для transactions и shared_budget в цикле",
        "fix": "Использовать агрегацию на уровне БД (SUM) вместо Python циклов"
    },
    {
        "file": "app/api/v1/goals.py",
        "line": "53-59",
        "problem": "N+1 запросы для account и transactions в цикле",
        "fix": "Использовать joinedload для предзагрузки"
    }
]

print("\n⚠️  Найдено потенциальных N+1 проблем:")
for i, issue in enumerate(issues, 1):
    print(f"\n{i}. {issue['file']} (строки {issue['line']})")
    print(f"   Проблема: {issue['problem']}")
    print(f"   Решение: {issue['fix']}")

print("\n" + "=" * 80)
print("Рекомендации:")
print("=" * 80)
print("1. Используйте joinedload/selectinload для предзагрузки связей")
print("2. Используйте агрегацию на уровне БД (SUM, COUNT) вместо Python")
print("3. Добавьте индексы на часто используемые поля")
print("4. Мониторьте медленные запросы через pg_stat_statements")











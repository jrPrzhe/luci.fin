#!/usr/bin/env python3
"""
Скрипт для проверки работоспособности VK бота
"""
import sys
import os
from decouple import config
import httpx
import asyncio
from vkbottle import Bot

# Добавляем путь к модулям
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Проверка переменных окружения
print("=" * 60)
print("ПРОВЕРКА НАСТРОЕК VK БОТА")
print("=" * 60)

VK_BOT_TOKEN = config("VK_BOT_TOKEN", default="")
BACKEND_URL = config("BACKEND_URL", default="http://localhost:8000")
VK_GROUP_ID = config("VK_GROUP_ID", default="")

print(f"\n1. VK_BOT_TOKEN: {'✅ Установлен' if VK_BOT_TOKEN else '❌ НЕ УСТАНОВЛЕН'}")
if VK_BOT_TOKEN:
    print(f"   Длина токена: {len(VK_BOT_TOKEN)} символов")
    print(f"   Первые 10 символов: {VK_BOT_TOKEN[:10]}...")

print(f"\n2. BACKEND_URL: {BACKEND_URL}")
print(f"3. VK_GROUP_ID: {VK_GROUP_ID if VK_GROUP_ID else 'Не установлен'}")

# Проверка подключения к VK API
print("\n" + "=" * 60)
print("ПРОВЕРКА ПОДКЛЮЧЕНИЯ К VK API")
print("=" * 60)

async def check_vk_api():
    if not VK_BOT_TOKEN:
        print("❌ Нельзя проверить VK API без токена")
        return False
    
    try:
        bot = Bot(token=VK_BOT_TOKEN)
        # Проверяем получение информации о группе
        try:
            group_info = await bot.api.groups.get_by_id()
            print(f"✅ Подключение к VK API успешно")
            print(f"   Группа: {group_info[0].name if group_info else 'Не определена'}")
            return True
        except Exception as e:
            print(f"❌ Ошибка при получении информации о группе: {e}")
            return False
    except Exception as e:
        print(f"❌ Ошибка при создании бота: {e}")
        return False

# Проверка подключения к бэкенду
print("\n" + "=" * 60)
print("ПРОВЕРКА ПОДКЛЮЧЕНИЯ К БЭКЕНДУ")
print("=" * 60)

async def check_backend():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BACKEND_URL}/docs", timeout=5.0)
            if response.status_code == 200:
                print(f"✅ Бэкенд доступен: {BACKEND_URL}")
                return True
            else:
                print(f"⚠️ Бэкенд отвечает с кодом: {response.status_code}")
                return False
    except httpx.ConnectError:
        print(f"❌ Не удалось подключиться к бэкенду: {BACKEND_URL}")
        print("   Убедитесь, что бэкенд запущен")
        return False
    except Exception as e:
        print(f"❌ Ошибка при проверке бэкенда: {e}")
        return False

# Проверка Long Poll настроек
print("\n" + "=" * 60)
print("ПРОВЕРКА LONG POLL API")
print("=" * 60)

async def check_long_poll():
    if not VK_BOT_TOKEN:
        print("❌ Нельзя проверить Long Poll без токена")
        return False
    
    try:
        bot = Bot(token=VK_BOT_TOKEN)
        # Получаем настройки Long Poll
        try:
            lp_settings = await bot.api.groups.get_long_poll_server(group_id=int(VK_GROUP_ID) if VK_GROUP_ID else None)
            print(f"✅ Long Poll сервер получен")
            print(f"   Server: {lp_settings.server}")
            print(f"   Key: {lp_settings.key[:20]}...")
            print(f"   Ts: {lp_settings.ts}")
            return True
        except Exception as e:
            print(f"❌ Ошибка при получении Long Poll сервера: {e}")
            print("\n   ВАЖНО: Проверьте настройки сообщества:")
            print("   1. Управление -> Настройки -> Работа с API")
            print("   2. Включите 'Long Poll API'")
            print("   3. Включите событие 'Входящие сообщения'")
            return False
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

# Главная функция
async def main():
    print("\nЗапуск проверок...\n")
    
    vk_ok = await check_vk_api()
    backend_ok = await check_backend()
    lp_ok = await check_long_poll()
    
    print("\n" + "=" * 60)
    print("ИТОГОВЫЙ РЕЗУЛЬТАТ")
    print("=" * 60)
    
    if vk_ok and backend_ok and lp_ok:
        print("✅ Все проверки пройдены! Бот должен работать.")
    else:
        print("❌ Обнаружены проблемы:")
        if not vk_ok:
            print("   - Проблема с VK API или токеном")
        if not backend_ok:
            print("   - Проблема с подключением к бэкенду")
        if not lp_ok:
            print("   - Проблема с Long Poll API")
        
        print("\n📋 Чек-лист для исправления:")
        print("   1. Проверьте VK_BOT_TOKEN в .env файле")
        print("   2. Убедитесь, что используется токен СООБЩЕСТВА (не пользовательский)")
        print("   3. В настройках сообщества включите Long Poll API")
        print("   4. Включите событие 'Входящие сообщения' в Long Poll")
        print("   5. Убедитесь, что бэкенд запущен и доступен")

if __name__ == "__main__":
    asyncio.run(main())






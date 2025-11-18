"""
Простой скрипт для анализа результатов тестов Locust из CSV файлов
Simple script to analyze Locust test results from CSV files
"""
import csv
import os
import sys
from pathlib import Path


def analyze_csv_results(csv_file):
    """Анализирует результаты из CSV файла Locust"""
    if not os.path.exists(csv_file):
        print(f"Ошибка: Файл не найден: {csv_file}")
        return
    
    print(f"\n{'='*60}")
    print(f"Анализ: {csv_file}")
    print(f"{'='*60}\n")
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            
            if not rows:
                print("В CSV файле не найдено данных")
                return
            
            # Найти агрегированную строку (обычно последняя)
            aggregated = None
            for row in rows:
                if row.get('Type') == 'Aggregated' or row.get('Name') == 'Aggregated':
                    aggregated = row
                    break
            
            if aggregated:
                print("📊 Общая статистика:")
                print(f"  Всего запросов: {aggregated.get('Request Count', 'N/A')}")
                print(f"  Ошибок: {aggregated.get('Failure Count', 'N/A')} ({aggregated.get('Failure Rate', 'N/A')})")
                print(f"  Среднее время отклика: {aggregated.get('Average Response Time', 'N/A')} мс")
                print(f"  Минимальное время отклика: {aggregated.get('Min Response Time', 'N/A')} мс")
                print(f"  Максимальное время отклика: {aggregated.get('Max Response Time', 'N/A')} мс")
                print(f"  Медианное время отклика: {aggregated.get('Median Response Time', 'N/A')} мс")
                print(f"  Запросов в секунду: {aggregated.get('Requests/s', 'N/A')}")
                print()
            
            # Показать топ эндпоинтов по количеству запросов
            print("🔝 Топ эндпоинтов по количеству запросов:")
            endpoint_rows = [r for r in rows if r.get('Type') != 'Aggregated' and r.get('Name') != 'Aggregated']
            endpoint_rows.sort(key=lambda x: int(x.get('Request Count', 0)), reverse=True)
            
            for i, row in enumerate(endpoint_rows[:10], 1):
                name = row.get('Name', 'Unknown')
                count = row.get('Request Count', '0')
                avg_time = row.get('Average Response Time', 'N/A')
                failures = row.get('Failure Count', '0')
                print(f"  {i}. {name}")
                print(f"     Запросов: {count} | Среднее время: {avg_time}мс | Ошибок: {failures}")
            
            # Показать эндпоинты с ошибками
            failed_endpoints = [r for r in endpoint_rows if int(r.get('Failure Count', 0)) > 0]
            if failed_endpoints:
                print(f"\n⚠️  Эндпоинты с ошибками ({len(failed_endpoints)}):")
                for row in failed_endpoints:
                    name = row.get('Name', 'Unknown')
                    failures = row.get('Failure Count', '0')
                    failure_rate = row.get('Failure Rate', 'N/A')
                    print(f"  - {name}: {failures} ошибок ({failure_rate})")
            
            # Показать медленные эндпоинты
            slow_endpoints = [r for r in endpoint_rows if float(r.get('Average Response Time', 0)) > 500]
            if slow_endpoints:
                print(f"\n🐌 Медленные эндпоинты (>500мс):")
                slow_endpoints.sort(key=lambda x: float(x.get('Average Response Time', 0)), reverse=True)
                for row in slow_endpoints[:5]:
                    name = row.get('Name', 'Unknown')
                    avg_time = row.get('Average Response Time', 'N/A')
                    print(f"  - {name}: {avg_time}мс")
            
    except Exception as e:
        print(f"Ошибка при анализе файла: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Главная функция"""
    if len(sys.argv) < 2:
        print("Использование: python analyze_results.py <csv_file>")
        print("\nПример:")
        print("  python analyze_results.py reports/light_load_stats.csv")
        print("\nИли проанализировать все CSV файлы в директории reports/:")
        print("  python analyze_results.py reports/")
        return
    
    input_path = sys.argv[1]
    
    if os.path.isdir(input_path):
        # Проанализировать все CSV файлы в директории
        csv_files = list(Path(input_path).glob("*_stats.csv"))
        if not csv_files:
            print(f"CSV файлы не найдены в {input_path}")
            return
        
        for csv_file in sorted(csv_files):
            analyze_csv_results(str(csv_file))
    else:
        # Проанализировать один файл
        analyze_csv_results(input_path)


if __name__ == "__main__":
    main()


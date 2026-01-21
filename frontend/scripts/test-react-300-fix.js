#!/usr/bin/env node

/**
 * Скрипт для проверки исправлений React error #300
 * Проверяет:
 * 1. TypeScript типы
 * 2. Линтинг
 * 3. Сборку
 * 4. Потенциальные проблемы с undefined в критических компонентах
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const frontendDir = join(__dirname, '..')

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function checkCommand(command, description) {
  try {
    log(`\n${'='.repeat(60)}`, 'cyan')
    log(`Проверка: ${description}`, 'blue')
    log('='.repeat(60), 'cyan')
    
    execSync(command, {
      cwd: frontendDir,
      stdio: 'inherit',
      encoding: 'utf-8'
    })
    
    log(`✓ ${description} - УСПЕШНО`, 'green')
    return true
  } catch (error) {
    log(`✗ ${description} - ОШИБКА`, 'red')
    return false
  }
}

function checkCodeForUndefinedIssues() {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log('Проверка кода на потенциальные проблемы с undefined', 'blue')
  log('='.repeat(60), 'cyan')
  
  const criticalFiles = [
    'src/components/Layout.tsx',
    'src/components/AppLoadingScreen.tsx',
  ]
  
  const issues = []
  
  for (const file of criticalFiles) {
    const filePath = join(frontendDir, file)
    if (!existsSync(filePath)) {
      log(`⚠ Файл не найден: ${file}`, 'yellow')
      continue
    }
    
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    
    // Проверка на опасные паттерны
    const dangerousPatterns = [
      {
        pattern: /\.map\([^)]*\)/g,
        message: 'Использование .map() без проверки массива',
        check: (line, index) => {
          // Проверяем, что перед .map() есть проверка Array.isArray
          const beforeMap = content.substring(0, content.indexOf(line))
          const lastArrayCheck = beforeMap.lastIndexOf('Array.isArray')
          const lastMap = beforeMap.lastIndexOf('.map(')
          return lastArrayCheck > lastMap || line.includes('Array.isArray')
        }
      },
      {
        pattern: /\.filter\([^)]*\)/g,
        message: 'Использование .filter() без проверки массива',
        check: (line, index) => {
          const beforeFilter = content.substring(0, content.indexOf(line))
          const lastArrayCheck = beforeFilter.lastIndexOf('Array.isArray')
          const lastFilter = beforeFilter.lastIndexOf('.filter(')
          return lastArrayCheck > lastFilter || line.includes('Array.isArray')
        }
      },
      {
        pattern: /\.flatMap\([^)]*\)/g,
        message: 'Использование .flatMap() без проверки массива',
        check: (line, index) => {
          const beforeFlatMap = content.substring(0, content.indexOf(line))
          const lastArrayCheck = beforeFlatMap.lastIndexOf('Array.isArray')
          const lastFlatMap = beforeFlatMap.lastIndexOf('.flatMap(')
          return lastArrayCheck > lastFlatMap || line.includes('Array.isArray')
        }
      },
      {
        pattern: /\.some\([^)]*\)/g,
        message: 'Использование .some() без проверки массива',
        check: (line, index) => {
          const beforeSome = content.substring(0, content.indexOf(line))
          const lastArrayCheck = beforeSome.lastIndexOf('Array.isArray')
          const lastSome = beforeSome.lastIndexOf('.some(')
          return lastArrayCheck > lastSome || line.includes('Array.isArray')
        }
      },
      {
        pattern: /\.forEach\([^)]*\)/g,
        message: 'Использование .forEach() без проверки массива',
        check: (line, index) => {
          const beforeForEach = content.substring(0, content.indexOf(line))
          const lastArrayCheck = beforeForEach.lastIndexOf('Array.isArray')
          const lastForEach = beforeForEach.lastIndexOf('.forEach(')
          return lastArrayCheck > lastForEach || line.includes('Array.isArray')
        }
      },
    ]
    
    lines.forEach((line, index) => {
      dangerousPatterns.forEach(({ pattern, message, check }) => {
        if (pattern.test(line) && !check(line, index)) {
          // Пропускаем, если это комментарий или уже есть проверка
          if (!line.trim().startsWith('//') && !line.includes('Array.isArray')) {
            issues.push({
              file,
              line: index + 1,
              message,
              code: line.trim()
            })
          }
        }
      })
    })
  }
  
  if (issues.length > 0) {
    log(`\n⚠ Найдено ${issues.length} потенциальных проблем:`, 'yellow')
    issues.forEach(({ file, line, message, code }) => {
      log(`  ${file}:${line} - ${message}`, 'yellow')
      log(`    ${code.substring(0, 80)}...`, 'yellow')
    })
    return false
  } else {
    log('✓ Проверка кода на undefined - УСПЕШНО', 'green')
    return true
  }
}

function checkProtectionPatterns() {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log('Проверка защитных паттернов', 'blue')
  log('='.repeat(60), 'cyan')
  
  const filePath = join(frontendDir, 'src/components/Layout.tsx')
  if (!existsSync(filePath)) {
    log('⚠ Файл Layout.tsx не найден', 'yellow')
    return false
  }
  
  const content = readFileSync(filePath, 'utf-8')
  
  const requiredPatterns = [
    { pattern: /Array\.isArray\(navGroups\)/g, name: 'Проверка navGroups на массив' },
    { pattern: /Array\.isArray\(group\.items\)/g, name: 'Проверка group.items на массив' },
    { pattern: /Array\.isArray\(navItems\)/g, name: 'Проверка navItems на массив' },
    { pattern: /item\s*&&\s*item\.path/g, name: 'Проверка item перед доступом к path' },
    { pattern: /group\s*&&\s*group\.key/g, name: 'Проверка group перед доступом к key' },
  ]
  
  const found = []
  const missing = []
  
  requiredPatterns.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      found.push(name)
    } else {
      missing.push(name)
    }
  })
  
  if (found.length > 0) {
    log('✓ Найдены защитные паттерны:', 'green')
    found.forEach(name => log(`  - ${name}`, 'green'))
  }
  
  if (missing.length > 0) {
    log('⚠ Отсутствуют защитные паттерны:', 'yellow')
    missing.forEach(name => log(`  - ${name}`, 'yellow'))
  }
  
  return missing.length === 0
}

async function main() {
  log('\n🚀 Запуск проверки исправлений React error #300\n', 'cyan')
  
  const results = []
  
  // 1. Проверка TypeScript типов
  results.push({
    name: 'TypeScript типы',
    passed: checkCommand('npx tsc --noEmit', 'TypeScript типы')
  })
  
  // 2. Проверка линтинга
  results.push({
    name: 'Линтинг',
    passed: checkCommand('npm run lint', 'Линтинг')
  })
  
  // 3. Проверка защитных паттернов
  results.push({
    name: 'Защитные паттерны',
    passed: checkProtectionPatterns()
  })
  
  // 4. Проверка кода на undefined
  results.push({
    name: 'Проверка на undefined',
    passed: checkCodeForUndefinedIssues()
  })
  
  // 5. Проверка сборки (опционально, может быть долго)
  log(`\n${'='.repeat(60)}`, 'cyan')
  log('Проверка сборки (может занять время)...', 'blue')
  log('='.repeat(60), 'cyan')
  
  const buildPassed = checkCommand('npm run build', 'Сборка проекта')
  results.push({
    name: 'Сборка',
    passed: buildPassed
  })
  
  // Итоговый отчет
  log(`\n${'='.repeat(60)}`, 'cyan')
  log('ИТОГОВЫЙ ОТЧЕТ', 'blue')
  log('='.repeat(60), 'cyan')
  
  const passed = results.filter(r => r.passed).length
  const total = results.length
  
  results.forEach(({ name, passed }) => {
    if (passed) {
      log(`✓ ${name}`, 'green')
    } else {
      log(`✗ ${name}`, 'red')
    }
  })
  
  log(`\n${'='.repeat(60)}`, 'cyan')
  if (passed === total) {
    log(`✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (${passed}/${total})`, 'green')
    process.exit(0)
  } else {
    log(`❌ НЕКОТОРЫЕ ПРОВЕРКИ НЕ ПРОЙДЕНЫ (${passed}/${total})`, 'red')
    process.exit(1)
  }
}

main().catch(error => {
  log(`\n❌ КРИТИЧЕСКАЯ ОШИБКА: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

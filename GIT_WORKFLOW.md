# Работа с Git и GitHub

## Основные команды для добавления изменений

### 1. Проверка статуса изменений

```bash
git status
```

Показывает все измененные, добавленные и удаленные файлы.

### 2. Просмотр изменений

```bash
# Просмотр всех изменений
git diff

# Просмотр изменений конкретного файла
git diff path/to/file
```

### 3. Добавление файлов в staging area

```bash
# Добавить все измененные файлы
git add .

# Добавить конкретный файл
git add path/to/file

# Добавить все файлы в определенной директории
git add server/scripts/
```

### 4. Создание коммита

```bash
# Коммит с сообщением
git commit -m "Описание изменений"

# Примеры хороших сообщений коммита:
git commit -m "Добавлен сканер сети с поддержкой Python"
git commit -m "Улучшено получение MAC адресов и hostname устройств"
git commit -m "Добавлена группировка устройств по категориям при добавлении"
```

### 5. Отправка изменений в GitHub

```bash
# Отправить в удаленный репозиторий (обычно origin)
git push

# Если ветка новая, нужно указать upstream
git push -u origin main
# или
git push -u origin master
```

## Рекомендуемый workflow для новой функции

### 1. Создание ветки для новой функции (опционально, но рекомендуется)

```bash
# Создать и переключиться на новую ветку
git checkout -b feature/network-scanner

# Или для исправления бага
git checkout -b fix/mac-address-detection
```

### 2. Внесение изменений и коммиты

```bash
# После внесения изменений
git add .
git commit -m "Краткое описание изменений"

# Повторять по мере необходимости
```

### 3. Отправка ветки в GitHub

```bash
git push -u origin feature/network-scanner
```

### 4. Создание Pull Request (через веб-интерфейс GitHub)

1. Перейти на GitHub в репозиторий
2. Нажать "Compare & pull request"
3. Заполнить описание изменений
4. Нажать "Create pull request"

### 5. После слияния (merge) - обновить основную ветку

```bash
# Переключиться на основную ветку
git checkout main  # или master

# Обновить локальную ветку из удаленного репозитория
git pull origin main

# Удалить локальную ветку (после слияния)
git branch -d feature/network-scanner
```

## Полезные команды

### Просмотр истории коммитов

```bash
git log
git log --oneline  # краткий вид
git log --graph --oneline --all  # с визуализацией веток
```

### Отмена изменений

```bash
# Отменить изменения в рабочей директории (не в staging)
git checkout -- path/to/file

# Отменить добавление в staging (но сохранить изменения)
git reset HEAD path/to/file

# Отменить последний коммит (сохранить изменения)
git reset --soft HEAD~1
```

### Игнорирование файлов

Файл `.gitignore` уже настроен для:
- `node_modules/`
- `venv/` (Python виртуальное окружение)
- `.env` файлы
- `dist/` и другие сгенерированные файлы

## Примеры сообщений коммитов для текущих изменений

```bash
# Добавление сканера сети
git add server/scripts/network_scanner.py server/scripts/requirements.txt
git commit -m "Добавлен Python скрипт для сканирования сети с получением детальной информации об устройствах"

# Обновление API
git add server/src/routes/equipment.ts
git commit -m "Добавлен API endpoint для сканирования сети через Python скрипт"

# Обновление фронтенда
git add src/components/equipment/NetworkScanner.tsx src/services/networkScanner.service.ts
git commit -m "Добавлен UI для сканера сети с группировкой устройств по категориям"

# Улучшения
git add server/scripts/network_scanner.py
git commit -m "Улучшено получение MAC адресов через /proc/net/arp и ARP таблицу"

git add src/components/equipment/NetworkScanner.tsx
git commit -m "Добавлена автоматическая группировка устройств по категориям при добавлении"
```

## Важные файлы для текущих изменений

Новые файлы, которые нужно добавить:
- `server/scripts/network_scanner.py`
- `server/scripts/requirements.txt`
- `server/scripts/.gitignore`
- `server/scripts/README.md`

Измененные файлы:
- `server/src/routes/equipment.ts`
- `server/src/utils/networkScanner.ts` (старый файл, можно удалить)
- `src/components/equipment/NetworkScanner.tsx`
- `src/services/networkScanner.service.ts`
- `src/types/index.ts` (если были изменения)
- `server/package.json` (если устанавливались зависимости)
- `package.json` (если устанавливались зависимости)

## Предупреждения

⚠️ **Не добавляйте в git:**
- `server/scripts/venv/` - виртуальное окружение Python
- `.env` файлы с секретными данными
- `node_modules/` - зависимости Node.js
- Логи и временные файлы

✅ **Всегда добавляйте:**
- Исходный код (`.ts`, `.tsx`, `.py`, `.js`)
- Конфигурационные файлы (`package.json`, `requirements.txt`)
- Документацию (`.md` файлы)
- `.gitignore`


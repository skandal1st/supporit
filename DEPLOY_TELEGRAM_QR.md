# Инструкция по обновлению: Telegram бот и QR-коды

**Коммит:** c0401c5
**Дата:** 2026-01-05

---

## Краткое описание изменений

### Новые функции:
1. **Telegram бот** для ИТ-специалистов
   - Привязка аккаунта через одноразовый код
   - Уведомления о заявках (новые, назначенные, изменения статуса, комментарии)
   - Просмотр и управление заявками через бот
   - Распознавание QR-кодов оборудования через фото

2. **QR-коды для оборудования**
   - Генерация QR-кодов в карточке оборудования
   - Массовая генерация для печати
   - Скачивание и печать

---

## Шаги обновления

### 1. Применить миграцию базы данных

```sql
-- Выполнить содержимое файла:
-- supabase/migration_telegram.sql
```

**Что делает миграция:**
- Добавляет поля `telegram_id`, `telegram_username`, `telegram_linked_at`, `telegram_notifications` в таблицу `users`
- Создаёт таблицу `telegram_link_codes` для одноразовых кодов привязки
- Создаёт триггер для автогенерации QR-данных при создании оборудования
- Обновляет существующее оборудование QR-данными

### 2. Установить зависимости сервера

```bash
cd server
npm install
```

**Новые зависимости:**
- `telegraf` - библиотека Telegram Bot API
- `qrcode` - генерация QR-кодов
- `jsqr` - распознавание QR-кодов
- `sharp` - обработка изображений

### 3. Настроить переменные окружения

Добавить в `.env` на сервере:

```env
# Telegram Bot
TELEGRAM_BOT_ENABLED=true
TELEGRAM_BOT_TOKEN=<токен_от_BotFather>
```

**Как получить токен:**
1. Открыть @BotFather в Telegram
2. Отправить `/newbot`
3. Задать имя бота (например: SupporIT Notifications)
4. Задать username бота (например: SupporITBot)
5. Скопировать полученный токен

### 4. Пересобрать и перезапустить сервер

```bash
# Если используется PM2:
pm2 restart supporit-server

# Или вручную:
cd server
npm run build
npm start
```

### 5. Пересобрать фронтенд

```bash
npm run build
```

Обновить файлы на веб-сервере.

---

## Проверка работоспособности

### Telegram бот:
1. Открыть бота в Telegram (по username указанному при создании)
2. Отправить `/start` - должно появиться приветствие с инструкцией привязки
3. В веб-интерфейсе: Настройки → Telegram → Получить код
4. В боте: `/link <код>` - должна появиться подтверждение привязки

### QR-коды:
1. Открыть карточку любого оборудования
2. Нажать кнопку с иконкой QR-кода
3. Должно открыться окно с QR-кодом, кнопками "Скачать" и "Печать"

### Уведомления:
1. Создать тестовую заявку
2. ИТ-специалисты с привязанным Telegram должны получить уведомление

---

## Откат изменений

При необходимости отката:

### 1. Отключить бота
```env
TELEGRAM_BOT_ENABLED=false
```

### 2. Откат миграции (опционально)
```sql
-- Удалить поля из users
ALTER TABLE users
  DROP COLUMN IF EXISTS telegram_id,
  DROP COLUMN IF EXISTS telegram_username,
  DROP COLUMN IF EXISTS telegram_linked_at,
  DROP COLUMN IF EXISTS telegram_notifications;

-- Удалить таблицу кодов
DROP TABLE IF EXISTS telegram_link_codes;

-- Удалить триггер
DROP TRIGGER IF EXISTS trigger_generate_equipment_qr ON equipment;
DROP FUNCTION IF EXISTS generate_equipment_qr_data();
```

---

## Новые API эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/telegram/status` | Статус привязки Telegram |
| POST | `/api/telegram/generate-link-code` | Генерация кода привязки |
| POST | `/api/telegram/unlink` | Отвязка Telegram |
| PUT | `/api/telegram/settings` | Настройки уведомлений |
| GET | `/api/equipment/:id/qr-code` | QR-код оборудования |
| POST | `/api/equipment/qr-codes/batch` | Массовая генерация QR |

---

## Структура файлов бота

```
server/src/telegram/
├── bot.ts                    # Инициализация бота
├── types.ts                  # TypeScript типы
├── handlers/
│   ├── commands.ts           # /start, /link, /tickets, etc.
│   ├── callbacks.ts          # Обработка inline-кнопок
│   ├── messages.ts           # Текстовые сообщения
│   └── photos.ts             # QR-коды через фото
├── keyboards/
│   └── inline.ts             # Inline-клавиатуры
├── middleware/
│   └── auth.ts               # Проверка привязки аккаунта
├── services/
│   └── telegram-notification.service.ts  # Отправка уведомлений
└── utils/
    └── formatters.ts         # Форматирование сообщений
```

---

## Возможные проблемы

### Бот не запускается
- Проверить `TELEGRAM_BOT_TOKEN` в `.env`
- Проверить `TELEGRAM_BOT_ENABLED=true`
- Проверить логи: `[Telegram Bot]`

### Не приходят уведомления
- Проверить что Telegram привязан к аккаунту
- Проверить что уведомления включены в настройках
- Проверить что пользователь имеет роль `admin` или `it_specialist`

### QR-код не распознаётся
- Убедиться что это QR-код оборудования из системы
- Проверить качество фото (освещение, резкость)
- Попробовать переснять ближе к QR-коду

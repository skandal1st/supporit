# Интеграция SupporIT с HR_desk

Данный документ описывает настройку двусторонней синхронизации между системами SupporIT и HR_desk.

## Обзор

SupporIT предоставляет REST API для интеграции с HR_desk, позволяя:
- Синхронизировать пользователей (сотрудников)
- Получать информацию об оборудовании сотрудников
- Создавать заявки из HR-процессов (приём/увольнение)
- Обновлять контактные данные сотрудников

## Настройка SupporIT

### 1. Генерация токена интеграции

```bash
# Генерация безопасного токена
openssl rand -hex 32
```

### 2. Настройка переменных окружения

Добавьте в файл `.env` сервера SupporIT:

```env
# HR_desk Integration
HR_DESK_API_TOKEN=ваш_сгенерированный_токен
```

### 3. Перезапуск сервера

```bash
cd /home/skandal1st/scripts/supporit/server
npm run build
pm2 restart supporit-api
# или
systemctl restart supporit-api
```

## Настройка HR_desk

Добавьте в `.env` или `.env.prod` проекта HR_desk:

```env
SUPPORIT_API_URL=https://supporit.example.com/api/integrations/hr-desk
SUPPORIT_TOKEN=тот_же_токен_что_в_supporit
SUPPORIT_TIMEOUT_SECONDS=10
```

## API Endpoints

Базовый URL: `https://supporit.example.com/api/integrations/hr-desk`

Все запросы требуют заголовок авторизации:
```
Authorization: Bearer <HR_DESK_API_TOKEN>
```

### Health Check

```http
GET /health
```

Ответ:
```json
{
  "status": "ok",
  "integration_source": "hr_desk",
  "database": "connected",
  "stats": {
    "users": 150,
    "equipment": 320,
    "tickets": 1250
  },
  "timestamp": "2026-01-16T12:00:00.000Z"
}
```

---

### Пользователи

#### Получить всех пользователей

```http
GET /users
```

Ответ:
```json
{
  "data": [
    {
      "id": "uuid",
      "email": "ivanov@example.com",
      "full_name": "Иванов Иван Иванович",
      "fullName": "Иванов Иван Иванович",
      "role": "employee",
      "department": "IT отдел",
      "position": "Системный администратор",
      "phone": "+7 999 123-45-67",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-15T10:30:00.000Z"
    }
  ]
}
```

#### Получить пользователя по ID

```http
GET /users/:id
```

#### Создать/обновить пользователя

```http
POST /users
Content-Type: application/json

{
  "email": "petrov@example.com",
  "full_name": "Петров Пётр Петрович",
  "department": "Бухгалтерия",
  "position": "Главный бухгалтер",
  "phone": "+7 999 987-65-43"
}
```

Ответ:
```json
{
  "data": { ... },
  "created": true  // или "updated": true
}
```

#### Обновить пользователя

```http
PUT /users/:id
Content-Type: application/json

{
  "full_name": "Петров Пётр Петрович",
  "department": "Финансовый отдел",
  "position": "Финансовый директор",
  "phone": "+7 999 111-22-33"
}
```

#### Массовая синхронизация пользователей

```http
POST /sync/users
Content-Type: application/json

{
  "users": [
    {
      "email": "user1@example.com",
      "full_name": "Пользователь 1",
      "department": "Отдел 1",
      "position": "Должность 1",
      "phone": "+7 999 000-00-01"
    },
    {
      "email": "user2@example.com",
      "full_name": "Пользователь 2"
    }
  ]
}
```

Ответ:
```json
{
  "success": true,
  "created": 5,
  "updated": 10,
  "errors": 0,
  "total": 15
}
```

---

### Оборудование

#### Получить оборудование

```http
GET /equipment
GET /equipment?owner_id=uuid
GET /equipment?email=ivanov@example.com
```

Ответ:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Ноутбук Dell Latitude 5520",
      "model": "Latitude 5520",
      "inventory_number": "INV-001234",
      "serial_number": "ABC123XYZ",
      "category": "laptop",
      "status": "in_use",
      "current_owner_id": "user-uuid",
      "owner_email": "ivanov@example.com",
      "owner_name": "Иванов Иван Иванович",
      "location_department": "IT отдел",
      "location_room": "Каб. 305"
    }
  ]
}
```

#### Получить оборудование по ID

```http
GET /equipment/:id
```

---

### Заявки

#### Создать заявку

```http
POST /tickets
Content-Type: application/json

{
  "title": "Настройка рабочего места для нового сотрудника",
  "description": "Необходимо подготовить рабочее место для Сидорова С.С., выход на работу 20.01.2026",
  "category": "setup",
  "priority": "high",
  "creator_email": "hr@example.com",
  "location_department": "Отдел продаж",
  "location_room": "Каб. 210"
}
```

Категории (`category`):
- `hardware` - Оборудование
- `software` - Программное обеспечение
- `network` - Сеть
- `printer` - Принтеры
- `setup` - Настройка рабочего места
- `other` - Другое

Приоритеты (`priority`):
- `low` - Низкий
- `medium` - Средний (по умолчанию)
- `high` - Высокий
- `critical` - Критический

#### Получить заявки

```http
GET /tickets
GET /tickets?status=new
GET /tickets?category=setup
GET /tickets?creator_email=hr@example.com
GET /tickets?limit=100
```

---

## Типовые сценарии использования

### Приём нового сотрудника

1. HR_desk создаёт пользователя в SupporIT:
```http
POST /users
{
  "email": "novichok@example.com",
  "full_name": "Новичок Николай Николаевич",
  "department": "Маркетинг",
  "position": "Менеджер по рекламе"
}
```

2. HR_desk создаёт заявку на настройку рабочего места:
```http
POST /tickets
{
  "title": "Подготовка РМ для Новичок Н.Н.",
  "description": "Выход 25.01.2026. Требуется: ноутбук, монитор, настройка ПО.",
  "category": "setup",
  "priority": "high",
  "creator_email": "hr@example.com"
}
```

### Увольнение сотрудника

1. HR_desk получает список оборудования сотрудника:
```http
GET /equipment?email=uvolnyaemiy@example.com
```

2. HR_desk создаёт заявку на сбор оборудования:
```http
POST /tickets
{
  "title": "Сбор оборудования - Увольняемый У.У.",
  "description": "Последний рабочий день 31.01.2026. Собрать: ноутбук INV-001234, монитор INV-005678",
  "category": "hardware",
  "priority": "medium"
}
```

### Периодическая синхронизация

HR_desk может периодически синхронизировать данные сотрудников:
```http
POST /sync/users
{
  "users": [ ... массив всех активных сотрудников ... ]
}
```

---

## Безопасность

1. **Токен** должен храниться в секрете и не передаваться по незащищённым каналам
2. Используйте **HTTPS** для всех запросов
3. Регулярно **ротируйте токены** (рекомендуется раз в 6 месяцев)
4. Ограничьте доступ к API по **IP-адресам** через nginx/firewall

Пример ограничения в nginx:
```nginx
location /api/integrations/ {
    allow 192.168.1.100;  # IP сервера HR_desk
    deny all;
    proxy_pass http://localhost:3001;
}
```

---

## Логирование

Все запросы от интеграций логируются с префиксом `[Integration]`:
```
[Integration] ✅ HR_desk интеграция авторизована
[Integration] HR_desk запросил список пользователей: 150 записей
[Integration] HR_desk создал заявку: abc123-def456
```

Просмотр логов:
```bash
pm2 logs supporit-api | grep "\[Integration\]"
# или
journalctl -u supporit-api | grep "\[Integration\]"
```

---

## Troubleshooting

### Ошибка 401 Unauthorized

- Проверьте правильность токена в `.env`
- Убедитесь, что заголовок `Authorization: Bearer <token>` передаётся корректно
- Перезапустите сервер после изменения `.env`

### Ошибка 503 Service Unavailable

- Проверьте подключение к базе данных
- Проверьте, запущен ли сервер SupporIT

### Пользователь не создаётся

- Проверьте, что email уникален
- Убедитесь, что поле `email` передано в запросе

---

## Контакты

При возникновении проблем обращайтесь к администратору SupporIT.

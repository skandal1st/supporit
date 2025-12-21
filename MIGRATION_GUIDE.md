# Руководство по миграции с Supabase на PostgreSQL

Этот проект был мигрирован с Supabase на прямое подключение к PostgreSQL через REST API.

## Изменения в архитектуре

### До миграции
- Frontend → Supabase Client → Supabase (PostgreSQL + Auth)
- Аутентификация через Supabase Auth
- Row Level Security (RLS) в Supabase

### После миграции
- Frontend → REST API → PostgreSQL
- Аутентификация через JWT токены
- Контроль доступа на уровне API

## Структура проекта

```
supporit/
├── server/              # Бэкенд API сервер
│   ├── src/
│   │   ├── config/      # Конфигурация БД
│   │   ├── middleware/  # Middleware (auth)
│   │   ├── routes/      # API маршруты
│   │   └── index.ts     # Точка входа
│   ├── package.json
│   └── tsconfig.json
├── src/                 # Frontend
│   ├── lib/
│   │   └── api.ts       # HTTP клиент (заменяет supabase.ts)
│   └── services/        # Обновленные сервисы
└── supabase/
    └── schema_postgres.sql  # Новая схема БД
```

## Установка и настройка

### 1. Настройка базы данных

1. Создайте базу данных PostgreSQL:
```sql
CREATE DATABASE supporit;
```

2. Примените схему:
```bash
psql -U postgres -d supporit -f supabase/schema_postgres.sql
```

### 2. Настройка бэкенда

1. Перейдите в директорию server:
```bash
cd server
```

2. Установите зависимости:
```bash
npm install
```

3. Создайте файл `.env` на основе `.env.example`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/supporit
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
```

4. Запустите сервер:
```bash
npm run dev
```

### 3. Настройка фронтенда

1. Создайте файл `.env` в корне проекта:
```env
VITE_API_URL=http://localhost:3001/api
```

2. Установите зависимости (если еще не установлены):
```bash
npm install
```

3. Запустите фронтенд:
```bash
npm run dev
```

## Основные изменения

### Аутентификация

**Было (Supabase):**
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
```

**Стало (REST API):**
```typescript
const { data, error } = await post('/auth/signin', { email, password });
if (data) {
  setAuthToken(data.token); // Сохранение JWT токена
}
```

### Работа с данными

**Было (Supabase):**
```typescript
const { data, error } = await supabase
  .from('equipment')
  .select('*')
  .eq('status', 'in_use');
```

**Стало (REST API):**
```typescript
const { data, error } = await get('/equipment?status=in_use');
```

### Хранение токена

JWT токен теперь хранится в `localStorage` под ключом `auth_token` и автоматически добавляется в заголовки всех запросов.

## API Endpoints

### Аутентификация
- `POST /api/auth/signup` - Регистрация
- `POST /api/auth/signin` - Вход
- `POST /api/auth/signout` - Выход
- `GET /api/auth/me` - Получить текущего пользователя

### Оборудование
- `GET /api/equipment` - Список оборудования (с фильтрами)
- `GET /api/equipment/:id` - Получить оборудование
- `POST /api/equipment` - Создать оборудование (требует роль admin/it_specialist)
- `PUT /api/equipment/:id` - Обновить оборудование (требует роль admin/it_specialist)
- `DELETE /api/equipment/:id` - Удалить оборудование (требует роль admin/it_specialist)
- `POST /api/equipment/:id/change-owner` - Изменить владельца
- `GET /api/equipment/:id/history` - История перемещений

### Пользователи
- `GET /api/users` - Список пользователей (требует роль admin)
- `GET /api/users/:id` - Получить пользователя

## Миграция данных

Если у вас уже есть данные в Supabase, вам нужно:

1. Экспортировать данные из Supabase
2. Преобразовать структуру таблицы `users` (добавить поле `password_hash`)
3. Импортировать данные в новую БД

**Важно:** Пароли пользователей нужно будет сбросить, так как Supabase использует свою систему хеширования.

## Отличия от Supabase

1. **Нет RLS (Row Level Security)** - контроль доступа на уровне API
2. **Нет встроенной аутентификации** - используется JWT
3. **Нет real-time подписок** - можно добавить через WebSockets при необходимости
4. **Нет Storage** - нужно настроить отдельное хранилище файлов (S3, MinIO и т.д.)

## Следующие шаги

- [ ] Настроить хранение файлов (S3/MinIO)
- [ ] Добавить валидацию на бэкенде
- [ ] Реализовать сброс пароля
- [ ] Добавить rate limiting
- [ ] Настроить логирование
- [ ] Добавить тесты




# Быстрое решение ошибки ECONNREFUSED

## Проблема
Ошибка `ECONNREFUSED` означает, что PostgreSQL не запущен или недоступен.

## Решение

### Шаг 1: Установите PostgreSQL (если не установлен)

**Windows:**
1. Скачайте с https://www.postgresql.org/download/windows/
2. Установите (запомните пароль для пользователя `postgres`)

**Или используйте Docker:**
```bash
docker run --name supporit-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=supporit -p 5432:5432 -d postgres:15
```

### Шаг 2: Запустите PostgreSQL

**Windows:**
- Откройте "Службы" (Win+R → services.msc)
- Найдите службу PostgreSQL (например, "postgresql-x64-15")
- Запустите её (правой кнопкой → Запустить)

**Или через командную строку:**
```bash
net start postgresql-x64-15
```

**Linux:**
```bash
sudo systemctl start postgresql
```

**macOS:**
```bash
brew services start postgresql@15
```

### Шаг 3: Создайте базу данных

Откройте терминал и выполните:

```bash
psql -U postgres
```

В psql выполните:
```sql
CREATE DATABASE supporit;
\q
```

### Шаг 4: Примените схему

```bash
psql -U postgres -d supporit -f supabase/schema_postgres.sql
```

### Шаг 5: Настройте .env файл

Откройте `server/.env` и проверьте `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:ВАШ_ПАРОЛЬ@localhost:5432/supporit
```

**Важно:** Замените `ВАШ_ПАРОЛЬ` на ваш реальный пароль PostgreSQL!

### Шаг 6: Перезапустите сервер

```bash
cd server
npm run dev
```

## Проверка

Откройте в браузере: http://localhost:3001/health

Должно вернуть:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```

## Альтернатива: Docker (самый простой способ)

Если не хотите устанавливать PostgreSQL:

```bash
# 1. Запустите PostgreSQL в Docker
docker run --name supporit-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=supporit -p 5432:5432 -d postgres:15

# 2. Примените схему
docker exec -i supporit-postgres psql -U postgres -d supporit < supabase/schema_postgres.sql

# 3. В server/.env используйте:
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/supporit
```


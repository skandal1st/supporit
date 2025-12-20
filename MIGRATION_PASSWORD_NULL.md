# Миграция: Разрешить NULL для password_hash

Эта миграция необходима для создания пользователей без пароля через админ-панель.

## Выполнение миграции

### Способ 1: Через psql (командная строка)

1. Подключитесь к вашей базе данных PostgreSQL:

**Linux/macOS:**
```bash
# Если используется пользователь postgres и локальная БД
sudo -u postgres psql -d supporit

# Или если используется другой пользователь
psql -U ваш_пользователь -d supporit -h localhost
```

**Windows:**
```bash
psql -U postgres -d supporit
```

2. Выполните SQL команду:

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

3. Проверьте, что миграция выполнена успешно:

```sql
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'password_hash';
```

Должно быть: `is_nullable = 'YES'`

4. Выйдите из psql:
```sql
\q
```

### Способ 2: Через файл миграции

Если у вас есть доступ к базе данных через файловую систему:

```bash
# Linux/macOS
psql -U postgres -d supporit -f supabase/migration_allow_null_password.sql

# Windows (если psql в PATH)
psql -U postgres -d supporit -f supabase\migration_allow_null_password.sql
```

### Способ 3: Через pgAdmin или другой графический клиент

1. Откройте pgAdmin или другой PostgreSQL клиент
2. Подключитесь к базе данных `supporit`
3. Откройте Query Tool
4. Выполните команду:

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

## Что делает эта миграция?

- Удаляет ограничение NOT NULL с колонки `password_hash` в таблице `users`
- Позволяет создавать пользователей без пароля
- Пользователи без пароля смогут установить его при первом входе через форму установки пароля

## Проверка после миграции

После выполнения миграции попробуйте создать пользователя без пароля через админ-панель. Это должно работать без ошибок.

## Откат миграции (если нужно)

Если по какой-то причине нужно вернуть ограничение NOT NULL:

```sql
-- ВНИМАНИЕ: Это не сработает, если уже есть пользователи с NULL password_hash
-- Сначала нужно установить пароли для всех пользователей с NULL

-- Установить временный пароль для всех пользователей без пароля
UPDATE users 
SET password_hash = '$2a$10$temporary_hash_here' 
WHERE password_hash IS NULL;

-- Затем вернуть ограничение
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
```


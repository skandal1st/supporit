# Устранение проблем

## Проблема: После регистрации запись не создается в таблице users

### Причина
Триггер, который автоматически создает запись в таблице `users` при регистрации, может не сработать из-за:
1. Триггер не создан в базе данных
2. Проблемы с RLS (Row Level Security) политиками
3. Ошибка в функции триггера

### Решение

#### Шаг 1: Проверьте, создан ли триггер

1. Откройте Supabase Dashboard → SQL Editor
2. Выполните запрос:

```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  event_object_table, 
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

Если результат пустой, триггер не создан.

#### Шаг 2: Выполните скрипт исправления

Выполните SQL скрипт `supabase/fix_trigger.sql` в SQL Editor Supabase. Этот скрипт:
- Пересоздаст функцию триггера
- Убедится, что триггер установлен правильно
- Добавит необходимые политики
- Создаст записи для существующих пользователей, у которых нет записи в таблице users

#### Шаг 3: Проверьте существующих пользователей

После выполнения скрипта проверьте:

```sql
-- Пользователи в auth.users
SELECT id, email, created_at FROM auth.users;

-- Пользователи в таблице users
SELECT id, email, full_name, role FROM public.users;
```

Количество должно совпадать.

#### Шаг 4: Создайте записи для существующих пользователей вручную (если нужно)

Если у вас есть пользователи в `auth.users`, но нет в `public.users`, выполните:

```sql
INSERT INTO public.users (id, email, full_name, role)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', au.email),
  'employee'
FROM auth.users au
LEFT JOIN public.users u ON au.id = u.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;
```

### Альтернативное решение: Ручное создание записи

Если триггер не работает, код приложения пытается создать запись вручную после регистрации. Это должно работать автоматически.

Если и это не помогает:

1. Проверьте, что таблица `users` существует:

```sql
SELECT * FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public';
```

2. Проверьте права доступа. Убедитесь, что anon key имеет права на INSERT в таблицу users через политики RLS.

3. Проверьте консоль браузера на наличие ошибок.

### Проверка работы регистрации

1. Зарегистрируйтесь через форму `/register`
2. Проверьте в Supabase Dashboard → Table Editor → users, появилась ли запись
3. Если записи нет, проверьте логи в Supabase Dashboard → Logs → Postgres Logs

### Отладка триггера

Чтобы увидеть, срабатывает ли триггер, можно добавить логирование:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Логируем попытку создания
  RAISE NOTICE 'Creating user: %', NEW.email;
  
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'employee'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
```

Затем проверьте логи в Supabase Dashboard → Logs → Postgres Logs.




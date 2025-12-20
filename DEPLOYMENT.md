# Руководство по развертыванию на новом сервере

Это руководство поможет вам развернуть систему учета ИТ-оборудования на новом сервере с нуля.

## Требования к системе

- **Node.js**: версия 18.x или выше
- **PostgreSQL**: версия 12.x или выше
- **npm**: версия 9.x или выше
- **Операционная система**: Linux, macOS или Windows

### Проверка версий

```bash
node --version  # Должно быть v18.x или выше
npm --version   # Должно быть 9.x или выше
psql --version  # Должно быть 12.x или выше
```

## Шаг 1: Установка зависимостей системы

### Установка Node.js

**Linux (Ubuntu/Debian):**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Linux (CentOS/RHEL):**
```bash
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

**macOS:**
```bash
brew install node@18
```

**Windows:**
Скачайте установщик с [официального сайта Node.js](https://nodejs.org/)

### Установка PostgreSQL

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Linux (CentOS/RHEL):**
```bash
sudo yum install postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
Скачайте установщик с [официального сайта PostgreSQL](https://www.postgresql.org/download/windows/)

Подробная инструкция по настройке PostgreSQL: см. `server/SETUP_POSTGRES.md`

## Шаг 2: Клонирование проекта

```bash
# Клонируйте репозиторий (или скопируйте файлы проекта)
git clone <repository-url> supporit
cd supporit
```

Или если вы копируете файлы вручную, убедитесь, что все файлы проекта на месте.

## Шаг 3: Установка зависимостей проекта

```bash
# Установка зависимостей фронтенда
npm install

# Установка зависимостей бэкенда
cd server
npm install
cd ..
```

## Шаг 4: Настройка базы данных

### 4.1. Создание базы данных

Подключитесь к PostgreSQL:

**Linux/macOS:**
```bash
sudo -u postgres psql
```

**Windows:**
```bash
psql -U postgres
```

**С паролем (если требуется):**
```bash
PGPASSWORD='ваш_пароль' psql -U postgres -h localhost
```

В консоли PostgreSQL выполните:

```sql
CREATE DATABASE supporit;
\q
```

### 4.2. Применение схемы базы данных

**Linux/macOS (с sudo):**
```bash
sudo -u postgres psql -d supporit -f $(pwd)/supabase/schema_postgres.sql
```

**Linux/macOS/Windows (с паролем):**
```bash
PGPASSWORD='ваш_пароль' psql -U postgres -h localhost -d supporit -f supabase/schema_postgres.sql
```

**Windows (без пароля):**
```bash
psql -U postgres -d supporit -f supabase/schema_postgres.sql
```

### 4.3. Применение миграций

⚠️ **Важно:** Необходимо применить миграцию для разрешения NULL значений в поле `password_hash`, чтобы администраторы могли создавать пользователей без пароля.

**Linux/macOS (с sudo):**
```bash
sudo -u postgres psql -d supporit -f $(pwd)/supabase/migration_allow_null_password.sql
```

**Linux/macOS/Windows (с паролем):**
```bash
PGPASSWORD='ваш_пароль' psql -U postgres -h localhost -d supporit -f supabase/migration_allow_null_password.sql
```

**Windows (без пароля):**
```bash
psql -U postgres -d supporit -f supabase/migration_allow_null_password.sql
```

**Проверка миграции:**
```sql
-- Подключитесь к базе данных
psql -U postgres -d supporit

-- Проверьте структуру таблицы users
\d users

-- Поле password_hash должно быть nullable (без NOT NULL)
```

## Шаг 5: Настройка переменных окружения

### 5.1. Настройка бэкенда

Создайте файл `server/.env` на основе `server/env.example`:

```bash
cd server
cp env.example .env
```

Отредактируйте `server/.env`:

```env
# База данных
# Формат: postgresql://пользователь:пароль@хост:порт/база_данных
DATABASE_URL=postgresql://postgres:ваш_пароль@localhost:5432/supporit

# JWT токены
# ⚠️ ВАЖНО: В продакшене используйте надежный случайный ключ!
# Сгенерировать можно командой: openssl rand -base64 32
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# Сервер
PORT=3001
NODE_ENV=production

# CORS
# Укажите домен вашего фронтенда
CORS_ORIGIN=http://localhost:5173
```

**Для продакшена:**
- Замените `JWT_SECRET` на надежный случайный ключ (используйте `openssl rand -base64 32`)
- Измените `CORS_ORIGIN` на домен вашего фронтенда (например, `https://yourdomain.com`)
- Убедитесь, что `NODE_ENV=production`

### 5.2. Настройка фронтенда

Создайте файл `.env` в корне проекта на основе `src/config/env.example`:

```bash
cp src/config/env.example .env
```

Отредактируйте `.env`:

```env
# API Configuration
# Укажите URL вашего API сервера
VITE_API_URL=http://localhost:3001/api
```

**Для продакшена:**
- Измените `VITE_API_URL` на URL вашего API сервера (например, `https://api.yourdomain.com/api`)

## Шаг 6: Запуск в режиме разработки

### 6.1. Запуск бэкенда

В одном терминале:

```bash
cd server
npm run dev
```

Сервер будет доступен на `http://localhost:3001`

### 6.2. Запуск фронтенда

В другом терминале:

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:5173`

## Шаг 7: Создание первого администратора

После запуска приложения:

1. Откройте браузер и перейдите на `http://localhost:5173/register`

2. Зарегистрируйте первого пользователя:
   - Заполните форму регистрации
   - **Важно:** По умолчанию все пользователи получают роль `employee`

3. Назначьте роль администратора через SQL:

```sql
-- Подключитесь к базе данных
psql -U postgres -d supporit

-- Замените email на ваш email
UPDATE users
SET role = 'admin'
WHERE email = 'ваш-email@example.com';

-- Проверьте результат
SELECT id, email, full_name, role FROM users WHERE email = 'ваш-email@example.com';

\q
```

**Или одной командой:**
```bash
PGPASSWORD='ваш_пароль' psql -U postgres -h localhost -d supporit -c "UPDATE users SET role = 'admin' WHERE email = 'ваш-email@example.com';"
```

4. Войдите в систему через `http://localhost:5173/login`

5. **Важно:** После изменения роли в базе данных выйдите из системы и войдите снова, чтобы получить новый токен с обновленной ролью.

Подробная инструкция: см. `SETUP_ADMIN.md`

## Шаг 8: Развертывание в продакшене

### 8.1. Сборка бэкенда

```bash
cd server
npm run build
```

Это создаст папку `server/dist` с скомпилированным JavaScript.

### 8.2. Сборка фронтенда

```bash
npm run build
```

Это создаст папку `dist` с готовыми статическими файлами.

### 8.3. Запуск бэкенда в продакшене

**Вариант 1: Прямой запуск Node.js**

```bash
cd server
NODE_ENV=production npm start
```

**Вариант 2: Использование PM2 (рекомендуется)**

Установка PM2:
```bash
npm install -g pm2
```

Запуск:
```bash
cd server
pm2 start dist/index.js --name supporit-api
pm2 save
pm2 startup  # Следуйте инструкциям для автозапуска
```

**Вариант 3: Systemd сервис (Linux)**

Создайте файл `/etc/systemd/system/supporit-api.service`:

```ini
[Unit]
Description=Supporit API Server
After=network.target postgresql.service

[Service]
Type=simple
User=ваш_пользователь
WorkingDirectory=/путь/к/проекту/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Активация сервиса:
```bash
sudo systemctl daemon-reload
sudo systemctl enable supporit-api
sudo systemctl start supporit-api
sudo systemctl status supporit-api
```

### 8.4. Развертывание фронтенда

**Вариант 1: Nginx (рекомендуется)**

Установите Nginx:
```bash
# Ubuntu/Debian
sudo apt install nginx

# CentOS/RHEL
sudo yum install nginx
```

Создайте конфигурацию `/etc/nginx/sites-available/supporit`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /путь/к/проекту/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активация:
```bash
sudo ln -s /etc/nginx/sites-available/supporit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Вариант 2: Node.js сервер (express-static)**

Можно использовать Express для раздачи статических файлов (см. примеры в документации Express).

**Вариант 3: Другие хостинги**

Файлы из папки `dist` можно загрузить на любой статический хостинг:
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages

## Особенности работы с пользователями

### Создание пользователей без пароля

Администраторы и ИТ-специалисты могут создавать пользователей через админ-панель без указания пароля. При этом:

1. Пользователь получает email с инструкциями
2. При первой попытке входа система предложит установить пароль
3. После установки пароля пользователь сможет войти в систему

### Управление пользователями

- **Администратор (`admin`)**: Полный доступ ко всем функциям, включая управление пользователями
- **ИТ-специалист (`it_specialist`)**: Может создавать пользователей, управлять оборудованием и заявками
- **Сотрудник (`employee`)**: Только просмотр своего оборудования и создание заявок

При входе:
- Администраторы и ИТ-специалисты перенаправляются на `/dashboard`
- Сотрудники перенаправляются на `/tickets`

## Проверка работоспособности

### Проверка бэкенда

```bash
# Health check
curl http://localhost:3001/health

# Проверка API (требуется авторизация)
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer ваш_токен"
```

### Проверка фронтенда

Откройте в браузере:
- Главная страница: `http://localhost:5173`
- Страница входа: `http://localhost:5173/login`
- Dashboard (после входа): `http://localhost:5173/dashboard`

### Проверка базы данных

```bash
psql -U postgres -d supporit -c "SELECT COUNT(*) FROM users;"
psql -U postgres -d supporit -c "SELECT email, role FROM users;"
```

## Резервное копирование базы данных

### Создание бэкапа

```bash
pg_dump -U postgres -d supporit > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Восстановление из бэкапа

```bash
psql -U postgres -d supporit < backup_20231220_120000.sql
```

**Рекомендуется:** Настроить автоматическое резервное копирование через cron или systemd timer.

## Обновление системы

1. Остановите сервер
2. Создайте бэкап базы данных
3. Обновите код (через git pull или копирование файлов)
4. Установите новые зависимости: `npm install` и `cd server && npm install`
5. Примените новые миграции (если есть)
6. Пересоберите проект: `npm run build` и `cd server && npm run build`
7. Перезапустите сервер

## Решение проблем

### PostgreSQL не запускается

**Linux:**
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

**macOS:**
```bash
brew services list
brew services start postgresql@15
```

### Ошибка подключения к базе данных

1. Проверьте, что PostgreSQL запущен
2. Проверьте правильность `DATABASE_URL` в `server/.env`
3. Проверьте права доступа пользователя PostgreSQL

### Ошибка "Peer authentication failed"

Используйте TCP/IP подключение с паролем в `DATABASE_URL`:
```
DATABASE_URL=postgresql://postgres:пароль@localhost:5432/supporit
```

Подробнее: см. `server/SETUP_POSTGRES.md`

### Ошибка "password_hash violates not-null constraint"

Убедитесь, что вы применили миграцию `migration_allow_null_password.sql` (см. Шаг 4.3).

### CORS ошибки в браузере

Проверьте, что `CORS_ORIGIN` в `server/.env` соответствует домену фронтенда.

### Фронтенд не подключается к API

Проверьте, что `VITE_API_URL` в `.env` соответствует URL бэкенда.

## Безопасность

⚠️ **Важные рекомендации для продакшена:**

1. **JWT_SECRET**: Используйте надежный случайный ключ длиной не менее 32 символов
2. **Пароли БД**: Используйте надежные пароли для пользователя PostgreSQL
3. **HTTPS**: Настройте SSL/TLS сертификаты (Let's Encrypt, Cloudflare и т.д.)
4. **Firewall**: Ограничьте доступ к портам базы данных только с сервера приложения
5. **Резервное копирование**: Настройте автоматическое резервное копирование базы данных
6. **Обновления**: Регулярно обновляйте зависимости и систему
7. **Логирование**: Настройте логирование ошибок и важных событий

## Дополнительная документация

- `README.md` - Общее описание проекта
- `SETUP_ADMIN.md` - Создание первого администратора
- `server/SETUP_POSTGRES.md` - Подробная настройка PostgreSQL
- `MIGRATION_GUIDE.md` - Руководство по миграции с Supabase
- `TROUBLESHOOTING.md` - Решение распространенных проблем

## Поддержка

При возникновении проблем проверьте:
1. Логи бэкенда (в консоли или через `pm2 logs`)
2. Логи фронтенда (в консоли браузера)
3. Логи PostgreSQL (`/var/log/postgresql/` на Linux)
4. Документацию по решению проблем: `TROUBLESHOOTING.md`


# Руководство по развертыванию на продакшн Ubuntu сервере

Это подробное руководство поможет вам развернуть систему Supporit на продакшн сервере Ubuntu.

## 📋 Содержание

1. [Требования](#требования)
2. [Быстрое развертывание](#быстрое-развертывание)
3. [Пошаговое развертывание](#пошаговое-развертывание)
4. [Настройка безопасности](#настройка-безопасности)
5. [Настройка SSL/HTTPS](#настройка-sslhttps)
6. [Мониторинг и логирование](#мониторинг-и-логирование)
7. [Резервное копирование](#резервное-копирование)
8. [Обновление системы](#обновление-системы)
9. [Решение проблем](#решение-проблем)

## Требования

- **Ubuntu Server**: 20.04 LTS или выше
- **Node.js**: версия 18.x или выше
- **PostgreSQL**: версия 12.x или выше
- **Nginx**: последняя стабильная версия
- **Минимум 2GB RAM**, 20GB свободного места на диске
- **Доступ root или sudo**

## Быстрое развертывание

Если у вас уже есть сервер и вы хотите быстро развернуть систему:

```bash
# 1. Клонируйте или скопируйте проект на сервер
git clone <repository-url> /opt/supporit
# или скопируйте файлы вручную

# 2. Запустите скрипт автоматического развертывания
cd /opt/supporit
sudo chmod +x scripts/*.sh
sudo ./scripts/deploy.sh

# 3. Настройте переменные окружения
sudo cp server/env.production.example server/.env
sudo nano server/.env  # Отредактируйте значения

sudo cp .env.production.example .env
sudo nano .env  # Отредактируйте значения

# 4. Настройте базу данных
sudo ./scripts/setup-database.sh

# 5. Соберите проект
sudo ./scripts/build-production.sh

# 6. Настройте systemd сервис
sudo cp scripts/supporit-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable supporit-api
sudo systemctl start supporit-api

# 7. Настройте Nginx
sudo cp scripts/nginx-supporit.conf /etc/nginx/sites-available/supporit
sudo nano /etc/nginx/sites-available/supporit  # Отредактируйте server_name
sudo ln -s /etc/nginx/sites-available/supporit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Пошаговое развертывание

### Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y curl wget git build-essential
```

### Шаг 2: Установка Node.js

```bash
# Установка Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Проверка версии
node --version  # Должно быть v18.x или выше
npm --version
```

### Шаг 3: Установка PostgreSQL

```bash
# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Запуск и автозапуск
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Проверка статуса
sudo systemctl status postgresql
```

### Шаг 4: Настройка базы данных

```bash
# Создание пользователя БД
sudo -u postgres psql -c "CREATE USER supporit_db WITH PASSWORD 'надежный_пароль';"

# Создание базы данных
sudo -u postgres psql -c "CREATE DATABASE supporit OWNER supporit_db;"

# Предоставление прав
sudo -u postgres psql -d supporit -c "GRANT ALL PRIVILEGES ON DATABASE supporit TO supporit_db;"
```

**ВАЖНО:** Замените `'надежный_пароль'` на надежный пароль!

### Шаг 5: Копирование проекта

```bash
# Создание директории
sudo mkdir -p /opt/supporit
sudo chown -R $USER:$USER /opt/supporit

# Копирование файлов (выберите один из вариантов)
# Вариант 1: Git
git clone <repository-url> /opt/supporit

# Вариант 2: SCP (с локального компьютера)
# scp -r /путь/к/проекту/* user@server:/opt/supporit/

# Вариант 3: Rsync (с локального компьютера)
# rsync -avz /путь/к/проекту/ user@server:/opt/supporit/
```

### Шаг 6: Настройка переменных окружения

#### Бэкенд

```bash
cd /opt/supporit/server
cp env.production.example .env
nano .env
```

Заполните следующие значения:

```env
DATABASE_URL=postgresql://supporit_db:ваш_пароль@localhost:5432/supporit
JWT_SECRET=$(openssl rand -base64 32)  # Сгенерируйте ключ
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

#### Фронтенд

```bash
cd /opt/supporit
cp .env.production.example .env
nano .env
```

Заполните:

```env
VITE_API_URL=https://yourdomain.com/api
```

### Шаг 7: Применение схемы базы данных

```bash
cd /opt/supporit
chmod +x scripts/*.sh
./scripts/setup-database.sh
```

Или вручную:

```bash
# Применение основной схемы
sudo -u postgres psql -d supporit -f supabase/schema_postgres.sql

# Применение миграций
sudo -u postgres psql -d supporit -f supabase/migration_allow_null_password.sql
# ... и другие миграции в правильном порядке
```

### Шаг 8: Сборка проекта

```bash
cd /opt/supporit
./scripts/build-production.sh
```

Или вручную:

```bash
# Установка зависимостей и сборка фронтенда
npm ci
npm run build

# Установка зависимостей и сборка бэкенда
cd server
npm ci
npm run build
cd ..
```

### Шаг 9: Настройка systemd сервиса

```bash
# Создание пользователя для приложения
sudo useradd -r -s /bin/bash -d /opt/supporit -m supporit

# Копирование конфигурации сервиса
sudo cp scripts/supporit-api.service /etc/systemd/system/

# Редактирование пути (если нужно)
sudo nano /etc/systemd/system/supporit-api.service

# Установка прав на файлы
sudo chown -R supporit:supporit /opt/supporit

# Активация и запуск сервиса
sudo systemctl daemon-reload
sudo systemctl enable supporit-api
sudo systemctl start supporit-api

# Проверка статуса
sudo systemctl status supporit-api

# Просмотр логов
sudo journalctl -u supporit-api -f
```

### Шаг 10: Настройка Nginx

```bash
# Установка Nginx (если не установлен)
sudo apt install -y nginx

# Копирование конфигурации
sudo cp scripts/nginx-supporit.conf /etc/nginx/sites-available/supporit

# Редактирование конфигурации
sudo nano /etc/nginx/sites-available/supporit
# Замените yourdomain.com на ваш домен

# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/supporit /etc/nginx/sites-enabled/

# Удаление дефолтной конфигурации (опционально)
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### Шаг 11: Создание первого администратора

```bash
# Зарегистрируйтесь через веб-интерфейс на /register
# Затем назначьте роль администратора:

sudo -u postgres psql -d supporit -c "UPDATE users SET role = 'admin' WHERE email = 'ваш-email@example.com';"
```

## Настройка безопасности

### 1. Firewall (UFW)

```bash
# Установка UFW (если не установлен)
sudo apt install -y ufw

# Разрешение SSH (ВАЖНО: сделайте это первым!)
sudo ufw allow 22/tcp

# Разрешение HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включение firewall
sudo ufw enable

# Проверка статуса
sudo ufw status
```

### 2. Настройка PostgreSQL

```bash
# Редактирование pg_hba.conf для безопасности
sudo nano /etc/postgresql/*/main/pg_hba.conf

# Убедитесь, что удаленный доступ ограничен:
# local   all             all                                     peer
# host    all             all             127.0.0.1/32            md5
# host    all             all             ::1/128                 md5

# Перезапуск PostgreSQL
sudo systemctl restart postgresql
```

### 3. Ограничение доступа к базе данных

В `server/.env` используйте только localhost для подключения:

```env
DATABASE_URL=postgresql://supporit_db:пароль@localhost:5432/supporit
```

### 4. Регулярное обновление системы

```bash
# Настройка автоматических обновлений безопасности
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

## Настройка SSL/HTTPS

### Вариант 1: Let's Encrypt (бесплатно)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Автоматическое обновление
sudo certbot renew --dry-run
```

После получения сертификата обновите конфигурацию Nginx:

```nginx
# Раскомментируйте SSL настройки в /etc/nginx/sites-available/supporit
listen 443 ssl http2;
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### Вариант 2: Собственный сертификат

Если у вас есть собственный SSL сертификат, укажите пути в конфигурации Nginx.

## Мониторинг и логирование

### Просмотр логов systemd

```bash
# Логи API сервера
sudo journalctl -u supporit-api -f

# Логи за последний час
sudo journalctl -u supporit-api --since "1 hour ago"

# Логи Nginx
sudo tail -f /var/log/nginx/supporit-access.log
sudo tail -f /var/log/nginx/supporit-error.log
```

### Мониторинг ресурсов

```bash
# Установка утилит мониторинга
sudo apt install -y htop iotop

# Мониторинг процессов
htop

# Мониторинг дисков
iotop
df -h
```

## Резервное копирование

### Автоматическое резервное копирование

Создайте cron задачу для ежедневного бэкапа:

```bash
# Редактирование crontab
sudo crontab -e

# Добавьте строку (бэкап каждый день в 2:00)
0 2 * * * /opt/supporit/scripts/backup-database.sh >> /var/log/supporit-backup.log 2>&1
```

### Ручное резервное копирование

```bash
# Создание бэкапа
cd /opt/supporit
./scripts/backup-database.sh

# Восстановление из бэкапа
./scripts/restore-database.sh backups/supporit_backup_20231220_120000.sql
```

### Хранение бэкапов

Рекомендуется хранить бэкапы:
- На отдельном диске/сервере
- В облачном хранилище (S3, Google Cloud Storage и т.д.)
- Минимум 30 дней истории

## Обновление системы

### Процесс обновления

```bash
# 1. Создание бэкапа
cd /opt/supporit
./scripts/backup-database.sh

# 2. Остановка сервиса
sudo systemctl stop supporit-api

# 3. Обновление кода
cd /opt/supporit
git pull  # или скопируйте новые файлы

# 4. Установка новых зависимостей
npm ci
cd server && npm ci && cd ..

# 5. Применение миграций (если есть)
./scripts/setup-database.sh

# 6. Пересборка
./scripts/build-production.sh

# 7. Запуск сервиса
sudo systemctl start supporit-api

# 8. Проверка статуса
sudo systemctl status supporit-api
```

## Решение проблем

### API сервер не запускается

```bash
# Проверка логов
sudo journalctl -u supporit-api -n 50

# Проверка переменных окружения
sudo systemctl show supporit-api | grep Environment

# Проверка подключения к БД
sudo -u supporit psql $DATABASE_URL -c "SELECT 1;"
```

### Ошибки подключения к базе данных

1. Проверьте, что PostgreSQL запущен: `sudo systemctl status postgresql`
2. Проверьте `DATABASE_URL` в `server/.env`
3. Проверьте права пользователя БД
4. Проверьте firewall правила

### Nginx возвращает 502 Bad Gateway

1. Проверьте, что API сервер запущен: `sudo systemctl status supporit-api`
2. Проверьте, что порт 3001 доступен: `sudo netstat -tlnp | grep 3001`
3. Проверьте логи Nginx: `sudo tail -f /var/log/nginx/supporit-error.log`

### Фронтенд не подключается к API

1. Проверьте `VITE_API_URL` в `.env`
2. Проверьте CORS настройки в `server/.env`
3. Проверьте консоль браузера на ошибки
4. Проверьте сетевые запросы в DevTools

### Проблемы с правами доступа

```bash
# Установка правильных прав
sudo chown -R supporit:supporit /opt/supporit
sudo chmod -R 755 /opt/supporit
sudo chmod 600 /opt/supporit/server/.env
sudo chmod 600 /opt/supporit/.env
```

## Дополнительные ресурсы

- [DEPLOYMENT.md](DEPLOYMENT.md) - Общее руководство по развертыванию
- [SETUP_ADMIN.md](SETUP_ADMIN.md) - Создание администратора
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Решение проблем
- [server/SETUP_POSTGRES.md](server/SETUP_POSTGRES.md) - Настройка PostgreSQL

## Поддержка

При возникновении проблем:
1. Проверьте логи: `sudo journalctl -u supporit-api -f`
2. Проверьте документацию по решению проблем
3. Убедитесь, что все переменные окружения настроены правильно


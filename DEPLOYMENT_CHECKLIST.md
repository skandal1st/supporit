# Чеклист развертывания на продакшн

Используйте этот чеклист для проверки готовности к развертыванию на продакшн сервере.

## Предварительная подготовка

### Сервер
- [ ] Ubuntu Server 20.04 LTS или выше установлен
- [ ] Доступ root или sudo настроен
- [ ] SSH доступ настроен и защищен
- [ ] Firewall (UFW) настроен
- [ ] Система обновлена (`sudo apt update && sudo apt upgrade`)

### Домены и DNS
- [ ] Доменное имя зарегистрировано
- [ ] DNS записи настроены (A запись указывает на IP сервера)
- [ ] SSL сертификат получен (Let's Encrypt или другой)

## Установка зависимостей

- [ ] Node.js 18.x или выше установлен
- [ ] npm установлен
- [ ] PostgreSQL установлен и запущен
- [ ] Nginx установлен

**Быстрая проверка:**
```bash
./scripts/check-deployment.sh
```

## Настройка базы данных

- [ ] База данных `supporit` создана
- [ ] Пользователь БД создан с надежным паролем
- [ ] Схема БД применена (`schema_postgres.sql`)
- [ ] Все миграции применены
- [ ] Доступ к БД ограничен только с localhost

**Команды:**
```bash
./scripts/setup-database.sh
```

## Настройка переменных окружения

### Бэкенд (`server/.env`)
- [ ] `DATABASE_URL` настроен с правильными учетными данными
- [ ] `JWT_SECRET` сгенерирован (минимум 32 символа)
- [ ] `JWT_EXPIRES_IN` настроен
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` настроен на ваш домен
- [ ] `PORT` настроен (обычно 3001)

**Генерация JWT_SECRET:**
```bash
openssl rand -base64 32
```

### Фронтенд (`.env`)
- [ ] `VITE_API_URL` настроен на URL вашего API

## Сборка проекта

- [ ] Зависимости фронтенда установлены (`npm ci`)
- [ ] Зависимости бэкенда установлены (`cd server && npm ci`)
- [ ] Фронтенд собран (`npm run build`)
- [ ] Бэкенд собран (`cd server && npm run build`)
- [ ] Файлы в `dist/` и `server/dist/` созданы

**Команда:**
```bash
./scripts/build-production.sh
```

## Настройка systemd

- [ ] Файл `supporit-api.service` скопирован в `/etc/systemd/system/`
- [ ] Пути в сервисе отредактированы (если нужно)
- [ ] Пользователь `supporit` создан
- [ ] Права на файлы установлены (`chown -R supporit:supporit /opt/supporit`)
- [ ] Сервис активирован (`systemctl enable supporit-api`)
- [ ] Сервис запущен (`systemctl start supporit-api`)
- [ ] Статус сервиса проверен (`systemctl status supporit-api`)

**Команды:**
```bash
sudo cp scripts/supporit-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable supporit-api
sudo systemctl start supporit-api
sudo systemctl status supporit-api
```

## Настройка Nginx

- [ ] Конфигурация скопирована в `/etc/nginx/sites-available/supporit`
- [ ] `server_name` изменен на ваш домен
- [ ] Пути к статическим файлам проверены
- [ ] SSL сертификаты настроены (для HTTPS)
- [ ] Конфигурация активирована (симлинк в `sites-enabled`)
- [ ] Конфигурация проверена (`nginx -t`)
- [ ] Nginx перезапущен

**Команды:**
```bash
sudo cp scripts/nginx-supporit.conf /etc/nginx/sites-available/supporit
sudo nano /etc/nginx/sites-available/supporit  # Отредактируйте
sudo ln -s /etc/nginx/sites-available/supporit /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Безопасность

- [ ] `.env` файлы не в Git (проверьте `.gitignore`)
- [ ] `JWT_SECRET` изменен с дефолтного значения
- [ ] Пароль БД изменен с дефолтного
- [ ] `CORS_ORIGIN` настроен только на ваши домены
- [ ] Firewall настроен (разрешены только 22, 80, 443)
- [ ] Доступ к PostgreSQL ограничен (только localhost)
- [ ] Права на `.env` файлы: `chmod 600`
- [ ] SSL/TLS настроен для веб-сервера
- [ ] Rate limiting настроен (рекомендуется)

**Проверка:**
```bash
# Проверка прав на .env файлы
ls -la server/.env .env

# Должно быть: -rw------- (600)
```

## Создание администратора

- [ ] Первый пользователь зарегистрирован через `/register`
- [ ] Роль администратора назначена через SQL:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'ваш-email@example.com';
  ```
- [ ] Вход в систему проверен

## Резервное копирование

- [ ] Скрипт резервного копирования протестирован
- [ ] Автоматическое резервное копирование настроено (cron)
- [ ] Директория для бэкапов создана
- [ ] Процесс восстановления из бэкапа протестирован

**Настройка автоматического бэкапа:**
```bash
sudo crontab -e
# Добавьте: 0 2 * * * /opt/supporit/scripts/backup-database.sh >> /var/log/supporit-backup.log 2>&1
```

## Мониторинг и логирование

- [ ] Логи systemd проверяются (`journalctl -u supporit-api -f`)
- [ ] Логи Nginx проверяются (`tail -f /var/log/nginx/supporit-*.log`)
- [ ] Health check endpoint работает (`/health`)
- [ ] Мониторинг ресурсов настроен (опционально)

## Тестирование

- [ ] Главная страница открывается
- [ ] Страница входа работает
- [ ] Регистрация работает
- [ ] Вход в систему работает
- [ ] API endpoints отвечают
- [ ] Статические файлы загружаются
- [ ] HTTPS работает (если настроен)
- [ ] Редирект с HTTP на HTTPS работает (если настроен)

## Финальная проверка

- [ ] Все зависимости обновлены (`npm audit`)
- [ ] Система обновлена
- [ ] Документация прочитана
- [ ] План восстановления подготовлен
- [ ] Контакты для поддержки известны

## После развертывания

- [ ] Создан первый администратор
- [ ] Тестовые данные добавлены (опционально)
- [ ] Пользователи уведомлены о запуске
- [ ] Мониторинг активен
- [ ] Резервное копирование работает

## Полезные команды

```bash
# Проверка статуса сервисов
sudo systemctl status supporit-api
sudo systemctl status nginx
sudo systemctl status postgresql

# Просмотр логов
sudo journalctl -u supporit-api -f
sudo tail -f /var/log/nginx/supporit-error.log

# Проверка подключения к БД
psql $DATABASE_URL -c "SELECT 1;"

# Проверка портов
sudo netstat -tlnp | grep -E '3001|80|443'

# Проверка дискового пространства
df -h

# Проверка памяти
free -h
```

## Дополнительные ресурсы

- [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md) - Подробное руководство
- [SECURITY.md](SECURITY.md) - Руководство по безопасности
- [scripts/README.md](scripts/README.md) - Документация по скриптам


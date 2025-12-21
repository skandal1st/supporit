# Скрипты развертывания

Эта директория содержит скрипты для развертывания и управления системой Supporit на продакшн сервере.

## Скрипты

### `deploy.sh`
Автоматический скрипт развертывания на Ubuntu сервере. Устанавливает все необходимые зависимости и настраивает систему.

**Использование:**
```bash
sudo ./scripts/deploy.sh
```

**Что делает:**
- Обновляет систему
- Устанавливает Node.js, PostgreSQL, Nginx
- Создает пользователя приложения
- Настраивает базу данных

### `setup-database.sh`
Настраивает базу данных: применяет схему и все миграции.

**Использование:**
```bash
./scripts/setup-database.sh [путь_к_проекту]
```

**Требования:**
- Файл `server/.env` с `DATABASE_URL`

### `build-production.sh`
Собирает проект для продакшена (фронтенд и бэкенд).

**Использование:**
```bash
./scripts/build-production.sh [путь_к_проекту]
```

### `backup-database.sh`
Создает резервную копию базы данных.

**Использование:**
```bash
./scripts/backup-database.sh [путь_к_проекту]
```

**Результат:**
- Создает файл бэкапа в `backups/` директории
- Автоматически сжимает SQL файлы
- Удаляет бэкапы старше 30 дней

**Настройка автоматического бэкапа:**
```bash
# Добавьте в crontab (sudo crontab -e)
0 2 * * * /opt/supporit/scripts/backup-database.sh >> /var/log/supporit-backup.log 2>&1
```

### `restore-database.sh`
Восстанавливает базу данных из резервной копии.

**Использование:**
```bash
./scripts/restore-database.sh <путь_к_бэкапу> [путь_к_проекту]
```

**ВНИМАНИЕ:** Это действие перезапишет текущую базу данных!

## Конфигурационные файлы

### `supporit-api.service`
Systemd unit файл для запуска API сервера как системного сервиса.

**Установка:**
```bash
sudo cp scripts/supporit-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable supporit-api
sudo systemctl start supporit-api
```

**Управление:**
```bash
sudo systemctl start supporit-api    # Запуск
sudo systemctl stop supporit-api     # Остановка
sudo systemctl restart supporit-api  # Перезапуск
sudo systemctl status supporit-api   # Статус
sudo journalctl -u supporit-api -f  # Логи
```

### `nginx-supporit.conf`
Конфигурация Nginx для фронтенда и проксирования API.

**Установка:**
```bash
sudo cp scripts/nginx-supporit.conf /etc/nginx/sites-available/supporit
sudo nano /etc/nginx/sites-available/supporit  # Отредактируйте server_name
sudo ln -s /etc/nginx/sites-available/supporit /etc/nginx/sites-enabled/
sudo nginx -t  # Проверка конфигурации
sudo systemctl restart nginx
```

**Важно:**
- Замените `yourdomain.com` на ваш домен
- Настройте SSL сертификаты для HTTPS
- Проверьте пути к статическим файлам

## Права доступа

Убедитесь, что скрипты исполняемые:

```bash
chmod +x scripts/*.sh
```

## Порядок развертывания

1. **Подготовка сервера:**
   ```bash
   sudo ./scripts/deploy.sh
   ```

2. **Настройка переменных окружения:**
   ```bash
   cp server/env.production.example server/.env
   nano server/.env
   
   cp .env.production.example .env
   nano .env
   ```

3. **Настройка базы данных:**
   ```bash
   ./scripts/setup-database.sh
   ```

4. **Сборка проекта:**
   ```bash
   ./scripts/build-production.sh
   ```

5. **Настройка systemd:**
   ```bash
   sudo cp scripts/supporit-api.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable supporit-api
   sudo systemctl start supporit-api
   ```

6. **Настройка Nginx:**
   ```bash
   sudo cp scripts/nginx-supporit.conf /etc/nginx/sites-available/supporit
   # Отредактируйте конфигурацию
   sudo ln -s /etc/nginx/sites-available/supporit /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

## Дополнительная документация

- [PRODUCTION_DEPLOYMENT.md](../PRODUCTION_DEPLOYMENT.md) - Полное руководство по развертыванию
- [SECURITY.md](../SECURITY.md) - Руководство по безопасности
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Общее руководство по развертыванию


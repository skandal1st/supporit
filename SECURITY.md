# Руководство по безопасности для продакшена

## ⚠️ Критические настройки безопасности

### 1. Переменные окружения

**НИКОГДА не коммитьте файлы `.env` в Git!**

Убедитесь, что `.env` файлы добавлены в `.gitignore`:

```gitignore
.env
.env.local
.env.production
server/.env
server/.env.local
server/.env.production
```

### 2. JWT Secret

**КРИТИЧНО:** Используйте надежный случайный ключ для `JWT_SECRET`:

```bash
# Генерация надежного ключа
openssl rand -base64 32
```

Минимальная длина: 32 символа. Используйте разные ключи для разных окружений.

### 3. Пароли базы данных

- Используйте надежные пароли (минимум 16 символов)
- Не используйте пароли по умолчанию
- Ограничьте доступ к БД только с localhost
- Используйте отдельного пользователя БД для приложения (не postgres)

### 4. SSL/TLS для базы данных

В продакшене рекомендуется использовать SSL для подключения к PostgreSQL.

**Текущая конфигурация в `server/src/config/database.ts`:**
```typescript
ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
```

⚠️ **ВНИМАНИЕ:** `rejectUnauthorized: false` отключает проверку сертификата, что небезопасно.

**Рекомендуемая конфигурация:**

1. Настройте SSL на PostgreSQL сервере
2. Используйте валидацию сертификата:

```typescript
ssl: process.env.NODE_ENV === 'production' ? {
  rejectUnauthorized: true,
  ca: fs.readFileSync('/path/to/ca-certificate.crt').toString()
} : false
```

Или для локального подключения (без SSL):
```typescript
ssl: false  // Для localhost подключений
```

### 5. CORS настройки

В продакшене ограничьте CORS только вашими доменами:

```env
# НЕ используйте * или http://localhost в продакшене!
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

### 6. Rate Limiting

Рекомендуется добавить rate limiting для API endpoints, особенно для:
- `/api/auth/signin` - защита от брутфорса
- `/api/auth/signup` - защита от спама регистраций

Пример с express-rate-limit:

```bash
npm install express-rate-limit
```

```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток
  message: 'Слишком много попыток, попробуйте позже'
});

app.use('/api/auth/signin', authLimiter);
app.use('/api/auth/signup', authLimiter);
```

### 7. Защита заголовков

Nginx конфигурация уже включает базовые заголовки безопасности:
- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

Дополнительно можно добавить:
- `Strict-Transport-Security` (HSTS) для HTTPS
- `Content-Security-Policy`

### 8. Валидация входных данных

Убедитесь, что все входные данные валидируются:
- Используйте Zod схемы (уже используется в проекте)
- Санитизация SQL запросов (используйте параметризованные запросы)
- Проверка типов данных

### 9. Логирование и мониторинг

- Логируйте все попытки аутентификации (успешные и неуспешные)
- Мониторьте подозрительную активность
- Настройте алерты на критические ошибки

### 10. Регулярные обновления

- Регулярно обновляйте зависимости: `npm audit` и `npm update`
- Обновляйте систему: `sudo apt update && sudo apt upgrade`
- Следите за уязвимостями в используемых библиотеках

### 11. Резервное копирование

- Настройте автоматическое резервное копирование БД
- Храните бэкапы в безопасном месте
- Тестируйте восстановление из бэкапов

### 12. Firewall

Настройте UFW или iptables:
- Разрешите только необходимые порты (22, 80, 443)
- Ограничьте доступ к порту PostgreSQL (5432) только с localhost
- Используйте fail2ban для защиты от брутфорса

### 13. Права доступа к файлам

```bash
# Правильные права для .env файлов
chmod 600 /opt/supporit/server/.env
chmod 600 /opt/supporit/.env

# Права для директории проекта
chmod 755 /opt/supporit
chown -R supporit:supporit /opt/supporit
```

### 14. Проверка безопасности перед развертыванием

Перед развертыванием в продакшене:

```bash
# Проверка уязвимостей в зависимостях
npm audit
cd server && npm audit

# Исправление автоматически исправимых уязвимостей
npm audit fix

# Проверка конфигурации
# Убедитесь, что:
# - JWT_SECRET изменен
# - Пароли БД изменены
# - CORS_ORIGIN настроен правильно
# - NODE_ENV=production
```

## Чеклист безопасности перед развертыванием

- [ ] `.env` файлы не в Git
- [ ] `JWT_SECRET` сгенерирован и установлен (минимум 32 символа)
- [ ] Пароль БД изменен с дефолтного
- [ ] `CORS_ORIGIN` настроен только на ваши домены
- [ ] `NODE_ENV=production` установлен
- [ ] SSL/TLS настроен для веб-сервера
- [ ] Firewall настроен и активен
- [ ] Rate limiting настроен для auth endpoints
- [ ] Права доступа к файлам настроены правильно
- [ ] Резервное копирование настроено
- [ ] Логирование настроено
- [ ] Все зависимости обновлены (`npm audit`)
- [ ] Система обновлена (`apt update && apt upgrade`)

## Дополнительные рекомендации

### Использование переменных окружения для секретов

В продакшене рассмотрите использование:
- **HashiCorp Vault** для хранения секретов
- **AWS Secrets Manager** или **Azure Key Vault**
- **Kubernetes Secrets** (если используете K8s)

### Мониторинг безопасности

Настройте мониторинг:
- Неудачные попытки входа
- Необычная активность пользователей
- Ошибки аутентификации
- Изменения в критических данных

### Инцидент-менеджмент

Подготовьте план действий на случай:
- Утечки данных
- Компрометации системы
- DDoS атак
- Несанкционированного доступа

## Полезные ресурсы

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)


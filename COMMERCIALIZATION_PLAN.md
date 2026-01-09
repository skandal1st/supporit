# План коммерциализации SupporIT

> Сохранено: 2026-01-06
> Статус: В процессе

---

## Выполнено

### 1. Удаление хардкода
- [x] Убраны хардкодированные email `teplocentral.org` из:
  - `server/src/services/email-sender.service.ts`
  - `server/src/services/email-receiver.service.ts`
  - `server/env.example`
  - `supabase/migration_email_tickets.sql`
- [x] Добавлена валидация конфигурации при старте

### 2. Система автоматического обновления
- [x] Миграция БД: `supabase/migrations/20260106_000000_v1.0.0_update_system.sql`
  - Таблица `schema_migrations` — отслеживание миграций
  - Таблица `update_logs` — история обновлений
  - Таблица `system_info` — версия, лицензия, instance_id
- [x] `version.json` — манифест версии в корне проекта
- [x] Backend сервисы:
  - `server/src/services/license.service.ts` — проверка лицензий
  - `server/src/services/update.service.ts` — логика обновлений
  - `server/src/routes/updates.ts` — API endpoints
- [x] Frontend:
  - `src/services/update.service.ts` — API клиент
  - `src/components/settings/SystemUpdateSettings.tsx` — UI
  - Вкладка "Обновления" в настройках
- [x] Bash скрипты:
  - `scripts/update.sh` — автоматическое обновление
  - `scripts/rollback.sh` — откат к backup
  - `scripts/build-release.sh` — сборка релизов
- [x] Версия обновлена до 1.0.0

---

## Требуется выполнить

### 3. Лицензионный сервер (приоритет: высокий)
Отдельный микросервис для проверки лицензий.

**Функционал:**
- POST `/api/validate` — проверка ключа
- POST `/api/activate` — активация лицензии
- GET `/api/licenses/:key` — информация о лицензии
- Привязка к `instance_id` (защита от копирования)
- База данных клиентов и лицензий

**Формат ключа:** `SUPPORIT-{TIER}-{EXPIRY}-{FEATURES}-{CHECKSUM}`
- TIER: BASIC, PRO, ENTERPRISE
- EXPIRY: YYYYMMDD или LIFETIME
- FEATURES: UPD (updates), SUP (support), API
- CHECKSUM: HMAC-SHA256 первые 8 символов

**Технологии:** Node.js + Express + PostgreSQL (или SQLite для простоты)

### 4. Docker контейнеризация (приоритет: высокий)
Упрощает развёртывание у клиентов.

**Файлы для создания:**
- `Dockerfile` — образ приложения
- `docker-compose.yml` — полный стек (app + postgres + nginx)
- `docker-compose.prod.yml` — production конфигурация
- `.dockerignore`

**Команды для клиента:**
```bash
docker-compose up -d
```

### 5. Конфигурируемый брендинг (приоритет: средний)
Каждый клиент видит свой логотип и название.

**Что добавить:**
- Настройки в `system_settings`:
  - `app_name` — название приложения
  - `app_logo_url` — URL логотипа
  - `primary_color` — основной цвет
  - `company_name` — название компании клиента
- API endpoint GET `/api/settings/branding`
- Компонент `BrandingProvider` на фронтенде
- Динамическая загрузка логотипа в Sidebar и Login

### 6. Безопасность (приоритет: высокий)
- [ ] Rate limiting на `/api/auth/*` (express-rate-limit)
- [ ] Account lockout после 5 неудачных попыток входа
- [ ] Логирование попыток аутентификации
- [ ] 2FA для администраторов (TOTP)
- [ ] Helmet.js для security headers
- [ ] CSRF защита

### 7. Мультитенантность (приоритет: низкий, если не SaaS)
Если планируется один инстанс для нескольких клиентов:
- Добавить `tenant_id` во все таблицы
- RLS политики PostgreSQL
- Middleware для автоматической фильтрации

### 8. Документация для клиентов (приоритет: средний)
- [ ] Руководство администратора (PDF)
- [ ] Руководство пользователя (PDF)
- [ ] Инструкция по установке
- [ ] FAQ / Troubleshooting
- [ ] Видео-туториалы (опционально)

### 9. CI/CD Pipeline (приоритет: средний)
GitHub Actions для автоматизации:
- Сборка при push в main
- Автоматическое создание релизов при тегах
- Запуск тестов (когда будут добавлены)

**Файл:** `.github/workflows/release.yml`

### 10. Мониторинг и логирование (приоритет: средний)
- [ ] Централизованное логирование (Winston/Pino)
- [ ] Sentry для отслеживания ошибок
- [ ] Health check dashboard
- [ ] Prometheus метрики (опционально)

### 11. Тестирование (приоритет: средний)
- [ ] Unit тесты (Jest)
- [ ] Integration тесты для API
- [ ] E2E тесты (Playwright/Cypress)
- [ ] Минимум 70% покрытия

### 12. SSO/LDAP интеграция (приоритет: низкий)
Для корпоративных клиентов:
- Интеграция с Active Directory
- OAuth2/OIDC провайдеры
- SAML (опционально)

---

## Переменные окружения для добавления

```env
# GitHub (для системы обновлений)
GITHUB_REPO=username/supporit
GITHUB_TOKEN=ghp_xxx

# Лицензирование
LICENSE_SERVER_URL=https://license.yourdomain.com
LICENSE_SECRET=your-32-char-secret-for-license-keys

# Брендинг (будущее)
APP_NAME=SupporIT
APP_LOGO_URL=/logo.png
```

---

## Порядок реализации (рекомендуемый)

1. **Ближайшие шаги:**
   - [ ] Применить миграцию БД на продакшене
   - [ ] Протестировать систему обновлений
   - [ ] Создать первый релиз на GitHub

2. **Следующая итерация:**
   - [ ] Лицензионный сервер
   - [ ] Docker контейнеризация
   - [ ] Rate limiting и безопасность

3. **Перед первой продажей:**
   - [ ] Документация для клиентов
   - [ ] Конфигурируемый брендинг
   - [ ] Тестирование полного цикла

4. **После первых клиентов:**
   - [ ] CI/CD Pipeline
   - [ ] Мониторинг
   - [ ] SSO/LDAP (по запросу)

---

## Ценовая модель (предложение)

| Тариф | Функции | Цена |
|-------|---------|------|
| **BASIC** | Базовый функционал, без обновлений | Разовая оплата |
| **PRO** | + Обновления 1 год, email поддержка | Подписка/год |
| **ENTERPRISE** | + Приоритетная поддержка, кастомизация | Индивидуально |

---

## Контакты и ресурсы

- Репозиторий: (добавить после создания на GitHub)
- Лицензионный сервер: (добавить после развёртывания)
- Документация: (добавить ссылку)

---

*Последнее обновление: 2026-01-06*

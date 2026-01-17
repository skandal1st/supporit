# План реализации HR-модуля для SuppOrIT

## Обзор

Добавление модуля управления кадрами с:
- Новой ролью `hr_specialist`
- Формой для заявок на приём/увольнение сотрудников
- Автоматическим созданием аккаунтов в AD и Mailcow (после подтверждения IT)
- Справочником сотрудников с полными профилями
- Двусторонней синхронизацией с Active Directory

---

## Этап 1: База данных

### 1.1. Миграция роли hr_specialist
**Файл**: `supabase/migration_hr_role.sql`
```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'it_specialist', 'employee', 'hr_specialist'));
```

### 1.2. Расширение таблицы users для справочника
**Файл**: `supabase/migration_employee_directory.sql`

Новые поля:
- `internal_phone` - внутренний номер
- `birth_date` - дата рождения
- `hire_date` - дата приёма
- `termination_date` - дата увольнения
- `manager_id` - руководитель (FK на users)
- `room_id` - кабинет (FK на rooms)
- `additional_phones` - доп. телефоны (JSONB)
- `photo_url` - фото
- `is_active` - активен ли сотрудник
- `mailcow_alias` - email в Mailcow

### 1.3. Таблица HR-заявок
**Файл**: `supabase/migration_hr_requests.sql`

Структура:
- `id`, `request_type` (hire/terminate), `status`
- Данные сотрудника: ФИО, email, отдел, должность, телефоны, ДР, дата приёма, руководитель, кабинет
- Для увольнения: `terminating_user_id`, `termination_date`, `termination_reason`
- AD/Mailcow статус: `ad_created`, `mailcow_created`, ошибки
- Связь с IT-тикетом: `linked_ticket_id`
- Метаданные: создал, одобрил, причина отклонения

Статусы: `draft` → `pending_it` → `it_approved`/`it_rejected` → `in_progress` → `completed`

### 1.4. Таблица логов синхронизации AD
**Файл**: `supabase/migration_ad_sync.sql`

---

## Этап 2: Backend

### 2.1. Роут HR-заявок
**Файл**: `server/src/routes/hr-requests.ts`

| Метод | Путь | Роли | Описание |
|-------|------|------|----------|
| GET | `/` | admin, hr, it | Список заявок (HR видит свои, IT/admin все) |
| GET | `/:id` | admin, hr, it | Детали заявки |
| POST | `/` | admin, hr | Создание заявки |
| PUT | `/:id` | admin, hr, it | Обновление заявки |
| POST | `/:id/submit` | admin, hr | Отправить на согласование IT |
| POST | `/:id/approve` | admin, it | IT подтверждает |
| POST | `/:id/reject` | admin, it | IT отклоняет |
| POST | `/:id/execute` | admin, it | Выполнить (создать AD + Mailcow) |
| DELETE | `/:id` | admin, hr | Удалить (только draft) |

### 2.2. Роут справочника сотрудников
**Файл**: `server/src/routes/employee-directory.ts`

| Метод | Путь | Роли | Описание |
|-------|------|------|----------|
| GET | `/` | все | Список сотрудников (разные поля по ролям) |
| GET | `/:id` | все | Профиль сотрудника |
| PUT | `/:id` | admin, hr | Обновление профиля |
| GET | `/org-chart` | все | Организационная структура |

### 2.3. Расширение AD сервиса
**Файл**: `server/src/services/ad.service.ts` (изменение)

Новые функции:
- `createADUser()` - создание пользователя в AD
- `disableADUser()` - отключение (для увольнения)
- `updateADUser()` - обновление атрибутов

### 2.4. Сервис Mailcow
**Файл**: `server/src/services/mailcow.service.ts` (новый)

Функции:
- `createMailbox()` - создание почтового ящика
- `disableMailbox()` - отключение ящика
- `testMailcowConnection()` - проверка подключения

### 2.5. Сервис синхронизации AD
**Файл**: `server/src/services/ad-sync.service.ts` (новый)

- `syncFromAD()` - обновить SuppOrIT из AD
- `syncToAD()` - обновить AD из SuppOrIT

### 2.6. Уведомления
**Файл**: `server/src/services/notification.service.ts` (изменение)

- `notifyHRRequestPendingIT()` - IT о новой заявке
- `notifyHRRequestDecision()` - HR о решении IT
- `notifyHRRequestCompleted()` - HR о выполнении

### 2.7. Регистрация роутов
**Файл**: `server/src/index.ts` (изменение)
```typescript
app.use('/api/hr-requests', hrRequestsRoutes);
app.use('/api/employees', employeeDirectoryRoutes);
```

---

## Этап 3: Frontend

### 3.1. Типы
**Файл**: `src/types/index.ts` (изменение)

- Добавить `hr_specialist` в `UserRole`
- Добавить типы `HRRequest`, `HRRequestType`, `HRRequestStatus`
- Добавить интерфейс `Employee` с расширенными полями

### 3.2. Сервисы
**Файлы**:
- `src/services/hr-requests.service.ts` (новый)
- `src/services/employees.service.ts` (новый)

### 3.3. Permissions
**Файл**: `src/utils/permissions.ts` (изменение)

- `isHRSpecialist()`, `canManageHRRequests()`, `canApproveHRRequests()`
- `canViewEmployeeDirectory()`, `canEditEmployeeDirectory()`

### 3.4. Страницы
**Файлы**:
- `src/pages/HRRequestsPage.tsx` (новый) - список HR-заявок
- `src/pages/EmployeeDirectoryPage.tsx` (новый) - справочник

### 3.5. Компоненты форм
**Файлы**:
- `src/components/hr/HireRequestForm.tsx` (новый) - форма приёма
- `src/components/hr/TerminateRequestForm.tsx` (новый) - форма увольнения
- `src/components/employees/EmployeeProfile.tsx` (новый) - профиль

### 3.6. Навигация
**Файл**: `src/components/layout/Sidebar.tsx` (изменение)

Добавить пункты:
- "HR-заявки" (`/hr-requests`) - для admin, hr, it
- "Справочник сотрудников" (`/employees`) - для всех

### 3.7. Маршрутизация
**Файл**: `src/App.tsx` (изменение)

### 3.8. Форма пользователя
**Файл**: `src/components/users/UserForm.tsx` (изменение)

Добавить опцию роли `hr_specialist`

---

## Этап 4: Workflow

### Процесс приёма сотрудника:
```
HR создаёт заявку (draft)
       ↓
HR отправляет на согласование (pending_it)
       ↓ [создаётся IT-тикет, уведомление IT]
IT рассматривает
       ↓
   ┌───┴───┐
   ↓       ↓
it_approved  it_rejected
   ↓       ↓ [уведомление HR]
IT выполняет (in_progress)
   ↓
 - Создание AD аккаунта
 - Создание Mailcow ящика
 - Создание пользователя SuppOrIT
   ↓
completed [уведомление HR]
```

### Процесс увольнения:
```
HR создаёт заявку → IT подтверждает → IT выполняет:
 - Отключение AD аккаунта
 - Отключение Mailcow ящика
 - is_active = false в SuppOrIT
 - Открепление оборудования
```

---

## Этап 5: Конфигурация

**Файл**: `server/.env` (новые переменные)
```env
# Mailcow API
MAILCOW_ENABLED=false
MAILCOW_API_URL=https://mail.example.com
MAILCOW_API_KEY=your-api-key
MAILCOW_DOMAIN=example.com

# AD Write Operations
AD_WRITE_ENABLED=false
AD_NEW_USERS_OU=OU=NewUsers,DC=example,DC=com
```

---

## Порядок реализации

### Фаза 1: Основа
1. Миграции БД (4 файла)
2. Обновление auth middleware для hr_specialist
3. Роут `hr-requests.ts` (CRUD)
4. Роут `employee-directory.ts`

### Фаза 2: Frontend базовый
5. Типы в `types/index.ts`
6. Сервисы API (2 файла)
7. `HRRequestsPage.tsx` + формы
8. `EmployeeDirectoryPage.tsx`
9. Sidebar + App.tsx (маршруты)

### Фаза 3: Workflow
10. Логика статусов и переходов
11. Создание связанных IT-тикетов
12. Уведомления

### Фаза 4: Интеграции
13. AD: создание пользователей (`ad.service.ts`)
14. Mailcow сервис
15. Двусторонняя синхронизация

### Фаза 5: Доработки
16. Карточки сотрудников, орг. структура
17. Загрузка фото
18. Расширенные фильтры

---

## Критичные файлы

| Файл | Изменение |
|------|-----------|
| `src/types/index.ts` | Типы HRRequest, Employee, роль hr_specialist |
| `server/src/services/ad.service.ts` | createADUser, updateADUser, disableADUser |
| `server/src/routes/users.ts` | Паттерн для hr-requests.ts |
| `src/pages/UsersPage.tsx` | Паттерн для HRRequestsPage.tsx |
| `server/src/services/notification.service.ts` | HR-уведомления |

---

## Верификация

1. **Миграции**: `psql -U postgres -d supporit -f supabase/migration_*.sql`
2. **Backend**: `cd server && npm run dev` - проверить роуты через Postman/curl
3. **Frontend**: `npm run dev` - проверить страницы и формы
4. **Workflow**: создать тестовую HR-заявку, пройти весь цикл
5. **Интеграции**: проверить создание в AD и Mailcow (тестовая среда)

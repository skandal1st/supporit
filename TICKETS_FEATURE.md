# Функциональность заявок с привязкой к оборудованию

## Что было реализовано

### 1. Расширение базы данных

- **Таблица `equipment_consumables`** - связь между оборудованием и расходными материалами
- **Поля в `tickets`**: `location_department`, `location_room` - для фильтрации оборудования по кабинету
- **Функции PostgreSQL**:
  - `get_equipment_by_location()` - получение оборудования по отделу и кабинету
  - `get_consumables_for_equipment()` - получение расходников для оборудования

### 2. API Endpoints

#### Оборудование
- `GET /api/equipment/by-location?department=&room=` - получить оборудование по кабинету
- `GET /api/equipment/:id/consumables` - получить расходники для оборудования

#### Заявки
- `GET /api/tickets` - список заявок с фильтрами
- `GET /api/tickets/:id` - получить заявку (включая расходники для оборудования)
- `POST /api/tickets` - создать заявку
- `PUT /api/tickets/:id` - обновить заявку
- `DELETE /api/tickets/:id` - удалить заявку (только admin/it_specialist)

### 3. Компоненты фронтенда

- **TicketForm** - форма создания/редактирования заявки с:
  - Выбором отдела и кабинета
  - Автоматической загрузкой оборудования в выбранном кабинете
  - Выбором оборудования из списка
  - Автоматическим отображением расходников для выбранного оборудования

## Как использовать

### 1. Настройка расходных материалов для оборудования

Для того, чтобы при выборе оборудования в заявке отображались расходники, нужно связать их:

```sql
-- Пример: связать картридж с принтером
INSERT INTO equipment_consumables (equipment_id, consumable_id, quantity_per_unit, notes)
SELECT 
  e.id,  -- ID принтера
  c.id,  -- ID картриджа
  1,     -- Количество на единицу оборудования
  'Основной картридж для принтера'
FROM equipment e, consumables c
WHERE e.inventory_number = 'INV-001'  -- Инвентарный номер принтера
  AND c.name = 'Картридж HP 85A';     -- Название расходника
```

### 2. Создание заявки через форму

1. Заполните отдел и кабинет
2. Система автоматически загрузит список оборудования в этом кабинете
3. Выберите оборудование из списка (если нужно)
4. Если выбрано оборудование (например, принтер), автоматически отобразятся связанные расходники (например, картриджи)
5. Заполните остальные поля и создайте заявку

### 3. Работа с API напрямую

#### Получить оборудование в кабинете:
```javascript
const { data } = await equipmentService.getEquipmentByLocation('Отдел продаж', '205');
```

#### Получить расходники для оборудования:
```javascript
const { data } = await equipmentService.getEquipmentConsumables(equipmentId);
```

#### Создать заявку:
```javascript
const { data, error } = await ticketsService.createTicket({
  title: 'Не работает принтер',
  description: 'Принтер не печатает',
  category: 'hardware',
  priority: 'high',
  location_department: 'Отдел продаж',
  location_room: '205',
  equipment_id: 'equipment-uuid-here',
});
```

## Следующие шаги

Для полной функциональности нужно:

1. **Создать страницу списка заявок** (`TicketsPage.tsx`)
2. **Создать страницу просмотра заявки** (`TicketDetailPage.tsx`)
3. **Добавить управление расходными материалами** (CRUD для consumables)
4. **Добавить управление связями** equipment-consumables через интерфейс
5. **Добавить комментарии к заявкам**
6. **Добавить уведомления** при создании/обновлении заявок

## Примеры SQL запросов

### Добавить расходный материал:
```sql
INSERT INTO consumables (name, category, unit, quantity_in_stock, min_quantity)
VALUES ('Картридж HP 85A', 'Картриджи', 'шт', 10, 3);
```

### Связать расходник с оборудованием:
```sql
INSERT INTO equipment_consumables (equipment_id, consumable_id, quantity_per_unit)
VALUES (
  (SELECT id FROM equipment WHERE inventory_number = 'INV-001'),
  (SELECT id FROM consumables WHERE name = 'Картридж HP 85A'),
  1
);
```

### Посмотреть все расходники для оборудования:
```sql
SELECT * FROM get_consumables_for_equipment('equipment-uuid-here');
```

### Посмотреть оборудование в кабинете:
```sql
SELECT * FROM get_equipment_by_location('Отдел продаж', '205');
```



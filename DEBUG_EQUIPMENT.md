# Отладка проблемы с отображением оборудования

Если список оборудования не отображается, проверьте следующие моменты:

## 1. Проверьте консоль браузера

Откройте Developer Tools (F12) → Console и посмотрите на ошибки:
- Если есть ошибки красным цветом, скопируйте их
- Особенно важны ошибки, связанные с Supabase или network запросами

## 2. Проверьте Network запросы

В Developer Tools перейдите на вкладку Network:
- Найдите запрос к `/rest/v1/equipment`
- Проверьте статус ответа (должен быть 200)
- Если статус 401 или 403 - проблема с авторизацией/правами
- Если статус 404 - таблица не найдена
- Посмотрите на Response - что возвращает сервер?

## 3. Проверьте наличие данных в базе

В Supabase Dashboard:
1. Откройте Table Editor
2. Выберите таблицу `equipment`
3. Проверьте, есть ли записи в таблице

Если таблицы нет или она пустая:
- Выполните SQL скрипт `supabase/schema.sql`
- Добавьте тестовые данные через SQL Editor:

```sql
INSERT INTO equipment (
  name,
  inventory_number,
  category,
  status
) VALUES (
  'Тестовый компьютер',
  'INV-001',
  'computer',
  'in_stock'
);
```

## 4. Проверьте RLS политики

Убедитесь, что политики Row Level Security позволяют читать данные:

```sql
-- Проверьте текущие политики
SELECT * FROM pg_policies WHERE tablename = 'equipment';

-- Если политики отсутствуют, выполните из schema.sql:
-- CREATE POLICY "Everyone can view equipment" ON equipment FOR SELECT USING (true);
```

## 5. Проверьте переменные окружения

Убедитесь, что `.env` файл содержит правильные значения:
```
VITE_SUPABASE_URL=ваш_url
VITE_SUPABASE_ANON_KEY=ваш_key
```

## 6. Проверьте права пользователя

Убедитесь, что вы авторизованы и у вас есть права на просмотр оборудования:
- Администратор и ИТ-специалист могут видеть всё оборудование
- Обычный сотрудник может видеть только своё оборудование (если такая политика настроена)

## 7. Временное решение для отладки

Если проблема сохраняется, временно упростите запрос для проверки базовой функциональности:

Откройте `src/services/equipment.service.ts` и временно замените метод `getEquipment` на:

```typescript
async getEquipment(filters?: EquipmentFilters, page = 1, pageSize = 20): Promise<EquipmentListResponse> {
  try {
    const { data, error, count } = await supabase
      .from('equipment')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) {
      console.error('Ошибка:', error);
      return { data: [], count: 0, error };
    }

    return {
      data: (data || []) as Equipment[],
      count: count || 0,
      error: null,
    };
  } catch (error) {
    console.error('Исключение:', error);
    return { data: [], count: 0, error: error as Error };
  }
}
```

Это поможет определить, в чём именно проблема - в запросе, фильтрах или загрузке связанных данных.




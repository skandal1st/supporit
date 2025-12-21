import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Получить список заявок
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      priority,
      category,
      location_department,
      location_room,
      page = '1',
      pageSize = '20',
    } = req.query;

    let query = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (priority) {
      paramCount++;
      query += ` AND priority = $${paramCount}`;
      params.push(priority);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (location_department) {
      paramCount++;
      query += ` AND location_department = $${paramCount}`;
      params.push(location_department);
    }

    if (location_room) {
      paramCount++;
      query += ` AND location_room = $${paramCount}`;
      params.push(location_room);
    }

    // Для обычных сотрудников показываем только их заявки
    if (req.userRole === 'employee') {
      paramCount++;
      query += ` AND creator_id = $${paramCount}`;
      params.push(req.userId);
    }

    // Подсчет общего количества
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Пагинация
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSizeNum, offset);

    const result = await pool.query(query, params);
    const tickets = result.rows;

    // Загружаем связанные данные
    const creatorIds = Array.from(new Set(tickets.map((t: any) => t.creator_id).filter(Boolean)));
    const assigneeIds = Array.from(new Set(tickets.map((t: any) => t.assignee_id).filter(Boolean)));
    const equipmentIds = Array.from(new Set(tickets.map((t: any) => t.equipment_id).filter(Boolean)));

    let creatorsMap = new Map();
    let assigneesMap = new Map();
    let equipmentMap = new Map();

    if (creatorIds.length > 0) {
      const creatorsResult = await pool.query(
        'SELECT id, email, full_name, department FROM users WHERE id = ANY($1)',
        [creatorIds]
      );
      creatorsMap = new Map(creatorsResult.rows.map((u: any) => [u.id, u]));
    }

    if (assigneeIds.length > 0) {
      const assigneesResult = await pool.query(
        'SELECT id, email, full_name, department FROM users WHERE id = ANY($1)',
        [assigneeIds]
      );
      assigneesMap = new Map(assigneesResult.rows.map((u: any) => [u.id, u]));
    }

    if (equipmentIds.length > 0) {
      const equipmentResult = await pool.query(
        'SELECT id, name, model, inventory_number, category FROM equipment WHERE id = ANY($1)',
        [equipmentIds]
      );
      equipmentMap = new Map(equipmentResult.rows.map((e: any) => [e.id, e]));
    }

    // Загружаем выбранные расходники для всех тикетов
    const ticketIds = tickets.map((t: any) => t.id);
    let selectedConsumablesMap = new Map();
    
    if (ticketIds.length > 0) {
      const selectedConsumablesResult = await pool.query(
        'SELECT ticket_id, consumable_id FROM ticket_consumables WHERE ticket_id = ANY($1)',
        [ticketIds]
      );
      
      selectedConsumablesMap = new Map();
      selectedConsumablesResult.rows.forEach((row: any) => {
        if (!selectedConsumablesMap.has(row.ticket_id)) {
          selectedConsumablesMap.set(row.ticket_id, []);
        }
        selectedConsumablesMap.get(row.ticket_id).push(row.consumable_id);
      });
    }

    // Добавляем связанные данные
    const ticketsWithRelations = tickets.map((ticket: any) => ({
      ...ticket,
      creator: creatorsMap.get(ticket.creator_id) || null,
      assignee: assigneesMap.get(ticket.assignee_id) || null,
      equipment: equipmentMap.get(ticket.equipment_id) || null,
      selected_consumables: selectedConsumablesMap.get(ticket.id) || [],
    }));

    res.json({
      data: ticketsWithRelations,
      count: totalCount,
    });
  } catch (error) {
    console.error('Ошибка получения заявок:', error);
    res.status(500).json({ error: 'Ошибка при получении заявок' });
  }
});

// Получить заявку по ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const ticket = result.rows[0];

    // Проверка прав доступа
    if (req.userRole === 'employee' && ticket.creator_id !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    // Загружаем связанные данные
    const [creator, assignee, equipment] = await Promise.all([
      ticket.creator_id ? pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.creator_id]) : Promise.resolve({ rows: [] }),
      ticket.assignee_id ? pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.assignee_id]) : Promise.resolve({ rows: [] }),
      ticket.equipment_id ? pool.query('SELECT * FROM equipment WHERE id = $1', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
    ]);

    // Загружаем расходники для оборудования, если оно указано
    let consumables = [];
    if (ticket.equipment_id) {
      const consumablesResult = await pool.query(
        'SELECT * FROM get_consumables_for_equipment($1)',
        [ticket.equipment_id]
      );
      consumables = consumablesResult.rows;
    }

    // Загружаем выбранные расходники
    const selectedConsumablesResult = await pool.query(
      'SELECT consumable_id FROM ticket_consumables WHERE ticket_id = $1',
      [id]
    );

    res.json({
      data: {
        ...ticket,
        creator: creator.rows[0] || null,
        assignee: assignee.rows[0] || null,
        equipment: equipment.rows[0] || null,
        consumables,
        selected_consumables: selectedConsumablesResult.rows.map((r: any) => r.consumable_id),
      },
    });
  } catch (error) {
    console.error('Ошибка получения заявки:', error);
    res.status(500).json({ error: 'Ошибка при получении заявки' });
  }
});

// Создать заявку
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      title,
      description,
      category,
      priority,
      equipment_id,
      location_department,
      location_room,
      desired_resolution_date,
      selected_consumables,
    } = req.body;

    if (!title || !description || !category) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Заголовок, описание и категория обязательны' });
    }

    const result = await client.query(
      `INSERT INTO tickets (
        title, description, category, priority, creator_id, equipment_id,
        location_department, location_room, desired_resolution_date,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        title,
        description,
        category,
        priority || 'medium',
        req.userId,
        equipment_id || null,
        location_department || null,
        location_room || null,
        desired_resolution_date || null,
      ]
    );

    const ticket = result.rows[0];

    // Сохраняем выбранные расходники
    if (selected_consumables && Array.isArray(selected_consumables) && selected_consumables.length > 0) {
      for (const consumableId of selected_consumables) {
        await client.query(
          `INSERT INTO ticket_consumables (ticket_id, consumable_id, quantity)
           VALUES ($1, $2, 1)
           ON CONFLICT (ticket_id, consumable_id) DO NOTHING`,
          [ticket.id, consumableId]
        );
      }
    }

    await client.query('COMMIT');

    // Загружаем связанные данные
    const [creator, equipment, consumables] = await Promise.all([
      pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.creator_id]),
      ticket.equipment_id ? pool.query('SELECT * FROM equipment WHERE id = $1', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
      ticket.equipment_id ? pool.query('SELECT * FROM get_consumables_for_equipment($1)', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
    ]);

    // Загружаем выбранные расходники
    const selectedConsumablesResult = await pool.query(
      'SELECT consumable_id FROM ticket_consumables WHERE ticket_id = $1',
      [ticket.id]
    );

    res.status(201).json({
      data: {
        ...ticket,
        creator: creator.rows[0] || null,
        assignee: null,
        equipment: equipment.rows[0] || null,
        consumables: consumables.rows || [],
        selected_consumables: selectedConsumablesResult.rows.map((r: any) => r.consumable_id),
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Ошибка создания заявки:', error);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  } finally {
    client.release();
  }
});

// Обновить заявку
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  // Проверяем существование заявки и права доступа
  const existingResult = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
  if (existingResult.rows.length === 0) {
    return res.status(404).json({ error: 'Заявка не найдена' });
  }

  const existingTicket = existingResult.rows[0];

  // Обычные сотрудники могут обновлять только свои заявки и только определенные поля
  if (req.userRole === 'employee') {
    if (existingTicket.creator_id !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }
    // Удаляем поля, которые сотрудники не могут изменять
    delete updates.status;
    delete updates.assignee_id;
    delete updates.priority;
    delete updates.resolved_at;
    delete updates.closed_at;
  }

  // Извлекаем selected_consumables из updates, если они есть
  const selectedConsumables = updates.selected_consumables;
  delete updates.selected_consumables;

  // Формируем динамический запрос
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  const allowedFields = [
    'title', 'description', 'category', 'priority', 'status',
    'assignee_id', 'equipment_id', 'location_department', 'location_room',
    'desired_resolution_date', 'resolved_at', 'closed_at', 'rating', 'rating_comment'
  ];

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      paramCount++;
      // Для дат разрешаем null значения
      if (key === 'resolved_at' || key === 'closed_at' || key === 'desired_resolution_date') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key] === null || updates[key] === '' ? null : updates[key]);
      } else {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    }
  });

  if (fields.length === 0 && !selectedConsumables) {
    return res.status(400).json({ error: 'Нет полей для обновления' });
  }

  const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Обновляем тикет, если есть поля для обновления
      if (fields.length > 0) {
        fields.push(`updated_at = NOW()`);
        paramCount++;
        values.push(id);

        const query = `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        const result = await client.query(query, values);
        
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Заявка не найдена' });
        }
      } else {
        // Если нет полей для обновления, просто получаем тикет
        const result = await client.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (result.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Заявка не найдена' });
        }
      }

      // Обновляем выбранные расходники, если они указаны
      if (selectedConsumables !== undefined) {
        // Удаляем старые записи
        await client.query('DELETE FROM ticket_consumables WHERE ticket_id = $1', [id]);
        
        // Добавляем новые записи
        if (Array.isArray(selectedConsumables) && selectedConsumables.length > 0) {
          for (const consumableId of selectedConsumables) {
            await client.query(
              `INSERT INTO ticket_consumables (ticket_id, consumable_id, quantity)
               VALUES ($1, $2, 1)
               ON CONFLICT (ticket_id, consumable_id) DO NOTHING`,
              [id, consumableId]
            );
          }
        }
      }

      await client.query('COMMIT');

      // Получаем обновленный тикет
      const ticketResult = await client.query('SELECT * FROM tickets WHERE id = $1', [id]);
      const ticket = ticketResult.rows[0];

      // Проверяем, изменился ли статус на closed или resolved
      const oldStatus = existingTicket.status;
      const newStatus = ticket.status;
      const statusChangedToClosedOrResolved = 
        (newStatus === 'closed' || newStatus === 'resolved') && 
        oldStatus !== 'closed' && 
        oldStatus !== 'resolved';

      // Если статус изменился на closed/resolved и есть оборудование, списываем расходники
      if (statusChangedToClosedOrResolved && ticket.equipment_id) {
        try {
          // Получаем выбранные расходники из тикета
          const selectedConsumablesResult = await pool.query(
            'SELECT consumable_id FROM ticket_consumables WHERE ticket_id = $1',
            [ticket.id]
          );

          const selectedConsumableIds = selectedConsumablesResult.rows.map((r: any) => r.consumable_id);

          // Если есть выбранные расходники, используем их, иначе используем все расходники оборудования
          let consumablesToIssue;
          if (selectedConsumableIds.length > 0) {
            // Получаем информацию о выбранных расходниках
            const consumablesResult = await pool.query(
              `SELECT c.*, ec.quantity_per_unit 
               FROM consumables c
               JOIN equipment_consumables ec ON c.id = ec.consumable_id
               WHERE c.id = ANY($1) AND ec.equipment_id = $2`,
              [selectedConsumableIds, ticket.equipment_id]
            );
            consumablesToIssue = consumablesResult.rows.map((row: any) => ({
              consumable_id: row.id,
              consumable_name: row.name,
              quantity_per_unit: row.quantity_per_unit || 1,
            }));
          } else {
            // Если расходники не выбраны, используем все расходники оборудования
            const consumablesResult = await pool.query(
              'SELECT * FROM get_consumables_for_equipment($1)',
              [ticket.equipment_id]
            );
            consumablesToIssue = consumablesResult.rows;
          }

          if (consumablesToIssue.length > 0) {
            // Получаем информацию о владельце оборудования (кому выдать)
            const equipmentResult = await pool.query(
              'SELECT current_owner_id FROM equipment WHERE id = $1',
              [ticket.equipment_id]
            );
            const equipmentOwnerId = equipmentResult.rows[0]?.current_owner_id || ticket.creator_id;

            // Определяем, кто выдал (assignee или текущий пользователь)
            const issuedById = ticket.assignee_id || req.userId;

            // Используем отдельный клиент для транзакции списания расходников
            const consumableClient = await pool.connect();
            try {
              await consumableClient.query('BEGIN');

              // Создаем записи о выдаче расходников
              for (const consumable of consumablesToIssue) {
                const quantityToIssue = consumable.quantity_per_unit || 1;
                
                // Проверяем и обновляем количество на складе атомарно
                const checkResult = await consumableClient.query(
                  `SELECT quantity_in_stock FROM consumables WHERE id = $1 FOR UPDATE`,
                  [consumable.consumable_id]
                );
                
                if (checkResult.rows.length === 0) {
                  console.warn(`Расходник не найден: ${consumable.consumable_id} (заявка ${ticket.id})`);
                  continue;
                }
                
                const currentStock = checkResult.rows[0].quantity_in_stock;
                
                if (currentStock >= quantityToIssue) {
                  // Создаем запись в consumable_issues
                  await consumableClient.query(
                    `INSERT INTO consumable_issues (
                      consumable_id, quantity, issued_to_id, issued_by_id, reason, created_at
                    ) VALUES ($1, $2, $3, $4, $5, NOW())`,
                    [
                      consumable.consumable_id,
                      quantityToIssue,
                      equipmentOwnerId,
                      issuedById,
                      `Заявка #${ticket.id}: ${ticket.title}`
                    ]
                  );

                  // Уменьшаем количество на складе
                  await consumableClient.query(
                    `UPDATE consumables 
                     SET quantity_in_stock = quantity_in_stock - $1, updated_at = NOW()
                     WHERE id = $2`,
                    [quantityToIssue, consumable.consumable_id]
                  );
                } else {
                  console.warn(`Недостаточно расходников на складе: ${consumable.consumable_name || consumable.consumable_id} (текущий остаток: ${currentStock}, требуется: ${quantityToIssue}) (заявка ${ticket.id})`);
                }
              }
              
              await consumableClient.query('COMMIT');
            } catch (txError: any) {
              await consumableClient.query('ROLLBACK');
              console.error('Ошибка при списании расходников:', txError);
              // Не прерываем выполнение, просто логируем ошибку
            } finally {
              consumableClient.release();
            }
          }
        } catch (consumableError: any) {
          console.error('Ошибка при списании расходников:', consumableError);
          // Не прерываем выполнение, просто логируем ошибку
        }
      }

      // Загружаем связанные данные
      const [creator, assignee, equipment, consumables] = await Promise.all([
        pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.creator_id]),
        ticket.assignee_id ? pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.assignee_id]) : Promise.resolve({ rows: [] }),
        ticket.equipment_id ? pool.query('SELECT * FROM equipment WHERE id = $1', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
        ticket.equipment_id ? pool.query('SELECT * FROM get_consumables_for_equipment($1)', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
      ]);

      // Загружаем выбранные расходники
      const selectedConsumablesResult = await pool.query(
        'SELECT consumable_id FROM ticket_consumables WHERE ticket_id = $1',
        [id]
      );

      res.json({
        data: {
          ...ticket,
          creator: creator.rows[0] || null,
          assignee: assignee.rows[0] || null,
          equipment: equipment.rows[0] || null,
          consumables: consumables.rows || [],
          selected_consumables: selectedConsumablesResult.rows.map((r: any) => r.consumable_id),
        },
      });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Ошибка обновления заявки:', error);
      res.status(500).json({ error: 'Ошибка при обновлении заявки' });
    } finally {
      client.release();
    }
});

// Удалить заявку
router.delete('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM tickets WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({ message: 'Заявка удалена' });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    res.status(500).json({ error: 'Ошибка при удалении заявки' });
  }
});

export default router;


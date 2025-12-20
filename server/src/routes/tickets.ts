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
    const creatorIds = [...new Set(tickets.map((t: any) => t.creator_id).filter(Boolean))];
    const assigneeIds = [...new Set(tickets.map((t: any) => t.assignee_id).filter(Boolean))];
    const equipmentIds = [...new Set(tickets.map((t: any) => t.equipment_id).filter(Boolean))];

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

    // Добавляем связанные данные
    const ticketsWithRelations = tickets.map((ticket: any) => ({
      ...ticket,
      creator: creatorsMap.get(ticket.creator_id) || null,
      assignee: assigneesMap.get(ticket.assignee_id) || null,
      equipment: equipmentMap.get(ticket.equipment_id) || null,
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

    res.json({
      data: {
        ...ticket,
        creator: creator.rows[0] || null,
        assignee: assignee.rows[0] || null,
        equipment: equipment.rows[0] || null,
        consumables,
      },
    });
  } catch (error) {
    console.error('Ошибка получения заявки:', error);
    res.status(500).json({ error: 'Ошибка при получении заявки' });
  }
});

// Создать заявку
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      category,
      priority,
      equipment_id,
      location_department,
      location_room,
      desired_resolution_date,
    } = req.body;

    if (!title || !description || !category) {
      return res.status(400).json({ error: 'Заголовок, описание и категория обязательны' });
    }

    const result = await pool.query(
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

    // Загружаем связанные данные
    const [creator, equipment, consumables] = await Promise.all([
      pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.creator_id]),
      ticket.equipment_id ? pool.query('SELECT * FROM equipment WHERE id = $1', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
      ticket.equipment_id ? pool.query('SELECT * FROM get_consumables_for_equipment($1)', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
    ]);

    res.status(201).json({
      data: {
        ...ticket,
        creator: creator.rows[0] || null,
        assignee: null,
        equipment: equipment.rows[0] || null,
        consumables: consumables.rows || [],
      },
    });
  } catch (error: any) {
    console.error('Ошибка создания заявки:', error);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  }
});

// Обновить заявку
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
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

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    fields.push(`updated_at = NOW()`);
    paramCount++;
    values.push(id);

    const query = `UPDATE tickets SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);
    const ticket = result.rows[0];

    // Загружаем связанные данные
    const [creator, assignee, equipment, consumables] = await Promise.all([
      pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.creator_id]),
      ticket.assignee_id ? pool.query('SELECT id, email, full_name, department FROM users WHERE id = $1', [ticket.assignee_id]) : Promise.resolve({ rows: [] }),
      ticket.equipment_id ? pool.query('SELECT * FROM equipment WHERE id = $1', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
      ticket.equipment_id ? pool.query('SELECT * FROM get_consumables_for_equipment($1)', [ticket.equipment_id]) : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      data: {
        ...ticket,
        creator: creator.rows[0] || null,
        assignee: assignee.rows[0] || null,
        equipment: equipment.rows[0] || null,
        consumables: consumables.rows || [],
      },
    });
  } catch (error: any) {
    console.error('Ошибка обновления заявки:', error);
    res.status(500).json({ error: 'Ошибка при обновлении заявки' });
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


import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Получить список зданий (только активные для всех, все для админов)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { active } = req.query;
    const user = req.user;

    let query = 'SELECT * FROM buildings WHERE 1=1';
    const params: any[] = [];

    // Если не админ, показываем только активные здания
    // Если запрошены только активные, показываем только их
    if (active === 'true' || user?.role !== 'admin') {
      query += ' AND is_active = true';
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error('Ошибка получения зданий:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      table: error.table,
    });
    
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: 'Таблица buildings не существует. Необходимо применить миграцию БД.',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при получении зданий',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Получить здание по ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM buildings WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Здание не найдено' });
    }

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка получения здания:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: 'Таблица buildings не существует. Необходимо применить миграцию БД.',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при получении здания',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Создать здание (только админ и IT-специалист)
router.post('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      address,
      description,
      is_active = true,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Название здания обязательно' });
    }

    // Проверяем на дубликаты
    const checkResult = await pool.query(
      'SELECT id FROM buildings WHERE name = $1',
      [name.trim()]
    );

    if (checkResult.rows.length > 0) {
      return res.status(400).json({ error: 'Здание с таким названием уже существует' });
    }

    const result = await pool.query(
      `INSERT INTO buildings (name, address, description, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING *`,
      [
        name.trim(),
        address?.trim() || null,
        description?.trim() || null,
        is_active,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка создания здания:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      stack: error.stack,
    });
    
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: 'Таблица buildings не существует. Необходимо применить миграцию БД.',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Здание с таким названием уже существует' });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при создании здания',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
      detail: process.env.NODE_ENV === 'development' ? error.detail : undefined
    });
  }
});

// Обновить здание (только админ и IT-специалист)
router.put('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      address,
      description,
      is_active,
    } = req.body;

    // Проверяем существование здания
    const existingResult = await pool.query('SELECT * FROM buildings WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Здание не найдено' });
    }

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Название здания не может быть пустым' });
    }

    // Если изменяется название, проверяем на дубликаты
    if (name && name.trim() !== existingResult.rows[0].name) {
      const checkResult = await pool.query(
        'SELECT id FROM buildings WHERE name = $1 AND id != $2',
        [name.trim(), id]
      );

      if (checkResult.rows.length > 0) {
        return res.status(400).json({ error: 'Здание с таким названием уже существует' });
      }
    }

    const updateFields: string[] = [];
    const params: any[] = [];
    let paramCount = 0;

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      params.push(name.trim());
    }

    if (address !== undefined) {
      paramCount++;
      updateFields.push(`address = $${paramCount}`);
      params.push(address?.trim() || null);
    }

    if (description !== undefined) {
      paramCount++;
      updateFields.push(`description = $${paramCount}`);
      params.push(description?.trim() || null);
    }

    if (is_active !== undefined) {
      paramCount++;
      updateFields.push(`is_active = $${paramCount}`);
      params.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.json({ data: existingResult.rows[0] });
    }

    paramCount++;
    updateFields.push(`updated_at = NOW()`);
    paramCount++;
    params.push(id);
    updateFields.push(`id = $${paramCount}`);

    const query = `UPDATE buildings SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, params);

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка обновления здания:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: 'Таблица buildings не существует. Необходимо применить миграцию БД.',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Здание с таким названием уже существует' });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при обновлении здания',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Удалить здание (только админ)
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Проверяем, используется ли здание в оборудовании или заявках
    const equipmentCheck = await pool.query(
      'SELECT COUNT(*) as count FROM equipment WHERE location_department IN (SELECT name FROM buildings WHERE id = $1)',
      [id]
    );

    const ticketsCheck = await pool.query(
      'SELECT COUNT(*) as count FROM tickets WHERE location_department IN (SELECT name FROM buildings WHERE id = $1)',
      [id]
    );

    const equipmentCount = parseInt(equipmentCheck.rows[0].count);
    const ticketsCount = parseInt(ticketsCheck.rows[0].count);

    if (equipmentCount > 0 || ticketsCount > 0) {
      return res.status(400).json({ 
        error: `Невозможно удалить здание: оно используется в ${equipmentCount} единицах оборудования и ${ticketsCount} заявках. Сначала деактивируйте здание.` 
      });
    }

    const result = await pool.query('DELETE FROM buildings WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Здание не найдено' });
    }

    res.json({ data: result.rows[0], message: 'Здание успешно удалено' });
  } catch (error: any) {
    console.error('Ошибка удаления здания:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    
    if (error.code === '42P01') {
      return res.status(500).json({ 
        error: 'Таблица buildings не существует. Необходимо применить миграцию БД.',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при удалении здания',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;


import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Получить список расходников
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, page = '1', pageSize = '20' } = req.query;

    let query = 'SELECT * FROM consumables WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR model ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    // Подсчет общего количества
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Пагинация
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    query += ` ORDER BY name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSizeNum, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: totalCount,
    });
  } catch (error) {
    console.error('Ошибка получения расходников:', error);
    res.status(500).json({ error: 'Ошибка при получении расходников' });
  }
});

// Получить расходник по ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM consumables WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Расходник не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения расходника:', error);
    res.status(500).json({ error: 'Ошибка при получении расходника' });
  }
});

// Создать расходник
router.post('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      model,
      category,
      unit = 'шт',
      quantity_in_stock = 0,
      min_quantity = 0,
      cost_per_unit,
      supplier,
      last_purchase_date,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO consumables (
        name, model, category, unit, quantity_in_stock, min_quantity,
        cost_per_unit, supplier, last_purchase_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        name,
        model || null,
        category || null,
        unit,
        quantity_in_stock,
        min_quantity,
        cost_per_unit || null,
        supplier || null,
        last_purchase_date || null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка создания расходника:', error);
    res.status(500).json({ 
      error: 'Ошибка при создании расходника',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Обновить расходник
router.put('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'model', 'category', 'unit', 'quantity_in_stock', 'min_quantity',
      'cost_per_unit', 'supplier', 'last_purchase_date'
    ];

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        paramCount++;
        if (key === 'quantity_in_stock' || key === 'min_quantity') {
          const value = updates[key];
          if (value === null || value === undefined || value === '') {
            fields.push(`${key} = $${paramCount}::integer`);
            values.push(0);
          } else {
            const numValue = parseFloat(String(value));
            fields.push(`${key} = $${paramCount}::integer`);
            values.push(isNaN(numValue) ? 0 : Math.round(numValue));
          }
        } else if (key === 'cost_per_unit') {
          const value = updates[key];
          if (value === null || value === undefined || value === '') {
            fields.push(`${key} = $${paramCount}::numeric`);
            values.push(null);
          } else {
            const numValue = parseFloat(String(value));
            fields.push(`${key} = $${paramCount}::numeric`);
            values.push(isNaN(numValue) ? null : numValue);
          }
        } else if (key === 'last_purchase_date') {
          fields.push(`${key} = $${paramCount}::date`);
          values.push(updates[key] && updates[key] !== '' ? updates[key] : null);
        } else {
          fields.push(`${key} = $${paramCount}::text`);
          values.push(updates[key] && updates[key] !== '' ? updates[key] : null);
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    fields.push(`updated_at = NOW()`);
    paramCount++;
    values.push(id);

    const query = `UPDATE consumables SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Расходник не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка обновления расходника:', error);
    res.status(500).json({ 
      error: 'Ошибка при обновлении расходника',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Удалить расходник
router.delete('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM consumables WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Расходник не найден' });
    }

    res.json({ message: 'Расходник удален' });
  } catch (error: any) {
    console.error('Ошибка удаления расходника:', error);
    
    // Проверка на внешние ключи
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Невозможно удалить расходник: он используется в системе' 
      });
    }

    res.status(500).json({ error: 'Ошибка при удалении расходника' });
  }
});

export default router;


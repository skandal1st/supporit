import { Router, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Генерация 6-значного кода
function generateLinkCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/telegram/generate-link-code - Генерация кода привязки
router.post(
  '/generate-link-code',
  authenticate,
  requireRole('admin', 'it_specialist'),
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId;

      // Проверяем, не привязан ли уже Telegram
      const userResult = await pool.query(
        `SELECT telegram_id FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      if (userResult.rows[0].telegram_id) {
        return res.status(400).json({
          error: 'Telegram уже привязан',
          message: 'Сначала отвяжите текущий аккаунт',
        });
      }

      // Удаляем старые неиспользованные коды для этого пользователя
      await pool.query(
        `DELETE FROM telegram_link_codes WHERE user_id = $1 AND used_at IS NULL`,
        [userId]
      );

      // Генерируем новый код
      const code = generateLinkCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

      await pool.query(
        `INSERT INTO telegram_link_codes (user_id, code, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, code, expiresAt]
      );

      res.json({
        code,
        expires_at: expiresAt.toISOString(),
        instructions: `Отправьте команду /link ${code} боту @SupporITBot`,
      });
    } catch (error) {
      console.error('[Telegram API] Ошибка генерации кода:', error);
      res.status(500).json({ error: 'Ошибка генерации кода привязки' });
    }
  }
);

// GET /api/telegram/status - Статус привязки
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    const result = await pool.query(
      `SELECT telegram_id, telegram_username, telegram_linked_at, telegram_notifications
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = result.rows[0];

    res.json({
      linked: !!user.telegram_id,
      telegram_id: user.telegram_id,
      telegram_username: user.telegram_username,
      linked_at: user.telegram_linked_at,
      notifications_enabled: user.telegram_notifications,
    });
  } catch (error) {
    console.error('[Telegram API] Ошибка получения статуса:', error);
    res.status(500).json({ error: 'Ошибка получения статуса' });
  }
});

// POST /api/telegram/unlink - Отвязка Telegram
router.post('/unlink', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;

    await pool.query(
      `UPDATE users
       SET telegram_id = NULL,
           telegram_username = NULL,
           telegram_linked_at = NULL,
           telegram_notifications = false
       WHERE id = $1`,
      [userId]
    );

    res.json({ success: true, message: 'Telegram успешно отвязан' });
  } catch (error) {
    console.error('[Telegram API] Ошибка отвязки:', error);
    res.status(500).json({ error: 'Ошибка отвязки Telegram' });
  }
});

// PUT /api/telegram/settings - Настройки уведомлений
router.put('/settings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { notifications_enabled } = req.body;

    if (typeof notifications_enabled !== 'boolean') {
      return res.status(400).json({ error: 'Параметр notifications_enabled должен быть boolean' });
    }

    await pool.query(
      `UPDATE users SET telegram_notifications = $1 WHERE id = $2`,
      [notifications_enabled, userId]
    );

    res.json({
      success: true,
      notifications_enabled,
    });
  } catch (error) {
    console.error('[Telegram API] Ошибка обновления настроек:', error);
    res.status(500).json({ error: 'Ошибка обновления настроек' });
  }
});

export default router;

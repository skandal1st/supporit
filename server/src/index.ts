import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.js';
import equipmentRoutes from './routes/equipment.js';
import usersRoutes from './routes/users.js';
import ticketsRoutes from './routes/tickets.js';
import ticketCommentsRoutes from './routes/ticket-comments.js';
import consumablesRoutes from './routes/consumables.js';
import buildingsRoutes from './routes/buildings.js';
import zabbixRoutes from './routes/zabbix.js';
import dictionariesRoutes from './routes/dictionaries.js';
import settingsRoutes from './routes/settings.js';
import notificationsRoutes from './routes/notifications.js';
import licensesRoutes from './routes/licenses.js';
import telegramRoutes from './routes/telegram.js';
import { pool } from './config/database.js';
import { startEmailCron } from './services/email-cron.service.js';
import { verifySmtpConnection } from './services/email-sender.service.js';
import { initTelegramBot, stopTelegramBot } from './telegram/bot.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Статические файлы для загруженных вложений
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/ticket-comments', ticketCommentsRoutes);
app.use('/api/consumables', consumablesRoutes);
app.use('/api/buildings', buildingsRoutes);
app.use('/api/zabbix', zabbixRoutes);
app.use('/api/dictionaries', dictionariesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/licenses', licensesRoutes);
app.use('/api/telegram', telegramRoutes);

// Health check
app.get('/health', async (req, res) => {
  try {
    // Проверяем подключение к БД
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'error', 
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString() 
    });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);

  // Проверка SMTP соединения
  if (process.env.SMTP_ENABLED === 'true') {
    const smtpOk = await verifySmtpConnection();
    if (smtpOk) {
      console.log('📧 SMTP соединение установлено');
    } else {
      console.warn('⚠️  SMTP соединение не установлено (проверьте настройки в .env)');
    }
  }

  // Запуск email-приемника (cron для проверки писем)
  if (process.env.EMAIL_RECEIVER_ENABLED === 'true') {
    startEmailCron();
    console.log('📬 Email-приемник запущен');
  }

  // Запуск Telegram бота
  if (process.env.TELEGRAM_BOT_ENABLED === 'true') {
    const bot = await initTelegramBot();
    if (bot) {
      console.log('🤖 Telegram бот запущен');
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⏹️  Получен сигнал SIGTERM, завершаем работу...');
  await stopTelegramBot();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('⏹️  Получен сигнал SIGINT, завершаем работу...');
  await stopTelegramBot();
  process.exit(0);
});


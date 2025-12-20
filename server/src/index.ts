import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import equipmentRoutes from './routes/equipment.js';
import usersRoutes from './routes/users.js';
import ticketsRoutes from './routes/tickets.js';
import consumablesRoutes from './routes/consumables.js';
import buildingsRoutes from './routes/buildings.js';
import { pool } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/consumables', consumablesRoutes);
app.use('/api/buildings', buildingsRoutes);

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

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
});


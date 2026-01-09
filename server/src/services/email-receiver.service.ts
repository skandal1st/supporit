/**
 * Email Receiver Service
 * Получает письма через IMAP и создает тикеты
 */

import Imap from 'imap';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import { pool } from '../config/database.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

// Типы
interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface ParsedTicketData {
  from: string;
  subject: string;
  body: string;
  category: 'hardware' | 'software' | 'network' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
  attachments: string[];  // Пути к сохраненным файлам
}

// Конфигурация IMAP (все значения должны быть в .env)
const emailConfig: EmailConfig = {
  host: process.env.IMAP_HOST || '',
  port: parseInt(process.env.IMAP_PORT || '993'),
  user: process.env.IMAP_USER || '',
  password: process.env.IMAP_PASSWORD || '',
  tls: process.env.IMAP_TLS !== 'false', // по умолчанию true
};

/**
 * Проверка наличия обязательной конфигурации IMAP
 */
function validateImapConfig(): boolean {
  const missing: string[] = [];
  if (!emailConfig.host) missing.push('IMAP_HOST');
  if (!emailConfig.user) missing.push('IMAP_USER');
  if (!emailConfig.password) missing.push('IMAP_PASSWORD');

  if (missing.length > 0) {
    console.warn(`[Email Receiver] ⚠️ IMAP не настроен. Отсутствуют: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

// Директория для вложений
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads', 'tickets');

/**
 * Основная функция для проверки новых писем
 */
export async function checkNewEmails(): Promise<void> {
  console.log('[Email Receiver] Проверка новых писем...');

  if (!validateImapConfig()) {
    console.error('[Email Receiver] IMAP не настроен, пропускаем проверку писем');
    return;
  }

  const imap = new Imap({
    user: emailConfig.user,
    password: emailConfig.password,
    host: emailConfig.host,
    port: emailConfig.port,
    tls: emailConfig.tls,
    tlsOptions: { rejectUnauthorized: false },
  });

  return new Promise((resolve, reject) => {
    imap.once('ready', () => {
      imap.openBox('INBOX', false, async (err, box) => {
        if (err) {
          console.error('[Email Receiver] Ошибка открытия INBOX:', err);
          imap.end();
          return reject(err);
        }

        // Ищем непрочитанные письма
        imap.search(['UNSEEN'], async (err, results) => {
          if (err) {
            console.error('[Email Receiver] Ошибка поиска писем:', err);
            imap.end();
            return reject(err);
          }

          if (results.length === 0) {
            console.log('[Email Receiver] Новых писем нет');
            imap.end();
            return resolve();
          }

          console.log(`[Email Receiver] Найдено новых писем: ${results.length}`);

          const fetch = imap.fetch(results, { bodies: '', markSeen: true });

          fetch.on('message', (msg) => {
            msg.on('body', async (stream) => {
              try {
                const parsed = await simpleParser(stream);
                await processEmail(parsed);
              } catch (error) {
                console.error('[Email Receiver] Ошибка обработки письма:', error);
              }
            });
          });

          fetch.once('error', (err) => {
            console.error('[Email Receiver] Ошибка fetch:', err);
            reject(err);
          });

          fetch.once('end', () => {
            console.log('[Email Receiver] Обработка завершена');
            imap.end();
            resolve();
          });
        });
      });
    });

    imap.once('error', (err) => {
      console.error('[Email Receiver] IMAP ошибка:', err);
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Обработка одного письма
 */
async function processEmail(mail: ParsedMail): Promise<void> {
  console.log(`[Email Receiver] Обработка письма от: ${mail.from?.text}`);

  try {
    // Парсим данные
    const ticketData = await parseEmailToTicket(mail);

    // Создаем тикет
    await createTicketFromEmail(ticketData);
  } catch (error) {
    console.error('[Email Receiver] Ошибка при обработке письма:', error);
  }
}

/**
 * Парсинг письма в данные тикета
 */
async function parseEmailToTicket(mail: ParsedMail): Promise<ParsedTicketData> {
  // Извлекаем email отправителя
  const from = mail.from?.value[0]?.address || 'unknown@example.com';

  // Тема письма
  const subject = mail.subject || 'Без темы';

  // Тело письма (текст или HTML)
  const body = mail.text || mail.html || 'Нет содержимого';

  // Парсим категорию и приоритет из темы
  const { category, priority } = parseCategoryAndPriority(subject);

  // Обрабатываем вложения
  const attachmentPaths = await saveAttachments(mail.attachments || [], from);

  return {
    from,
    subject,
    body,
    category,
    priority,
    attachments: attachmentPaths,
  };
}

/**
 * Парсинг категории и приоритета из темы письма
 * Примеры:
 * "[Hardware][Critical] Не работает компьютер" → hardware, critical
 * "[Software] Проблема с 1С" → software, medium
 * "Срочно: Сломался принтер" → other, critical
 */
function parseCategoryAndPriority(subject: string): {
  category: 'hardware' | 'software' | 'network' | 'other';
  priority: 'low' | 'medium' | 'high' | 'critical';
} {
  const subjectLower = subject.toLowerCase();

  // Парсинг категории
  let category: 'hardware' | 'software' | 'network' | 'other' = 'other';

  if (/\[hardware\]|железо|оборудование|компьютер|принтер|монитор|клавиатура|мышь/i.test(subject)) {
    category = 'hardware';
  } else if (/\[software\]|по|программа|1с|софт|приложение/i.test(subject)) {
    category = 'software';
  } else if (/\[network\]|сеть|интернет|wi-?fi|роутер|свитч/i.test(subject)) {
    category = 'network';
  }

  // Парсинг приоритета
  let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';

  if (/\[critical\]|срочно|критично|авария|немедленно/i.test(subject)) {
    priority = 'critical';
  } else if (/\[high\]|важно|высокий/i.test(subject)) {
    priority = 'high';
  } else if (/\[low\]|низкий|несрочно/i.test(subject)) {
    priority = 'low';
  }

  return { category, priority };
}

/**
 * Сохранение вложений на диск
 */
async function saveAttachments(
  attachments: Attachment[],
  senderEmail: string
): Promise<string[]> {
  const savedPaths: string[] = [];

  // Создаем директорию для загрузок, если не существует
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  for (const attachment of attachments) {
    try {
      // Проверка типа файла (безопасность)
      if (!isAllowedFileType(attachment.filename || '')) {
        console.warn(`[Email Receiver] Пропущен небезопасный файл: ${attachment.filename}`);
        continue;
      }

      // Генерируем уникальное имя файла
      const ext = path.extname(attachment.filename || '');
      const filename = `${uuidv4()}${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Сохраняем файл (проверяем наличие content)
      if (!attachment.content) {
        console.warn(`[Email Receiver] Вложение ${attachment.filename} не имеет содержимого, пропущено`);
        continue;
      }
      await fs.writeFile(filepath, attachment.content);

      // Сохраняем относительный путь для базы данных
      savedPaths.push(`/uploads/tickets/${filename}`);

      console.log(`[Email Receiver] Сохранено вложение: ${filename} (${attachment.filename})`);
    } catch (error) {
      console.error(`[Email Receiver] Ошибка сохранения вложения ${attachment.filename}:`, error);
    }
  }

  return savedPaths;
}

/**
 * Проверка допустимых типов файлов
 */
function isAllowedFileType(filename: string): boolean {
  const allowedExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', // Изображения
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', // Документы Office
    '.txt', '.log', '.csv',                                     // Текстовые
    '.zip', '.rar', '.7z', '.tar', '.gz',                       // Архивы
  ];

  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Создание тикета из email
 */
async function createTicketFromEmail(data: ParsedTicketData): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Проверяем, существует ли пользователь с таким email
    const userResult = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [data.from]
    );

    let creatorId: string | null = null;
    let status: string;
    let emailSender: string | null = null;

    if (userResult.rows.length > 0) {
      // Случай A: Пользователь найден
      creatorId = userResult.rows[0].id;
      status = 'new';
      console.log(`[Email Receiver] Пользователь найден: ${data.from}`);
    } else {
      // Случай B: Пользователь не найден
      creatorId = null;
      status = 'pending_user';
      emailSender = data.from;
      console.log(`[Email Receiver] Пользователь не найден: ${data.from}, тикет требует привязки`);
    }

    // Создаем тикет
    const ticketResult = await client.query(
      `INSERT INTO tickets (
        title, description, category, priority, status,
        creator_id, email_sender, created_via, attachments,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        data.subject,
        data.body,
        data.category,
        data.priority,
        status,
        creatorId,
        emailSender,
        'email',
        data.attachments.length > 0 ? data.attachments : null,
      ]
    );

    await client.query('COMMIT');

    const ticket = ticketResult.rows[0];
    console.log(`[Email Receiver] ✅ Тикет создан: #${ticket.id.substring(0, 8)} (статус: ${status})`);
    console.log(`[Email Receiver]    Тема: ${data.subject}`);
    console.log(`[Email Receiver]    Категория: ${data.category}, Приоритет: ${data.priority}`);
    if (data.attachments.length > 0) {
      console.log(`[Email Receiver]    Вложения: ${data.attachments.length}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Email Receiver] Ошибка создания тикета:', error);
    throw error;
  } finally {
    client.release();
  }
}

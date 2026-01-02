/**
 * Email Sender Service
 * Отправка email-уведомлений через SMTP
 */

import nodemailer, { Transporter } from 'nodemailer';

// Конфигурация SMTP
const smtpConfig = {
  host: process.env.SMTP_HOST || 'mail.teplocentral.org',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' || false, // true для 465, false для других портов
  auth: {
    user: process.env.SMTP_USER || 'support@teplocentral.org',
    pass: process.env.SMTP_PASSWORD || '',
  },
};

// Email отправителя
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@teplocentral.org';
const FROM_NAME = process.env.FROM_NAME || 'SupporIT Support';

// Создаем транспортер
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig);
  }
  if (!transporter) {
    throw new Error('Failed to create SMTP transporter');
  }
  return transporter;
}

/**
 * Отправить email-уведомление о смене статуса тикета
 */
export async function sendTicketStatusEmail(
  toEmail: string,
  ticketId: string,
  ticketTitle: string,
  newStatus: string,
  assigneeName?: string
): Promise<void> {
  try {
    const subject = getEmailSubject(newStatus, ticketId);
    const html = getEmailTemplate(newStatus, ticketId, ticketTitle, assigneeName);

    await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject,
      html,
    });

    console.log(`[Email Sender] ✅ Отправлено уведомление на ${toEmail}`);
    console.log(`[Email Sender]    Тикет: #${ticketId.substring(0, 8)}, Статус: ${newStatus}`);
  } catch (error) {
    console.error(`[Email Sender] ❌ Ошибка отправки email на ${toEmail}:`, error);
    throw error;
  }
}

/**
 * Тема письма в зависимости от статуса
 */
function getEmailSubject(status: string, ticketId: string): string {
  const shortId = ticketId.substring(0, 8);

  switch (status) {
    case 'in_progress':
      return `Заявка #${shortId} принята в работу`;
    case 'resolved':
      return `Заявка #${shortId} решена`;
    case 'closed':
      return `Заявка #${shortId} закрыта`;
    default:
      return `Обновление статуса заявки #${shortId}`;
  }
}

/**
 * HTML-шаблон письма
 */
function getEmailTemplate(
  status: string,
  ticketId: string,
  ticketTitle: string,
  assigneeName?: string
): string {
  let message = '';
  let statusColor = '#3b82f6';
  let statusText = '';

  switch (status) {
    case 'in_progress':
      message = 'Ваша заявка принята в работу';
      statusText = 'В работе';
      statusColor = '#f59e0b';
      break;
    case 'resolved':
      message = 'Ваша заявка решена';
      statusText = 'Решена';
      statusColor = '#10b981';
      break;
    case 'closed':
      message = 'Ваша заявка закрыта';
      statusText = 'Закрыта';
      statusColor = '#6b7280';
      break;
    default:
      message = 'Статус вашей заявки изменен';
      statusText = status;
  }

  const shortId = ticketId.substring(0, 8);

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailSubject(status, ticketId)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <!-- Header -->
  <div style="background-color: ${statusColor}; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${message}</h1>
  </div>

  <!-- Content -->
  <div style="background-color: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Номер заявки:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="font-family: monospace; background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 14px;">#${shortId}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Название:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="font-size: 14px;">${ticketTitle}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Статус:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">${statusText}</span>
        </td>
      </tr>
      ${assigneeName ? `
      <tr>
        <td style="padding: 10px 0;">
          <strong style="color: #6b7280; font-size: 14px;">Исполнитель:</strong>
        </td>
        <td style="padding: 10px 0; text-align: right;">
          <span style="font-size: 14px;">${assigneeName}</span>
        </td>
      </tr>
      ` : ''}
    </table>

    <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid ${statusColor};">
      <p style="margin: 0; font-size: 14px; color: #4b5563;">
        ${status === 'in_progress'
          ? 'Наш специалист уже работает над решением вашей проблемы.'
          : status === 'resolved'
          ? 'Ваша проблема была успешно решена. Если у вас остались вопросы, пожалуйста, сообщите нам.'
          : 'Для просмотра деталей заявки, пожалуйста, войдите в систему SupporIT.'
        }
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 15px;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>⚠️ Важно:</strong> Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      © ${new Date().getFullYear()} SupporIT. Система управления IT-заявками.
    </p>
  </div>

</body>
</html>
  `;
}

/**
 * Проверка подключения к SMTP
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await getTransporter().verify();
    console.log('[Email Sender] ✅ SMTP соединение успешно установлено');
    return true;
  } catch (error) {
    console.error('[Email Sender] ❌ Ошибка SMTP соединения:', error);
    return false;
  }
}

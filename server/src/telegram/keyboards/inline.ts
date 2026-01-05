import { Markup } from 'telegraf';
import type { TicketStatus } from '../types.js';

export const mainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('📋 Активные заявки', 'tickets_list')],
  [Markup.button.callback('🔍 Мои заявки', 'my_tickets')],
  [Markup.button.callback('⚙️ Настройки', 'settings')],
]);

export const ticketsFilterKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('Все', 'tickets_filter_all'),
    Markup.button.callback('🔵 Новые', 'tickets_filter_new'),
  ],
  [
    Markup.button.callback('🟡 В работе', 'tickets_filter_in_progress'),
    Markup.button.callback('🟠 Ожидание', 'tickets_filter_waiting'),
  ],
  [Markup.button.callback('« Назад', 'main_menu')],
]);

export function ticketActionsKeyboard(ticketId: string, currentStatus: TicketStatus) {
  const buttons = [];

  // Кнопка "Взять в работу" только для новых заявок
  if (currentStatus === 'new') {
    buttons.push([Markup.button.callback('✅ Взять в работу', `ticket_take_${ticketId}`)]);
  }

  // Кнопки изменения статуса
  if (currentStatus !== 'closed' && currentStatus !== 'resolved') {
    buttons.push([Markup.button.callback('📊 Изменить статус', `ticket_status_${ticketId}`)]);
  }

  // Кнопка комментария
  buttons.push([Markup.button.callback('💬 Добавить комментарий', `ticket_comment_${ticketId}`)]);

  // Кнопка назад
  buttons.push([Markup.button.callback('« К списку заявок', 'tickets_list')]);

  return Markup.inlineKeyboard(buttons);
}

export function ticketStatusKeyboard(ticketId: string, currentStatus: TicketStatus) {
  const buttons = [];

  const statuses: Array<{ status: TicketStatus; label: string; emoji: string }> = [
    { status: 'new', label: 'Новая', emoji: '🔵' },
    { status: 'in_progress', label: 'В работе', emoji: '🟡' },
    { status: 'waiting', label: 'Ожидание', emoji: '🟠' },
    { status: 'resolved', label: 'Решена', emoji: '🟢' },
    { status: 'closed', label: 'Закрыта', emoji: '⚫' },
  ];

  for (const s of statuses) {
    if (s.status !== currentStatus) {
      buttons.push([
        Markup.button.callback(
          `${s.emoji} ${s.label}`,
          `ticket_set_status_${ticketId}_${s.status}`
        ),
      ]);
    }
  }

  buttons.push([Markup.button.callback('« Назад', `ticket_view_${ticketId}`)]);

  return Markup.inlineKeyboard(buttons);
}

export function ticketListKeyboard(tickets: Array<{ id: string; title: string }>, filter: string) {
  const buttons = tickets.map((t) => [
    Markup.button.callback(
      `#${t.id.slice(0, 8)} - ${t.title.slice(0, 30)}${t.title.length > 30 ? '...' : ''}`,
      `ticket_view_${t.id}`
    ),
  ]);

  buttons.push([Markup.button.callback('🔄 Обновить', `tickets_filter_${filter}`)]);
  buttons.push([Markup.button.callback('« Главное меню', 'main_menu')]);

  return Markup.inlineKeyboard(buttons);
}

export const settingsKeyboard = (notificationsEnabled: boolean) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        notificationsEnabled ? '🔔 Уведомления: Вкл' : '🔕 Уведомления: Выкл',
        'toggle_notifications'
      ),
    ],
    [Markup.button.callback('🔗 Отвязать аккаунт', 'unlink_account')],
    [Markup.button.callback('« Назад', 'main_menu')],
  ]);

export const confirmUnlinkKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback('✅ Да, отвязать', 'confirm_unlink'),
    Markup.button.callback('❌ Отмена', 'settings'),
  ],
]);

export function equipmentActionsKeyboard(equipmentId: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 Создать заявку', `equipment_create_ticket_${equipmentId}`)],
    [Markup.button.callback('📜 История', `equipment_history_${equipmentId}`)],
  ]);
}

export const cancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('❌ Отмена', 'cancel_action')],
]);

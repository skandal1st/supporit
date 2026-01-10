import { Telegraf } from "telegraf";
import type { BotContext } from "./types.js";
import { requireLinkedAccount } from "./middleware/auth.js";
import {
  handleStart,
  handleHelp,
  handleLink,
  handleTickets,
  handleTicketById,
  handleSettings,
} from "./handlers/commands.js";
import {
  handleMainMenu,
  handleTicketsList,
  handleMyTickets,
  showTicketDetails,
  handleTakeTicket,
  handleShowStatusMenu,
  handleSetStatus,
  handleCommentPrompt,
  showSettings,
  handleToggleNotifications,
  handleUnlinkPrompt,
  handleConfirmUnlink,
} from "./handlers/callbacks.js";
import {
  handlePhoto,
  handleEquipmentCreateTicket,
  handleEquipmentHistory,
} from "./handlers/photos.js";
import {
  handleTextMessage,
  handleCancelAction,
  setUserState,
} from "./handlers/messages.js";

let bot: Telegraf<BotContext> | null = null;

export async function initTelegramBot(): Promise<Telegraf<BotContext> | null> {
  console.log("[Telegram Bot] Инициализация бота...");

  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    console.log(
      "[Telegram Bot] TELEGRAM_BOT_TOKEN не установлен, бот отключён",
    );
    return null;
  }

  if (process.env.TELEGRAM_BOT_ENABLED !== "true") {
    console.log("[Telegram Bot] Бот отключён (TELEGRAM_BOT_ENABLED != true)");
    return null;
  }

  console.log("[Telegram Bot] Создание экземпляра Telegraf...");

  try {
    bot = new Telegraf<BotContext>(token);

    // Инициализируем state
    bot.use((ctx: BotContext, next: () => Promise<void>) => {
      ctx.state = ctx.state || {};
      return next();
    });

    // Публичные команды (без авторизации)
    bot.command("start", handleStart);
    bot.command("help", handleHelp);
    bot.command("link", handleLink);

    // Защищённые команды (требуют привязки аккаунта)
    bot.command("tickets", requireLinkedAccount, handleTickets);
    bot.command("ticket", requireLinkedAccount, handleTicketById);
    bot.command("settings", requireLinkedAccount, handleSettings);

    // Обработчики callback-кнопок
    bot.action("main_menu", requireLinkedAccount, handleMainMenu);
    bot.action("tickets_list", requireLinkedAccount, (ctx) =>
      handleTicketsList(ctx, "all"),
    );
    bot.action("my_tickets", requireLinkedAccount, handleMyTickets);
    bot.action("settings", requireLinkedAccount, showSettings);

    // Фильтры заявок
    bot.action("tickets_filter_all", requireLinkedAccount, (ctx) =>
      handleTicketsList(ctx, "all"),
    );
    bot.action("tickets_filter_new", requireLinkedAccount, (ctx) =>
      handleTicketsList(ctx, "new"),
    );
    bot.action("tickets_filter_in_progress", requireLinkedAccount, (ctx) =>
      handleTicketsList(ctx, "in_progress"),
    );
    bot.action("tickets_filter_waiting", requireLinkedAccount, (ctx) =>
      handleTicketsList(ctx, "waiting"),
    );
    bot.action("tickets_filter_my", requireLinkedAccount, handleMyTickets);

    // Действия с заявками
    bot.action(/^ticket_view_(.+)$/, requireLinkedAccount, async (ctx) => {
      const ticketId = ctx.match[1];
      await showTicketDetails(ctx, ticketId);
    });

    bot.action(/^ticket_take_(.+)$/, requireLinkedAccount, async (ctx) => {
      const ticketId = ctx.match[1];
      await handleTakeTicket(ctx, ticketId);
    });

    bot.action(/^ticket_status_(.+)$/, requireLinkedAccount, async (ctx) => {
      const ticketId = ctx.match[1];
      await handleShowStatusMenu(ctx, ticketId);
    });

    bot.action(
      /^ticket_set_status_(.+)_(.+)$/,
      requireLinkedAccount,
      async (ctx) => {
        const ticketId = ctx.match[1];
        const newStatus = ctx.match[2] as any;
        await handleSetStatus(ctx, ticketId, newStatus);
      },
    );

    bot.action(/^ticket_comment_(.+)$/, requireLinkedAccount, async (ctx) => {
      const ticketId = ctx.match[1];
      const telegramId = ctx.from?.id;
      if (telegramId) {
        setUserState(telegramId, { action: "comment", ticketId });
      }
      await handleCommentPrompt(ctx, ticketId);
    });

    // Настройки
    bot.action(
      "toggle_notifications",
      requireLinkedAccount,
      handleToggleNotifications,
    );
    bot.action("unlink_account", requireLinkedAccount, handleUnlinkPrompt);
    bot.action("confirm_unlink", requireLinkedAccount, handleConfirmUnlink);

    // Действия с оборудованием
    bot.action(
      /^equipment_create_ticket_(.+)$/,
      requireLinkedAccount,
      async (ctx) => {
        const equipmentId = ctx.match[1];
        const telegramId = ctx.from?.id;
        if (telegramId) {
          setUserState(telegramId, { action: "create_ticket", equipmentId });
        }
        await handleEquipmentCreateTicket(ctx, equipmentId);
      },
    );

    bot.action(
      /^equipment_history_(.+)$/,
      requireLinkedAccount,
      async (ctx) => {
        const equipmentId = ctx.match[1];
        await handleEquipmentHistory(ctx, equipmentId);
      },
    );

    // Отмена действия
    bot.action("cancel_action", handleCancelAction);

    // Обработчик фото (QR-коды)
    bot.on("photo", requireLinkedAccount, handlePhoto);

    // Обработчик текстовых сообщений
    bot.on("text", requireLinkedAccount, handleTextMessage);

    // Запускаем бота в режиме long polling с таймаутом
    console.log("[Telegram Bot] Запуск long polling...");

    // Добавляем таймаут на случай если launch зависнет
    const launchPromise = bot.launch({
      dropPendingUpdates: true, // Игнорируем старые сообщения
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Таймаут запуска бота (30 сек)")),
        30000,
      );
    });

    await Promise.race([launchPromise, timeoutPromise]);

    console.log("[Telegram Bot] Бот успешно запущен");

    return bot;
  } catch (error) {
    console.error("[Telegram Bot] Ошибка запуска бота:", error);
    return null;
  }
}

export async function stopTelegramBot(): Promise<void> {
  if (bot) {
    bot.stop("SIGTERM");
    console.log("[Telegram Bot] Бот остановлен");
  }
}

export function getBot(): Telegraf<BotContext> | null {
  return bot;
}

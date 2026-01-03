import { get, put, post } from '../lib/api';
import type { SystemSetting } from '../types';

export const settingsService = {
  // Получить список всех настроек
  async getSettings(): Promise<{ data: SystemSetting[]; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: SystemSetting[] }>('/settings');

      if (error || !data) {
        return { data: [], error: error || new Error('Ошибка загрузки настроек') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },

  // Получить конкретную настройку по ключу
  async getSettingByKey(key: string): Promise<{ data: SystemSetting | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: SystemSetting }>(`/settings/${key}`);

      if (error || !data) {
        return { data: null, error: error || new Error('Настройка не найдена') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить настройку
  async updateSetting(
    key: string,
    value: string
  ): Promise<{ data: SystemSetting | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: SystemSetting }>(`/settings/${key}`, { value });

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка обновления настройки') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Отправить тестовое email
  async sendTestEmail(to: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await post('/settings/test-email', { to });

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};

import { get, post, put, del } from '../lib/api';
import type { Building } from '../types';

export const buildingsService = {
  // Получить список зданий
  async getBuildings(activeOnly?: boolean): Promise<{ data: Building[]; count: number; error: Error | null }> {
    try {
      const queryParams = new URLSearchParams();
      if (activeOnly) queryParams.append('active', 'true');

      const { data, error } = await get<{ data: Building[]; count: number }>(
        `/buildings${queryParams.toString() ? '?' + queryParams.toString() : ''}`
      );

      if (error || !data) {
        return { data: [], count: 0, error: error || new Error('Ошибка загрузки зданий') };
      }

      return { data: data.data, count: data.count, error: null };
    } catch (error) {
      return { data: [], count: 0, error: error as Error };
    }
  },

  // Получить здание по ID
  async getBuildingById(id: string): Promise<{ data: Building | null; error: Error | null }> {
    try {
      const { data, error } = await get<{ data: Building }>(`/buildings/${id}`);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка загрузки здания') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Создать здание
  async createBuilding(building: Partial<Building>): Promise<{ data: Building | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: Building }>('/buildings', building);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка создания здания') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить здание
  async updateBuilding(id: string, updates: Partial<Building>): Promise<{ data: Building | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: Building }>(`/buildings/${id}`, updates);

      if (error || !data) {
        return { data: null, error: error || new Error('Ошибка обновления здания') };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить здание
  async deleteBuilding(id: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/buildings/${id}`);

      if (error) {
        return { error: error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },
};



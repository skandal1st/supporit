import { post } from '../lib/api';

export interface ScannedDevice {
  ip: string;
  hostname?: string;
  mac?: string;
  isAlive: boolean;
  responseTime?: number;
  vendor?: string;
  os?: string;
  os_version?: string;
  cpu?: string;
  ram?: string;
  hdd?: string;
  domain?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  open_ports?: number[];
  services?: Record<string, {
    name?: string;
    product?: string;
    version?: string;
  }>;
}

export interface ScanNetworkParams {
  startIp?: string;
  endIp?: string;
  subnet?: string;
  singleIp?: string;
  domainUser?: string;
  domainPassword?: string;
  domainServer?: string;
}

export interface ScanNetworkResponse {
  data: ScannedDevice[];
  count: number;
  error?: Error;
}

export interface BulkCreateParams {
  devices: Array<{
    ip: string;
    hostname?: string;
    mac?: string;
    name?: string;
    category?: string;
    status?: string;
    location_department?: string;
    location_room?: string;
    manufacturer?: string;
    inventory_number?: string;
  }>;
  defaults?: {
    category?: string;
    status?: string;
    location_department?: string;
    location_room?: string;
    manufacturer?: string;
  };
}

export interface BulkCreateResponse {
  data: any[];
  created: number;
  errors: number;
  errorDetails: Array<{
    ip: string;
    error: string;
  }>;
  error?: Error;
}

export const networkScannerService = {
  // Сканировать сеть
  async scanNetwork(params: ScanNetworkParams): Promise<ScanNetworkResponse> {
    try {
      const { data, error } = await post<{ data: ScannedDevice[]; count: number }>(
        '/equipment/scan-network',
        params
      );

      if (error || !data) {
        return {
          data: [],
          count: 0,
          error: error || new Error('Ошибка сканирования сети'),
        };
      }

      return {
        data: data.data,
        count: data.count,
        error: null,
      };
    } catch (error) {
      return {
        data: [],
        count: 0,
        error: error as Error,
      };
    }
  },

  // Массовое создание оборудования из результатов сканирования
  async bulkCreateEquipment(params: BulkCreateParams): Promise<BulkCreateResponse> {
    try {
      const { data, error } = await post<{
        data: any[];
        created: number;
        errors: number;
        errorDetails: Array<{ ip: string; error: string }>;
      }>('/equipment/bulk-create-from-scan', params);

      if (error || !data) {
        return {
          data: [],
          created: 0,
          errors: 0,
          errorDetails: [],
          error: error || new Error('Ошибка создания оборудования'),
        };
      }

      return {
        data: data.data,
        created: data.created,
        errors: data.errors,
        errorDetails: data.errorDetails,
        error: null,
      };
    } catch (error) {
      return {
        data: [],
        created: 0,
        errors: 0,
        errorDetails: [],
        error: error as Error,
      };
    }
  },
};


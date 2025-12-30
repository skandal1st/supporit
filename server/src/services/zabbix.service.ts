/**
 * Zabbix API Service
 * Интеграция с Zabbix 7.x через JSON-RPC API
 */

const ZABBIX_URL = process.env.ZABBIX_URL || 'http://localhost/api_jsonrpc.php';
const ZABBIX_API_TOKEN = process.env.ZABBIX_API_TOKEN || '';

interface ZabbixResponse<T> {
  jsonrpc: string;
  result: T;
  error?: {
    code: number;
    message: string;
    data: string;
  };
  id: number;
}

interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
  interfaces?: Array<{
    interfaceid: string;
    ip: string;
    type: string;
    main: string;
    available: string;
  }>;
}

interface ZabbixItem {
  itemid: string;
  name: string;
  key_: string;
  lastvalue: string;
  lastclock: string;
  units: string;
}

interface ZabbixGroup {
  groupid: string;
  name: string;
}

interface ZabbixTemplate {
  templateid: string;
  name: string;
  host: string;
}

// Счётчик запросов для уникальных ID
let requestId = 1;

/**
 * Выполнить запрос к Zabbix API
 */
async function zabbixRequest<T>(method: string, params: Record<string, any> = {}): Promise<T> {
  if (!ZABBIX_URL || !ZABBIX_API_TOKEN) {
    throw new Error('Zabbix не настроен. Проверьте ZABBIX_URL и ZABBIX_API_TOKEN');
  }

  const body = {
    jsonrpc: '2.0',
    method,
    params,
    id: requestId++,
  };

  const response = await fetch(ZABBIX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZABBIX_API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Zabbix API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ZabbixResponse<T>;

  if (data.error) {
    throw new Error(`Zabbix API error: ${data.error.message} - ${data.error.data}`);
  }

  return data.result;
}

/**
 * Проверить подключение к Zabbix
 */
async function checkConnection(): Promise<boolean> {
  try {
    await zabbixRequest<string>('apiinfo.version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Получить версию Zabbix API
 */
async function getApiVersion(): Promise<string> {
  return zabbixRequest<string>('apiinfo.version');
}

/**
 * Получить список всех хостов
 */
async function getHosts(groupIds?: string[]): Promise<ZabbixHost[]> {
  const params: Record<string, any> = {
    output: ['hostid', 'host', 'name', 'status'],
    selectInterfaces: ['interfaceid', 'ip', 'type', 'main', 'available'],
  };

  if (groupIds && groupIds.length > 0) {
    params.groupids = groupIds;
  }

  return zabbixRequest<ZabbixHost[]>('host.get', params);
}

/**
 * Найти хост по IP адресу
 */
async function getHostByIP(ip: string): Promise<ZabbixHost | null> {
  const hosts = await zabbixRequest<ZabbixHost[]>('host.get', {
    output: ['hostid', 'host', 'name', 'status'],
    selectInterfaces: ['interfaceid', 'ip', 'type', 'main', 'available'],
    filter: {},
    searchByAny: true,
  });

  // Фильтруем по IP в интерфейсах
  const host = hosts.find(h =>
    h.interfaces?.some(iface => iface.ip === ip)
  );

  return host || null;
}

/**
 * Получить метрики (items) хоста
 */
async function getHostItems(hostId: string, search?: string): Promise<ZabbixItem[]> {
  const params: Record<string, any> = {
    hostids: hostId,
    output: ['itemid', 'name', 'key_', 'lastvalue', 'lastclock', 'units'],
  };

  if (search) {
    params.search = { key_: search };
    params.searchWildcardsEnabled = true;
  }

  return zabbixRequest<ZabbixItem[]>('item.get', params);
}

/**
 * Получить счётчики страниц принтера
 */
async function getPageCounters(hostId: string): Promise<{
  total: number | null;
  black: number | null;
  color: number | null;
  items: ZabbixItem[];
}> {
  // Ищем items связанные со счётчиками страниц
  // Стандартные SNMP OID ключи для принтеров
  const items = await getHostItems(hostId);

  // Фильтруем items по известным ключам счётчиков
  const pageCounterKeys = [
    'hrPrinterLifeCount',
    'prtMarkerLifeCount',
    'prtMIBLifeCount',
    'printer.pages',
    'pages.total',
    'pages.black',
    'pages.color',
  ];

  const counterItems = items.filter(item =>
    pageCounterKeys.some(key =>
      item.key_.toLowerCase().includes(key.toLowerCase()) ||
      item.name.toLowerCase().includes('page') ||
      item.name.toLowerCase().includes('count') ||
      item.name.toLowerCase().includes('страниц')
    )
  );

  // Пытаемся определить тип счётчика
  let total: number | null = null;
  let black: number | null = null;
  let color: number | null = null;

  for (const item of counterItems) {
    const value = parseInt(item.lastvalue, 10);
    if (isNaN(value)) continue;

    const keyLower = item.key_.toLowerCase();
    const nameLower = item.name.toLowerCase();

    if (keyLower.includes('black') || nameLower.includes('black') || nameLower.includes('чёрн')) {
      black = value;
    } else if (keyLower.includes('color') || nameLower.includes('color') || nameLower.includes('цвет')) {
      color = value;
    } else if (keyLower.includes('life') || keyLower.includes('total') || nameLower.includes('total') || nameLower.includes('всего')) {
      total = value;
    } else if (total === null) {
      // Если не определили тип, считаем что это общий счётчик
      total = value;
    }
  }

  return { total, black, color, items: counterItems };
}

/**
 * Получить статус доступности хоста
 */
async function getHostAvailability(hostId: string): Promise<{
  available: boolean;
  lastCheck: string | null;
}> {
  const hosts = await zabbixRequest<ZabbixHost[]>('host.get', {
    hostids: hostId,
    output: ['hostid'],
    selectInterfaces: ['available', 'error'],
  });

  if (hosts.length === 0) {
    return { available: false, lastCheck: null };
  }

  const host = hosts[0];
  const mainInterface = host.interfaces?.find(i => i.main === '1');

  // available: 0 = unknown, 1 = available, 2 = unavailable
  const isAvailable = mainInterface?.available === '1';

  return {
    available: isAvailable,
    lastCheck: new Date().toISOString(),
  };
}

/**
 * Получить группы хостов
 */
async function getHostGroups(): Promise<ZabbixGroup[]> {
  return zabbixRequest<ZabbixGroup[]>('hostgroup.get', {
    output: ['groupid', 'name'],
    sortfield: 'name',
  });
}

/**
 * Получить шаблоны
 */
async function getTemplates(search?: string): Promise<ZabbixTemplate[]> {
  const params: Record<string, any> = {
    output: ['templateid', 'name', 'host'],
    sortfield: 'name',
  };

  if (search) {
    params.search = { name: search };
    params.searchWildcardsEnabled = true;
  }

  return zabbixRequest<ZabbixTemplate[]>('template.get', params);
}

/**
 * Создать хост в Zabbix
 */
async function createHost(options: {
  name: string;
  ip: string;
  groupIds: string[];
  templateIds?: string[];
  snmpCommunity?: string;
  description?: string;
}): Promise<{ hostids: string[] }> {
  const { name, ip, groupIds, templateIds = [], snmpCommunity = 'public', description } = options;

  // Создаём имя хоста (без пробелов и спецсимволов)
  const hostTechnicalName = name
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 64);

  const params: Record<string, any> = {
    host: hostTechnicalName,
    name: name,
    groups: groupIds.map(id => ({ groupid: id })),
    interfaces: [
      {
        type: 2, // SNMP
        main: 1,
        useip: 1,
        ip: ip,
        dns: '',
        port: '161',
        details: {
          version: 2, // SNMP v2c
          community: snmpCommunity,
        },
      },
    ],
  };

  if (templateIds.length > 0) {
    params.templates = templateIds.map(id => ({ templateid: id }));
  }

  if (description) {
    params.description = description;
  }

  return zabbixRequest<{ hostids: string[] }>('host.create', params);
}

/**
 * Удалить хост из Zabbix
 */
async function deleteHost(hostId: string): Promise<{ hostids: string[] }> {
  return zabbixRequest<{ hostids: string[] }>('host.delete', [hostId]);
}

export const zabbixService = {
  checkConnection,
  getApiVersion,
  getHosts,
  getHostByIP,
  getHostItems,
  getPageCounters,
  getHostAvailability,
  getHostGroups,
  getTemplates,
  createHost,
  deleteHost,
};

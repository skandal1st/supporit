import { useState, useMemo } from 'react';
import { Search, Loader2, CheckCircle2, XCircle, Plus, X } from 'lucide-react';
import { networkScannerService, type ScannedDevice } from '../../services/networkScanner.service';
import { Button } from '../ui/Button';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../ui/Table';
import type { EquipmentCategory, EquipmentStatus } from '../../types';
import { getCategoryLabel } from '../../utils/format';

interface NetworkScannerProps {
  onDevicesSelected?: (devices: ScannedDevice[]) => void;
  onClose?: () => void;
}

export const NetworkScanner = ({ onDevicesSelected, onClose }: NetworkScannerProps) => {
  const [scanType, setScanType] = useState<'subnet' | 'range' | 'single'>('subnet');
  const [subnet, setSubnet] = useState('192.168.1.0/24');
  const [startIp, setStartIp] = useState('192.168.1.1');
  const [endIp, setEndIp] = useState('192.168.1.254');
  const [singleIp, setSingleIp] = useState('');
  const [devices, setDevices] = useState<ScannedDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  
  // Учетные данные домена
  const [useDomain, setUseDomain] = useState(false);
  const [domainUser, setDomainUser] = useState('');
  const [domainPassword, setDomainPassword] = useState('');
  const [domainServer, setDomainServer] = useState('');
  
  // Параметры для массового создания
  const [defaultCategory, setDefaultCategory] = useState<EquipmentCategory>('network');
  const [defaultStatus, setDefaultStatus] = useState<EquipmentStatus>('in_stock');
  const [defaultDepartment, setDefaultDepartment] = useState('');
  const [defaultRoom, setDefaultRoom] = useState('');
  const [creating, setCreating] = useState(false);
  const [createResult, setCreateResult] = useState<{ created: number; errors: number } | null>(null);

  const handleScan = async () => {
    setScanning(true);
    setError(null);
    setDevices([]);
    setSelectedDevices(new Set());
    setCreateResult(null);

    try {
      let params: { 
        startIp?: string; 
        endIp?: string; 
        subnet?: string;
        singleIp?: string;
        domainUser?: string;
        domainPassword?: string;
        domainServer?: string;
      } = {};

      if (scanType === 'subnet') {
        params.subnet = subnet;
      } else if (scanType === 'range') {
        params.startIp = startIp;
        params.endIp = endIp;
      } else {
        params.singleIp = singleIp;
      }

      // Добавляем учетные данные домена, если они указаны
      if (useDomain && domainUser && domainPassword) {
        params.domainUser = domainUser;
        params.domainPassword = domainPassword;
        if (domainServer) {
          params.domainServer = domainServer;
        }
      }

      const result = await networkScannerService.scanNetwork(params);

      if (result.error) {
        setError(result.error.message || 'Ошибка при сканировании сети');
      } else {
        setDevices(result.data);
        // Автоматически выбираем все найденные устройства
        setSelectedDevices(new Set(result.data.map(d => d.ip)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при сканировании');
    } finally {
      setScanning(false);
    }
  };

  const toggleDeviceSelection = (ip: string) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(ip)) {
      newSelected.delete(ip);
    } else {
      newSelected.add(ip);
    }
    setSelectedDevices(newSelected);
  };

  const toggleAllDevices = () => {
    if (selectedDevices.size === devices.length) {
      setSelectedDevices(new Set());
    } else {
      setSelectedDevices(new Set(devices.map(d => d.ip)));
    }
  };

  // Функция для определения категории устройства
  const getDeviceCategory = (device: ScannedDevice): EquipmentCategory => {
    // Если есть информация о производителе/модели, определяем по ней
    const hostnameLower = (device.hostname || '').toLowerCase();
    const vendorLower = (device.vendor || '').toLowerCase();
    const osLower = (device.os || '').toLowerCase();

    // Принтеры
    if (hostnameLower.includes('printer') || hostnameLower.includes('print') ||
        vendorLower.includes('hp') && ('printer' in hostnameLower || 'laser' in hostnameLower) ||
        vendorLower.includes('canon') || vendorLower.includes('epson')) {
      return 'printer';
    }

    // Серверы
    if (hostnameLower.includes('server') || hostnameLower.includes('srv') ||
        hostnameLower.includes('dc') || hostnameLower.includes('domain')) {
      return 'server';
    }

    // Сетевое оборудование
    if (hostnameLower.includes('router') || hostnameLower.includes('switch') ||
        hostnameLower.includes('gateway') || hostnameLower.includes('access-point') ||
        vendorLower.includes('cisco') || vendorLower.includes('netgear')) {
      return 'network';
    }

    // Мониторы (редко имеют IP, но на всякий случай)
    if (hostnameLower.includes('monitor') || hostnameLower.includes('display')) {
      return 'monitor';
    }

    // Если есть CPU/RAM/HDD - это компьютер
    if (device.cpu || device.ram || device.hdd) {
      return 'computer';
    }

    // По умолчанию - компьютер (так как большинство устройств в сети - компьютеры)
    return 'computer';
  };

  // Группируем устройства по категориям
  const devicesByCategory = useMemo(() => {
    const grouped: Record<EquipmentCategory, ScannedDevice[]> = {
      computer: [],
      monitor: [],
      printer: [],
      network: [],
      server: [],
      mobile: [],
      peripheral: [],
      other: [],
    };

    devices.forEach(device => {
      const category = getDeviceCategory(device);
      grouped[category].push(device);
    });

    return grouped;
  }, [devices]);

  // Получаем количество выбранных устройств по категориям
  const getSelectedCountByCategory = (category: EquipmentCategory): number => {
    return devicesByCategory[category].filter(d => selectedDevices.has(d.ip)).length;
  };

  const handleCreateEquipment = async (category?: EquipmentCategory) => {
    const categoryToUse = category || defaultCategory;
    const devicesToCreate = category 
      ? devices.filter(d => selectedDevices.has(d.ip) && getDeviceCategory(d) === category)
      : devices.filter(d => selectedDevices.has(d.ip));

    if (devicesToCreate.length === 0) {
      setError(`Выберите устройства${category ? ` категории "${getCategoryLabel(categoryToUse)}"` : ''} для добавления`);
      return;
    }

    setCreating(true);
    setError(null);
    setCreateResult(null);

    try {
      const result = await networkScannerService.bulkCreateEquipment({
        devices: devicesToCreate.map(device => ({
          ip: device.ip,
          hostname: device.hostname,
          mac: device.mac,
        })),
        defaults: {
          category: categoryToUse,
          status: defaultStatus,
          location_department: defaultDepartment || undefined,
          location_room: defaultRoom || undefined,
        },
      });

      if (result.error) {
        setError(result.error.message || 'Ошибка при создании оборудования');
      } else {
        setCreateResult({
          created: result.created,
          errors: result.errors,
        });

        // Если есть ошибки, показываем их
        if (result.errors > 0 && result.errorDetails.length > 0) {
          const errorMessages = result.errorDetails.map(e => `${e.ip}: ${e.error}`).join('\n');
          setError(`Создано: ${result.created}, Ошибок: ${result.errors}\n${errorMessages}`);
        }

        // Если все успешно, вызываем callback
        if (result.created > 0 && onDevicesSelected) {
          onDevicesSelected(devicesToCreate);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка при создании оборудования');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Сканер сети</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Форма сканирования */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Тип сканирования
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="subnet"
                  checked={scanType === 'subnet'}
                  onChange={(e) => setScanType(e.target.value as any)}
                  className="mr-2"
                />
                Подсеть (CIDR)
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="range"
                  checked={scanType === 'range'}
                  onChange={(e) => setScanType(e.target.value as any)}
                  className="mr-2"
                />
                Диапазон IP
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="single"
                  checked={scanType === 'single'}
                  onChange={(e) => setScanType(e.target.value as any)}
                  className="mr-2"
                />
                Один IP
              </label>
            </div>
          </div>

          {scanType === 'subnet' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Подсеть (CIDR)
              </label>
              <input
                type="text"
                value={subnet}
                onChange={(e) => setSubnet(e.target.value)}
                placeholder="192.168.1.0/24"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {scanType === 'range' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Начальный IP
                </label>
                <input
                  type="text"
                  value={startIp}
                  onChange={(e) => setStartIp(e.target.value)}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Конечный IP
                </label>
                <input
                  type="text"
                  value={endIp}
                  onChange={(e) => setEndIp(e.target.value)}
                  placeholder="192.168.1.254"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {scanType === 'single' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                IP адрес
              </label>
              <input
                type="text"
                value={singleIp}
                onChange={(e) => setSingleIp(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Параметры домена */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="flex items-center mb-3">
              <input
                type="checkbox"
                checked={useDomain}
                onChange={(e) => setUseDomain(e.target.checked)}
                className="mr-2 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Использовать учетные данные домена (для получения детальной информации о компьютерах)
              </span>
            </label>
            
            {useDomain && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Пользователь домена
                  </label>
                  <input
                    type="text"
                    value={domainUser}
                    onChange={(e) => setDomainUser(e.target.value)}
                    placeholder="DOMAIN\\user"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Пароль
                  </label>
                  <input
                    type="password"
                    value={domainPassword}
                    onChange={(e) => setDomainPassword(e.target.value)}
                    placeholder="Пароль"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Сервер домена (необязательно)
                  </label>
                  <input
                    type="text"
                    value={domainServer}
                    onChange={(e) => setDomainServer(e.target.value)}
                    placeholder="dc.example.com или IP"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleScan} disabled={scanning} className="w-full mt-4">
            {scanning ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Сканирование...
              </>
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Начать сканирование
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Результаты сканирования */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg whitespace-pre-line">
          {error}
        </div>
      )}

      {createResult && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg">
          Успешно создано: {createResult.created} устройств
          {createResult.errors > 0 && `, ошибок: ${createResult.errors}`}
        </div>
      )}

      {devices.length > 0 && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Найдено устройств: {devices.length}
              </h3>
              <button
                onClick={toggleAllDevices}
                className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {selectedDevices.size === devices.length ? 'Снять все' : 'Выбрать все'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableHeaderCell>
                    <input
                      type="checkbox"
                      checked={selectedDevices.size === devices.length && devices.length > 0}
                      onChange={toggleAllDevices}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </TableHeaderCell>
                  <TableHeaderCell>IP адрес</TableHeaderCell>
                  <TableHeaderCell>Hostname</TableHeaderCell>
                  <TableHeaderCell>MAC / Vendor</TableHeaderCell>
                  <TableHeaderCell>Производитель / Модель</TableHeaderCell>
                  <TableHeaderCell>ОС</TableHeaderCell>
                  <TableHeaderCell>CPU / RAM / HDD</TableHeaderCell>
                  <TableHeaderCell>Время отклика</TableHeaderCell>
                  <TableHeaderCell>Статус</TableHeaderCell>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.ip}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedDevices.has(device.ip)}
                          onChange={() => toggleDeviceSelection(device.ip)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </TableCell>
                      <TableCell className="font-mono font-medium">{device.ip}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{device.hostname || <span className="text-gray-400 italic text-sm">не определено</span>}</div>
                          {device.domain && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Домен: {device.domain}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-sm">{device.mac || <span className="text-red-500 text-xs italic">не найден</span>}</div>
                        {device.vendor && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{device.vendor}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {getCategoryLabel(getDeviceCategory(device))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {device.manufacturer || device.model ? (
                          <div>
                            {device.manufacturer && <div>{device.manufacturer}</div>}
                            {device.model && <div className="text-xs text-gray-500 dark:text-gray-400">{device.model}</div>}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {device.os ? (
                          <div>
                            <div>{device.os}</div>
                            {device.os_version && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">v{device.os_version}</div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {device.cpu || device.ram || device.hdd ? (
                          <div className="text-xs space-y-1">
                            {device.cpu && <div className="truncate" title={device.cpu}>{device.cpu}</div>}
                            {device.ram && <div>{device.ram}</div>}
                            {device.hdd && <div className="truncate" title={device.hdd}>{device.hdd}</div>}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{device.responseTime ? `${Math.round(device.responseTime)} мс` : '-'}</TableCell>
                      <TableCell>
                        {device.isAlive ? (
                          <span className="inline-flex items-center text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Онлайн
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4 mr-1" />
                            Офлайн
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Параметры для создания */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Параметры для добавления оборудования
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Категория по умолчанию
                </label>
                <select
                  value={defaultCategory}
                  onChange={(e) => setDefaultCategory(e.target.value as EquipmentCategory)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="computer">Компьютер</option>
                  <option value="monitor">Монитор</option>
                  <option value="printer">Принтер</option>
                  <option value="network">Сетевое оборудование</option>
                  <option value="server">Сервер</option>
                  <option value="mobile">Мобильное устройство</option>
                  <option value="peripheral">Периферия</option>
                  <option value="other">Прочее</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Статус по умолчанию
                </label>
                <select
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value as EquipmentStatus)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="in_use">В работе</option>
                  <option value="in_stock">На складе</option>
                  <option value="in_repair">В ремонте</option>
                  <option value="written_off">Списано</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Отдел/Здание
                </label>
                <input
                  type="text"
                  value={defaultDepartment}
                  onChange={(e) => setDefaultDepartment(e.target.value)}
                  placeholder="Необязательно"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Кабинет
                </label>
                <input
                  type="text"
                  value={defaultRoom}
                  onChange={(e) => setDefaultRoom(e.target.value)}
                  placeholder="Необязательно"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {/* Кнопка добавления всех выбранных устройств */}
              <Button
                onClick={() => handleCreateEquipment()}
                disabled={creating || selectedDevices.size === 0}
                className="w-full"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Создание оборудования...
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    Добавить все выбранные ({selectedDevices.size})
                  </>
                )}
              </Button>

              {/* Кнопки добавления по категориям */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(Object.keys(devicesByCategory) as EquipmentCategory[]).map((category) => {
                  const count = getSelectedCountByCategory(category);
                  if (devicesByCategory[category].length === 0) return null;
                  
                  return (
                    <Button
                      key={category}
                      onClick={() => handleCreateEquipment(category)}
                      disabled={creating || count === 0}
                      variant="secondary"
                      size="sm"
                      className="flex flex-col items-center"
                    >
                      <span className="text-xs font-medium">{getCategoryLabel(category)}</span>
                      <span className="text-xs text-gray-500">
                        {count > 0 ? `${count} выбрано` : '0'}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Plus, RefreshCw, FileText, AlertCircle } from 'lucide-react';
import { zabbixService } from '../../services/zabbix.service';
import type { ZabbixEquipmentStatus, ZabbixEquipmentCounters, ZabbixGroup, ZabbixTemplate } from '../../types';
import { Button } from '../ui/Button';

interface ZabbixStatusProps {
  equipmentId: string;
  category: string;
  ipAddress?: string;
  compact?: boolean;
}

export const ZabbixStatus = ({ equipmentId, category, ipAddress, compact = false }: ZabbixStatusProps) => {
  const [status, setStatus] = useState<ZabbixEquipmentStatus | null>(null);
  const [counters, setCounters] = useState<ZabbixEquipmentCounters | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояние для модального окна добавления
  const [showAddModal, setShowAddModal] = useState(false);
  const [groups, setGroups] = useState<ZabbixGroup[]>([]);
  const [templates, setTemplates] = useState<ZabbixTemplate[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [snmpCommunity, setSnmpCommunity] = useState('public');
  const [adding, setAdding] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: err } = await zabbixService.getEquipmentStatus(equipmentId);
      if (err) {
        setError(err.message);
      } else if (data) {
        setStatus(data);

        // Если это принтер и найден в Zabbix, загружаем счётчики
        if (category === 'printer' && data.found) {
          const { data: countersData } = await zabbixService.getEquipmentCounters(equipmentId);
          if (countersData) {
            setCounters(countersData);
          }
        }
      }
    } catch (e) {
      setError('Ошибка загрузки статуса');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ipAddress) {
      loadStatus();
    } else {
      setLoading(false);
      setStatus({ found: false, reason: 'no_ip', message: 'IP не указан' });
    }
  }, [equipmentId, ipAddress, category]);

  const loadGroupsAndTemplates = async () => {
    const [groupsResult, templatesResult] = await Promise.all([
      zabbixService.getGroups(),
      zabbixService.getTemplates('printer'),
    ]);

    if (groupsResult.data) setGroups(groupsResult.data);
    if (templatesResult.data) setTemplates(templatesResult.data);
  };

  const handleOpenAddModal = async () => {
    setShowAddModal(true);
    await loadGroupsAndTemplates();
  };

  const handleAddToZabbix = async () => {
    if (!selectedGroup) {
      alert('Выберите группу хостов');
      return;
    }

    setAdding(true);
    try {
      const { data, error: err } = await zabbixService.addEquipmentToZabbix(
        equipmentId,
        selectedGroup,
        selectedTemplate || undefined,
        snmpCommunity
      );

      console.log('Zabbix add response:', { data, error: err });

      if (err) {
        alert('Ошибка: ' + err.message);
      } else if (data?.success) {
        alert('Устройство успешно добавлено в Zabbix');
        setShowAddModal(false);
        loadStatus(); // Перезагружаем статус
      } else {
        // Если нет success, показываем сообщение об ошибке
        alert('Ошибка: ' + (data?.message || 'Не удалось добавить устройство в Zabbix'));
      }
    } catch (e: any) {
      console.error('Zabbix add error:', e);
      alert('Ошибка добавления в Zabbix: ' + (e?.message || 'Неизвестная ошибка'));
    } finally {
      setAdding(false);
    }
  };

  // Компактный вид для таблицы
  if (compact) {
    if (loading) {
      return <span className="text-gray-400 text-sm">...</span>;
    }

    if (!ipAddress) {
      return <span className="text-gray-400 text-sm">—</span>;
    }

    if (error) {
      return (
        <span title={error}>
          <AlertCircle className="h-4 w-4 text-red-500" />
        </span>
      );
    }

    if (!status?.found) {
      return (
        <span className="text-gray-400 text-sm" title="Не в Zabbix">
          —
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1">
        {status.available ? (
          <span title="Online">
            <Wifi className="h-4 w-4 text-green-500" />
          </span>
        ) : (
          <span title="Offline">
            <WifiOff className="h-4 w-4 text-red-500" />
          </span>
        )}
        {counters?.counters?.total !== null && counters?.counters?.total !== undefined && (
          <span className="text-xs text-gray-500" title="Счётчик страниц">
            {counters.counters.total.toLocaleString()}
          </span>
        )}
      </div>
    );
  }

  // Полный вид для карточки/формы
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Wifi className="h-4 w-4" />
          Мониторинг Zabbix
        </h4>
        <button
          onClick={loadStatus}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Обновить"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Загрузка...</div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : !ipAddress ? (
        <div className="text-sm text-gray-500">
          Для мониторинга укажите IP-адрес устройства
        </div>
      ) : !status?.found ? (
        <div className="space-y-3">
          <div className="text-sm text-yellow-600 dark:text-yellow-400">
            Устройство не найдено в Zabbix
          </div>
          <Button size="sm" onClick={handleOpenAddModal}>
            <Plus className="h-4 w-4 mr-1" />
            Добавить в Zabbix
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Статус доступности */}
          <div className="flex items-center gap-2">
            {status.available ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-600 dark:text-green-400">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-500" />
                <span className="text-sm text-red-600 dark:text-red-400">Offline</span>
              </>
            )}
            <span className="text-xs text-gray-400">({status.hostname})</span>
          </div>

          {/* Счётчики страниц для принтеров */}
          {category === 'printer' && counters?.found && counters.counters && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Счётчики страниц
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {counters.counters.total !== null && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Всего</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {counters.counters.total.toLocaleString()}
                    </div>
                  </div>
                )}
                {counters.counters.black !== null && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Ч/Б</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {counters.counters.black.toLocaleString()}
                    </div>
                  </div>
                )}
                {counters.counters.color !== null && (
                  <div>
                    <div className="text-gray-500 dark:text-gray-400">Цвет</div>
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {counters.counters.color.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Модальное окно добавления в Zabbix */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75"
              onClick={() => setShowAddModal(false)}
            />
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Добавить в Zabbix
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Группа хостов *
                  </label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Выберите группу</option>
                    {groups.map((group) => (
                      <option key={group.groupid} value={group.groupid}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Шаблон (опционально)
                  </label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Без шаблона</option>
                    {templates.map((template) => (
                      <option key={template.templateid} value={template.templateid}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SNMP Community
                  </label>
                  <input
                    type="text"
                    value={snmpCommunity}
                    onChange={(e) => setSnmpCommunity(e.target.value)}
                    placeholder="public"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                  Отмена
                </Button>
                <Button onClick={handleAddToZabbix} loading={adding}>
                  Добавить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

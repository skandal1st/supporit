import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { settingsService } from '../services/settings.service';
import type { SystemSetting, SettingType } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';

// Метаданные для типов настроек
const settingTypeMetadata: Record<SettingType, { title: string; description: string }> = {
  smtp: {
    title: 'Настройки SMTP',
    description: 'Параметры почтового сервера для отправки уведомлений',
  },
  email: {
    title: 'Настройки Email',
    description: 'Параметры отправителя для email-уведомлений',
  },
  system: {
    title: 'Системные настройки',
    description: 'Общие параметры системы',
  },
  other: {
    title: 'Прочие настройки',
    description: 'Дополнительные параметры',
  },
};

// Удобочитаемые названия для настроек
const settingLabels: Record<string, string> = {
  smtp_host: 'SMTP хост',
  smtp_port: 'SMTP порт',
  smtp_user: 'SMTP пользователь',
  smtp_password: 'SMTP пароль',
  smtp_secure: 'Использовать SSL/TLS',
  from_email: 'Email отправителя',
  from_name: 'Имя отправителя',
};

export const SettingsPage = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await settingsService.getSettings();
      if (result.error) {
        setError(result.error.message || 'Ошибка при загрузке настроек');
      } else {
        setSettings(result.data);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке настроек');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Группировка настроек по типам
  const groupedSettings = settings.reduce((acc, setting) => {
    const type = setting.setting_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(setting);
    return acc;
  }, {} as Record<SettingType, SystemSetting[]>);

  const handleInputChange = (key: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (setting: SystemSetting) => {
    const newValue = editedValues[setting.setting_key];

    // Если значение не изменилось, не отправляем запрос
    if (newValue === undefined || newValue === setting.setting_value) {
      return;
    }

    // Если значение *** (замаскированное), не отправляем запрос
    if (newValue === '***') {
      return;
    }

    setSaving(setting.setting_key);
    setError(null);
    setSuccess(null);

    try {
      const result = await settingsService.updateSetting(setting.setting_key, newValue);
      if (result.error) {
        setError(`Ошибка при сохранении ${setting.setting_key}: ${result.error.message}`);
      } else {
        setSuccess(`Настройка ${setting.setting_key} успешно сохранена`);
        // Обновляем локальное состояние
        setSettings((prev) =>
          prev.map((s) =>
            s.setting_key === setting.setting_key
              ? { ...s, setting_value: result.data?.setting_value || newValue }
              : s
          )
        );
        // Очищаем отредактированное значение
        setEditedValues((prev) => {
          const newValues = { ...prev };
          delete newValues[setting.setting_key];
          return newValues;
        });

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      setError('Произошла ошибка при сохранении настройки');
    } finally {
      setSaving(null);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      setError('Введите email адрес');
      return;
    }

    setSendingTestEmail(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await settingsService.sendTestEmail(testEmailAddress);
      if (result.error) {
        setError(`Ошибка при отправке тестового письма: ${result.error.message}`);
      } else {
        setSuccess(`Тестовое письмо отправлено на ${testEmailAddress}`);
        setIsTestEmailModalOpen(false);
        setTestEmailAddress('');

        // Скрываем сообщение об успехе через 5 секунд
        setTimeout(() => {
          setSuccess(null);
        }, 5000);
      }
    } catch (err) {
      setError('Произошла ошибка при отправке тестового письма');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const getCurrentValue = (setting: SystemSetting): string => {
    // Если есть отредактированное значение, возвращаем его
    if (editedValues[setting.setting_key] !== undefined) {
      return editedValues[setting.setting_key];
    }
    // Иначе возвращаем текущее значение из настройки
    return setting.setting_value || '';
  };

  const hasChanges = (setting: SystemSetting): boolean => {
    const editedValue = editedValues[setting.setting_key];
    return editedValue !== undefined && editedValue !== setting.setting_value && editedValue !== '***';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <SettingsIcon className="h-8 w-8 mr-3" />
            Системные настройки
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление параметрами системы и SMTP настройками
          </p>
        </div>
        <Button onClick={() => setIsTestEmailModalOpen(true)} variant="secondary">
          <Mail className="h-5 w-5 mr-2" />
          Тестовое письмо
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(groupedSettings) as SettingType[]).map((type) => (
            <div
              key={type}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
            >
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {settingTypeMetadata[type].title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {settingTypeMetadata[type].description}
                </p>
              </div>

              <div className="p-6 space-y-4">
                {groupedSettings[type].map((setting) => (
                  <div
                    key={setting.id}
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start"
                  >
                    <div>
                      <label
                        htmlFor={setting.setting_key}
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        {settingLabels[setting.setting_key] || setting.setting_key}
                      </label>
                      {setting.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {setting.description}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2 flex items-center gap-2">
                      <input
                        id={setting.setting_key}
                        type={setting.is_encrypted && setting.setting_value === '***' ? 'password' : 'text'}
                        value={getCurrentValue(setting)}
                        onChange={(e) => handleInputChange(setting.setting_key, e.target.value)}
                        placeholder={
                          setting.is_encrypted && setting.setting_value === '***'
                            ? 'Введите новое значение для изменения'
                            : 'Введите значение'
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <Button
                        onClick={() => handleSave(setting)}
                        disabled={!hasChanges(setting) || saving === setting.setting_key}
                        variant={hasChanges(setting) ? 'primary' : 'secondary'}
                        size="sm"
                      >
                        {saving === setting.setting_key ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-1" />
                            Сохранить
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно для тестовой отправки email */}
      <Modal
        isOpen={isTestEmailModalOpen}
        onClose={() => {
          setIsTestEmailModalOpen(false);
          setTestEmailAddress('');
        }}
        title="Отправить тестовое письмо"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Введите email адрес для отправки тестового письма. Это поможет проверить корректность SMTP
            настроек.
          </p>
          <div>
            <label
              htmlFor="test-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email адрес
            </label>
            <input
              id="test-email"
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="example@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => {
                setIsTestEmailModalOpen(false);
                setTestEmailAddress('');
              }}
              variant="secondary"
            >
              Отмена
            </Button>
            <Button onClick={handleSendTestEmail} disabled={sendingTestEmail || !testEmailAddress}>
              {sendingTestEmail ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Отправка...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Отправить
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

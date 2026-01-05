import { useState } from 'react';
import { Settings as SettingsIcon, Server, Building2, Package, List, MessageCircle } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs';
import { SystemSettings } from '../components/settings/SystemSettings';
import { BuildingsSettings } from '../components/settings/BuildingsSettings';
import { DictionariesSettings } from '../components/settings/DictionariesSettings';
import { TelegramSettings } from '../components/settings/TelegramSettings';

export const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('system');

  const tabs = [
    {
      id: 'system',
      label: 'Системные настройки',
      icon: <Server className="h-4 w-4" />,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      id: 'buildings',
      label: 'Здания',
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: 'equipment_categories',
      label: 'Категории оборудования',
      icon: <Package className="h-4 w-4" />,
    },
    {
      id: 'equipment_statuses',
      label: 'Статусы оборудования',
      icon: <List className="h-4 w-4" />,
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'system':
        return <SystemSettings />;
      case 'telegram':
        return <TelegramSettings />;
      case 'buildings':
        return <BuildingsSettings />;
      case 'equipment_categories':
        return <DictionariesSettings type="equipment_category" />;
      case 'equipment_statuses':
        return <DictionariesSettings type="equipment_status" />;
      default:
        return <SystemSettings />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <SettingsIcon className="h-8 w-8 mr-3" />
          Настройки системы
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Управление параметрами системы, зданиями и справочниками
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">{renderTabContent()}</div>
    </div>
  );
};

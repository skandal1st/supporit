import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Building2, CheckCircle, XCircle } from 'lucide-react';
import { buildingsService } from '../../services/buildings.service';
import type { Building } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../ui/Table';

export const BuildingsSettings = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Форма
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    description: '',
    is_active: true,
  });

  const loadBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await buildingsService.getBuildings();
      if (result.error) {
        setError(result.error.message);
      } else {
        setBuildings(result.data);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке зданий');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  const handleCreate = () => {
    setEditingBuilding(null);
    setFormData({ name: '', address: '', description: '', is_active: true });
    setIsModalOpen(true);
  };

  const handleEdit = (building: Building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address || '',
      description: building.description || '',
      is_active: building.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (editingBuilding) {
        const result = await buildingsService.updateBuilding(editingBuilding.id, formData);
        if (result.error) {
          setError(result.error.message);
          return;
        }
      } else {
        const result = await buildingsService.createBuilding(formData);
        if (result.error) {
          setError(result.error.message);
          return;
        }
      }

      setIsModalOpen(false);
      loadBuildings();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (building: Building) => {
    if (!confirm(`Вы уверены, что хотите удалить здание "${building.name}"?`)) {
      return;
    }

    const result = await buildingsService.deleteBuilding(building.id);
    if (result.error) {
      setError(result.error.message);
    } else {
      loadBuildings();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building2 className="h-6 w-6 mr-2" />
            Здания
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Управление списком зданий организации
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Добавить здание
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
          Здания не найдены
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableHeaderCell>Название</TableHeaderCell>
              <TableHeaderCell>Адрес</TableHeaderCell>
              <TableHeaderCell>Описание</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {buildings.map((building) => (
                <TableRow key={building.id}>
                  <TableCell>
                    <div className="font-medium">{building.name}</div>
                  </TableCell>
                  <TableCell>
                    {building.address || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {building.description || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {building.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Активно
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        <XCircle className="h-3 w-3 mr-1" />
                        Неактивно
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(building)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(building)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBuilding ? `Редактировать здание: ${editingBuilding.name}` : 'Добавить здание'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Адрес
            </label>
            <input
              id="address"
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Описание
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Активно
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary">
              Отмена
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingBuilding ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

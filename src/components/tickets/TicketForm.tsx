import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect, useState } from 'react';
import type { Ticket, Equipment, EquipmentConsumable, Building } from '../../types';
import { Button } from '../ui/Button';
import { equipmentService } from '../../services/equipment.service';
import { buildingsService } from '../../services/buildings.service';
import { AlertCircle, Package } from 'lucide-react';

const ticketSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен'),
  description: z.string().min(1, 'Описание обязательно'),
  category: z.enum(['hardware', 'software', 'network', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  location_department: z.string().optional(),
  location_room: z.string().optional(),
  equipment_id: z.string().optional().nullable(),
  desired_resolution_date: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

interface TicketFormProps {
  ticket?: Ticket;
  onSubmit: (data: TicketFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const TicketForm = ({ ticket, onSubmit, onCancel, loading }: TicketFormProps) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [consumables, setConsumables] = useState<EquipmentConsumable[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(false);
  const [loadingConsumables, setLoadingConsumables] = useState(false);
  const [loadingBuildings, setLoadingBuildings] = useState(false);

  // Функция для преобразования даты в формат yyyy-MM-dd
  const formatDateForInput = (dateString: string | undefined | null): string => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: ticket
      ? {
          title: ticket.title,
          description: ticket.description,
          category: ticket.category,
          priority: ticket.priority,
          location_department: ticket.location_department || '',
          location_room: ticket.location_room || '',
          equipment_id: ticket.equipment_id || null,
          desired_resolution_date: formatDateForInput(ticket.desired_resolution_date),
        }
      : {
          priority: 'medium',
          category: 'hardware',
        },
  });

  const watchedDepartment = watch('location_department');
  const watchedRoom = watch('location_room');
  const watchedEquipmentId = watch('equipment_id');

  // Загружаем список зданий при монтировании компонента
  useEffect(() => {
    const loadBuildings = async () => {
      setLoadingBuildings(true);
      try {
        const { data, error } = await buildingsService.getBuildings(true); // Только активные
        if (!error && data) {
          setBuildings(data);
        }
      } catch (err) {
        console.error('Ошибка загрузки зданий:', err);
      } finally {
        setLoadingBuildings(false);
      }
    };
    loadBuildings();
  }, []);

  // Загружаем оборудование при изменении кабинета
  useEffect(() => {
    const loadEquipment = async () => {
      // Загружаем только если указаны оба поля или хотя бы одно
      const dept = watchedDepartment?.trim();
      const room = watchedRoom?.trim();
      
      if (dept || room) {
        setLoadingEquipment(true);
        setEquipmentList([]); // Очищаем список перед загрузкой
        try {
          const { data, error } = await equipmentService.getEquipmentByLocation(
            dept || undefined,
            room || undefined
          );
          if (!error && data) {
            setEquipmentList(data);
            console.log('Загружено оборудование:', data.length, 'единиц');
          } else {
            console.error('Ошибка загрузки оборудования:', error);
            setEquipmentList([]);
          }
        } catch (err) {
          console.error('Исключение при загрузке оборудования:', err);
          setEquipmentList([]);
        } finally {
          setLoadingEquipment(false);
        }
      } else {
        setEquipmentList([]);
        setLoadingEquipment(false);
      }
      
      // Сбрасываем выбранное оборудование при смене кабинета ТОЛЬКО если это новый тикет
      // Не сбрасываем, если это просмотр существующего тикета с уже выбранным оборудованием
      const currentEquipmentId = watch('equipment_id');
      if (!ticket || !ticket.equipment_id) {
        // Только для новых тикетов или тикетов без оборудования
        reset({ ...watch(), equipment_id: null });
      }
    };

    const timeoutId = setTimeout(loadEquipment, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [watchedDepartment, watchedRoom, reset, watch, ticket]);

  // Загружаем расходники при выборе оборудования
  useEffect(() => {
    const loadConsumables = async () => {
      if (watchedEquipmentId) {
        console.log('Загрузка расходников для оборудования:', watchedEquipmentId);
        setLoadingConsumables(true);
        try {
          const { data, error } = await equipmentService.getEquipmentConsumables(watchedEquipmentId);
          if (!error && data) {
            console.log('Загружено расходников:', data.length, 'единиц', data);
            setConsumables(data);
          } else {
            console.error('Ошибка загрузки расходников:', error);
            setConsumables([]);
          }
        } catch (err) {
          console.error('Исключение при загрузке расходников:', err);
          setConsumables([]);
        } finally {
          setLoadingConsumables(false);
        }
      } else {
        setConsumables([]);
      }
    };

    loadConsumables();
  }, [watchedEquipmentId]);

  useEffect(() => {
    if (ticket) {
      console.log('Загрузка данных тикета в форму:', ticket);
      reset({
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        location_department: ticket.location_department || '',
        location_room: ticket.location_room || '',
        equipment_id: ticket.equipment_id || null,
        desired_resolution_date: formatDateForInput(ticket.desired_resolution_date),
      });
      
      // Если у тикета есть оборудование, загружаем его в список оборудования
      if (ticket.equipment_id && ticket.location_department && ticket.location_room) {
        // Загружаем оборудование для отображения в списке
        equipmentService.getEquipmentByLocation(
          ticket.location_department,
          ticket.location_room
        ).then(({ data, error }) => {
          if (!error && data) {
            setEquipmentList(data);
          }
        });
      }
    }
  }, [ticket, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Заголовок <span className="text-red-500">*</span>
          </label>
          <input
            {...register('title')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Краткое описание проблемы"
          />
          {errors.title && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title.message}</p>}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Описание <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Подробное описание проблемы..."
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Категория <span className="text-red-500">*</span>
          </label>
          <select
            {...register('category')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="hardware">Оборудование</option>
            <option value="software">Программное обеспечение</option>
            <option value="network">Сеть</option>
            <option value="other">Прочее</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Приоритет <span className="text-red-500">*</span>
          </label>
          <select
            {...register('priority')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="critical">Критический</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Здание</label>
          <select
            {...register('location_department')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={loadingBuildings}
          >
            <option value="">Не выбрано</option>
            {buildings.map((building) => (
              <option key={building.id} value={building.name}>
                {building.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Кабинет</label>
          <input
            {...register('location_room')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: 205"
          />
        </div>

        {/* Список оборудования в кабинете */}
        {(watchedDepartment?.trim() || watchedRoom?.trim()) && (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Оборудование в кабинете 
              {watchedDepartment?.trim() && watchedRoom?.trim() && (
                <span className="text-gray-500 dark:text-gray-400"> ({watchedDepartment}, {watchedRoom})</span>
              )}
            </label>
            {loadingEquipment ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
                Загрузка оборудования...
              </div>
            ) : equipmentList.length > 0 ? (
              <>
                <select
                  {...register('equipment_id')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Не выбрано</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.name} {eq.model ? `(${eq.model})` : ''} - {eq.inventory_number} [{eq.category}]
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Найдено {equipmentList.length} единиц оборудования
                </p>
              </>
            ) : (
              <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                Оборудование в указанном кабинете не найдено. 
                <br />
                <span className="text-xs">Убедитесь, что здание и кабинет указаны правильно и совпадают с данными оборудования.</span>
              </div>
            )}
          </div>
        )}

        {/* Расходные материалы для выбранного оборудования */}
        {watchedEquipmentId && (
          <div className="md:col-span-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center mb-2">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                <h3 className="font-medium text-blue-900 dark:text-blue-100">Расходные материалы для оборудования</h3>
              </div>
              {loadingConsumables ? (
                <div className="text-sm text-blue-700 dark:text-blue-300">Загрузка расходников...</div>
              ) : consumables.length > 0 ? (
                <ul className="space-y-2">
                  {consumables.map((consumable) => (
                    <li key={consumable.consumable_id} className="flex items-center justify-between text-sm">
                      <span className="text-blue-900 dark:text-blue-100">
                        {consumable.consumable_name}
                        {consumable.consumable_model && ` (${consumable.consumable_model})`}
                        {consumable.consumable_category && ` - ${consumable.consumable_category}`}
                      </span>
                      <div className="flex items-center gap-2">
                        {consumable.is_low_stock && (
                          <AlertCircle className="h-4 w-4 text-yellow-500" title="Низкий остаток" />
                        )}
                        <span className={`font-medium ${consumable.is_low_stock ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-700 dark:text-blue-300'}`}>
                          В наличии: {consumable.quantity_in_stock} {consumable.min_quantity > 0 && `(мин: ${consumable.min_quantity})`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  Для данного оборудования не указаны расходные материалы
                </div>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Желаемая дата решения
          </label>
          <input
            {...register('desired_resolution_date')}
            type="date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
        <Button type="submit" loading={loading}>
          {ticket ? 'Сохранить' : 'Создать заявку'}
        </Button>
      </div>
    </form>
  );
};


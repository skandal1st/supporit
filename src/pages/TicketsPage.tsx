import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Eye, Filter, CheckCircle, Clock, XCircle } from 'lucide-react';
import { ticketsService, type TicketFilters } from '../services/tickets.service';
import type { Ticket, TicketStatus, TicketPriority, TicketCategory } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { TicketForm } from '../components/tickets/TicketForm';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { useAuthStore } from '../store/auth.store';
import { canManageTickets } from '../utils/permissions';

const getStatusLabel = (status: TicketStatus): string => {
  const labels: Record<TicketStatus, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    waiting: 'Ожидание',
    resolved: 'Решена',
    closed: 'Закрыта',
  };
  return labels[status] || status;
};

const getStatusColor = (status: TicketStatus): string => {
  const colors: Record<TicketStatus, string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    waiting: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  };
  return colors[status] || '';
};

const getPriorityLabel = (priority: TicketPriority): string => {
  const labels: Record<TicketPriority, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    critical: 'Критический',
  };
  return labels[priority] || priority;
};

const getPriorityColor = (priority: TicketPriority): string => {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return colors[priority] || '';
};

const getCategoryLabel = (category: TicketCategory): string => {
  const labels: Record<TicketCategory, string> = {
    hardware: 'Оборудование',
    software: 'ПО',
    network: 'Сеть',
    other: 'Прочее',
  };
  return labels[category] || category;
};

export const TicketsPage = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<TicketFilters>({});
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageTickets(user?.role);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ticketsService.getTickets(
        {
          ...filters,
          search: searchTerm || undefined,
        },
        page,
        pageSize
      );
      if (result.error) {
        console.error('Ошибка загрузки заявок:', result.error);
        setError(result.error.message || 'Ошибка при загрузке заявок');
      } else {
        setTickets(result.data);
        setTotalCount(result.count);
      }
    } catch (err) {
      console.error('Исключение при загрузке:', err);
      setError('Произошла ошибка при загрузке заявок');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.status, filters.priority, filters.category, searchTerm]);

  const handleCreate = () => {
    setEditingTicket(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setIsModalOpen(true);
  };

  const handleView = async (ticket: Ticket) => {
    // TODO: Открыть детальный просмотр заявки
    const { data } = await ticketsService.getTicketById(ticket.id);
    if (data) {
      setEditingTicket(data);
      setIsModalOpen(true);
    }
  };

  const handleSubmit = async (data: any) => {
    if (editingTicket) {
      const { error } = await ticketsService.updateTicket(editingTicket.id, data);
      if (error) {
        alert('Ошибка при обновлении: ' + error.message);
        return;
      }
    } else {
      const { error } = await ticketsService.createTicket(data);
      if (error) {
        alert('Ошибка при создании: ' + error.message);
        return;
      }
    }
    setIsModalOpen(false);
    setEditingTicket(undefined);
    loadTickets();
  };

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    const updateData: any = { status: newStatus };
    
    // Автоматически устанавливаем resolved_at или closed_at в зависимости от статуса
    if (newStatus === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    } else if (newStatus === 'closed') {
      updateData.closed_at = new Date().toISOString();
      // Если resolved_at не установлен, устанавливаем его тоже
      const ticket = tickets.find(t => t.id === ticketId);
      if (ticket && !ticket.resolved_at) {
        updateData.resolved_at = new Date().toISOString();
      }
    } else if (newStatus !== 'resolved' && newStatus !== 'closed') {
      // При переходе обратно в работу сбрасываем даты закрытия
      updateData.resolved_at = null;
      updateData.closed_at = null;
    }

    const { error } = await ticketsService.updateTicket(ticketId, updateData);
    if (error) {
      alert('Ошибка при изменении статуса: ' + error.message);
    } else {
      loadTickets();
    }
  };

  const handleQuickAction = async (ticket: Ticket, action: 'close' | 'waiting' | 'in_progress') => {
    let newStatus: TicketStatus;
    if (action === 'close') {
      newStatus = 'closed';
    } else if (action === 'waiting') {
      newStatus = 'waiting';
    } else {
      newStatus = 'in_progress';
    }
    await handleStatusChange(ticket.id, newStatus);
  };

  const handleStatusFilter = (status: TicketStatus | 'all') => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status,
    }));
    setPage(1);
  };

  const handlePriorityFilter = (priority: TicketPriority | 'all') => {
    setFilters(prev => ({
      ...prev,
      priority: priority === 'all' ? undefined : priority,
    }));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Заявки</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Всего: {totalCount} заявок
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Создать заявку
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по заголовку или описанию..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filters.status || 'all'}
              onChange={(e) => handleStatusFilter(e.target.value as TicketStatus | 'all')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все статусы</option>
              <option value="new">Новая</option>
              <option value="in_progress">В работе</option>
              <option value="waiting">Ожидание</option>
              <option value="resolved">Решена</option>
              <option value="closed">Закрыта</option>
            </select>
            <select
              value={filters.priority || 'all'}
              onChange={(e) => handlePriorityFilter(e.target.value as TicketPriority | 'all')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все приоритеты</option>
              <option value="low">Низкий</option>
              <option value="medium">Средний</option>
              <option value="high">Высокий</option>
              <option value="critical">Критический</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="text-center py-12 text-red-500 dark:text-red-400">
            {error}
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Заявки не найдены
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>Заголовок</TableHeaderCell>
              <TableHeaderCell>Категория</TableHeaderCell>
              <TableHeaderCell>Приоритет</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              <TableHeaderCell>Создатель</TableHeaderCell>
              <TableHeaderCell>Оборудование</TableHeaderCell>
              <TableHeaderCell>Кабинет</TableHeaderCell>
              <TableHeaderCell>Создана</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {tickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="max-w-xs whitespace-normal">
                    <div>
                      <div className="font-medium truncate">{ticket.title}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {ticket.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getCategoryLabel(ticket.category)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(ticket.priority)}`}>
                      {getPriorityLabel(ticket.priority)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <select
                        value={ticket.status}
                        onChange={(e) => handleStatusChange(ticket.id, e.target.value as TicketStatus)}
                        className={`text-xs font-semibold rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-primary-500 ${getStatusColor(ticket.status)} cursor-pointer`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="new">Новая</option>
                        <option value="in_progress">В работе</option>
                        <option value="waiting">Ожидание</option>
                        <option value="resolved">Решена</option>
                        <option value="closed">Закрыта</option>
                      </select>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                        {getStatusLabel(ticket.status)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ticket.creator ? (
                      <div>
                        <div className="font-medium">{ticket.creator.full_name}</div>
                        {ticket.creator.department && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">{ticket.creator.department}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ticket.equipment ? (
                      <div>
                        <div className="font-medium">{ticket.equipment.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{ticket.equipment.inventory_number}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {ticket.location_room ? (
                      <div>
                        {ticket.location_department && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">{ticket.location_department}</div>
                        )}
                        <div className="font-medium">{ticket.location_room}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString('ru-RU')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleView(ticket);
                        }}
                        className="p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        title="Просмотр"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {canManage && (
                        <>
                          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickAction(ticket, 'waiting');
                                }}
                                className="p-1 text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                                title="Отложить"
                              >
                                <Clock className="h-4 w-4" />
                              </button>
                              {ticket.status !== 'in_progress' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleQuickAction(ticket, 'in_progress');
                                  }}
                                  className="p-1 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
                                  title="Взять в работу"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                          {ticket.status !== 'closed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQuickAction(ticket, 'close');
                              }}
                              className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                              title="Закрыть"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(ticket);
                            }}
                            className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            title="Редактировать"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && totalCount > pageSize && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              Показано {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, totalCount)} из {totalCount}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Назад
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= totalCount}
              >
                Вперед
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTicket(undefined);
        }}
        title={editingTicket ? 'Редактирование заявки' : 'Создание заявки'}
        size="xl"
        confirmClose
        confirmMessage="Вы уверены, что хотите закрыть окно? Несохранённые данные заявки будут потеряны."
      >
        <TicketForm
          ticket={editingTicket}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingTicket(undefined);
          }}
        />
      </Modal>
    </div>
  );
};


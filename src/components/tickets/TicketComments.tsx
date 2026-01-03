import { useState, useEffect } from 'react';
import { MessageSquare, Send, Edit2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ticketCommentsService } from '../../services/ticket-comments.service';
import { useAuthStore } from '../../store/auth.store';
import type { TicketComment } from '../../types';

interface TicketCommentsProps {
  ticketId: string;
}

export const TicketComments = ({ ticketId }: TicketCommentsProps) => {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const user = useAuthStore((state) => state.user);

  const loadComments = async () => {
    setLoading(true);
    try {
      const result = await ticketCommentsService.getComments(ticketId);
      if (!result.error) {
        setComments(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [ticketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const result = await ticketCommentsService.createComment(ticketId, newComment.trim());
      if (!result.error) {
        setNewComment('');
        loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comment: TicketComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const result = await ticketCommentsService.updateComment(commentId, editContent.trim());
      if (!result.error) {
        setEditingId(null);
        setEditContent('');
        loadComments();
      }
    } catch (error) {
      console.error('Ошибка обновления комментария:', error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Удалить комментарий?')) return;

    try {
      const result = await ticketCommentsService.deleteComment(commentId);
      if (!result.error) {
        loadComments();
      }
    } catch (error) {
      console.error('Ошибка удаления комментария:', error);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
            Администратор
          </span>
        );
      case 'it_specialist':
        return (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
            ИТ-специалист
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
        <MessageSquare className="h-5 w-5" />
        <h3>Комментарии ({comments.length})</h3>
      </div>

      {/* Список комментариев */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
            Пока нет комментариев. Будьте первым!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center text-white text-sm font-medium">
                    {comment.user_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {comment.user_name || 'Пользователь'}
                      </p>
                      {getRoleBadge(comment.user_role)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </div>
                </div>

                {/* Кнопки редактирования/удаления */}
                {comment.user_id === user?.id && (
                  <div className="flex items-center space-x-2">
                    {editingId !== comment.id && (
                      <>
                        <button
                          onClick={() => handleEdit(comment)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                          title="Редактировать"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Контент комментария */}
              {editingId === comment.id ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      {/* Форма добавления комментария */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Добавить комментарий..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows={3}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </form>
    </div>
  );
};

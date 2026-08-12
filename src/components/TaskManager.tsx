import React, { useState, useEffect } from 'react';
import { User, AppTask } from '../types';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  UserCheck,
  Sparkles,
  Filter,
  Check,
  Send,
  Bell,
  Search,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';

interface TaskManagerProps {
  currentUser: User;
  users: User[];
  onTaskCreated?: () => void;
}

export const TaskManager: React.FC<TaskManagerProps> = ({
  currentUser,
  users,
  onTaskCreated
}) => {
  const [tasks, setTasks] = useState<AppTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New Task Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [assignedToEmail, setAssignedToEmail] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueTime, setDueTime] = useState('05:00 PM');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('high');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';

  // Load Tasks
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tasks?userEmail=${encodeURIComponent(currentUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentUser]);

  // Set default assigned user if empty
  useEffect(() => {
    if (users.length > 0 && !assignedToEmail) {
      const firstEmp = users.find(u => u.email.toLowerCase() !== currentUser.email.toLowerCase()) || users[0];
      if (firstEmp) setAssignedToEmail(firstEmp.email);
    }
  }, [users]);

  // Handle Create Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !assignedToEmail) return;

    try {
      setIsSubmitting(true);
      setStatusMsg(null);

      const targetUser = users.find(u => u.email.toLowerCase() === assignedToEmail.toLowerCase());

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDesc.trim(),
          assignedToEmail: assignedToEmail,
          assignedToName: targetUser?.name || assignedToEmail,
          assignedByEmail: currentUser.email,
          assignedByName: currentUser.name || 'إدارة النظام',
          dueDate,
          dueTime,
          priority
        })
      });

      if (res.ok) {
        setStatusMsg(' تم إسناد المهمة وإرسال الإشعار والتنبيه للموظف بنجاح');
        setTaskTitle('');
        setTaskDesc('');
        setShowCreateModal(false);
        await fetchTasks();
        if (onTaskCreated) onTaskCreated();
      } else {
        const data = await res.json();
        setStatusMsg(data.error || 'فشل إنشاء المهمة');
      }
    } catch (err: any) {
      setStatusMsg('حدث خطأ في الشبكة عند إضافة المهمة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Task Completion
  const handleToggleComplete = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error updating task:', err);
    }
  };

  // Handle Task Delete
  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('هل أنت تأكد من إزالة هذه المهمة؟')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchTasks();
      }
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'completed'
        ? t.status === 'completed'
        : filter === 'pending'
        ? t.status === 'pending' || t.status === 'in_progress'
        : filter === 'overdue'
        ? t.status === 'overdue' || (t.dueDate < new Date().toISOString().split('T')[0] && t.status !== 'completed')
        : true;

    const matchesSearch =
      !searchQuery ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignedToName.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  return (
    <div className="bg-[#fcfbfa] border border-[#e5dcce] rounded-2xl p-5 shadow-sm space-y-6 dir-rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e8dfcf]">
        <div>
          <h3 className="text-lg font-bold text-[#2c2824] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#8c622b]" />
            <span>جدول المهام والمواعيد والتنبيهات المباشرة</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#8c622b]/10 text-[#8c622b] font-bold border border-[#8c622b]/20">
              {pendingCount} قائمة الانتظار
            </span>
          </h3>
          <p className="text-xs text-[#6e685f] mt-1">
            متابعة وإسناد المهام والمواعيد للموظفين مع التنبيهات الفورية داخل النظام
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#8c622b] hover:bg-[#704d1f] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إسناد مهمة / موعد جديد</span>
          </button>
        )}
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Filters & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#f3ede0] p-1 rounded-xl border border-[#e2d8c7] w-full sm:w-auto text-xs font-bold">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'all' ? 'bg-[#8c622b] text-white shadow-sm' : 'text-[#6e685f] hover:text-[#2c2824]'
            }`}
          >
            الكل ({tasks.length})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-[#6e685f] hover:text-[#2c2824]'
            }`}
          >
            الجارية ⏳ ({pendingCount})
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              filter === 'completed' ? 'bg-emerald-600 text-white shadow-sm' : 'text-[#6e685f] hover:text-[#2c2824]'
            }`}
          >
            المكتملة  ({completedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو عنوان المهمة..."
            className="w-full pl-3 pr-9 py-2 bg-[#faf7f0] border border-[#e2d8c7] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
          />
          <Search className="w-4 h-4 text-[#8a8377] absolute right-3 top-2.5" />
        </div>
      </div>

      {/* Tasks List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-[#8a8377]">جاري تحميل جدول المهام والمواعيد...</div>
      ) : filteredTasks.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-[#e8dfcf] rounded-2xl bg-[#faf8f3]">
          <Calendar className="w-8 h-8 text-[#a39a8a] mx-auto mb-2" />
          <p className="text-xs font-bold text-[#6e685f]">لا توجد مهام أو مواعيد مسجلة ضمن هذا الفلتر</p>
          <p className="text-[11px] text-[#8a8377] mt-1">يمكنك إضافة مهام جديدة أو التحدث مع الـ AI Manager لإسنادها تلقائياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const isDone = task.status === 'completed';
            return (
              <div
                key={task.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isDone
                    ? 'bg-[#f4f2eb] border-[#dcd4c6] opacity-80'
                    : 'bg-[#faf7f0] border-[#e8dfcf] hover:border-[#8c622b]/40 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleComplete(task.id, task.status)}
                    className={`mt-0.5 p-1 rounded-lg border transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-transparent border-[#c8bba6] hover:border-[#8c622b]'
                    }`}
                    title={isDone ? 'تحديد كغير مكتملة' : 'إنجاز المهمة'}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`text-xs font-bold ${isDone ? 'line-through text-[#8a8377]' : 'text-[#2c2824]'}`}>
                        {task.title}
                      </h4>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                          task.priority === 'high'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : task.priority === 'medium'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-[#e8dfcf] text-[#704d1f]'
                        }`}
                      >
                        {task.priority === 'high' ? 'عالية الأهمية 🔥' : task.priority === 'medium' ? 'متوسطة' : 'عادية'}
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-[11px] text-[#6e685f] leading-relaxed">{task.description}</p>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-[#8a8377] flex-wrap pt-1">
                      <span className="flex items-center gap-1 font-bold text-[#704d1f]">
                        <UserCheck className="w-3 h-3" />
                        <span>الموجه إليه: {task.assignedToName}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-[#8c622b]" />
                        <span>الموعد: {task.dueDate} ({task.dueTime || 'طوال اليوم'})</span>
                      </span>
                      <span>بواسطة: {task.assignedByName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e8dfcf]">
                  <button
                    onClick={() => handleToggleComplete(task.id, task.status)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                      isDone
                        ? 'bg-[#e2d8c7] text-[#2c2824] border-[#c8bba6]'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm'
                    }`}
                  >
                    {isDone ? 'إعادة لجارية' : 'تم الإنجاز '}
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200"
                      title="حذف المهمة"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#fcfbfa] border border-[#dcd2c2] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4 dir-rtl">
            <div className="flex items-center justify-between border-b border-[#e8dfcf] pb-3">
              <h3 className="text-sm font-bold text-[#2c2824] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#8c622b]" />
                <span>إسناد مهمة وتعيين موعد جديد</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#8a8377] hover:text-[#2c2824] text-xs font-bold px-2 py-1 bg-[#e8dfcf] rounded-lg"
              >
                إغلاق ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#2c2824] mb-1">عنوان المهمة / الموعد *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={e => setTaskTitle(e.target.value)}
                  placeholder="مثال: موعد معاينة الشقة مع المالك باسل"
                  className="w-full px-3 py-2 bg-[#faf7f0] border border-[#d8cebe] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2c2824] mb-1">الموظف الموجه إليه المهمة *</label>
                <select
                  value={assignedToEmail}
                  onChange={e => setAssignedToEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#faf7f0] border border-[#d8cebe] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.email}>
                      {u.name} ({u.email}) - {u.role === 'admin' ? 'مدير' : 'موظف'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#2c2824] mb-1">التاريخ *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#faf7f0] border border-[#d8cebe] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2c2824] mb-1">الوقت المحدد *</label>
                  <input
                    type="text"
                    required
                    value={dueTime}
                    onChange={e => setDueTime(e.target.value)}
                    placeholder="مثال: 05:00 PM"
                    className="w-full px-3 py-2 bg-[#faf7f0] border border-[#d8cebe] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2c2824] mb-1">درجة الأهمية</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#faf7f0] border border-[#d8cebe] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                >
                  <option value="high">عالية (تنبيه فوري 🔥)</option>
                  <option value="medium">متوسطة</option>
                  <option value="low">عادية</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2c2824] mb-1">التفاصيل والملاحظات الإضافية</label>
                <textarea
                  rows={3}
                  value={taskDesc}
                  onChange={e => setTaskDesc(e.target.value)}
                  placeholder="أدخل أي ملاحظات أو تعليمات خاصة بالموعد..."
                  className="w-full px-3 py-2 bg-[#faf7f0] border border-[#d8cebe] rounded-xl text-xs text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e8dfcf]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-[#e8dfcf] hover:bg-[#d8cebe] text-[#2c2824] text-xs font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#8c622b] hover:bg-[#704d1f] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {isSubmitting ? 'جاري الحفظ والتنبيه...' : 'تأكيد وإسناد المهمة '}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

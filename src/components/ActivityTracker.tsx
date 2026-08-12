import React, { useState, useEffect } from 'react';
import { User, Customer, Activity } from '../types';
import { maskPhoneNumber } from '../utils/phoneUtils';
import {
  Activity as ActivityIcon,
  PhoneCall,
  MessageSquare,
  Calendar,
  User as UserIcon,
  Clock,
  Filter,
  PlusCircle,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowRightLeft,
  Building2,
  Sparkles,
  FileText,
  X,
  Send,
  SlidersHorizontal
} from 'lucide-react';

interface ActivityTrackerProps {
  currentUser: User | null;
  customers: Customer[];
  onRefreshData?: () => void;
}

export const ActivityTracker: React.FC<ActivityTrackerProps> = ({
  currentUser,
  customers,
  onRefreshData,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add Activity Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustId, setSelectedCustId] = useState('');
  const [actType, setActType] = useState<Activity['type']>('call');
  const [actTitle, setActTitle] = useState('');
  const [actDetails, setActDetails] = useState('');
  const [actOutcome, setActOutcome] = useState('');
  const [actFollowUpDate, setActFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'admin';

  const fetchActivities = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = currentUser && !isAdmin
        ? `/api/activities?userEmail=${encodeURIComponent(currentUser.email)}`
        : '/api/activities';
      const res = await fetch(url);
      if (res.ok) {
        const ct = res.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } else {
        setError('تعذر تحميل الأنشطة من السيرفر');
      }
    } catch (err) {
      setError('حدث خطأ أثناء الاتصال بالباك إند');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [currentUser]);

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const selectedCust = customers.find(c => c.id === selectedCustId);
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustId || undefined,
          type: actType,
          title: actTitle.trim(),
          details: actDetails.trim() || undefined,
          outcome: actOutcome.trim() || undefined,
          performedByEmail: currentUser?.email || 'system',
          performedByName: currentUser?.name || 'الموظف',
          performedByUserCode: currentUser?.userCode || undefined,
          followUpDate: actFollowUpDate || undefined
        }),
      });

      const ct = res.headers.get('content-type');
      if (res.ok && ct && ct.includes('application/json')) {
        const data = await res.json();
        setSuccessMsg(data.message || 'تم تسجيل النشاط وحفظه على السيرفر بنجاح');
        setActTitle('');
        setActDetails('');
        setActOutcome('');
        setActFollowUpDate('');
        setSelectedCustId('');
        setShowAddModal(false);
        fetchActivities();
        if (onRefreshData) onRefreshData();
      } else {
        setError('فشل حفظ النشاط على السيرفر');
      }
    } catch (err) {
      setError('خطأ أثناء إرسال البيانات للباك إند');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter logic
  const filteredActivities = activities.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterAgent !== 'all' && a.performedByEmail.toLowerCase() !== filterAgent.toLowerCase()) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = a.title?.toLowerCase().includes(q);
      const matchDetails = a.details?.toLowerCase().includes(q);
      const matchCustomer = a.customerName?.toLowerCase().includes(q) || a.customerRefCode?.toLowerCase().includes(q);
      const matchAgent = a.performedByName?.toLowerCase().includes(q) || a.performedByEmail?.toLowerCase().includes(q);
      if (!matchTitle && !matchDetails && !matchCustomer && !matchAgent) return false;
    }
    return true;
  });

  // Extract unique agents for filter dropdown
  const uniqueAgents = Array.from(
    new Set(activities.map(a => JSON.stringify({ email: a.performedByEmail, name: a.performedByName })))
  ).map((s: string) => JSON.parse(s));

  const getActivityBadge = (type: Activity['type']) => {
    switch (type) {
      case 'call':
        return { label: 'مكالمة هاتفية', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: PhoneCall };
      case 'whatsapp':
        return { label: 'رسالة واتساب', bg: 'bg-green-50 text-green-800 border-green-200', icon: MessageSquare };
      case 'meeting':
        return { label: 'معاينة / اجتماع', bg: 'bg-purple-50 text-purple-800 border-purple-200', icon: Calendar };
      case 'status_change':
        return { label: 'تحديث حالة', bg: 'bg-amber-50 text-amber-800 border-amber-200', icon: Sparkles };
      case 'transfer':
        return { label: 'تحويل ملكية', bg: 'bg-blue-50 text-blue-800 border-blue-200', icon: ArrowRightLeft };
      case 'workflow':
        return { label: 'تسويق المالك', bg: 'bg-indigo-50 text-indigo-800 border-indigo-200', icon: Building2 };
      case 'created':
        return { label: 'إضافة جديد', bg: 'bg-[#8c622b]/10 text-[#8c622b] border-[#8c622b]/20', icon: PlusCircle };
      default:
        return { label: 'ملاحظة', bg: 'bg-gray-100 text-gray-800 border-gray-200', icon: FileText };
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Main Control Banner */}
      <div className="bg-[#fcfbfa] border border-[#ded5c5] rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 text-[#8c622b] mb-1">
            <ActivityIcon className="w-6 h-6 shrink-0" />
            <h2 className="text-xl font-bold text-[#2c2824]">التتبع التفاعلي وسجل الأنشطة الحي</h2>
          </div>
          <p className="text-[#6e685f] text-xs font-normal leading-relaxed">
            متابعة فورية ومباشرة لكافة المكالمات، الرسائل، تحويلات العملاء، وتحديثات الملاك المحفوظة على السيرفر.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-[#f5efe4] hover:bg-[#eae1d0] text-[#2c2824] border border-[#d8cebe] text-xs font-bold px-4 py-2.5 rounded-2xl transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#8c622b] ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-[#8c622b] hover:bg-[#734f21] text-white border border-[#734f21] text-xs font-bold px-4 py-2.5 rounded-2xl transition-all cursor-pointer shadow-md active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>تسجيل نشاط تفاعلي جديد</span>
          </button>
        </div>
      </div>

      {/* Success / Error Messages */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-bold">
          <X className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Interactive Filters Bar */}
      <div className="bg-[#fcfbfa] border border-[#ded5c5] rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-[#2c2824] text-xs font-bold">
          <SlidersHorizontal className="w-4 h-4 text-[#8c622b]" />
          <span>فلترة البحث المتقدم في سجل الأنشطة:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search text */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-[#8c8275]" />
            <input
              type="text"
              placeholder="ابحث بالعنوان، اسم العميل، أو الكود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs rounded-2xl p-2.5 pr-9 outline-none focus:border-[#8c622b] focus:bg-[#fcfbfa] transition-all"
            />
          </div>

          {/* Activity Type Filter */}
          <div className="relative">
            <Filter className="w-4 h-4 absolute right-3 top-3 text-[#8c8275]" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs rounded-2xl p-2.5 pr-9 outline-none focus:border-[#8c622b] focus:bg-[#fcfbfa] transition-all cursor-pointer font-medium"
            >
              <option value="all">جميع أنواع الأنشطة (الكل)</option>
              <option value="call">📞 مكالمات هاتفية</option>
              <option value="whatsapp">💬 رسائل واتساب</option>
              <option value="meeting">🤝 معاينات واجتماعات</option>
              <option value="status_change">🔄 تحديثات الحالة والنتائج</option>
              <option value="transfer">↔️ تحويلات الملكية</option>
              <option value="workflow">🏢 تسويق الملاك</option>
              <option value="created">➕ إضافة عملاء جديد</option>
              <option value="note">📝 ملاحظات عامة</option>
            </select>
          </div>

          {/* Agent Filter */}
          <div className="relative">
            <UserIcon className="w-4 h-4 absolute right-3 top-3 text-[#8c8275]" />
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs rounded-2xl p-2.5 pr-9 outline-none focus:border-[#8c622b] focus:bg-[#fcfbfa] transition-all cursor-pointer font-medium"
            >
              <option value="all">جميع الموظفين / المسؤولين</option>
              {uniqueAgents.map((ag, i) => (
                <option key={i} value={ag.email}>
                  {ag.name} ({ag.email})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity Log Feed */}
      <div className="bg-[#fcfbfa] border border-[#ded5c5] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#e8e0d0] pb-3">
          <div className="text-sm font-bold text-[#2c2824] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#8c622b]" />
            <span>شريط الأنشطة والمتابعات ({filteredActivities.length})</span>
          </div>
          <span className="text-xs text-[#6e685f]">محفوظة تلقائياً في قاعدة البيانات بالسيرفر</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[#6e685f] space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#8c622b] mx-auto" />
            <p>جاري جلب سجل الأنشطة من السيرفر...</p>
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#6e685f] space-y-2">
            <ActivityIcon className="w-8 h-8 text-[#8c8275] mx-auto opacity-40" />
            <p className="font-bold text-[#2c2824]">لا توجد أنشطة مسجلة مطابقة للفلتر حتى الآن</p>
            <p className="text-[11px]">يمكنك إضافة أول نشاط تفاعلي عبر الزر في الأعلى.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredActivities.map((act) => {
              const badge = getActivityBadge(act.type);
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={act.id}
                  className="bg-[#f8f5ee] hover:bg-[#f2ece1] border border-[#e2d8c7] rounded-2xl p-4 transition-all space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold border ${badge.bg}`}>
                        <BadgeIcon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>

                      {act.customerRefCode && (
                        <span className="bg-[#8c622b]/10 text-[#8c622b] font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg border border-[#8c622b]/20">
                          {act.customerRefCode}
                        </span>
                      )}

                      {act.customerName && (
                        <span className="text-xs font-bold text-[#2c2824]">
                          {act.customerName}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[#6e685f] font-mono flex items-center gap-1.5 dir-ltr">
                      <Clock className="w-3 h-3 text-[#8c8275]" />
                      <span>{new Date(act.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                  </div>

                  {/* Title & Details */}
                  <div className="text-xs font-bold text-[#2c2824] pr-1 flex items-center justify-between gap-2 flex-wrap">
                    <span>{act.title}</span>
                    {act.customerPhone && (
                      <a
                        href={`tel:${act.customerPhone}`}
                        className="text-[11px] bg-[#8c622b]/15 text-[#704d1f] hover:bg-[#8c622b]/25 border border-[#8c622b]/30 px-2.5 py-0.5 rounded-lg font-mono font-bold flex items-center gap-1 transition-colors"
                        title="رقم هاتف العميل المستهدف"
                      >
                        <PhoneCall className="w-3 h-3 text-[#8c622b]" />
                        <span>رقم العميل: {act.customerPhone}</span>
                      </a>
                    )}
                  </div>
                  {act.details && (
                    <p className="text-xs text-[#554f47] leading-relaxed pr-1 bg-[#f0e9dc] p-2.5 rounded-xl border border-[#ded5c5]">
                      {act.details}
                    </p>
                  )}

                  {/* Author & Follow up badge */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-[#6e685f] pt-1 border-t border-[#e2d8c7]/60">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="w-3 h-3 text-[#8c8275]" />
                      <span>المسؤول: <strong className="text-[#2c2824]">{act.performedByName || act.performedByEmail}</strong></span>
                      {act.performedByUserCode && (
                        <span className="bg-[#8c622b] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs">
                          {act.performedByUserCode}
                        </span>
                      )}
                    </div>

                    {act.followUpDate && (
                      <div className="bg-amber-100/80 text-amber-900 px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 border border-amber-200">
                        <Calendar className="w-3 h-3 text-amber-700" />
                        <span>موعد المتابعة: {act.followUpDate}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add New Interactive Activity */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#fcfbfa] border border-[#ded5c5] w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-[#e2d8c7] pb-3">
              <div className="flex items-center gap-2 text-[#8c622b]">
                <PlusCircle className="w-5 h-5" />
                <h3 className="text-base font-bold text-[#2c2824]">تسجيل نشاط تفاعلي جديد</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8c8275] hover:text-[#2c2824] p-1 rounded-xl hover:bg-[#f5efe4] transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddActivity} className="space-y-4">
              {/* Select Customer */}
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">
                  العميل أو المالك المرتبط بالنشاط (اختياري):
                </label>
                <select
                  value={selectedCustId}
                  onChange={(e) => setSelectedCustId(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-medium rounded-2xl p-3 outline-none focus:border-[#8c622b] transition-all cursor-pointer"
                >
                  <option value="">-- نشاط عام للنظام (غير مرتبك بعميل محدد) --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.refCode ? `[${c.refCode}] ` : ''}{c.name || 'عميل بدون اسم'} ({maskPhoneNumber(c.customerNumber || c.phone, isAdmin)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Type */}
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">
                  نوع النشاط:
                </label>
                <select
                  value={actType}
                  onChange={(e) => setActType(e.target.value as Activity['type'])}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-medium rounded-2xl p-3 outline-none focus:border-[#8c622b] transition-all cursor-pointer"
                >
                  <option value="call">📞 مكالمة هاتفية</option>
                  <option value="whatsapp">💬 رسالة واتساب</option>
                  <option value="meeting">🤝 معاينة / اجتماع ميداني</option>
                  <option value="note">📝 ملاحظة متابعة</option>
                  <option value="status_change">🔄 تحديث نتيجة أو حالة</option>
                  <option value="workflow">🏢 إجراء تسويق مالك</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">
                  عنوان النشاط / ملخص التواصل:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تم الاتصال بالعميل وشرح أنظمة السداد"
                  value={actTitle}
                  onChange={(e) => setActTitle(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs rounded-2xl p-3 outline-none focus:border-[#8c622b] transition-all"
                />
              </div>

              {/* Details */}
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">
                  التفاصيل الإضافية والنتائج:
                </label>
                <textarea
                  rows={3}
                  placeholder="اكتب كافة الملاحظات، استجابة العميل، أو أسباب التأجيل..."
                  value={actDetails}
                  onChange={(e) => setActDetails(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs rounded-2xl p-3 outline-none focus:border-[#8c622b] transition-all"
                />
              </div>

              {/* Follow up date */}
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">
                  تحديد موعد المتابعة القادمة (إن وجد):
                </label>
                <input
                  type="date"
                  value={actFollowUpDate}
                  onChange={(e) => setActFollowUpDate(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs rounded-2xl p-3 outline-none focus:border-[#8c622b] transition-all"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-2xl border border-[#ded5c5] text-[#6e685f] hover:bg-[#f5efe4] text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-[#8c622b] hover:bg-[#734f21] text-white border border-[#734f21] text-xs font-bold px-5 py-2.5 rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ على السيرفر...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>حفظ وإضافة للباك إند</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

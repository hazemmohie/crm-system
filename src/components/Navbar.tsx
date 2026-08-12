import React, { useState, useRef, useEffect } from 'react';
import { User, Customer } from '../types';
import { Users, LogOut, CheckCircle2, ShieldCheck, Building2, UserPlus, BookOpen, Bell, Calendar, Clock, AlertCircle, MessageSquare, Phone, ExternalLink, X } from 'lucide-react';
import { formatWhatsAppPhone, formatDisplayPhone, maskPhoneNumber } from '../utils/phoneUtils';

interface NavbarProps {
  currentUser: User | null;
  onLogout: () => void;
  onSwitchUser: (email: string) => void;
  allUsers: User[];
  customers?: Customer[];
  onOpenGuide: () => void;
  onOpenClientRequests?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onLogout,
  onSwitchUser,
  allUsers,
  customers = [],
  onOpenGuide,
  onOpenClientRequests,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeNotifTab, setActiveNotifTab] = useState<'all' | 'today' | 'tasks' | 'overdue'>('all');
  const [systemNotifs, setSystemNotifs] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === 'admin';

  // Fetch System Notifications
  const fetchSystemNotifications = async () => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/notifications?userEmail=${encodeURIComponent(currentUser.email)}`);
      if (res.ok) {
        const data = await res.json();
        setSystemNotifs(data.notifications || []);
      }
    } catch (err) {
      // Periodic notification polling sync
    }
  };

  useEffect(() => {
    fetchSystemNotifications();
    const interval = setInterval(fetchSystemNotifications, 15000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute Follow-Up Notifications for current user (or all if admin)
  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];

  const myCustomers = currentUser
    ? isAdmin
      ? customers
      : customers.filter(c => c.assignedToEmail?.toLowerCase() === currentUser.email.toLowerCase())
    : [];

  // Filter customers with valid follow-up dates
  const followUpNotifications = myCustomers
    .map(c => {
      const date = c.nextFollowUpDate;
      if (!date) return null;

      let notifType: 'today' | 'overdue' | 'upcoming' = 'upcoming';
      if (date === todayStr) {
        notifType = 'today';
      } else if (date < todayStr) {
        notifType = 'overdue';
      }

      return {
        customer: c,
        followUpDate: date,
        note: c.nextFollowUpNote || (c.feedbackHistory?.[c.feedbackHistory.length - 1]?.text) || 'متابعة دورية مع العميل',
        notifType,
      };
    })
    .filter(Boolean) as Array<{
      customer: Customer;
      followUpDate: string;
      note: string;
      notifType: 'today' | 'overdue' | 'upcoming';
    }>;

  // Sort: Today first, Overdue second, Upcoming third
  followUpNotifications.sort((a, b) => {
    const order = { today: 1, overdue: 2, upcoming: 3 };
    if (order[a.notifType] !== order[b.notifType]) {
      return order[a.notifType] - order[b.notifType];
    }
    return a.followUpDate.localeCompare(b.followUpDate);
  });

  const todayCount = followUpNotifications.filter(n => n.notifType === 'today').length;
  const overdueCount = followUpNotifications.filter(n => n.notifType === 'overdue').length;
  const upcomingCount = followUpNotifications.filter(n => n.notifType === 'upcoming').length;
  const unreadSystemNotifs = systemNotifs.filter(n => !n.isRead);
  const totalNotifCount = followUpNotifications.length + unreadSystemNotifs.length;

  // Filter based on active tab inside dropdown
  const filteredNotifs = followUpNotifications.filter(n => {
    if (activeNotifTab === 'today') return n.notifType === 'today';
    if (activeNotifTab === 'overdue') return n.notifType === 'overdue';
    if (activeNotifTab === 'upcoming') return n.notifType === 'upcoming';
    if (activeNotifTab === 'tasks') return false; // task tab shows systemNotifs below separately
    return true; // 'all' tab
  });

  return (
    <header className="bg-[#f2ece1]/95 backdrop-blur-md border-b border-[#e2d8c7] text-[#2c2824] sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Title */}
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-[#8c622b]/10 border border-[#8c622b]/20 rounded-xl text-[#8c622b] shadow-sm">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#2c2824] flex items-center gap-2">
              <span>منظومة إدارة العملاء والعقارات</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e8e0d0] text-[#704d1f] font-bold border border-[#d8ccb8]">
                الإصدار الكلاسيكي
              </span>
            </h1>
            <p className="text-[11px] text-[#6e685f] font-medium">
              توزيع وإدارة صفقات المبيعات والملاك بخصوصية كاملة
            </p>
          </div>
        </div>

        {/* User Info, Notifications & Actions */}
        {currentUser && (
          <div className="flex items-center space-x-3 space-x-reverse">
            
            {/* Follow-Up Notification Bell */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className={`relative p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center ${
                  showNotifications
                    ? 'bg-[#8c622b] text-white border-[#8c622b] font-bold shadow-md'
                    : totalNotifCount > 0
                    ? 'bg-[#eae3d5] text-[#704d1f] border-[#c8bba6] hover:bg-[#dfd7c7]'
                    : 'bg-[#eae3d5] text-[#6e685f] border-[#d8cebe] hover:text-[#2c2824]'
                }`}
                title="تنبيهات مواعيد المتابعة والمهام"
              >
                <Bell className={`w-4 h-4 ${todayCount > 0 || unreadSystemNotifs.length > 0 ? 'animate-bounce text-[#8c622b]' : ''}`} />
                
                {totalNotifCount > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    todayCount > 0 || unreadSystemNotifs.length > 0
                      ? 'bg-rose-600 text-white border-rose-500 animate-pulse'
                      : 'bg-[#8c622b] text-white border-[#704d1f]'
                  }`}>
                    {totalNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {showNotifications && (
                <div className="absolute left-0 sm:right-auto sm:left-0 mt-3 w-80 sm:w-96 bg-[#fcfbfa] border border-[#dcd2c2] rounded-2xl shadow-xl z-50 overflow-hidden dir-rtl">
                  {/* Header */}
                  <div className="p-4 bg-[#f4ede1] border-b border-[#e2d8c7] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-[#8c622b]/10 text-[#8c622b] rounded-lg border border-[#8c622b]/20">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[#2c2824]">تنبيهات مواعيد المتابعة القادمة</h4>
                        <p className="text-[10px] text-[#6e685f]">
                          {totalNotifCount > 0 ? `لديك ${totalNotifCount} عميل يتطلب المتابعة` : 'لا توجد مواعيد متابعة حالياً'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="p-1 text-[#6e685f] hover:text-[#2c2824] rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Filter Tabs */}
                  {totalNotifCount > 0 && (
                    <div className="flex items-center gap-1 p-2 bg-[#f8f4ec] border-b border-[#e2d8c7] text-[11px] font-bold">
                      <button
                        onClick={() => setActiveNotifTab('all')}
                        className={`flex-1 py-1 rounded-lg transition-colors ${
                          activeNotifTab === 'all'
                            ? 'bg-[#8c622b] text-white'
                            : 'text-[#6e685f] hover:text-[#2c2824]'
                        }`}
                      >
                        الكل ({totalNotifCount})
                      </button>
                      <button
                        onClick={() => setActiveNotifTab('today')}
                        className={`flex-1 py-1 rounded-lg transition-colors ${
                          activeNotifTab === 'today'
                            ? 'bg-rose-600 text-white'
                            : 'text-[#6e685f] hover:text-[#2c2824]'
                        }`}
                      >
                        اليوم 🚨 ({todayCount})
                      </button>
                      <button
                        onClick={() => setActiveNotifTab('overdue')}
                        className={`flex-1 py-1 rounded-lg transition-colors ${
                          activeNotifTab === 'overdue'
                            ? 'bg-[#a37233]/20 text-[#704d1f] border border-[#a37233]/30'
                            : 'text-[#6e685f] hover:text-[#2c2824]'
                        }`}
                      >
                        متأخرة ⏰ ({overdueCount})
                      </button>
                      <button
                        onClick={() => setActiveNotifTab('upcoming')}
                        className={`flex-1 py-1 rounded-lg transition-colors ${
                          activeNotifTab === 'upcoming'
                            ? 'bg-[#e2d8c7] text-[#2c2824]'
                            : 'text-[#6e685f] hover:text-[#2c2824]'
                        }`}
                      >
                        قادمة 🔔 ({upcomingCount})
                      </button>
                    </div>
                  )}

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-[#ebd8c0] p-2 space-y-2">
                    {filteredNotifs.length === 0 ? (
                      <div className="p-6 text-center text-[#8a8377] text-xs">
                        {totalNotifCount === 0
                          ? '🎉 لا توجد أية مواعيد متابعة مستحقة الآن'
                          : 'لا توجد تنبيهات ضمن هذا الفلتر'}
                      </div>
                    ) : (
                      filteredNotifs.map(({ customer, followUpDate, note, notifType }) => {
                        const waNum = formatWhatsAppPhone(customer.customerNumber || customer.phone || '');
                        const displayPhone = maskPhoneNumber(customer.customerNumber || customer.phone || '', isAdmin);
                        const refCode = customer.refCode || 'N/A';

                        return (
                          <div
                            key={customer.id}
                            className={`p-3 rounded-xl border transition-all space-y-2 ${
                              notifType === 'today'
                                ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/50'
                                : notifType === 'overdue'
                                ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/50'
                                : 'bg-[#faf7f0] border-[#e8dfcf] hover:bg-[#f3ede0]'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="text-xs font-bold text-[#2c2824] flex items-center gap-1.5">
                                  <span className="font-mono text-[#704d1f] bg-[#e8dfcf] px-1.5 py-0.5 rounded text-[10px]">
                                    {refCode}
                                  </span>
                                  <span>{customer.name || customer.customerNumber || 'عميل'}</span>
                                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                                    customer.category === 'lead'
                                      ? 'bg-[#8c622b]/10 text-[#704d1f] border border-[#8c622b]/20'
                                      : 'bg-purple-900/10 text-purple-800 border border-purple-800/20'
                                  }`}>
                                    {customer.category === 'lead' ? 'عميل محتمل' : 'مالك عقار'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-[#6e685f] font-mono mt-0.5 dir-ltr text-right">
                                  {displayPhone}
                                </div>
                              </div>

                              {/* Due status badge */}
                              {notifType === 'today' ? (
                                <span className="text-[9px] bg-rose-600 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-pulse">
                                  <AlertCircle className="w-2.5 h-2.5" /> مستحق اليوم!
                                </span>
                              ) : notifType === 'overdue' ? (
                                <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" /> متأخر ({followUpDate})
                                </span>
                              ) : (
                                <span className="text-[9px] bg-[#e8e0d0] text-[#2c2824] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <Calendar className="w-2.5 h-2.5" /> {followUpDate}
                                </span>
                              )}
                            </div>

                            {/* Note preview */}
                            {note && (
                              <p className="text-[11px] text-[#423d37] bg-[#f2ebd9] p-2 rounded-lg border border-[#e2d5bf] line-clamp-2">
                                💬 {note}
                              </p>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              {waNum && (
                                <a
                                  href={`https://wa.me/${waNum}?text=${encodeURIComponent('مرحباً، أتواصل معك بخصوص متابعة عقارك/طلبك.')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 transition-colors"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>مراسلة واتساب</span>
                                </a>
                              )}
                              {customer.customerNumber && (
                                <a
                                  href={`tel:${customer.customerNumber}`}
                                  className="p-1.5 bg-[#8c622b] hover:bg-[#704d1f] text-white text-[10px] rounded-lg font-bold flex items-center gap-1 shadow-sm"
                                  title="إجراء مكالمة هاتفية"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>اتصال</span>
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Client Requests Exchange Button */}
            {onOpenClientRequests && (
              <button
                onClick={onOpenClientRequests}
                className="flex items-center gap-1.5 bg-[#8c622b] hover:bg-[#704d1f] text-white border border-[#704d1f] px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="سوق طلبات العملاء المشتركة لمطابقة العروض مع الطلبات"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">سوق الطلبات المشتركة 🏢</span>
              </button>
            )}

            {/* Guide Button */}
            <button
              onClick={onOpenGuide}
              className="flex items-center gap-1.5 bg-[#eae3d5] hover:bg-[#dfd7c7] text-[#2c2824] border border-[#d8cebe] px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#8c622b]" />
              <span className="hidden sm:inline">دليل النظام</span>
            </button>

            {/* Current Account Card */}
            <div className="flex items-center gap-2.5 bg-[#eae3d5]/90 px-3 py-1.5 rounded-xl border border-[#d8cebe]">
              <div className="w-7 h-7 rounded-lg bg-[#8c622b] text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {(currentUser.name || '?').charAt(0)}
              </div>
              <div className="hidden sm:block text-right">
                <div className="text-xs font-bold text-[#2c2824] flex items-center gap-1.5">
                  <span>{currentUser.name}</span>
                  {currentUser.role === 'admin' ? (
                    <span className="text-[10px] bg-[#8c622b]/15 text-[#704d1f] px-1.5 py-0.2 rounded-md border border-[#8c622b]/30 flex items-center gap-0.5 font-bold">
                      <ShieldCheck className="w-3 h-3" /> أدمن
                    </span>
                  ) : currentUser.status === 'approved' ? (
                    <span className="text-[10px] bg-emerald-800/10 text-emerald-800 px-1.5 py-0.2 rounded-md border border-emerald-800/20 flex items-center gap-0.5 font-bold">
                      <CheckCircle2 className="w-3 h-3" /> معتمد
                    </span>
                  ) : (
                    <span className="text-[10px] bg-[#d8cebe] text-[#6e685f] px-1.5 py-0.2 rounded-md border border-[#c8bba6] flex items-center gap-0.5 font-bold">
                      <UserPlus className="w-3 h-3" /> معلق
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={onLogout}
              className="p-2 text-[#6e685f] hover:text-rose-700 hover:bg-[#eae3d5] rounded-xl transition-all flex items-center gap-1 text-xs cursor-pointer border border-transparent hover:border-[#d8cebe]"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};


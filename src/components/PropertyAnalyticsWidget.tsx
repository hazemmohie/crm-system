import React, { useState } from 'react';
import { Customer } from '../types';
import { calculatePropertyAnalytics, filterCustomersByPropertyCategory } from '../utils/analyticsUtils';
import { formatWhatsAppPhone, ensureCountryCode, formatDisplayPhone, maskPhoneNumber } from '../utils/phoneUtils';
import { exportCustomersToCSV } from '../utils/exportUtils';
import { Building2, Home, CheckCircle2, PhoneOff, MessageSquare, Phone, ArrowUpRight, Filter, Search, Download, FileSpreadsheet, ShieldCheck } from 'lucide-react';

interface PropertyAnalyticsWidgetProps {
  customers: Customer[];
  isAdmin?: boolean;
  onAddFeedback?: (id: string, text: string, status: string) => void;
}

export const PropertyAnalyticsWidget: React.FC<PropertyAnalyticsWidgetProps> = ({
  customers,
  isAdmin = false,
  onAddFeedback,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<
    'all' | 'contacted' | 'unspecified' | 'units_sale' | 'units_rent' | 'no_response' | 'not_interested'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = calculatePropertyAnalytics(customers);

  // Unique Call & WhatsApp customer metrics (strictly 1 count per unique customer)
  const uniqueCallsCount = customers.filter(c =>
    (c.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('اتصال'))
  ).length;

  const uniqueWhatsAppCount = customers.filter(c =>
    (c.feedbackHistory || []).some(f => (f.text || '').includes('💬') || (f.text || '').includes('واتساب'))
  ).length;

  const filteredList = filterCustomersByPropertyCategory(customers, selectedCategoryFilter).filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const phone = (c.customerNumber || c.phone || '').toLowerCase();
    const name = (c.name || '').toLowerCase();
    const notes = (c.notes || '').toLowerCase();
    const agent = (c.assignedToName || '').toLowerCase();
    return phone.includes(q) || name.includes(q) || notes.includes(q) || agent.includes(q);
  });

  const cards = [
    {
      id: 'contacted' as const,
      title: 'المكتمل التواصل معهم (سجل الاتصال) 📞',
      subtitle: 'عملاء تم إجراء اتصال أو واتساب موثق معهم (فريدين)',
      count: stats.totalContacted,
      bgColor: 'bg-blue-950/20 border-blue-500/40 text-blue-900',
      activeColor: 'bg-blue-800 text-white border-blue-900 shadow-md',
      icon: Phone,
    },
    {
      id: 'unspecified' as const,
      title: 'تم التواصل - بانتظار تحديد الموقف 📋',
      subtitle: 'أرقام تواصلنا معهم ولم يُحدد موقفهم ببيع أو إيجار بعد',
      count: stats.unspecifiedStatusCount,
      bgColor: 'bg-amber-950/20 border-amber-500/40 text-amber-900',
      activeColor: 'bg-[#8c622b] text-white border-[#704d1f] shadow-md',
      icon: MessageSquare,
    },
    {
      id: 'units_sale' as const,
      title: 'مؤكد معروض للبيع 🏢',
      subtitle: 'عملاء وملاك أكدوا صراحة رغبتهم في البيع',
      count: stats.totalUnitsForSale,
      bgColor: 'bg-emerald-950/20 border-emerald-500/40 text-emerald-800',
      activeColor: 'bg-emerald-800 text-white border-emerald-900 shadow-md',
      icon: Building2,
    },
    {
      id: 'units_rent' as const,
      title: 'مؤكد معروض للإيجار 🔑',
      subtitle: 'عملاء وملاك أكدوا صراحة رغبتهم في التأجير',
      count: stats.totalUnitsForRent,
      bgColor: 'bg-purple-950/20 border-purple-500/40 text-purple-900',
      activeColor: 'bg-purple-800 text-white border-purple-900 shadow-md',
      icon: Home,
    },
    {
      id: 'no_response' as const,
      title: 'لم يرد / بانتظار الاتصال الأول ⏳',
      subtitle: 'أرقام لم تُجب أو بانتظار بدء التواصل معها',
      count: stats.noResponseCount,
      bgColor: 'bg-rose-950/20 border-rose-500/40 text-rose-900',
      activeColor: 'bg-rose-800 text-white border-rose-900 shadow-md',
      icon: PhoneOff,
    },
  ];

  return (
    <div className="bg-[#fcfbfa] border-2 border-[#8c622b]/30 rounded-3xl p-5 sm:p-6 space-y-6 shadow-sm dir-rtl">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#e2d8c7] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#8c622b]/15 text-[#704d1f] text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-[#8c622b]/30">
              📊 تحليلات العقارات وتصدير ملفات نهاية اليوم
            </span>
            {selectedCategoryFilter !== 'all' && (
              <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                تصفية نشطة: {cards.find((c) => c.id === selectedCategoryFilter)?.title}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-[#2c2824] mt-1">
            إحصائيات الوحدات المتاحة وتصدير الأرقام حسب الاستجابة 📥
          </h2>
          <p className="text-xs text-[#6e685f]">
            يتم تسجيل كافة التفاعلات تلقائياً مع مراعاة حفظ الأرقام التي استجابت والمتابعة في ملف، والأرقام التي لم ترد في ملف آخر لإعادة تشغيلها.
          </p>
        </div>

        {/* End-of-Day File Export Buttons - Restricted to Admin/Owner */}
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <button
                onClick={() => exportCustomersToCSV(customers, 'قائمة_المتابعة_والبيع_والإيجار', 'followup_sales')}
                className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold px-3 py-2 rounded-xl border border-emerald-900 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="تصدير الشقق والأرقام التي استجابت وستتم متابعتها لملف Excel/CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>📥 ملف المتابعة والبيع</span>
              </button>

              <button
                onClick={() => exportCustomersToCSV(customers, 'قائمة_لم_يرد_لإعادة_التواصل', 'no_answer')}
                className="bg-[#8c622b] hover:bg-[#704d1f] text-white text-xs font-bold px-3 py-2 rounded-xl border border-[#704d1f] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="تصدير الأرقام التي لم ترد لإعادة الشغل عليها وتوزيعها"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>🔄 ملف لم يرد (إعادة تشغيل)</span>
              </button>

              <button
                onClick={() => exportCustomersToCSV(customers, 'قائمة_غير_المهتمين', 'not_interested')}
                className="bg-[#eae3d5] hover:bg-[#dfd7c7] text-[#2c2824] text-xs font-bold px-3 py-2 rounded-xl border border-[#d8cebe] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title="تصدير أرقام غير المهتمين للحفظ والطلبات"
              >
                <Download className="w-3.5 h-3.5 text-[#6e685f]" />
                <span>🚫 ملف غير المهتمين</span>
              </button>
            </>
          ) : (
            <div className="text-xs font-bold text-[#704d1f] bg-[#eae3d5] px-3.5 py-2 rounded-xl border border-[#d8cebe] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8c622b] shrink-0" />
              <span>🔒 تنبيه أمني: تصدير وحفظ ملفات الأرقام مقتصر حصرياً على إدارة الشركة لمنع تسريب البيانات.</span>
            </div>
          )}

          {selectedCategoryFilter !== 'all' && (
            <button
              onClick={() => setSelectedCategoryFilter('all')}
              className="text-xs font-bold bg-[#f5efe4] hover:bg-[#eae3d5] text-[#2c2824] px-3 py-2 rounded-xl border border-[#d8cebe] transition-colors cursor-pointer"
            >
              إلغاء الفلتر ({customers.length})
            </button>
          )}
        </div>
      </div>

      {/* Phone Call & WhatsApp Unique Counter Banner */}
      <div className="bg-[#f5efe4] border border-[#e2d8c7] rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-[#8c622b]" />
          <span className="text-xs font-bold text-[#2c2824]">
            {isAdmin ? 'إحصائيات إنجاز المبيعات (عملاء فريدين):' : 'إحصائيات عملك الشخصية (عملاء فريدين):'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 sm:gap-4">
          <div className="bg-[#ffffff] border border-emerald-500/40 px-3 py-2 rounded-xl flex items-center gap-2 shadow-2xs">
            <Phone className="w-4 h-4 text-emerald-800 shrink-0" />
            <div>
              <div className="text-[10px] text-[#6e685f] font-semibold">المكالمات (عملاء فريدين)</div>
              <div className="text-sm font-black text-emerald-800">{uniqueCallsCount} عميل 📞</div>
            </div>
          </div>

          <div className="bg-[#ffffff] border border-emerald-500/40 px-3 py-2 rounded-xl flex items-center gap-2 shadow-2xs">
            <MessageSquare className="w-4 h-4 text-emerald-800 shrink-0" />
            <div>
              <div className="text-[10px] text-[#6e685f] font-semibold">الواتساب (عملاء فريدين)</div>
              <div className="text-sm font-black text-emerald-800">{uniqueWhatsAppCount} عميل 💬</div>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-[#8c622b] font-bold bg-[#eae3d5] px-2.5 py-1 rounded-lg border border-[#d8cebe] text-center sm:text-right">
          🔒 يُحسب العميل مرة واحدة فقط مهما كُرِّر الضغط
        </div>
      </div>

      {/* 5 Core Interactive Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedCategoryFilter === card.id;

          return (
            <div
              key={card.id}
              onClick={() => setSelectedCategoryFilter(isSelected ? 'all' : card.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 relative overflow-hidden ${
                isSelected ? card.activeColor : `${card.bgColor} hover:scale-[1.02]`
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : ''}`} />
                <span className={`text-2xl font-black ${isSelected ? 'text-white' : ''}`}>{card.count}</span>
              </div>

              <div>
                <div className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : ''}`}>{card.title}</div>
                <div className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-white/80' : 'text-[#6e685f]'}`}>
                  {card.subtitle}
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-[10px] font-bold">
                <span>{isSelected ? 'تحديد نشط 🎯' : 'اضغط للتصفية'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtered Results Header & Search Bar */}
      {selectedCategoryFilter !== 'all' && (
        <div className="bg-[#f5efe4] border border-[#d8cebe] rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#8c622b]" />
              <span className="text-xs font-bold text-[#2c2824]">
                نتائج التصنيف المحدد ({filteredList.length} رقم):
              </span>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#6e685f] absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث بالرقم المزود بكود الدولة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#ffffff] border border-[#d8cebe] text-xs rounded-xl pr-8 pl-3 py-1.5 outline-none font-bold text-[#2c2824]"
              />
            </div>
          </div>

          {/* Quick List Table */}
          <div className="overflow-x-auto bg-[#ffffff] rounded-xl border border-[#d8cebe]">
            <table className="w-full text-right text-xs text-[#2c2824]">
              <thead className="bg-[#f2ece1] text-[#6e685f] font-bold border-b border-[#e2d8c7]">
                <tr>
                  <th className="p-2.5">الكود المرجعي</th>
                  <th className="p-2.5">رقم الهاتف (بكود الدولة)</th>
                  <th className="p-2.5">النوع / التصنيف</th>
                  <th className="p-2.5">حالة التواصل والاستجابة</th>
                  <th className="p-2.5">الموظف المسئول</th>
                  <th className="p-2.5">التواصل الفوري</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e8e0d0]">
                {filteredList.length > 0 ? (
                  filteredList.map((c) => {
                    const rawNum = c.customerNumber || c.phone || '';
                    const displayPhone = ensureCountryCode(rawNum);
                    const waDigits = formatWhatsAppPhone(rawNum);

                    return (
                      <tr key={c.id} className="hover:bg-[#f8f5ee]">
                        <td className="p-2.5 font-mono font-bold text-[#8c622b]">{c.refCode || 'OW-000'}</td>
                        <td className="p-2.5 font-mono font-bold text-[#2c2824] dir-ltr text-right">
                          {maskPhoneNumber(rawNum, isAdmin)}
                        </td>
                        <td className="p-2.5 font-bold">
                          {c.category === 'owner' ? (
                            <span className="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full text-[10px]">
                              مالك 🏢
                            </span>
                          ) : (
                            <span className="bg-[#8c622b]/10 text-[#704d1f] border border-[#8c622b]/20 px-2 py-0.5 rounded-full text-[10px]">
                              مشتري / مستأجر 🎯
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold text-[#704d1f]">
                          {c.lastOutcomePreset || c.status || 'بانتظار التواصل'}
                        </td>
                        <td className="p-2.5 text-[#6e685f]">{c.assignedToName || 'غير مخصص'}</td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            {waDigits && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await fetch('/api/activities', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        customerId: c.id,
                                        type: 'whatsapp',
                                        title: `💬 محادثة واتساب: تواصل مع العميل (${c.name || c.customerNumber})`,
                                        details: `فتح مراسلة الواتساب بواسطة [${c.assignedToName || 'الموظف المكلف'}]`,
                                        performedByName: c.assignedToName || 'الموظف',
                                        performedByEmail: c.assignedToEmail || 'system'
                                      })
                                    });
                                  } catch (err) {
                                    console.error(err);
                                  }
                                  window.open(`https://wa.me/${waDigits}`, '_blank', 'noopener,noreferrer');
                                }}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>واتساب</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await fetch('/api/activities', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      customerId: c.id,
                                      type: 'call',
                                      title: `📞 مكالمة هاتفية: اتصال مباشر بالعميل (${c.name || c.customerNumber})`,
                                      details: `إجراء اتصال هاتف مباشر بواسطة [${c.assignedToName || 'الموظف المكلف'}]`,
                                      performedByName: c.assignedToName || 'الموظف',
                                      performedByEmail: c.assignedToEmail || 'system'
                                    })
                                  });
                                } catch (err) {
                                  console.error(err);
                                }
                                window.location.href = `tel:${waDigits || c.customerNumber}`;
                              }}
                              className="bg-[#8c622b] hover:bg-[#704d1f] text-white text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm cursor-pointer"
                              title="اتصال مباشر"
                            >
                              <Phone className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-[#6e685f] text-xs">
                      لا توجد أرقام مسجلة تطابق هذا التصنيف حالياً
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

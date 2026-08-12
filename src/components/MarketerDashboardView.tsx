import React, { useState } from 'react';
import { User, Customer } from '../types';
import {
  Megaphone,
  PlusCircle,
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  UserCheck,
  Search,
  Filter,
  Send,
  Building,
  Target,
  Sparkles,
  BarChart3,
  Calendar,
  Layers,
  AlertCircle
} from 'lucide-react';
import { formatDisplayPhone } from '../utils/phoneUtils';

interface MarketerDashboardViewProps {
  currentUser: User;
  allUsers: User[];
  customers: Customer[];
  onRefreshData?: () => void;
}

export const MarketerDashboardView: React.FC<MarketerDashboardViewProps> = ({
  currentUser,
  allUsers,
  customers,
  onRefreshData
}) => {
  // Input Form State
  const [entryMode, setEntryMode] = useState<'single' | 'bulk'>('single');
  const [category, setCategory] = useState<'lead' | 'owner'>('lead');
  const [campaignName, setCampaignName] = useState('');
  const [leadSource, setLeadSource] = useState('paid_ad');
  
  // Single Entry
  const [singleName, setSingleName] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [singleNotes, setSingleNotes] = useState('');
  const [interestType, setInterestType] = useState('عميل راغب بالشراء/الاستئجار');
  const [budget, setBudget] = useState('');

  // Bulk Entry
  const [bulkText, setBulkText] = useState('');
  const [autoDistribute, setAutoDistribute] = useState(true);

  // Status & Filters
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Filter customers that belong to or were uploaded by this marketer
  const marketerCustomers = customers.filter(c => 
    c.uploadedByEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    c.createdByEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    c.marketingAccountEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    c.assignedToEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
    (c.feedbackHistory || []).some(f => f.authorEmail?.toLowerCase() === currentUser.email.toLowerCase())
  );

  // Statistics
  const totalEntered = marketerCustomers.length;
  const assignedToSalesCount = marketerCustomers.filter(c => !!c.assignedToEmail).length;
  const contactedByPhoneCount = marketerCustomers.filter(c => 
    (c.feedbackHistory || []).some(f => f.text?.includes('📞') || f.text?.includes('اتصال'))
  ).length;
  const contactedByWhatsAppCount = marketerCustomers.filter(c => 
    (c.feedbackHistory || []).some(f => f.text?.includes('💬') || f.text?.includes('واتساب'))
  ).length;
  const interestedCount = marketerCustomers.filter(c => 
    c.status === 'interested_sale' || c.status === 'interested_rent' || c.status === 'won'
  ).length;

  // Get list of unique campaign names from marketer's uploaded leads
  const campaignNames = Array.from(
    new Set(marketerCustomers.map(c => c.campaignName).filter(Boolean))
  ) as string[];

  // Submit Single or Bulk Customer Entry
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    let itemsToAdd: any[] = [];

    if (entryMode === 'single') {
      if (!singlePhone.trim()) {
        setErrorMsg('يرجى إدخال رقم الهاتف الجوال للعميل');
        return;
      }

      itemsToAdd.push({
        customerNumber: singlePhone.trim(),
        name: singleName.trim() || undefined,
        phone: singlePhone.trim(),
        notes: singleNotes.trim() || undefined,
        category,
        leadSource,
        campaignName: campaignName.trim() || undefined,
        createdByEmail: currentUser.email,
        createdByName: currentUser.name,
        uploadedByEmail: currentUser.email,
        marketingAccountEmail: currentUser.email,
        leadDetails: category === 'lead' ? {
          interestType: interestType.trim(),
          budget: budget.trim() || undefined,
          priority: 'high'
        } : undefined
      });
    } else {
      // Bulk Entry Parsing
      if (!bulkText.trim()) {
        setErrorMsg('يرجى لصق الأرقام المراد إدخالها');
        return;
      }

      const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        // Line format can be: "Name, Phone, Notes" OR just "Phone"
        const parts = line.split(/[,;\t]/).map(p => p.trim());
        let phoneNum = parts[0];
        let nameVal = parts[1] || '';
        let notesVal = parts[2] || '';

        // Check if first part looks like name and second part looks like phone
        if (!/^\+?\d{8,15}$/.test(phoneNum) && /^\+?\d{8,15}$/.test(nameVal)) {
          const temp = phoneNum;
          phoneNum = nameVal;
          nameVal = temp;
        }

        if (phoneNum) {
          itemsToAdd.push({
            customerNumber: phoneNum,
            name: nameVal || undefined,
            phone: phoneNum,
            notes: notesVal || undefined,
            category,
            leadSource,
            campaignName: campaignName.trim() || undefined,
            createdByEmail: currentUser.email,
            createdByName: currentUser.name,
            uploadedByEmail: currentUser.email,
            marketingAccountEmail: currentUser.email
          });
        }
      });
    }

    if (itemsToAdd.length === 0) {
      setErrorMsg('لم يتم التعرف على أية أرقام صحيحة للإدخال');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToAdd,
          autoDistribute,
          requesterEmail: currentUser.email,
          creatorEmail: currentUser.email
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'حدث خطأ أثناء حفظ الأرقام');
      }

      setSuccessMsg(`تم إدخال ${itemsToAdd.length} رقم بنجاح للحملة [${campaignName || 'عامة'}]! ${autoDistribute ? 'وتم إسناد الأرقام تلقائياً لفريق المبيعات.' : ''}`);
      
      // Reset form
      setSingleName('');
      setSinglePhone('');
      setSingleNotes('');
      setBudget('');
      setBulkText('');

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      setErrorMsg(err.message || 'فشل الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  // Filtered list for audit
  const filteredCustomers = marketerCustomers.filter((c) => {
    const matchesSearch =
      c.customerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.assignedToName && c.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCampaign =
      campaignFilter === 'all' ? true : c.campaignName === campaignFilter;

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'contacted'
        ? (c.feedbackHistory || []).length > 0
        : statusFilter === 'pending'
        ? (c.feedbackHistory || []).length === 0
        : c.status === statusFilter;

    return matchesSearch && matchesCampaign && matchesStatus;
  });

  return (
    <div className="space-y-6 dir-rtl font-sans max-w-7xl mx-auto px-2 sm:px-4">
      {/* Top Banner & KPI Summary Cards */}
      <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-4 sm:p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#8c622b]/15 text-[#704d1f] text-[11px] px-3 py-1 rounded-full border border-[#8c622b]/30 font-extrabold flex items-center gap-1">
                <Megaphone className="w-3.5 h-3.5" />
                لوحة المسوق المباشر (Marketer Dashboard)
              </span>
              <span className="text-[#6e685f] text-xs font-medium hidden sm:inline">تغذية الحملات ومتابعة أرقام المبيعات</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-[#2c2824] mt-2">
              إدخال أرقام الحملات الإعلانية وتتبع نتائج اتصال فريق المبيعات 📣
            </h1>
            <p className="text-xs text-[#6e685f] mt-1">
              مرحباً <span className="font-bold text-[#8c622b]">{currentUser.name}</span>! يمكنك هنا إدخال أرقام الحملات، متابعة من قام بالاتصال بها من موظفي المبيعات، ومعرفة نتائج كل رقم والتفاعل الوارد عليه فورياً.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div className="bg-[#f5efe4] border border-[#e2d8c7] p-3.5 rounded-2xl">
            <div className="text-[11px] text-[#704d1f] font-bold flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-[#8c622b]" /> إجمالي الأرقام:
            </div>
            <div className="text-xl font-black text-[#2c2824] mt-1">{totalEntered}</div>
            <span className="text-[10px] text-[#6e685f]">أرقام مضافة بواسطتك</span>
          </div>

          <div className="bg-[#f5efe4] border border-[#e2d8c7] p-3.5 rounded-2xl">
            <div className="text-[11px] text-[#704d1f] font-bold flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-700" /> مسندة للمبيعات:
            </div>
            <div className="text-xl font-black text-blue-800 mt-1">{assignedToSalesCount}</div>
            <span className="text-[10px] text-[#6e685f]">جاري متابعتها بالمبيعات</span>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-2xl">
            <div className="text-[11px] text-amber-800 font-bold flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-amber-700" /> اتصالات الهاتف:
            </div>
            <div className="text-xl font-black text-amber-900 mt-1">{contactedByPhoneCount}</div>
            <span className="text-[10px] text-amber-800/80">مكالمات موثقة من المبيعات</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl">
            <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-700" /> رسائل الواتساب:
            </div>
            <div className="text-xl font-black text-emerald-900 mt-1">{contactedByWhatsAppCount}</div>
            <span className="text-[10px] text-emerald-700">مراسلات واتساب موثقة</span>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-2xl col-span-2 sm:col-span-1">
            <div className="text-[11px] text-purple-800 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-700" /> العملاء المهتمون:
            </div>
            <div className="text-xl font-black text-purple-900 mt-1">{interestedCount}</div>
            <span className="text-[10px] text-purple-700">فرص محققة ومغلقة</span>
          </div>
        </div>
      </div>

      {/* Input Section: Marketer Data Feed */}
      <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2d8c7] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#2c2824] flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-[#8c622b]" />
              <span>إدخال أرقام جديدة للحملات التسويقية</span>
            </h2>
            <p className="text-xs text-[#6e685f] mt-0.5">
              قم بترميز الحملة وإدخال أرقام العملاء أو الملاك ليتم إسنادها فورياً لموظفي المبيعات.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#f2ece1] p-1 rounded-2xl border border-[#d8cebe] self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setEntryMode('single')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                entryMode === 'single'
                  ? 'bg-[#8c622b] text-white shadow-xs'
                  : 'text-[#6e685f] hover:text-[#2c2824]'
              }`}
            >
              رقم منفرد
            </button>
            <button
              type="button"
              onClick={() => setEntryMode('bulk')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                entryMode === 'bulk'
                  ? 'bg-[#8c622b] text-white shadow-xs'
                  : 'text-[#6e685f] hover:text-[#2c2824]'
              }`}
            >
              إدخال متعدد (جملة)
            </button>
          </div>
        </div>

        {/* Feedback Alert Messages */}
        {successMsg && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs text-rose-800 font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmitEntry} className="space-y-4">
          {/* Common Campaign Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-[#704d1f] block mb-1">تصنيف الرقم:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b] font-medium"
              >
                <option value="lead">🎯 عميل محتمل (Lead - شراء / إيجار)</option>
                <option value="owner">🏠 مالك عقار (Owner - عارض عقار)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#704d1f] block mb-1">اسم الحملة الإعلانية:</label>
              <input
                type="text"
                placeholder="مثال: إعلان سناب شات - شقق الرياض"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#704d1f] block mb-1">مصدر الحملة:</label>
              <select
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b] font-medium"
              >
                <option value="paid_ad">📣 إعلان ممول (Paid Ad)</option>
                <option value="organic_marketing">🌱 تسويق أورجانيك (Organic)</option>
                <option value="direct_campaign">🎯 حملة مباشرة / استهداف</option>
              </select>
            </div>
          </div>

          {/* Single Entry Mode */}
          {entryMode === 'single' ? (
            <div className="bg-[#f5efe4] border border-[#e2d8c7] p-4 rounded-2xl space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#704d1f] block mb-1">رقم الهاتف الجوال <span className="text-rose-600">*</span>:</label>
                  <input
                    type="text"
                    placeholder="05xxxxxxxx"
                    value={singlePhone}
                    onChange={(e) => setSinglePhone(e.target.value)}
                    className="w-full bg-white border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b] dir-ltr text-right"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#704d1f] block mb-1">اسم العميل (اختياري):</label>
                  <input
                    type="text"
                    placeholder="اسم العميل إن وجد..."
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    className="w-full bg-white border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b]"
                  />
                </div>
              </div>

              {category === 'lead' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#704d1f] block mb-1">نوع الاهتمام / الطلب:</label>
                    <input
                      type="text"
                      placeholder="مثال: شقة للبيع في حطين"
                      value={interestType}
                      onChange={(e) => setInterestType(e.target.value)}
                      className="w-full bg-white border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#704d1f] block mb-1">الميزانية المتوقعة:</label>
                    <input
                      type="text"
                      placeholder="مثال: 1,500,000 ريال"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full bg-white border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-[#704d1f] block mb-1">ملاحظات المسوق / تفاصيل الإعلان:</label>
                <textarea
                  rows={2}
                  placeholder="أي معلومات إضافية سجلها العميل في نموذج الإعلان..."
                  value={singleNotes}
                  onChange={(e) => setSingleNotes(e.target.value)}
                  className="w-full bg-white border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b]"
                />
              </div>
            </div>
          ) : (
            /* Bulk Entry Mode */
            <div className="bg-[#f5efe4] border border-[#e2d8c7] p-4 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-[#704d1f] block">
                الصق قائمة الأرقام (كل رقم في سطر منفصل، أو بتنسيق: الاسم, الرقم):
              </label>
              <textarea
                rows={5}
                placeholder={`مثال:\n0501234567\nأحمد علي, 0559876543, مهتم بفلل الملقا\n0541112223`}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="w-full bg-white border border-[#d8cebe] text-[#2c2824] text-xs font-mono rounded-xl p-3 outline-none focus:border-[#8c622b]"
              />
              <span className="text-[11px] text-[#6e685f] block">
                سيقوم النظام بفلترة واستخراج الأرقام وتنسيقها تلقائياً.
              </span>
            </div>
          )}

          {/* Options & Action button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#2c2824]">
              <input
                type="checkbox"
                checked={autoDistribute}
                onChange={(e) => setAutoDistribute(e.target.checked)}
                className="w-4 h-4 rounded text-[#8c622b] focus:ring-[#8c622b] cursor-pointer"
              />
              <span>توزيع الأرقام تلقائياً وفورياً على موظفي المبيعات النشطين 🎯</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-[#8c622b] hover:bg-[#704d1f] text-white font-black text-xs px-6 py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'جاري حفظ الأرقام...' : 'تغذية وإرسال الأرقام للنظام 🚀'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Live Marketer Audit Feed: Numbers Status & Sales Responses */}
      <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2d8c7] pb-4">
          <div>
            <h2 className="text-base font-bold text-[#2c2824] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#8c622b]" />
              <span>تتبع وتدقيق أرقامك المدخلة بالحملات ({filteredCustomers.length})</span>
            </h2>
            <p className="text-xs text-[#6e685f] mt-0.5">
              استعرض الموظف المكلف بالاتصال برقمك، طريقة التواصل (هاتف/واتساب)، والملاحظات المسجلة.
            </p>
          </div>

          {/* Search & Campaign Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث بالرقم أو الموظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl pr-8 pl-3 py-1.5 outline-none focus:border-[#8c622b]"
              />
            </div>

            {campaignNames.length > 0 && (
              <select
                value={campaignFilter}
                onChange={(e) => setCampaignFilter(e.target.value)}
                className="bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-1.5 outline-none font-medium"
              >
                <option value="all">كافة الحملات</option>
                {campaignNames.map((camp) => (
                  <option key={camp} value={camp}>
                    {camp}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-1.5 outline-none font-medium"
            >
              <option value="all">كافة الحالات</option>
              <option value="contacted">تم التواصل من المبيعات 📞</option>
              <option value="pending">بانتظار الاتصال الأول ⏳</option>
              <option value="interested_sale">مهتم بالبيع 🏢</option>
              <option value="interested_rent">مهتم بالتأجير 🔑</option>
              <option value="no_answer">لم يرد ❌</option>
              <option value="not_interested">غير مهتم 🚫</option>
            </select>
          </div>
        </div>

        {/* Customer Audit Feed Cards */}
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-12 bg-[#f5efe4] rounded-2xl border border-dashed border-[#d8cebe]">
            <Megaphone className="w-12 h-12 text-[#8c622b]/40 mx-auto mb-2" />
            <p className="text-xs font-bold text-[#704d1f]">لا توجد أرقام مطابقة للفلاتر الحالية</p>
            <p className="text-[11px] text-[#6e685f] mt-1">قم بإدخال أرقام جديدة أعلاه ليتم إدراجها وتتبع نتائجها فورياً.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredCustomers.map((cust) => {
              const phoneCount = (cust.feedbackHistory || []).filter(f => f.text?.includes('📞') || f.text?.includes('اتصال')).length;
              const waCount = (cust.feedbackHistory || []).filter(f => f.text?.includes('💬') || f.text?.includes('واتساب')).length;
              const lastFeedback = cust.feedbackHistory && cust.feedbackHistory.length > 0 ? cust.feedbackHistory[0] : null;

              return (
                <div key={cust.id} className="bg-[#f8f5ee] border border-[#e2d8c7] rounded-2xl p-4 space-y-3 shadow-2xs hover:border-[#8c622b]/50 transition-all">
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2d8c7] pb-3 bg-[#fcfbfa] p-3 rounded-2xl">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-black text-sm sm:text-base text-[#2c2824]">
                          {cust.name || 'عميل بدون اسم'}
                        </span>
                        <span className="bg-[#8c622b]/15 text-[#704d1f] text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border border-[#8c622b]/30">
                          {cust.refCode || 'N/A'}
                        </span>
                      </div>

                      <div className="text-base sm:text-lg font-black text-[#8c622b] font-mono dir-ltr text-right bg-white px-3 py-1 rounded-xl border border-[#d8cebe] shadow-2xs tracking-wider w-fit">
                        {formatDisplayPhone(cust.customerNumber)}
                      </div>
                    </div>

                    <span className={`self-start sm:self-auto text-xs font-black px-2.5 py-1 rounded-xl border ${
                      cust.category === 'lead'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-blue-100 text-blue-900 border-blue-300'
                    }`}>
                      {cust.category === 'lead' ? '🎯 Lead' : '🏠 Owner'}
                    </span>
                  </div>

                  {/* Campaign Tag */}
                  {cust.campaignName && (
                    <div className="bg-[#eae3d5] border border-[#d8cebe] rounded-xl px-2.5 py-1 text-[11px] text-[#704d1f] font-bold flex items-center justify-between">
                      <span className="truncate">الحملة: {cust.campaignName}</span>
                      <span className="text-[10px] text-[#6e685f] shrink-0">{cust.leadSource === 'paid_ad' ? 'ممولة 📣' : 'أورجانيك 🌱'}</span>
                    </div>
                  )}

                  {/* Sales Agent Assignment Badge */}
                  <div className="bg-[#f5efe4] border border-[#d8cebe] rounded-xl p-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-[#2c2824]">
                      <UserCheck className="w-4 h-4 text-[#8c622b]" />
                      <span>الموظف المكلف:</span>
                    </div>
                    {cust.assignedToName || cust.assignedToEmail ? (
                      <span className="font-bold text-[#8c622b]">
                        {cust.assignedToName || cust.assignedToEmail}
                      </span>
                    ) : (
                      <span className="text-amber-800 font-bold bg-amber-100 px-2 py-0.5 rounded-full text-[10px]">
                        ⏳ بانتظار الإسناد للمبيعات
                      </span>
                    )}
                  </div>

                  {/* Live Communication Counters */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`p-2 rounded-xl border flex items-center justify-between ${
                      phoneCount > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 font-bold' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      <span className="flex items-center gap-1 text-[11px]">
                        <Phone className="w-3.5 h-3.5" /> مكالمات:
                      </span>
                      <span className="font-extrabold">{phoneCount}</span>
                    </div>

                    <div className={`p-2 rounded-xl border flex items-center justify-between ${
                      waCount > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-slate-100 border-slate-200 text-slate-500'
                    }`}>
                      <span className="flex items-center gap-1 text-[11px]">
                        <MessageSquare className="w-3.5 h-3.5" /> واتساب:
                      </span>
                      <span className="font-extrabold">{waCount}</span>
                    </div>
                  </div>

                  {/* Latest Sales Feedback & Response */}
                  <div className="bg-white border border-[#e2d8c7] rounded-xl p-2.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-[11px] font-bold text-[#704d1f]">
                      <span>آخر رد / ملاحظة مسجلة من المبيعات:</span>
                      {lastFeedback?.date && (
                        <span className="text-[10px] text-[#6e685f] font-mono">
                          {lastFeedback.date.substring(0, 10)}
                        </span>
                      )}
                    </div>

                    {lastFeedback ? (
                      <p className="text-[#2c2824] leading-relaxed text-[11px] bg-[#f8f5ee] p-2 rounded-lg border border-[#e2d8c7]">
                        "{lastFeedback.text}"
                        <span className="block text-[10px] text-[#8c622b] mt-1 font-bold">
                          — {lastFeedback.authorName || 'موظف المبيعات'}
                        </span>
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-800 font-medium italic">
                        لم يقم موظف المبيعات بتسجيل أي رد أو اتصال على هذا الرقم حتى الآن.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

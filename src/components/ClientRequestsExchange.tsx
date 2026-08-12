import React, { useState } from 'react';
import { User, Customer } from '../types';
import {
  Building2,
  PlusCircle,
  Search,
  Filter,
  Phone,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Lock,
  UserCheck,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  X,
  Sparkles,
  CheckCircle2,
  Users,
  Send,
  Home,
  Tag
} from 'lucide-react';
import { formatWhatsAppPhone, maskPhoneNumber, formatDisplayPhone } from '../utils/phoneUtils';

interface ClientRequestsExchangeProps {
  currentUser: User | null;
  customers: Customer[];
  allUsers: User[];
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
}

export const ClientRequestsExchange: React.FC<ClientRequestsExchangeProps> = ({
  currentUser,
  customers = [],
  allUsers = [],
  isOpen,
  onClose,
  onRefreshData
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedPurpose, setSelectedPurpose] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  
  // Add Request Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [interestType, setInterestType] = useState('شقة residential');
  const [purpose, setPurpose] = useState('شراء');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  if (!isOpen) return null;

  const isAdminOrOwner = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Filter only lead customers or customers with explicit property requests
  const requestCustomers = customers.filter(c => c.category === 'lead' || !!c.leadDetails);

  // Filter requests based on user selection
  const filteredRequests = requestCustomers.filter(cust => {
    const specsStr = `${cust.name || ''} ${cust.notes || ''} ${cust.leadDetails?.interestType || ''} ${cust.leadDetails?.budget || ''} ${cust.leadDetails?.notes || ''} ${cust.refCode || ''}`.toLowerCase();
    const matchesSearch = !searchTerm.trim() || specsStr.includes(searchTerm.toLowerCase());

    const typeStr = (cust.leadDetails?.interestType || cust.notes || '').toLowerCase();
    const matchesType = selectedType === 'all' || typeStr.includes(selectedType.toLowerCase());

    const matchesPurpose = selectedPurpose === 'all' || typeStr.includes(selectedPurpose.toLowerCase());

    const matchesAgent = selectedAgent === 'all' || (cust.assignedToEmail || '').toLowerCase() === selectedAgent.toLowerCase();

    return matchesSearch && matchesType && matchesPurpose && matchesAgent;
  });

  // Handle Adding New Client Property Request
  const handleAddRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setErrMsg('⚠️ يرجى إدخال رقم هاتف العميل بشكل صحيح');
      return;
    }

    setSubmitting(true);
    setErrMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/customers/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim(),
          phone: phone.trim(),
          interestType,
          purpose,
          location: location.trim(),
          budget: budget.trim(),
          notes: notes.trim(),
          creatorEmail: currentUser?.email,
          creatorName: currentUser?.name
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg('🎉 تم إضافة طلب العميل الجديد بنجاح في سوق الطلبات المشتركة!');
        setClientName('');
        setPhone('');
        setLocation('');
        setBudget('');
        setNotes('');
        await onRefreshData();
        setTimeout(() => {
          setShowAddModal(false);
          setSuccessMsg('');
        }, 1200);
      } else {
        setErrMsg(data.error || 'حدث خطأ عند إضافة الطلب');
      }
    } catch (err: any) {
      console.error('Error adding client request:', err);
      setErrMsg('حدث خطأ في شبكة الاتصال عند حفظ الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto dir-rtl">
      <div className="bg-[#fcfbfa] border-2 border-[#8c622b]/40 w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        
        {/* HEADER */}
        <div className="p-5 bg-[#f4ede1] border-b border-[#e2d8c7] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#8c622b] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full border border-[#704d1f]">
                Client Requests Exchange
              </span>
              <span className="text-xs text-[#704d1f] font-bold">مطابقة طلبات العملاء والمعروض</span>
            </div>
            <h2 className="text-xl font-black text-[#2c2824] flex items-center gap-2 mt-1">
              <Building2 className="w-6 h-6 text-[#8c622b]" />
              <span>سوق طلبات العملاء المشتركة (طلبات الشراء والإيجار) 🏢</span>
            </h2>
            <p className="text-xs text-[#6e685f] mt-0.5">
              استعراض كافة طلبات العملاء المسجلة بالشركة لمطابقتها مع الملاك والعقارات مع حماية تامة لأرقام الهواتف.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#8c622b] hover:bg-[#704d1f] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>إضافة عميل بطلب جديد +</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-[#6e685f] hover:text-[#2c2824] hover:bg-[#e8dfcf] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SECURITY PROMISE BAR */}
        <div className="bg-amber-900/10 border-b border-amber-900/20 px-5 py-2.5 text-xs font-bold text-amber-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-800 shrink-0" />
            <span>
              نظام حماية أرقام العملاء مفعل: أرقام التواصل تظهر حصرياً لـ <strong className="underline">صاحب الشركة والمسؤول المباشر عن العميل</strong> لمنع أي سرقة أو سحب أرقام.
            </span>
          </div>
          <span className="bg-white/80 px-2.5 py-0.5 rounded-md border border-amber-800/30 font-mono text-[11px] font-extrabold text-amber-900">
            إجمالي الطلبات النشطة: {requestCustomers.length} طلب
          </span>
        </div>

        {/* FILTERS TOOLBAR */}
        <div className="p-4 bg-[#f8f5ee] border-b border-[#e2d8c7] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-[#8c622b]" />
            <input
              type="text"
              placeholder="البحث بالاسم، المنطقة، الميزانية، المواصفات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-white border border-[#d8cebe] rounded-xl text-xs font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
            />
          </div>

          {/* Property Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#d8cebe] rounded-xl text-xs font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
          >
            <option value="all">جميع أنواع العقارات المطلوبة</option>
            <option value="شقة">شقة سكنية</option>
            <option value="فيلا">فيلا / تاون هاوس</option>
            <option value="مكتب">مكتب إداري</option>
            <option value="محل">محل تجاري</option>
            <option value="أرض">أرض</option>
            <option value="شاليه">شاليه سياحي</option>
          </select>

          {/* Purpose Filter */}
          <select
            value={selectedPurpose}
            onChange={(e) => setSelectedPurpose(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#d8cebe] rounded-xl text-xs font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
          >
            <option value="all">جميع الأغراض (شراء / إيجار)</option>
            <option value="شراء">طلب شراء</option>
            <option value="إيجار">طلب إيجار</option>
            <option value="استثمار">طلب استثمار</option>
          </select>

          {/* Assigned Agent Filter */}
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-[#d8cebe] rounded-xl text-xs font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
          >
            <option value="all">جميع المسؤولين بالشركة</option>
            {allUsers.map(u => (
              <option key={u.id} value={u.email}>{u.name} ({u.userCode || u.email})</option>
            ))}
          </select>
        </div>

        {/* REQUESTS LIST CONTAINER */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {filteredRequests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#d8cebe] p-8 space-y-3">
              <Building2 className="w-12 h-12 text-[#8c622b]/40 mx-auto" />
              <h3 className="text-base font-bold text-[#2c2824]">لا توجد طلبات عملاء مطابقة للفلتر الحقيقي</h3>
              <p className="text-xs text-[#6e685f]">يمكنك إضافة طلب عميل جديد من زر "إضافة عميل بطلب جديد +" بالأعلى.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRequests.map(cust => {
                const assignedEmail = (cust.assignedToEmail || '').toLowerCase();
                const creatorEmail = (cust.createdByEmail || '').toLowerCase();
                const myEmail = (currentUser?.email || '').toLowerCase();

                // PHONE VISIBILITY PRIVILEGE RULE:
                // Only Founder/Admin/Owner OR Assigned Agent OR Creator can see the plain text phone number!
                const canViewPhone = isAdminOrOwner || (myEmail && (myEmail === assignedEmail || myEmail === creatorEmail));

                const assignedUserObj = allUsers.find(u => u.email.toLowerCase() === assignedEmail);
                const assignedAgentPhone = assignedUserObj?.phone || '';

                const displayPhone = maskPhoneNumber(cust.customerNumber || cust.phone || '', canViewPhone);
                const waNum = formatWhatsAppPhone(cust.customerNumber || cust.phone || '');
                const leadDetails = cust.leadDetails;

                return (
                  <div
                    key={cust.id}
                    className="bg-white rounded-2xl border border-[#e2d8c7] p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3 relative overflow-hidden"
                  >
                    {/* Top Tag & Ref */}
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-[#f0e8db] pb-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-black bg-[#8c622b]/10 text-[#704d1f] px-2 py-0.5 rounded-md border border-[#8c622b]/20">
                            {cust.refCode || 'LD-REQ'}
                          </span>
                          <span className="text-xs font-black text-[#2c2824] truncate max-w-[130px]">
                            {cust.name || 'عميل راغب'}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold text-[#6e685f] bg-[#f8f5ee] px-2 py-0.5 rounded-full border border-[#d8cebe] flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#8c622b]" />
                          {cust.createdAt ? new Date(cust.createdAt).toLocaleDateString('ar-SA') : 'اليوم'}
                        </span>
                      </div>

                      {/* Property Specs Box */}
                      <div className="mt-3 bg-[#fbf9f4] p-3 rounded-xl border border-[#e8e0d0] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-[#704d1f] font-bold">
                          <span className="flex items-center gap-1">
                            <Home className="w-3.5 h-3.5 text-[#8c622b]" /> العقار المطلوب:
                          </span>
                          <span className="bg-[#8c622b] text-white px-2 py-0.5 rounded-md text-[10px] font-black">
                            {leadDetails?.interestType || cust.notes || 'غير محدد'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[#2c2824]">
                          <span className="text-[#6e685f] flex items-center gap-1 font-semibold">
                            <DollarSign className="w-3.5 h-3.5 text-[#8c622b]" /> الميزانية:
                          </span>
                          <span className="font-bold text-amber-900 font-mono">
                            {leadDetails?.budget || 'حسب الاتفاق'}
                          </span>
                        </div>

                        {cust.notes && (
                          <div className="pt-1 border-t border-[#e8e0d0] text-[11px] text-[#423d37] line-clamp-2 leading-relaxed">
                            <FileText className="w-3 h-3 inline text-[#8c622b] ml-1" />
                            {cust.notes}
                          </div>
                        )}
                      </div>

                      {/* Assigned Agent Badge */}
                      <div className="mt-2.5 flex items-center justify-between text-[11px] bg-[#f5efe4] p-2 rounded-xl border border-[#e2d8c7]">
                        <span className="text-[#6e685f] font-bold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-[#8c622b]" /> المسؤول المباشر:
                        </span>
                        <span className="font-black text-[#2c2824]">
                          {cust.assignedToName || 'غير مسند'}
                        </span>
                      </div>
                    </div>

                    {/* PHONE & CONTACT SECURITY ACTION BAR */}
                    <div className="pt-2 border-t border-[#f0e8db] space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono font-bold px-1">
                        <span className="text-[#6e685f]">رقم الهاتف:</span>
                        <span className={`dir-ltr ${canViewPhone ? 'text-[#2c2824] font-black' : 'text-rose-800 font-bold'}`}>
                          {displayPhone}
                        </span>
                      </div>

                      {canViewPhone ? (
                        /* UNMASKED PRIVILEGED ACTIONS */
                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={`https://wa.me/${waNum}?text=${encodeURIComponent(`مرحباً ${cust.name || ''}، أتواصل معك بخصوص طلبك العقاري ${leadDetails?.interestType || ''}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 shadow-sm transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>واتساب العميل</span>
                          </a>

                          <a
                            href={`tel:${cust.customerNumber || cust.phone}`}
                            className="bg-[#8c622b] hover:bg-[#704d1f] text-white text-[11px] font-bold py-2 px-2 rounded-xl flex items-center justify-center gap-1 shadow-sm transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>اتصال مباشر</span>
                          </a>
                        </div>
                      ) : (
                        /* MASKED SECURITY ACTION FOR OTHER BROKERS */
                        <div className="space-y-1.5">
                          <div className="bg-rose-50 border border-rose-200 p-2 rounded-xl text-[10px] text-rose-900 font-bold flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                            <span>محمي: الرقم متاح للمسؤول ({cust.assignedToName || 'الموظف'}) والإدارة فقط.</span>
                          </div>

                          {assignedAgentPhone ? (
                            <a
                              href={`https://wa.me/${formatWhatsAppPhone(assignedAgentPhone)}?text=${encodeURIComponent(`مرحباً أستاذ ${cust.assignedToName || ''}، لدي ترشيح عقاري مناسب لطلب عميلك (${cust.name || ''} - ${cust.refCode || ''}).`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full bg-[#8c622b] hover:bg-[#704d1f] text-white text-[11px] font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>تواصل مع الزميل المسؤول ({cust.assignedToName}) لتقديم عرض</span>
                            </a>
                          ) : (
                            <div className="text-[11px] font-bold text-[#704d1f] bg-[#f5efe4] p-2 rounded-xl text-center border border-[#e2d8c7]">
                              💬 يرجى التواصل مع الإدارة للتنسيق مع المسؤول ({cust.assignedToName})
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* SUB-MODAL: ADD NEW CLIENT PROPERTY REQUEST */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 dir-rtl">
          <div className="bg-[#fcfbfa] border-2 border-[#8c622b] w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 my-auto relative">
            <div className="flex items-center justify-between border-b border-[#e2d8c7] pb-3">
              <h3 className="text-base font-black text-[#2c2824] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#8c622b]" />
                <span>إضافة عميل بطلب عقاري جديد 📝</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#6e685f] hover:text-[#2c2824] rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {successMsg && (
              <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>{successMsg}</span>
              </div>
            )}

            {errMsg && (
              <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-xl text-xs font-bold">
                {errMsg}
              </div>
            )}

            <form onSubmit={handleAddRequest} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2c2824] mb-1">اسم العميل:</label>
                  <input
                    type="text"
                    required
                    placeholder="أدخل اسم العميل"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2c2824] mb-1">رقم الهاتف (الواتساب):</label>
                  <input
                    type="text"
                    required
                    placeholder="01012345678 أو 0501234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] dir-ltr text-right focus:outline-none focus:border-[#8c622b]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2c2824] mb-1">نوع العقار المطلوب:</label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  >
                    <option value="شقة residential">شقة سكنية</option>
                    <option value="فيلا villa">فيلا / تاون هاوس</option>
                    <option value="مكتب office">مكتب إداري</option>
                    <option value="محل retail">محل تجاري</option>
                    <option value="أرض land">أرض</option>
                    <option value="شاليه chalet">شاليه سياحي</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[#2c2824] mb-1">الغرض من الطلب:</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  >
                    <option value="شراء">شراء (Buy)</option>
                    <option value="إيجار">إيجار (Rent)</option>
                    <option value="استثمار">استثمار (Investment)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#2c2824] mb-1">المنطقة والمدينة المطلوبة:</label>
                  <input
                    type="text"
                    placeholder="مثال: التجمع الخامس، الشيخ زايد، العاصمة"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#2c2824] mb-1">الميزانية المستهدفة:</label>
                  <input
                    type="text"
                    placeholder="مثال: من 2.5 مليون إلى 4 مليون"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#2c2824] mb-1">تفاصيل ومواصفات الطلب الخاص للعميل:</label>
                <textarea
                  rows={3}
                  placeholder="عدد الغرف، الدور المطلوب، نوع التشطيب، طريقة السداد المفضل كاش أم أقساط..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#d8cebe] rounded-xl font-bold text-[#2c2824] focus:outline-none focus:border-[#8c622b]"
                />
              </div>

              <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200 text-[11px] text-amber-900 font-bold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>سيتم إسناد العميل باسمك تلقائياً ({currentUser?.name}) وتوثيق الطلب بسوق الطلبات.</span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-[#eae3d5] text-[#2c2824] rounded-xl font-bold text-xs hover:bg-[#dfd7c7]"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#8c622b] hover:bg-[#704d1f] text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{submitting ? 'جاري الحفظ...' : 'حفظ الطلب بسوق الطلبات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

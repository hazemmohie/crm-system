import React, { useState } from 'react';
import { Building2, KeyRound, User, AlertCircle, RefreshCw, Eye, EyeOff, ShieldCheck, Tag, Info, UserPlus, CheckCircle2 } from 'lucide-react';

interface LoginViewProps {
  onLogin: (usernameOrEmail: string, password?: string) => Promise<{ success: boolean; error?: string } | void>;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'client_request'>('login');
  
  // Login State
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<'user' | 'admin'>('user');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccessMessage, setRegSuccessMessage] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  // Public Client Request Form State
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [interestType, setInterestType] = useState('شقة سكنية');
  const [purpose, setPurpose] = useState('شراء');
  const [location, setLocation] = useState('');
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<{ msg: string; refCode?: string } | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanInput = usernameOrEmail.trim();
    if (!cleanInput) {
      setLoginError('يرجى إدخال اسم المستخدم أو البريد الإلكتروني');
      return;
    }
    if (!password) {
      setLoginError('يرجى إدخال كلمة المرور');
      return;
    }

    setLoginLoading(true);
    try {
      const result = await onLogin(cleanInput, password);
      if (result && !result.success) {
        setLoginError(result.error || 'تعذر تسجيل الدخول. يرجى التأكد من بيانات الدخول.');
      }
    } catch (err: any) {
      setLoginError('حدث خطأ أثناء الاتصال بالخادم عند تسجيل الدخول');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccessMessage(null);

    if (!regName.trim() || !regPhone.trim() || !regUsername.trim() || !regPassword.trim()) {
      setRegError('يرجى تعبئة جميع الحقول المطلوبة: (الاسم، رقم الهاتف، اسم المستخدم، وكلمة المرور)');
      return;
    }

    setRegLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName.trim(),
          phone: regPhone.trim(),
          username: regUsername.trim(),
          password: regPassword.trim(),
          role: regRole,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setRegSuccessMessage(data.message || 'تم إرسال طلب الحساب بنجاح! حسابك بانتظار موافقة حازم محي (hazemmohie8@gmail.com).');
        setRegName('');
        setRegPhone('');
        setRegUsername('');
        setRegPassword('');
      } else {
        setRegError(data.error || 'حدث خطأ أثناء إنشاء الحساب الجديد');
      }
    } catch (err: any) {
      setRegError('حدث خطأ بالاتصال بالسيرفر أثناء إنشاء الحساب');
    } finally {
      setRegLoading(false);
    }
  };

  const handleClientRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    if (!clientPhone.trim()) {
      setRequestError('يرجى إدخال رقم الهاتف بشكل صحيح');
      return;
    }

    setRequestLoading(true);
    try {
      const res = await fetch('/api/customers/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: clientName.trim() || 'عميل مباشر',
          phone: clientPhone.trim(),
          interestType,
          purpose,
          location: location.trim(),
          budget: budget.trim(),
          notes: notes.trim(),
          creatorEmail: 'public_client@system',
          creatorName: 'عميل زائر'
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setRequestSuccess({
          msg: '🎉 تم تسجيل وتقديم طلبك العقاري بنجاح! تم حفظ طلبك وسيقوم فريق المبيعات بالتواصل معك فوراً.',
          refCode: data.customer?.refCode
        });
        setClientName('');
        setClientPhone('');
        setLocation('');
        setBudget('');
        setNotes('');
      } else {
        setRequestError(data.error || 'حدث خطأ أثناء تقديم الطلب');
      }
    } catch (err: any) {
      setRequestError('حدث خطأ بالاتصال بالسيرفر أثناء حفظ الطلب');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#f7f4ed] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full bg-[#fcfbfa] border border-[#ded5c5] rounded-3xl shadow-xl overflow-hidden p-6 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex p-3.5 bg-[#8c622b]/10 border border-[#8c622b]/20 rounded-2xl text-[#8c622b] shadow-sm">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#2c2824]">نظام إدارة وتتبع المبيعات العقارية</h1>
            <p className="text-[#6e685f] text-xs leading-relaxed font-medium mt-1">
              منصة التسجيل وإدارة طلبات ومعروض العقارات الذكية
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#f2ece1] p-1 rounded-2xl border border-[#d8cebe] gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'login'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'text-[#6e685f] hover:text-[#2c2824]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>تسجيل الدخول</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('client_request')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'client_request'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'text-[#6e685f] hover:text-[#2c2824]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>تقديم طلب عقار</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
              activeTab === 'register'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'text-[#6e685f] hover:text-[#2c2824]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>حساب جديد</span>
          </button>
        </div>

        {/* User Code Highlight Banner */}
        <div className="bg-[#f5efe4] border border-[#d8cebe] rounded-2xl p-3 flex items-start gap-2.5 text-xs text-[#554f47]">
          <Tag className="w-4 h-4 text-[#8c622b] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-[#2c2824] block mb-0.5">أكواد تتبع الموظفين:</strong>
            يُمنح كل مستخدم كوداً حركياً فريداً (مثال: <code className="bg-[#8c622b]/10 text-[#8c622b] font-mono px-1.5 py-0.5 rounded font-bold">EMP-001</code>) يربط كل تسجيلات العقارات والتواصل باسمه.
          </div>
        </div>

        {/* TAB 1: LOGIN */}
        {activeTab === 'login' && (
          <div className="space-y-4">
            {loginError && (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-bold leading-relaxed">{loginError}</div>
              </div>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1.5">
                  اسم المستخدم / البريد الإلكتروني:
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3.5 top-3.5 text-[#8c8275]" />
                  <input
                    type="text"
                    placeholder="أدخل اسم المستخدم أو البريد"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-3 pr-10 outline-none focus:border-[#8c622b] focus:bg-[#fcfbfa] transition-all dir-ltr text-right"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1.5">
                  كلمة المرور:
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute right-3.5 top-3.5 text-[#8c8275]" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-3 pr-10 pl-10 outline-none focus:border-[#8c622b] focus:bg-[#fcfbfa] transition-all dir-ltr text-right"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-3.5 text-[#8c8275] hover:text-[#2c2824] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#8c622b] hover:bg-[#734f21] text-white border border-[#734f21] font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span className="text-xs font-bold">جاري التحقق والدخول...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-bold">تسجيل الدخول للنظام</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: REGISTER NEW USERNAME */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            {regError && (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-bold leading-relaxed">{regError}</div>
              </div>
            )}

            {regSuccessMessage && (
              <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="font-bold leading-relaxed">{regSuccessMessage}</div>
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">الاسم الكامل للموظف:</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمود"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">رقم الهاتف / الجوال:</label>
                <input
                  type="tel"
                  placeholder="مثال: 0501234567"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all dir-ltr text-right"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">اسم المستخدم (Username):</label>
                <input
                  type="text"
                  placeholder="مثال: ahmed101"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all dir-ltr text-right"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">كلمة المرور:</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all dir-ltr text-right"
                  required
                />
              </div>

              <div className="bg-[#f2ece1] border border-[#d8cebe] p-3 rounded-2xl text-[11px] text-[#704d1f] font-semibold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#8c622b] shrink-0" />
                <span>ملاحظة أمنية: يتم تحديد نوع الحساب وتخصيص الصلاحيات المعتمدة داخلياً عبر إدارة الشركة عند المراجعة والقبول.</span>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#8c622b] hover:bg-[#734f21] text-white border border-[#734f21] font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 mt-2"
              >
                {regLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span className="text-xs font-bold">جاري التسجيل وإنشاء الحساب...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span className="text-xs font-bold">تسجيل وإنشاء الحساب الآن</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: PUBLIC CLIENT PROPERTY REQUEST FORM */}
        {activeTab === 'client_request' && (
          <div className="space-y-4">
            {requestError && (
              <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-bold leading-relaxed">{requestError}</div>
              </div>
            )}

            {requestSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col gap-2 text-xs text-emerald-900 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="font-bold leading-relaxed">{requestSuccess.msg}</div>
                </div>
                {requestSuccess.refCode && (
                  <div className="bg-emerald-100 border border-emerald-300 p-2.5 rounded-xl font-mono text-center font-bold text-emerald-900 mt-1">
                    كود الطلب المرجعي: <span className="text-emerald-700 underline">{requestSuccess.refCode}</span>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleClientRequestSubmit} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">اسمك الكريم (أو اسم شركتك):</label>
                <input
                  type="text"
                  placeholder="مثال: محمد العمري"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">رقم الهاتف / الواتساب (*مطلوب):</label>
                <input
                  type="tel"
                  placeholder="مثال: 0501234567 أو +966..."
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all dir-ltr text-right"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2c2824] block mb-1">نوع العقار:</label>
                  <select
                    value={interestType}
                    onChange={(e) => setInterestType(e.target.value)}
                    className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all cursor-pointer"
                  >
                    <option value="شقة سكنية">شقة سكنية</option>
                    <option value="فيلا / دوبلكس">فيلا / دوبلكس</option>
                    <option value="أرض سكنية/تجارية">أرض سكنية/تجارية</option>
                    <option value="عمائر ومجمعات">عمائر ومجمعات</option>
                    <option value="محلات ومكاتب تجارية">محلات ومكاتب تجارية</option>
                    <option value="مزرعة / شاليه">مزرعة / شاليه</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2c2824] block mb-1">الغرض:</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all cursor-pointer"
                  >
                    <option value="شراء">شراء</option>
                    <option value="إيجار">إيجار</option>
                    <option value="استثمار">استثمار</option>
                    <option value="تمويل عقاري">تمويل عقاري</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-[#2c2824] block mb-1">المنطقة / الحي:</label>
                  <input
                    type="text"
                    placeholder="مثال: الرياض - الملقا"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2c2824] block mb-1">الميزانية التقريبية:</label>
                  <input
                    type="text"
                    placeholder="مثال: 1,500,000 ريال"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2c2824] block mb-1">تفاصيل ومواصفات إضافية:</label>
                <textarea
                  rows={2}
                  placeholder="المساحة المطلوبة، عدد الغرف، طريقة الدفع..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#f5efe4] border border-[#d8cebe] text-[#2c2824] text-xs font-semibold rounded-2xl p-2.5 outline-none focus:border-[#8c622b] transition-all resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={requestLoading}
                className="w-full flex items-center justify-center gap-2 bg-[#8c622b] hover:bg-[#734f21] text-white border border-[#734f21] font-bold py-3.5 px-4 rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 mt-1"
              >
                {requestLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span className="text-xs font-bold">جاري تسجيل وحفظ الطلب...</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    <span className="text-xs font-bold">تقديم وتسجيل الطلب العقاري الآن</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Footer info */}
        <div className="border-t border-[#e8e0d0] pt-3 text-center text-[11px] text-[#6e685f] flex items-center justify-center gap-1.5 font-medium">
          <Info className="w-3.5 h-3.5 text-[#8c622b] shrink-0" />
          <span>يرجى إدخال اسم المستخدم وكلمة المرور الخاصة بحسابك للدخول للنظام.</span>
        </div>

      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { User, Customer, GoogleSheetConfig, CustomerStatus } from './types';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { PendingView } from './components/PendingView';
import { AdminDashboard } from './components/AdminDashboard';
import { UserDashboard } from './components/UserDashboard';
import { TermsAgreementModal } from './components/TermsAgreementModal';
import { UserGuideModal } from './components/UserGuideModal';
import { ClientRequestsExchange } from './components/ClientRequestsExchange';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sheetConfig, setSheetConfig] = useState<GoogleSheetConfig>({
    sheetUrl: '',
    sheetId: '',
    autoSync: false,
  });
  const [loading, setLoading] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isRequestsExchangeOpen, setIsRequestsExchangeOpen] = useState(false);

  const lastUsersJsonRef = React.useRef<string>('');
  const lastCustomersJsonRef = React.useRef<string>('');

  // Fetch initial data smoothly without forcing re-renders if unchanged
  const fetchData = async (userEmail?: string) => {
    try {
      // Load users
      const usersRes = await fetch('/api/users');
      if (usersRes.ok) {
        const ct = usersRes.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await usersRes.json();
          const fetchedUsers = data.users || [];
          const usersStr = JSON.stringify(fetchedUsers);
          if (usersStr !== lastUsersJsonRef.current) {
            lastUsersJsonRef.current = usersStr;
            setUsers(fetchedUsers);
          }

          // Sync current user state if already logged in
          const emailToMatch = userEmail || currentUser?.email || localStorage.getItem('app_user_email');
          if (emailToMatch) {
            const matched = fetchedUsers.find((u: User) => u.email?.toLowerCase() === emailToMatch.toLowerCase());
            if (matched) {
              setCurrentUser(matched);
            }
          }
        }
      }

      // Load customers
      const activeEmail = userEmail || currentUser?.email || localStorage.getItem('app_user_email');
      const custRes = await fetch(`/api/customers${activeEmail ? `?userEmail=${encodeURIComponent(activeEmail)}` : ''}`);
      if (custRes.ok) {
        const ct = custRes.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const cData = await custRes.json();
          const fetchedCusts = cData.customers || [];
          const custsStr = JSON.stringify(fetchedCusts);
          if (custsStr !== lastCustomersJsonRef.current) {
            lastCustomersJsonRef.current = custsStr;
            setCustomers(fetchedCusts);
          }
        }
      }
    } catch (err) {
      // Network sync error handling (e.g. server restart or transient disconnect)
    } finally {
      setLoading(false);
    }
  };

  const restoreSession = async (emailOrUsername: string) => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const users: User[] = data.users || [];
        const cleanKey = emailOrUsername.trim().toLowerCase();
        const found = users.find(u => 
          (u.email && u.email.toLowerCase() === cleanKey) ||
          (u.username && u.username.toLowerCase() === cleanKey)
        );
        if (found && found.status === 'approved') {
          setCurrentUser(found);
          await fetchData(found.email);
          return;
        }
      }
    } catch (e) {}
    localStorage.removeItem('app_user_email');
    await fetchData();
  };

  useEffect(() => {
    const savedEmail = localStorage.getItem('app_user_email');
    if (savedEmail) {
      restoreSession(savedEmail);
    } else {
      fetchData();
    }

    // Auto-poll smoothly every 20 seconds for updates without screen flickering
    const interval = setInterval(() => {
      fetchData();
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  // Handle Login or Switch Account
  const handleLogin = async (usernameOrEmail: string, password?: string, name?: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password, name }),
      });

      const ct = res.headers.get('content-type');
      if (res.ok && ct && ct.includes('application/json')) {
        const data = await res.json();
        setCurrentUser(data.user);
        localStorage.setItem('app_user_email', data.user.email || data.user.username);
        await fetchData(data.user.email);
        return { success: true, user: data.user };
      } else {
        let msg = 'فشل عملية تسجيل الدخول';
        if (ct && ct.includes('application/json')) {
          const errData = await res.json();
          msg = errData.error || msg;
        }
        return { success: false, error: msg };
      }
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: 'حدث خطأ بشبكة الاتصال عند تسجيل الدخول' };
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('app_user_email');
  };

  const handleSwitchUser = (_email: string) => {
    handleLogout();
  };

  // Admin Actions
  const handleApproveUser = async (email: string, autoDistribute: boolean) => {
    try {
      const res = await fetch('/api/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, autoDistribute }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'فشل اعتماد الحساب');
      }
    } catch (err: any) {
      console.error('handleApproveUser error:', err);
    }
  };

  const handleRejectUser = async (email: string) => {
    try {
      const res = await fetch('/api/users/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'فشل رفض الحساب');
      }
    } catch (err: any) {
      console.error('handleRejectUser error:', err);
    }
  };

  const handleCreateUser = async (userData: any) => {
    const res = await fetch('/api/users/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, creatorEmail: currentUser?.email }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل إضافة الموظف الجديد');
    }
  };

  const handleUpdateUser = async (userData: any) => {
    const res = await fetch('/api/users/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل تحديث بيانات الموظف');
    }
  };

  const handleDeleteUser = async (email: string) => {
    const res = await fetch('/api/users/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل حذف الموظف');
    }
  };

  const handleSuspendUser = async (email: string) => {
    const res = await fetch('/api/users/suspend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل إيقاف الحساب');
    }
  };

  const handlePurgeFakeUsers = async () => {
    const res = await fetch('/api/users/purge-fake', {
      method: 'POST',
    });

    if (res.ok) {
      const data = await res.json();
      await fetchData();
      return data.remainingUsersCount;
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل تنظيف الحسابات الوهمية');
    }
  };

  const handleAddCustomers = async (items: any[], autoDistribute: boolean) => {
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, autoDistribute }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل رفع بيانات العملاء');
      }
    } catch (err: any) {
      console.error('handleAddCustomers error:', err);
      throw err;
    }
  };

  const handleDistributeCustomers = async (redistributeAll: boolean) => {
    try {
      const res = await fetch('/api/customers/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redistributeAll }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'فشل توزيع العملاء');
      }
    } catch (err: any) {
      console.error('handleDistributeCustomers error:', err);
    }
  };

  const handleFetchSheet = async (sheetUrl: string, autoDistribute: boolean) => {
    const res = await fetch('/api/sheets/fetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetUrl, autoDistribute }),
    });

    if (res.ok) {
      const data = await res.json();
      setSheetConfig({ sheetUrl, sheetId: data.sheetId, autoSync: false });
      await fetchData();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل في ربط Google Sheet');
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      await fetchData();
    }
  };

  const handleReassignCustomer = async (id: string, targetEmail: string | null) => {
    try {
      const res = await fetch(`/api/customers/${id}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل إعادة تعيين العميل');
      }
    } catch (err: any) {
      console.error('handleReassignCustomer error:', err);
      throw err;
    }
  };

  const handleClearAllCustomers = async () => {
    try {
      const res = await fetch('/api/customers/all', { method: 'DELETE' });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل مسح جميع العملاء');
      }
    } catch (err: any) {
      console.error('handleClearAllCustomers error:', err);
      throw err;
    }
  };

  const handleUpdateCategory = async (
    id: string,
    category: 'lead' | 'owner' | 'contact',
    leadDetails?: any,
    ownerDetails?: any,
    leadSource?: string,
    campaignName?: string
  ) => {
    const res = await fetch(`/api/customers/${id}/category`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, leadDetails, ownerDetails, leadSource, campaignName }),
    });

    if (res.ok) {
      await fetchData();
    }
  };

  const handleRequestTransfer = async (id: string, targetEmail: string, reasonNote: string) => {
    if (!currentUser) return;
    const res = await fetch(`/api/customers/${id}/transfer-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail, reasonNote, requestedByEmail: currentUser.email }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'فشل تقديم طلب التحويل');
    }
  };

  const handleUpdateOwnerWorkflow = async (id: string, ownerWorkflow: any) => {
    if (!currentUser) return;
    const res = await fetch(`/api/customers/${id}/owner-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerWorkflow,
        authorName: currentUser.name,
        authorEmail: currentUser.email
      }),
    });

    if (res.ok) {
      await fetchData();
    }
  };

  const handleApproveTransfer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}/approve-transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminEmail: currentUser?.email, adminName: currentUser?.name }),
    });

    if (res.ok) {
      await fetchData();
    }
  };

  const handleRejectTransfer = async (id: string) => {
    const res = await fetch(`/api/customers/${id}/reject-transfer`, {
      method: 'POST',
    });

    if (res.ok) {
      await fetchData();
    }
  };

  const handleSetUserQuota = async (
    email: string,
    dailyQuota: number,
    quotaIncrementPerDay?: number,
    offDays?: number[],
    dailyLeadQuota?: number,
    dailyOwnerQuota?: number,
    earlyLeaveToday?: boolean,
    role?: 'admin' | 'user' | 'marketing'
  ) => {
    const res = await fetch('/api/users/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, dailyQuota, quotaIncrementPerDay, offDays, dailyLeadQuota, dailyOwnerQuota, earlyLeaveToday, role }),
    });

    if (res.ok) {
      await fetchData();
    }
  };

  // User Actions
  const handleAgreeTerms = async () => {
    if (!currentUser) return;
    const res = await fetch('/api/auth/agree-terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: currentUser.email }),
    });

    if (res.ok) {
      const data = await res.json();
      setCurrentUser(data.user);
      await fetchData(data.user.email);
    }
  };

  const handleAddFeedback = async (
    id: string,
    text: string,
    status: CustomerStatus,
    followUpDate?: string | null,
    followUpNote?: string | null
  ) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/customers/${id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          status,
          authorEmail: currentUser.email,
          authorName: currentUser.name,
          followUpDate,
          followUpNote,
        }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل حفظ الملاحظة');
      }
    } catch (err: any) {
      console.error('handleAddFeedback error:', err);
      throw err;
    }
  };

  const handleScheduleFollowUp = async (id: string, followUpDate: string | null, followUpNote?: string | null) => {
    try {
      const res = await fetch(`/api/customers/${id}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate, followUpNote }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل جدولة المتابعة');
      }
    } catch (err: any) {
      console.error('handleScheduleFollowUp error:', err);
      throw err;
    }
  };

  // Dummy OAuth request launcher for Google Workspace Skill protocol
  const handleRequestOAuth = () => {
    alert('تنبيه: يمكنك استخدام ربط رابط Google Sheet المباشر أو تفعيل OAuth من خيارات النظام.');
  };

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 dir-rtl font-sans">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-semibold">جاري تحميل التطبيق والنظام...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans dir-rtl antialiased selection:bg-emerald-500 selection:text-slate-950">
      {/* Header Navigation */}
      <Navbar
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        allUsers={users}
        customers={customers}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenClientRequests={() => setIsRequestsExchangeOpen(true)}
      />

      {/* Shared Client Requests Exchange Modal */}
      <ClientRequestsExchange
        currentUser={currentUser}
        customers={customers}
        allUsers={users}
        isOpen={isRequestsExchangeOpen}
        onClose={() => setIsRequestsExchangeOpen(false)}
        onRefreshData={fetchData}
      />

      {/* Mandatory Terms Agreement Modal on First Login */}
      {currentUser && currentUser.status === 'approved' && !currentUser.agreedToTerms && (
        <TermsAgreementModal
          user={currentUser}
          onAgree={handleAgreeTerms}
        />
      )}

      {/* Interactive User Guide Modal */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        isAdmin={currentUser?.role === 'admin'}
      />

      {/* View Routing Based on Auth & Status */}
      {!currentUser ? (
        <LoginView onLogin={handleLogin} allUsers={users} />
      ) : currentUser.status === 'pending' ? (
        <PendingView
          user={currentUser}
          onLogout={handleLogout}
          onCheckStatus={() => fetchData(currentUser.email)}
          onSwitchToAdmin={() => handleSwitchUser('hazemmohie8@gmail.com')}
        />
      ) : currentUser.role === 'admin' ? (
        <AdminDashboard
          currentUser={currentUser}
          users={users}
          customers={customers}
          sheetConfig={sheetConfig}
          onApproveUser={handleApproveUser}
          onRejectUser={handleRejectUser}
          onCreateUser={handleCreateUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onSuspendUser={handleSuspendUser}
          onPurgeFakeUsers={handlePurgeFakeUsers}
          onAddCustomers={handleAddCustomers}
          onDistributeCustomers={handleDistributeCustomers}
          onFetchSheet={handleFetchSheet}
          onDeleteCustomer={handleDeleteCustomer}
          onReassignCustomer={handleReassignCustomer}
          onClearAllCustomers={handleClearAllCustomers}
          onUpdateCategory={handleUpdateCategory}
          onSetUserQuota={handleSetUserQuota}
          onRequestOAuth={handleRequestOAuth}
          onApproveTransfer={handleApproveTransfer}
          onRejectTransfer={handleRejectTransfer}
        />
      ) : (
        <UserDashboard
          currentUser={currentUser}
          allUsers={users}
          customers={customers}
          onAddFeedback={handleAddFeedback}
          onScheduleFollowUp={handleScheduleFollowUp}
          onUpdateCategory={handleUpdateCategory}
          onRequestTransfer={handleRequestTransfer}
          onUpdateOwnerWorkflow={handleUpdateOwnerWorkflow}
          onOpenClientRequests={() => setIsRequestsExchangeOpen(true)}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { User, Customer, GoogleSheetConfig, CustomerStatus, LeadPriority } from '../types';
import { PropertyAnalyticsWidget } from './PropertyAnalyticsWidget';
import { ActivityTracker } from './ActivityTracker';
import { GeminiVoiceAssistant } from './GeminiVoiceAssistant';
import { TaskManager } from './TaskManager';
import { AiAgentSettingsModal } from './AiAgentSettingsModal';
import { CeoExecutiveDashboard } from './CeoExecutiveDashboard';
import { BackupManagementCenter } from './BackupManagementCenter';
import { ensureCountryCode, formatWhatsAppPhone, formatDisplayPhone } from '../utils/phoneUtils';
import {
  Users,
  UserCheck,
  UserX,
  UserPlus,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Share2,
  Trash2,
  Sparkles,
  Download,
  MessageSquare,
  Phone,
  BarChart2,
  ExternalLink,
  Target,
  Sliders,
  Calendar,
  Volume2,
  Briefcase,
  DollarSign,
  TrendingUp,
  Clock,
  ShieldCheck,
  Check,
  Building2,
  PieChart,
  Flame,
  Megaphone,
  PhoneCall,
  Activity as ActivityIcon,
  Bot,
  Lock,
  Eye,
  FileText,
  X,
  FileCheck
} from 'lucide-react';

const DEFAULT_ADMIN_EMAIL = 'hazemmohie8@gmail.com';

interface AdminDashboardProps {
  currentUser?: User;
  users: User[];
  customers: Customer[];
  sheetConfig: GoogleSheetConfig;
  onApproveUser: (email: string, autoDistribute: boolean) => Promise<void>;
  onRejectUser: (email: string) => Promise<void>;
  onCreateUser?: (userData: any) => Promise<void>;
  onUpdateUser?: (userData: any) => Promise<void>;
  onDeleteUser?: (email: string) => Promise<void>;
  onSuspendUser?: (email: string) => Promise<void>;
  onPurgeFakeUsers?: () => Promise<number>;
  onAddCustomers: (items: any[], autoDistribute: boolean) => Promise<void>;
  onDistributeCustomers: (redistributeAll: boolean) => Promise<void>;
  onFetchSheet: (url: string, autoDistribute: boolean) => Promise<void>;
  onDeleteCustomer: (id: string) => Promise<void>;
  onReassignCustomer?: (id: string, targetEmail: string | null) => Promise<void>;
  onClearAllCustomers?: () => Promise<void>;
  onUpdateCategory?: (id: string, category: 'lead' | 'contact' | 'owner', leadDetails?: any) => Promise<void>;
  onSetUserQuota?: (
    email: string,
    dailyQuota: number,
    quotaIncrementPerDay?: number,
    offDays?: number[],
    dailyLeadQuota?: number,
    dailyOwnerQuota?: number,
    earlyLeaveToday?: boolean,
    role?: 'admin' | 'user' | 'marketing'
  ) => Promise<void>;
  onApproveTransfer?: (customerId: string) => Promise<void>;
  onRejectTransfer?: (customerId: string) => Promise<void>;
  onRequestOAuth: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  users,
  customers,
  sheetConfig,
  onApproveUser,
  onRejectUser,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onSuspendUser,
  onPurgeFakeUsers,
  onAddCustomers,
  onDistributeCustomers,
  onFetchSheet,
  onDeleteCustomer,
  onReassignCustomer,
  onClearAllCustomers,
  onUpdateCategory,
  onSetUserQuota,
  onApproveTransfer,
  onRejectTransfer,
  onRequestOAuth,
}) => {
  const [activeTab, setActiveTab] = useState<'ceo_main' | 'users' | 'import' | 'overview' | 'analytics' | 'activities' | 'ai_query' | 'tasks' | 'backup_center'>('ceo_main');
  const [showAiSettingsModal, setShowAiSettingsModal] = useState(false);
  const [showTasksDrawer, setShowTasksDrawer] = useState(false);

  // Employee Communication & Calls Audit Modal State
  const [selectedAuditUserEmail, setSelectedAuditUserEmail] = useState<string | null>(null);
  const [auditSearchTerm, setAuditSearchTerm] = useState<string>('');
  const [auditMethodFilter, setAuditMethodFilter] = useState<'all' | 'phone_only' | 'wa_only' | 'both' | 'pending'>('all');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<'all' | 'lead' | 'owner'>('all');
  
  // Data Entry State - Two Separate Boxes for Leads & Owners
  const [leadsNumbersText, setLeadsNumbersText] = useState('');
  const [leadsIsCampaign, setLeadsIsCampaign] = useState(false);
  const [leadsCampaignName, setLeadsCampaignName] = useState('');
  const [ownersNumbersText, setOwnersNumbersText] = useState('');

  const [sheetUrlInput, setSheetUrlInput] = useState(sheetConfig.sheetUrl || '');
  const [autoDistributeOnImport, setAutoDistributeOnImport] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Overview Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Quota & Employee Editing State for User
  const [editingQuotaUserEmail, setEditingQuotaUserEmail] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState<string>('');
  const [editUsernameVal, setEditUsernameVal] = useState<string>('');
  const [editPasswordVal, setEditPasswordVal] = useState<string>('');
  const [editUserCodeVal, setEditUserCodeVal] = useState<string>('');
  const [editPhoneVal, setEditPhoneVal] = useState<string>('');
  const [editJobTitlesVal, setEditJobTitlesVal] = useState<string>('');
  const [quotaVal, setQuotaVal] = useState<number>(10);
  const [leadQuotaVal, setLeadQuotaVal] = useState<number>(10);
  const [ownerQuotaVal, setOwnerQuotaVal] = useState<number>(10);
  const [incrementVal, setIncrementVal] = useState<number>(2);
  const [selectedOffDays, setSelectedOffDays] = useState<number[]>([5, 6]); // Default Friday (5) and Saturday (6)
  const [earlyLeaveVal, setEarlyLeaveVal] = useState<boolean>(false);
  const [roleVal, setRoleVal] = useState<'admin' | 'user' | 'marketing' | 'manager'>('user');

  // User Management Form State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserCode, setNewUserCode] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'user' | 'marketing'>('user');
  const [newUserLeadQuota, setNewUserLeadQuota] = useState(10);
  const [newUserOwnerQuota, setNewUserOwnerQuota] = useState(10);

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const approvedUsers = users.filter((u) => u.status === 'approved');
  const suspendedUsers = users.filter((u) => u.status === 'suspended' || u.status === 'rejected');
  const unassignedCustomers = customers.filter((c) => !c.assignedToEmail);
  const assignedCustomers = customers.filter((c) => c.assignedToEmail);

  const leadsCount = customers.filter((c) => c.category === 'lead').length;
  const ownersCount = customers.filter((c) => c.category === 'owner').length;
  const contactsCount = customers.filter((c) => c.category === 'contact' || (!c.category && c.category !== 'lead')).length;
  const pendingTransferCustomers = customers.filter((c) => c.transferRequest && c.transferRequest.status === 'pending');

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateUser) return;
    if (!newUserName.trim()) {
      alert('يرجى إدخال اسم الموظف الكامل');
      return;
    }
    setLoadingAction(true);
    try {
      await onCreateUser({
        name: newUserName.trim(),
        username: newUserUsername.trim() || undefined,
        email: newUserEmail.trim() || undefined,
        password: newUserPassword.trim() || '123456',
        userCode: newUserCode.trim() || undefined,
        phone: newUserPhone.trim(),
        role: newUserRole,
        dailyLeadQuota: newUserLeadQuota,
        dailyOwnerQuota: newUserOwnerQuota,
        dailyQuota: newUserLeadQuota + newUserOwnerQuota
      });
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserEmail('');
      setNewUserPassword('123456');
      setNewUserCode('');
      setNewUserPhone('');
      setStatusMessage({ type: 'success', text: `تمت إضافة الموظف الجديد (${newUserName}) وتعيين بيانات الدخول والكود بنجاح!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'حدث خطأ أثناء إضافة الموظف' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDeleteUserAction = async (email: string, name: string) => {
    if (!onDeleteUser) return;
    if (!confirm(`هل أنت متأكد من حذف حساب الموظف (${name} - ${email}) نهائياً؟ سيتم إلغاء تخصيص أرقامه.`)) return;
    setLoadingAction(true);
    try {
      await onDeleteUser(email);
      setStatusMessage({ type: 'success', text: `تم حذف حساب الموظف (${email}) نهائياً.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'فشل حذف الحساب' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSuspendUserAction = async (email: string, name: string) => {
    if (!onSuspendUser) return;
    if (!confirm(`هل أنت متأكد من إيقاف/تجميد حساب الموظف (${name})؟ لن يمكنه استلام أرقام جديدة.`)) return;
    setLoadingAction(true);
    try {
      await onSuspendUser(email);
      setStatusMessage({ type: 'success', text: `تم إيقاف/تجميد حساب الموظف (${email}) بنجاح.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'فشل إيقاف الحساب' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handlePurgeFakeAction = async () => {
    if (!onPurgeFakeUsers) return;
    if (!confirm('هل تريد تنظيف وتصفية جميع الحسابات الوهمية والمعلقة من النظام؟')) return;
    setLoadingAction(true);
    try {
      const count = await onPurgeFakeUsers();
      setStatusMessage({ type: 'success', text: `تم تنظيف الحسابات الوهمية بنجاح! المتبقي: ${count} حساب حقيقي معتمد.` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'فشل تنظيف الحسابات الوهمية' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleApprove = async (email: string) => {
    setLoadingAction(true);
    try {
      await onApproveUser(email, true);
      setStatusMessage({ type: 'success', text: `تمت موافقة الحساب (${email}) وتوزيع حصته بالتساوي!` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'حدث خطأ أثناء الموافقة' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleReject = async (email: string) => {
    if (!confirm(`هل أنت متاكد من رفض أو إلغاء تفعيل حساب ${email}؟`)) return;
    setLoadingAction(true);
    try {
      await onRejectUser(email);
      setStatusMessage({ type: 'success', text: `تم رفض/إلغاء الحساب ${email}` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'حدث خطأ' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSaveQuotaSubmit = async (e: React.FormEvent, email: string) => {
    e.preventDefault();
    setLoadingAction(true);
    try {
      if (onUpdateUser) {
        await onUpdateUser({
          email,
          name: editNameVal,
          username: editUsernameVal.trim() || undefined,
          password: editPasswordVal.trim() || undefined,
          userCode: editUserCodeVal.trim() || undefined,
          phone: editPhoneVal,
          role: roleVal,
          jobTitles: editJobTitlesVal ? editJobTitlesVal.split(',').map(s => s.trim()).filter(Boolean) : [],
          dailyQuota: quotaVal,
          dailyLeadQuota: leadQuotaVal,
          dailyOwnerQuota: ownerQuotaVal,
          offDays: selectedOffDays,
        });
      }
      if (onSetUserQuota) {
        await onSetUserQuota(email, quotaVal, incrementVal, selectedOffDays, leadQuotaVal, ownerQuotaVal, earlyLeaveVal, roleVal as any);
      }
      setEditingQuotaUserEmail(null);
      setStatusMessage({ type: 'success', text: `تم تحديث بيانات ومسمى الموظف وإعداداته بنجاح (${email})` });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'فشل في حفظ وتحديث بيانات الموظف' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleManualAdd = async (e?: React.FormEvent, targetCategory?: 'lead' | 'owner' | 'both') => {
    if (e) e.preventDefault();

    const categoryMode = targetCategory || 'both';

    const leadLines = leadsNumbersText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const ownerLines = ownersNumbersText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const itemsToInsert: any[] = [];

    if (categoryMode === 'lead' || categoryMode === 'both') {
      leadLines.forEach((num) => {
        itemsToInsert.push({
          customerNumber: ensureCountryCode(num),
          category: 'lead',
          leadSource: leadsIsCampaign ? 'paid_ad' : 'organic_marketing',
          campaignName: leadsCampaignName.trim() || undefined,
        });
      });
    }

    if (categoryMode === 'owner' || categoryMode === 'both') {
      ownerLines.forEach((num) => {
        itemsToInsert.push({
          customerNumber: ensureCountryCode(num),
          category: 'owner',
          leadSource: 'direct_owner',
        });
      });
    }

    if (itemsToInsert.length === 0) {
      setStatusMessage({ type: 'error', text: 'يرجى كتابة أرقام في خانة العملاء المحتملين أو خانة الملاك قبل الحفظ.' });
      return;
    }

    setLoadingAction(true);
    try {
      await onAddCustomers(itemsToInsert, autoDistributeOnImport);
      if (categoryMode === 'lead' || categoryMode === 'both') setLeadsNumbersText('');
      if (categoryMode === 'owner' || categoryMode === 'both') setOwnersNumbersText('');

      const leadsAddedCount = (categoryMode === 'lead' || categoryMode === 'both') ? leadLines.length : 0;
      const ownersAddedCount = (categoryMode === 'owner' || categoryMode === 'both') ? ownerLines.length : 0;

      setStatusMessage({
        type: 'success',
        text: `تمت إضافة ${itemsToInsert.length} رقم بنجاح (${leadsAddedCount > 0 ? `${leadsAddedCount} عملاء محتملين 🎯` : ''} ${ownersAddedCount > 0 ? `${ownersAddedCount} ملاك 🏠` : ''}) ${autoDistributeOnImport ? 'وتوزيعهم بالتساوي' : ''}!`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'فشل في إضافة الأرقام' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSheetFetchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrlInput.trim()) {
      alert('يرجى إدخال رابط Google Sheet');
      return;
    }

    setLoadingAction(true);
    setStatusMessage(null);
    try {
      await onFetchSheet(sheetUrlInput, autoDistributeOnImport);
      setStatusMessage({ type: 'success', text: 'تمت القراءة والجلب من Google Sheet وتحديث القائمة بنجاح!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'تعذر جلب البيانات من Google Sheet' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDistributeAction = async (redistributeAll: boolean) => {
    setLoadingAction(true);
    try {
      await onDistributeCustomers(redistributeAll);
      setStatusMessage({
        type: 'success',
        text: redistributeAll
          ? 'تمت إعادة توزيع جميع الأرقام بالتساوي على موظفي المبيعات فقط (حسب السياسة: لا يتم التوزيع على الإدارة أو المسوقين)'
          : 'تم توزيع الأرقام المتبقية بالتساوي على موظفي المبيعات',
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: 'حدث خطأ أثناء التوزيع' });
    } finally {
      setLoadingAction(false);
    }
  };

  // Filtered Overview Customers
  const filteredCustomers = customers.filter((c) => {
    const matchesSearch =
      c.customerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm)) ||
      (c.assignedToName && c.assignedToName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesUser =
      filterUser === 'all'
        ? true
        : filterUser === 'unassigned'
        ? !c.assignedToEmail
        : c.assignedToEmail?.toLowerCase() === filterUser.toLowerCase();

    const matchesStatus = filterStatus === 'all' ? true : c.status === filterStatus;
    const matchesCategory =
      filterCategory === 'all'
        ? true
        : filterCategory === 'lead'
        ? c.category === 'lead'
        : c.category !== 'lead';

    return matchesSearch && matchesUser && matchesStatus && matchesCategory;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 dir-rtl font-sans">
      
      {/* Top Banner & KPI Summary */}
      <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#8c622b]/10 text-[#704d1f] text-[11px] px-2.5 py-0.5 rounded-full border border-[#8c622b]/20 font-bold">
                مركز التحكم الإداري (Executive Admin)
              </span>
              <span className="text-[#6e685f] text-xs font-medium">إدارة المنظومة وسقف المبيعات</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[#2c2824] mt-1.5">التحكم في فرق العمل، السقف اليومي، وحسابات الاستيراد والتوزيع</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleDistributeAction(false)}
              disabled={loadingAction || unassignedCustomers.length === 0}
              className="bg-[#eae3d5] hover:bg-[#dfd7c7] disabled:opacity-40 text-[#2c2824] border border-[#d8cebe] font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 text-[#8c622b] ${loadingAction ? 'animate-spin' : ''}`} />
              <span>توزيع الأرقام الجديدة ({unassignedCustomers.length})</span>
            </button>

            <button
              onClick={() => handleDistributeAction(true)}
              disabled={loadingAction || customers.length === 0}
              className="bg-[#8c622b] hover:bg-[#704d1f] disabled:opacity-40 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-white" />
              <span>إعادة توزيع الكل بالتساوي</span>
            </button>
          </div>
        </div>

        {/* Global KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="bg-[#f5efe4] p-3.5 rounded-2xl border border-[#e2d8c7] shadow-sm">
            <div className="text-[11px] text-[#6e685f] font-medium">إجمالي الحسابات:</div>
            <div className="text-lg font-bold text-[#2c2824] mt-1">{users.length}</div>
          </div>

          <div className="bg-[#fffbf0] p-3.5 rounded-2xl border border-[#8c622b]/30 shadow-sm">
            <div className="text-[11px] text-[#704d1f] font-bold">بانتظار الموافقة:</div>
            <div className="text-lg font-bold text-[#8c622b] mt-1">{pendingUsers.length}</div>
          </div>

          <div className="bg-[#f5efe4] p-3.5 rounded-2xl border border-[#e2d8c7] shadow-sm">
            <div className="text-[11px] text-[#6e685f] font-medium">إجمالي الأرقام:</div>
            <div className="text-lg font-bold text-[#2c2824] mt-1">{customers.length}</div>
          </div>

          <div className="bg-[#f5efe4] p-3.5 rounded-2xl border border-[#e2d8c7] shadow-sm">
            <div className="text-[11px] text-[#704d1f] font-medium">العملاء المحتملون (Leads):</div>
            <div className="text-lg font-bold text-[#8c622b] mt-1">{leadsCount}</div>
          </div>

          <div className="bg-[#f5efe4] p-3.5 rounded-2xl border border-[#e2d8c7] shadow-sm">
            <div className="text-[11px] text-[#6e685f] font-medium">الملاك (Owners):</div>
            <div className="text-lg font-bold text-[#2c2824] mt-1">{ownersCount}</div>
          </div>

          <div className="bg-[#f5efe4] p-3.5 rounded-2xl border border-[#e2d8c7] shadow-sm">
            <div className="text-[11px] text-emerald-800 font-medium">دليل الاتصال:</div>
            <div className="text-lg font-bold text-emerald-800 mt-1">{contactsCount}</div>
          </div>

          <div className="bg-[#f5efe4] p-3.5 rounded-2xl border border-[#e2d8c7] shadow-sm">
            <div className="text-[11px] text-[#6e685f] font-medium">طلبات التحويل:</div>
            <div className="text-lg font-bold text-[#2c2824] mt-1">{pendingTransferCustomers.length}</div>
          </div>
        </div>
      </div>

      {/* Pending Employee Join Requests Banner (Always Visible at Top of Admin Dashboard) */}
      {pendingUsers.length > 0 && (
        <div className="bg-[#fffbf0] border-2 border-[#8c622b]/50 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#8c622b] animate-pulse" />
              <h3 className="text-sm font-bold text-[#2c2824]">
                طلبات انضمام موظفين جدد (بانتظار موافقة واعتمادك كـ مدير للنظام)
              </h3>
              <span className="bg-[#8c622b]/15 text-[#704d1f] text-xs px-2.5 py-0.5 rounded-full border border-[#8c622b]/30 font-bold">
                {pendingUsers.length} طلبات جديدة
              </span>
            </div>
            <span className="text-[11px] text-[#704d1f] font-medium hidden sm:inline">اضغط لقبول الموظف واعتماده فوراً</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingUsers.map((u) => (
              <div key={u.id} className="bg-[#ffffff] border border-[#e2d8c7] rounded-2xl p-4 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#2c2824]">{u.name}</span>
                  <span className="text-[10px] bg-[#8c622b]/15 text-[#704d1f] border border-[#8c622b]/30 px-2 py-0.5 rounded-full font-bold">
                    طلب انضمام موظف ⏳
                  </span>
                </div>

                <div className="text-xs text-[#2c2824] space-y-1 bg-[#f8f5ee] p-3 rounded-xl border border-[#e8e0d0]">
                  <div className="flex justify-between">
                    <span className="text-[#6e685f]">البريد الإلكتروني:</span>
                    <strong className="text-[#8c622b] font-mono dir-ltr text-right">{u.email}</strong>
                  </div>
                  {u.createdAt && (
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6e685f]">تاريخ الإرسال:</span>
                      <span className="text-[#2c2824]">{new Date(u.createdAt).toLocaleString('ar-EG')}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleApprove(u.email)}
                    disabled={loadingAction}
                    className="flex-1 bg-[#8c622b] hover:bg-[#704d1f] text-white text-xs font-bold py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer active:scale-[0.98]"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>قبول واعتماد الموظف</span>
                  </button>
                  <button
                    onClick={() => handleReject(u.email)}
                    disabled={loadingAction}
                    className="bg-[#f2ece1] hover:bg-rose-100 text-rose-700 border border-[#d8cebe] text-xs font-semibold py-2 px-3 rounded-xl transition-colors cursor-pointer"
                    title="رفض الطلب"
                  >
                    <UserX className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Transfer Requests Admin Action UI */}
      {pendingTransferCustomers.length > 0 && (
        <div className="bg-blue-950/40 border-2 border-blue-500/60 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-blue-400 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-100">
                طلبات تحويل العملاء والملاك بين الموظفين (بانتظار موافقة المسؤول Admin)
              </h3>
              <span className="bg-blue-500/30 text-blue-300 text-xs px-2.5 py-0.5 rounded-full border border-blue-500/40 font-bold">
                {pendingTransferCustomers.length} طلبات معلقة
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingTransferCustomers.map((cust) => (
              <div key={cust.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200">{cust.customerNumber}</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-bold border border-slate-700">
                    {cust.category === 'lead' ? 'Lead 🎯' : cust.category === 'owner' ? 'Owner 🏢' : 'جهة اتصال 📇'}
                  </span>
                </div>

                <div className="text-xs text-slate-300 space-y-1 bg-slate-800/80 p-3 rounded-lg border border-slate-700/80">
                  <div className="flex justify-between">
                    <span className="text-slate-400">طالب التحويل (من):</span>
                    <strong className="text-slate-200">{cust.assignedToName || cust.assignedToEmail}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">الموظف المستهدف (إلى):</span>
                    <strong className="text-blue-300">{cust.transferRequest?.targetEmail}</strong>
                  </div>
                  {cust.transferRequest?.reasonNote && (
                    <div className="pt-1 border-t border-slate-700/60 text-slate-300 text-[11px]">
                      <span className="text-slate-400">السبب/الملاحظة: </span>
                      {cust.transferRequest.reasonNote}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onApproveTransfer && onApproveTransfer(cust.id)}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>موافقة وتعيين للزميل</span>
                  </button>
                  <button
                    onClick={() => onRejectTransfer && onRejectTransfer(cust.id)}
                    className="bg-slate-800 hover:bg-rose-950/80 text-rose-400 border border-rose-500/40 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
                  >
                    رفض الطلب
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Alert Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-bold border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-200">
            ✕
          </button>
        </div>
      )}

      {/* Admin Tab Navigation - Clean & Focused */}
      <div className="flex items-center gap-2 border-b border-[#e2d8c7] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('ceo_main')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'ceo_main'
              ? 'bg-gradient-to-r from-amber-600 via-[#8c622b] to-amber-700 text-white font-extrabold shadow-md ring-2 ring-amber-400/50'
              : 'bg-[#f2ece1] text-[#704d1f] hover:text-[#2c2824] border border-[#d8cebe]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>الرئيسية (CEO Dashboard) 👑</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-[#8c622b] text-white font-bold shadow-sm'
              : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>الموظفون والسقف اليومي ({approvedUsers.length})</span>
          {pendingUsers.length > 0 && (
            <span className="bg-[#8c622b] text-white text-[10px] px-1.5 py-0.5 rounded-full font-black">
              {pendingUsers.length} طلب جديد
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-[#8c622b] text-white font-bold shadow-sm'
              : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>جدول العملاء والإدارة ({customers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'import'
              ? 'bg-[#8c622b] text-white font-bold shadow-sm'
              : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>جلب Google Sheet والإدخال</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'analytics' || activeTab === 'activities'
              ? 'bg-[#8c622b] text-white font-bold shadow-sm'
              : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>مركز التقارير والأداء والتحليلات الشامل 📊</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_query')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ai_query'
              ? 'bg-gradient-to-r from-[#8c622b] to-[#704d1f] text-white font-bold shadow-md ring-2 ring-amber-400/40'
              : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          <span>قسم الذكاء الاصطناعي 🎙️</span>
        </button>

        <button
          onClick={() => setActiveTab('backup_center')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'backup_center'
              ? 'bg-gradient-to-r from-emerald-800 to-emerald-900 text-white font-bold shadow-md ring-2 ring-emerald-400/40'
              : 'bg-[#f2ece1] text-emerald-800 hover:text-[#2c2824] border border-emerald-600/30'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span>النسخ الاحتياطي والأرشفة 🛡️</span>
        </button>

        <button
          onClick={() => setShowTasksDrawer(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#f2ece1] text-[#8c622b] hover:bg-[#e8dfcf] border border-[#8c622b]/30 shadow-sm transition-all cursor-pointer mr-auto"
          title="عرض المهام والمواعيد في لوحة جانبية"
        >
          <Calendar className="w-4 h-4" />
          <span>المهام والمواعيد 📅 (جانبية)</span>
        </button>
      </div>

      {/* TAB 0: CEO MAIN EXECUTIVE DASHBOARD */}
      {activeTab === 'ceo_main' && (
        <CeoExecutiveDashboard
          currentUser={currentUser || users.find(u => u.role === 'admin') || { id: 'admin', email: DEFAULT_ADMIN_EMAIL, name: 'المدير التنفيذي', role: 'admin', status: 'approved', createdAt: new Date().toISOString() }}
          users={users}
          customers={customers}
          onDistributeCustomers={onDistributeCustomers}
          onRefreshData={() => window.location.reload()}
        />
      )}

      {/* TAB 1: USERS & DAILY QUOTA MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-6">

          {/* User Control Header Actions */}
          <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#2c2824] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#8c622b]" />
                <span>إدارة وحماية قائمة الموظفين والمستخدمين</span>
              </h3>
              <p className="text-xs text-[#6e685f] font-medium mt-1">
                إضافة موظفين حقيقيين معتمدين، تجميد أو حذف الحسابات، وتنظيف الحسابات الوهمية لمنع وصول أي مستخدم غير مصرح له.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowAddUserModal(true)}
                className="bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span>إضافة موظف حقيقي جديد</span>
              </button>

              <button
                onClick={handlePurgeFakeAction}
                disabled={loadingAction}
                className="bg-[#f2ece1] hover:bg-rose-100 text-rose-700 border border-[#d8cebe] font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                title="حذف كافة الحسابات غير المعتمة أو الوهمية بضغطة واحدة"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>تصفية وتنظيف الحسابات الوهمية</span>
              </button>
            </div>
          </div>

          {/* Add Real Employee Form / Modal */}
          {showAddUserModal && (
            <div className="bg-zinc-950 border-2 border-amber-400/50 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h4 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-400" />
                  <span>إضافة موظف جديد واعتماده فورياً</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="text-zinc-400 hover:text-zinc-200 text-xs font-bold"
                >
                  إلغاء ✕
                </button>
              </div>

              <form onSubmit={handleCreateUserSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-zinc-300 font-medium block mb-1">اسم الموظف الكامل *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد محمود علي"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-zinc-100 p-2.5 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="text-amber-300 font-medium block mb-1">اسم المستخدم للدخول (Username) *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ahmed101"
                    value={newUserUsername}
                    onChange={(e) => setNewUserUsername(e.target.value)}
                    className="w-full bg-zinc-900 border border-amber-500/50 focus:border-amber-400 text-amber-300 font-mono font-bold p-2.5 rounded-xl outline-none dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="text-amber-300 font-medium block mb-1">كلمة المرور *</label>
                  <input
                    type="text"
                    required
                    placeholder="123456"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-amber-500/50 focus:border-amber-400 text-amber-300 font-mono font-bold p-2.5 rounded-xl outline-none dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="text-amber-300 font-medium block mb-1">كود الموظف الفريد (تلقائي إن ترك فارغاً)</label>
                  <input
                    type="text"
                    placeholder="تلقائي: EMP-103"
                    value={newUserCode}
                    onChange={(e) => setNewUserCode(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-amber-400 font-mono font-bold p-2.5 rounded-xl outline-none dir-ltr text-right"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-medium block mb-1">البريد الإلكتروني (Gmail - اختياري)</label>
                  <input
                    type="email"
                    placeholder="employee@gmail.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-zinc-100 p-2.5 rounded-xl outline-none dir-ltr text-right font-mono"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-medium block mb-1">رقم الهاتف / واتساب (اختياري)</label>
                  <input
                    type="text"
                    placeholder="0501234567"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-zinc-100 p-2.5 rounded-xl outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="text-zinc-300 font-medium block mb-1">الدور والصلاحية</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-2.5 rounded-xl outline-none"
                  >
                    <option value="user">👤 موظف مبيعات عادي</option>
                    <option value="marketing">📣 موظف تسويق وحملات</option>
                    <option value="admin">⭐ مدير / أدمين</option>
                  </select>
                </div>

                <div>
                  <label className="text-amber-300 font-medium block mb-1">سقف العملاء المحتملين (Leads / اليوم)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newUserLeadQuota}
                    onChange={(e) => setNewUserLeadQuota(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-amber-300 font-bold p-2.5 rounded-xl outline-none"
                  />
                </div>

                <div>
                  <label className="text-purple-300 font-medium block mb-1">سقف الملاك (Owners / اليوم)</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newUserOwnerQuota}
                    onChange={(e) => setNewUserOwnerQuota(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-800 text-purple-300 font-bold p-2.5 rounded-xl outline-none"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="px-4 py-2 text-zinc-400 hover:text-zinc-200"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction}
                    className="bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    حفظ وإضافة الحساب المعتمد
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Pending Approval Requests Section */}
          {pendingUsers.length > 0 && (
            <div className="bg-[#fffdfa] border-2 border-[#8c622b] rounded-3xl p-6 space-y-4 shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-[#e2d8c7]">
                <div className="flex items-center gap-2.5 text-[#8c622b] font-extrabold text-base">
                  <ShieldCheck className="w-6 h-6 text-[#8c622b]" />
                  <span>طلبات التسجيل بانتظار اعتماد مالك النظام (حازم محي) ({pendingUsers.length})</span>
                </div>
                <span className="text-xs bg-[#8c622b]/10 text-[#8c622b] font-bold px-3 py-1 rounded-full border border-[#8c622b]/20">
                  يتطلب موافقتك الصارمة وتأكيد الكود
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingUsers.map((u) => (
                  <div key={u.id} className="bg-[#f5efe4] border border-[#d8cebe] rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-extrabold text-[#2c2824]">{u.name}</div>
                        <div className="text-xs text-[#6e685f] font-mono mt-0.5">
                          👤 اسم المستخدم: <strong className="text-[#2c2824]">{u.username || 'غير محدد'}</strong>
                        </div>
                        {u.phone && (
                          <div className="text-xs text-[#6e685f] font-mono mt-0.5">
                            📱 الهاتف: <strong className="text-[#2c2824]">{u.phone}</strong>
                          </div>
                        )}
                      </div>
                      <span className="bg-[#8c622b] text-white text-[11px] font-mono font-bold px-2 py-0.5 rounded shadow-xs">
                        {u.userCode || 'EMP-103'}
                      </span>
                    </div>

                    <div className="text-[11px] bg-[#eae1d0] p-2 rounded-xl text-[#554f47] leading-relaxed">
                      كلمة المرور المسجلة: <code className="font-mono font-bold text-[#8c622b]">{u.password || '123456'}</code>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#d8cebe]">
                      <button
                        onClick={() => handleApprove(u.email)}
                        disabled={loadingAction}
                        className="flex-1 bg-[#8c622b] hover:bg-[#734f21] text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>اعتماد وموافقة حازم محي</span>
                      </button>
                      <button
                        onClick={() => handleReject(u.email)}
                        disabled={loadingAction}
                        className="p-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl border border-rose-300 transition-all cursor-pointer disabled:opacity-50"
                        title="رفض الحساب"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Staff Members List & Quota Settings */}
          <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#2c2824]">الموظفون المعتمدون وسقف التوزيع والتحكم</h3>
                <p className="text-xs text-[#6e685f] mt-0.5">
                  تحديد سقف الأرقام اليومية، تعديل الأدوار، تجميد أو حذف أي حساب موظف نهائياً.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedUsers.map((u) => {
                const isEditingThis = editingQuotaUserEmail === u.email;
                const userCusts = customers.filter(c => c.assignedToEmail?.toLowerCase() === u.email.toLowerCase());
                const assignedCount = userCusts.length;
                const contactedCount = userCusts.filter(c => c.status !== 'pending' || (c.feedbackHistory && c.feedbackHistory.length > 0)).length;
                const resolvedCount = userCusts.filter(c => c.status && c.status !== 'pending' && c.status !== 'contacted').length;

                return (
                  <div key={u.id} className="bg-[#ffffff] border border-[#e2d8c7] rounded-3xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-[#2c2824] flex items-center gap-1.5 flex-wrap">
                          <span>{u.name}</span>
                          <span className="bg-[#8c622b] text-white text-[10px] px-2 py-0.5 rounded font-mono font-bold shadow-xs">
                            {u.userCode || 'EMP-100'}
                          </span>
                          {u.role === 'admin' ? (
                            <span className="bg-purple-900/15 text-purple-900 text-[10px] px-2 py-0.5 rounded border border-purple-800/30 font-bold">
                              مدير عام (Admin) ⭐
                            </span>
                          ) : u.role === 'manager' ? (
                            <span className="bg-indigo-900/15 text-indigo-900 text-[10px] px-2 py-0.5 rounded border border-indigo-800/30 font-bold">
                              مدير قسم (Manager) 🏢
                            </span>
                          ) : u.role === 'marketing' ? (
                            <span className="bg-amber-900/15 text-amber-900 text-[10px] px-2 py-0.5 rounded border border-amber-800/30 font-bold">
                              مسؤول تسويق (Marketing) 📣
                            </span>
                          ) : (
                            <span className="bg-emerald-900/15 text-emerald-900 text-[10px] px-2 py-0.5 rounded border border-emerald-800/30 font-bold">
                              موظف مبيعات (Sales) 👤
                            </span>
                          )}
                        </div>

                        {/* Multiple Job Titles Badges */}
                        {u.jobTitles && u.jobTitles.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {u.jobTitles.map((jt, idx) => (
                              <span key={idx} className="bg-[#8c622b]/10 text-[#704d1f] text-[10px] px-2 py-0.5 rounded-md font-bold border border-[#8c622b]/20">
                                {jt}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-xs text-[#6e685f] font-mono mt-1 flex items-center gap-2 flex-wrap">
                          {u.username && <span>اسم المستخدم: <strong className="text-[#2c2824]">{u.username}</strong></span>}
                          <span>📧 {u.email}</span>
                        </div>
                        {u.phone && <div className="text-[11px] text-[#857d72] font-mono mt-0.5">📱 {u.phone}</div>}
                      </div>

                      <span className="text-[10px] bg-emerald-800/10 text-emerald-800 border border-emerald-800/20 px-2 py-0.5 rounded-full font-bold shrink-0">
                        نشط ومعتمد
                      </span>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-2 bg-[#f8f5ee] p-3 rounded-2xl border border-[#e8e0d0] text-xs">
                      <div>
                        <div className="text-[#6e685f] text-[10px]">الأرقام المستلمة:</div>
                        <div className="font-bold text-[#2c2824] mt-0.5">{assignedCount} عميل</div>
                      </div>
                      <div>
                        <div className="text-[#6e685f] text-[10px]">تم التواصل معهم:</div>
                        <div className="font-bold text-amber-800 mt-0.5">{contactedCount} تواصل</div>
                      </div>
                      <div>
                        <div className="text-[#6e685f] text-[10px]">محسوم الموقف (إنجاز):</div>
                        <div className="font-bold text-emerald-800 mt-0.5">{resolvedCount} إنجاز</div>
                      </div>
                    </div>

                    {/* Current Quota Info */}
                    {!isEditingThis ? (
                      <div className="bg-[#f5efe4] p-3 rounded-2xl border border-[#e2d8c7] space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[#2c2824]">
                          <span>سقف التوزيع اليومي:</span>
                          <span className="font-bold text-[#8c622b]">{u.dailyQuota || 10} رقم / يوم</span>
                        </div>
                        <div className="flex items-center justify-between text-[#6e685f] text-[11px]">
                          <span>سقف المحتملين (Leads):</span>
                          <span>{u.dailyLeadQuota || 10} رقم</span>
                        </div>
                        <div className="flex items-center justify-between text-[#6e685f] text-[11px]">
                          <span>سقف الملاك (Owners):</span>
                          <span>{u.dailyOwnerQuota || 10} رقم</span>
                        </div>

                        <div className="flex items-center gap-1.5 pt-2 border-t border-[#e2d8c7] flex-wrap">
                          <button
                            onClick={() => {
                              setEditingQuotaUserEmail(u.email);
                              setEditNameVal(u.name || '');
                              setEditUsernameVal(u.username || '');
                              setEditPasswordVal(u.password || '');
                              setEditUserCodeVal(u.userCode || '');
                              setEditPhoneVal(u.phone || '');
                              setEditJobTitlesVal(u.jobTitles ? u.jobTitles.join(', ') : '');
                              setQuotaVal(u.dailyQuota || 10);
                              setLeadQuotaVal(u.dailyLeadQuota || 10);
                              setOwnerQuotaVal(u.dailyOwnerQuota || 10);
                              setIncrementVal(u.quotaIncrementPerDay || 2);
                              setSelectedOffDays(u.offDays || [5, 6]);
                              setEarlyLeaveVal(u.earlyLeaveToday || false);
                              setRoleVal(u.role || 'user');
                            }}
                            className="flex-1 bg-[#eae3d5] hover:bg-[#dfd7c7] text-[#704d1f] border border-[#d8cebe] text-[11px] font-bold py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>تعديل الموظف والألقاب والسقف</span>
                          </button>

                          {u.email.toLowerCase() !== DEFAULT_ADMIN_EMAIL.toLowerCase() && (
                            <>
                              <button
                                onClick={() => handleSuspendUserAction(u.email, u.name)}
                                className="p-1.5 bg-[#f2ece1] hover:bg-amber-100 text-[#8c622b] border border-[#d8cebe] rounded-xl cursor-pointer flex items-center gap-1 text-[11px]"
                                title="تجميد/إيقاف الحساب"
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteUserAction(u.email, u.name)}
                                className="p-1.5 bg-[#f2ece1] hover:bg-rose-100 text-rose-700 border border-[#d8cebe] rounded-xl cursor-pointer flex items-center gap-1 text-[11px]"
                                title="مسح/حذف الموظف نهائياً"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                              </button>
                            </>
                          )}
                        </div>

                        {/* Audit Details Button */}
                        <button
                          onClick={() => {
                            setSelectedAuditUserEmail(u.email);
                            setAuditSearchTerm('');
                            setAuditMethodFilter('all');
                            setAuditCategoryFilter('all');
                          }}
                          className="w-full mt-2 bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                        >
                          <PhoneCall className="w-4 h-4 text-amber-300" />
                          <span>فتح ملف المكالمات والواتساب والردود ({assignedCount} رقم) 📂</span>
                        </button>
                      </div>
                    ) : (
                      /* Complete Employee Editing Form */
                      <form onSubmit={(e) => handleSaveQuotaSubmit(e, u.email)} className="bg-[#fcfbfa] p-4 rounded-2xl border border-[#8c622b]/40 space-y-3 text-xs shadow-sm">
                        <div className="font-bold text-[#704d1f] text-xs border-b border-[#e2d8c7] pb-1.5 flex justify-between items-center">
                          <span>تعديل بيانات وإعدادات الموظف</span>
                          <span className="text-[10px] text-[#6e685f] font-mono">{u.email}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#6e685f] font-bold block mb-1">اسم الموظف:</label>
                            <input
                              type="text"
                              value={editNameVal}
                              onChange={(e) => setEditNameVal(e.target.value)}
                              className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none focus:border-[#8c622b] font-bold"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#6e685f] font-bold block mb-1">كود الموظف (الكود):</label>
                            <input
                              type="text"
                              value={editUserCodeVal}
                              onChange={(e) => setEditUserCodeVal(e.target.value)}
                              className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#8c622b] font-mono font-bold p-2 rounded-xl text-xs outline-none focus:border-[#8c622b]"
                              placeholder="EMP-102"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#6e685f] font-bold block mb-1">اسم المستخدم للدخول:</label>
                            <input
                              type="text"
                              value={editUsernameVal}
                              onChange={(e) => setEditUsernameVal(e.target.value)}
                              className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none focus:border-[#8c622b]"
                              placeholder="hazem_user"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-[#6e685f] font-bold block mb-1">كلمة المرور جديدة:</label>
                            <input
                              type="text"
                              value={editPasswordVal}
                              onChange={(e) => setEditPasswordVal(e.target.value)}
                              className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none focus:border-[#8c622b] font-mono"
                              placeholder="123456"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#6e685f] font-bold block mb-1">رقم الهاتف / الواتساب:</label>
                          <input
                            type="text"
                            value={editPhoneVal}
                            onChange={(e) => setEditPhoneVal(e.target.value)}
                            className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none focus:border-[#8c622b] font-mono"
                            placeholder="0501234567"
                          />
                        </div>

                        {/* Multiple Job Titles Input */}
                        <div>
                          <label className="text-[10px] text-[#704d1f] font-bold block mb-1">الألقاب والمسؤوليات الوظيفية (مفصولة بفاصلة):</label>
                          <input
                            type="text"
                            value={editJobTitlesVal}
                            onChange={(e) => setEditJobTitlesVal(e.target.value)}
                            className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none focus:border-[#8c622b]"
                            placeholder="مثال: مدير مبيعات, مسؤول تسويق, مشرف متابعة"
                          />
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {['مدير مبيعات', 'مسؤول تسويق', 'موظف مبيعات', 'مُنسّق توزيع', 'مشرف متابعة', 'خدمة عملاء'].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => {
                                  const current = editJobTitlesVal ? editJobTitlesVal.split(',').map(s=>s.trim()).filter(Boolean) : [];
                                  if (!current.includes(preset)) {
                                    setEditJobTitlesVal([...current, preset].join(', '));
                                  }
                                }}
                                className="text-[9px] bg-[#f2ece1] hover:bg-[#e8dfcf] text-[#704d1f] border border-[#d8cebe] px-2 py-0.5 rounded cursor-pointer font-bold"
                              >
                                + {preset}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#704d1f] font-bold block mb-1">الصفة والدور التنظيمي:</label>
                          <select
                            value={roleVal}
                            onChange={(e) => setRoleVal(e.target.value as any)}
                            className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none font-bold"
                          >
                            <option value="user">👤 موظف مبيعات عادي (توزع عليه المبيعات تلقائياً)</option>
                            <option value="marketing">📣 موظف تسويق وحملات (يوزع فقط ولا توزع عليه مبيعات)</option>
                            <option value="manager">🏢 مدير قسم / مسؤول (متابع ومناظر ولا توزع عليه مبيعات)</option>
                            <option value="admin">⭐ مدير عام / أدمين (صلاحيات كاملة ولا توزع عليه مبيعات)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-[#704d1f] font-bold block mb-1">سقف المحتملين (Leads):</label>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={leadQuotaVal}
                              onChange={(e) => setLeadQuotaVal(Number(e.target.value))}
                              className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#8c622b] font-bold p-2 rounded-xl text-xs outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-purple-800 font-bold block mb-1">سقف الملاك (Owners):</label>
                            <input
                              type="number"
                              min={1}
                              max={500}
                              value={ownerQuotaVal}
                              onChange={(e) => setOwnerQuotaVal(Number(e.target.value))}
                              className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-purple-900 font-bold p-2 rounded-xl text-xs outline-none"
                              required
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#6e685f] block mb-1">سقف الأرقام الكلي اليومي:</label>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            value={quotaVal}
                            onChange={(e) => setQuotaVal(Number(e.target.value))}
                            className="w-full bg-[#f8f5ee] border border-[#d8cebe] text-[#2c2824] p-2 rounded-xl text-xs outline-none"
                            required
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={loadingAction}
                            className="flex-1 bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold py-2 rounded-xl text-xs cursor-pointer shadow-sm"
                          >
                            حفظ التعديلات
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingQuotaUserEmail(null)}
                            className="p-2 text-[#6e685f] hover:text-[#2c2824] text-xs border border-[#d8cebe] bg-[#f2ece1] rounded-xl cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Suspended Accounts Section if any exist */}
          {suspendedUsers.length > 0 && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                <UserX className="w-4 h-4 text-rose-400" />
                <span>الحسابات الموقوفة / المعطلة ({suspendedUsers.length})</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {suspendedUsers.map((u) => (
                  <div key={u.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 opacity-80">
                    <div>
                      <div className="text-xs font-bold text-zinc-300">{u.name}</div>
                      <div className="text-[11px] text-zinc-500 font-mono">{u.email}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => handleApprove(u.email)}
                        disabled={loadingAction}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-zinc-700 font-bold py-1.5 rounded-lg text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>إعادة تفعيل الحساب</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUserAction(u.email, u.name)}
                        disabled={loadingAction}
                        className="p-1.5 bg-rose-950/80 text-rose-300 rounded-lg border border-rose-500/30 cursor-pointer"
                        title="حذف نهائي"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: IMPORT GOOGLE SHEETS & MANUAL ENTRY */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Google Sheets Connection */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">ربط وجلب بيانات Google Sheet تلقائياً</h3>
                <p className="text-xs text-slate-400">
                  أدخل رابط شيت جوجل العام واستورد العملاء بضغطة زر واحدة.
                </p>
              </div>
            </div>

            <form onSubmit={handleSheetFetchSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">رابط مستند Google Sheet:</label>
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={sheetUrlInput}
                  onChange={(e) => setSheetUrlInput(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-3 outline-none focus:border-emerald-500"
                  required
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  ملاحظة: يرجى التأكد من اختيار (Anyone with the link can view / أي شخص لديه الرابط يمكنه العرض) في شيت جوجل.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoDistributeSheet"
                  checked={autoDistributeOnImport}
                  onChange={(e) => setAutoDistributeOnImport(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-0"
                />
                <label htmlFor="autoDistributeSheet" className="text-xs text-slate-300 cursor-pointer">
                  توزيع الأرقام المستوردة فوراً بالتساوي على جميع الموظفين المعتمدين
                </label>
              </div>

              <button
                type="submit"
                disabled={loadingAction}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAction ? 'animate-spin' : ''}`} />
                <span>قراءة وجلب البيانات من Google Sheet</span>
              </button>
            </form>
          </div>

          {/* Manual Bulk Entry Section with 2 Separate Boxes */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-5 lg:col-span-2 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-400/10 text-amber-300 rounded-xl shrink-0 border border-amber-500/20">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <span>إدخال أرقام العملاء والملاك يدوياً (Leads & Owners)</span>
                  </h3>
                  <p className="text-xs text-zinc-400 font-medium">
                    أدخل أرقام العملاء المحتملين وأرقام الملاك في الخانات المخصصة للتصنيف والتوزيع الفوري.
                  </p>
                </div>
              </div>

              {/* Single action button to submit both boxes if filled */}
              <button
                type="button"
                onClick={() => handleManualAdd(undefined, 'both')}
                disabled={loadingAction || (!leadsNumbersText.trim() && !ownersNumbersText.trim())}
                className="bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-zinc-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-zinc-950" />
                <span>حفظ وإضافة كافة الأرقام المدخلة</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Box 1: Leads Entry */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 space-y-4 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>1. العملاء المحتملون (Leads)</span>
                  </div>
                  <span className="bg-amber-400/10 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-500/20">
                    مشتري / مستأجر
                  </span>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                    قائمة أرقام الـ Leads (سطر لكل عميل):
                  </label>
                  <textarea
                    rows={5}
                    placeholder={`0501234567\n0559876543\n0591122334`}
                    value={leadsNumbersText}
                    onChange={(e) => setLeadsNumbersText(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-zinc-200 text-xs rounded-xl p-3 outline-none font-mono transition-colors"
                  />
                </div>

                {/* Campaign Distinction Controls */}
                <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={leadsIsCampaign}
                        onChange={(e) => setLeadsIsCampaign(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Megaphone className="w-3.5 h-3.5 text-amber-400" />
                        حملة إعلانية ممولة (Campaign / Paid Ad)
                      </span>
                    </label>
                  </div>

                  {leadsIsCampaign && (
                    <div>
                      <label className="text-[11px] text-zinc-400 font-medium block mb-1">
                        اسم الحملة الإعلانية (لتتبع الأداء والتسويق):
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: حملة التجمع الخامس / فيسبوك"
                        value={leadsCampaignName}
                        onChange={(e) => setLeadsCampaignName(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-400 text-zinc-200 text-xs rounded-lg p-2.5 outline-none font-medium"
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleManualAdd(undefined, 'lead')}
                  disabled={loadingAction || !leadsNumbersText.trim()}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>حفظ وإضافة العملاء المحتملين فقط</span>
                </button>
              </div>

              {/* Box 2: Owners Entry */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 space-y-4 relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2 text-zinc-200 font-bold text-xs">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      <span>2. الملاك (Owners)</span>
                    </div>
                    <span className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded-full font-bold border border-zinc-700">
                      مالك وحدة / عرض
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                      قائمة أرقام الملاك (سطر لكل مالك):
                    </label>
                    <textarea
                      rows={5}
                      placeholder={`0509988776\n0551122334\n0594455667`}
                      value={ownersNumbersText}
                      onChange={(e) => setOwnersNumbersText(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-400 text-zinc-200 text-xs rounded-xl p-3 outline-none font-mono transition-colors"
                    />
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed">
                    💡 <strong className="text-slate-300">ملاحظة تنظيمية:</strong> سيتم تصنيف الأرقام في هذه الخانة تلقائياً كـ (ملاك - Owners) وإتاحة خيارات التسعير ونوع العقار لها في جدول متابعة الملاك.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleManualAdd(undefined, 'owner')}
                  disabled={loadingAction || !ownersNumbersText.trim()}
                  className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-md mt-4 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ وإضافة الملاك (Owners) فقط</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OVERVIEW & REASSIGNMENT TABLE */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Property Sales & Rent Key Analytics Widget */}
          <PropertyAnalyticsWidget customers={customers} isAdmin={true} />

          {/* Controls & Filters */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث بالرقم أو الموظف المستلم..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pr-9 pl-3 py-2.5 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 outline-none font-bold"
              >
                <option value="all">كافة التصنيفات (Leads + Owners + Contacts)</option>
                <option value="lead">🎯 العملاء المحتملين (Leads فقط)</option>
                <option value="owner">🏢 الملاك والعقارات المعروضة (Owners)</option>
                <option value="contact">📇 دليل الاتصال العام</option>
              </select>

              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 outline-none"
              >
                <option value="all">جميع الموظفين</option>
                <option value="unassigned">غير مخصص أحد</option>
                {approvedUsers.map((u) => (
                  <option key={u.id} value={u.email}>
                    {u.name}
                  </option>
                ))}
              </select>

              {onClearAllCustomers && (
                <button
                  onClick={async () => {
                    if (confirm('تنبيه هام جداً: هل أنت متاكد من حذف كل بيانات الأرقام والعملاء نهائياً؟')) {
                      await onClearAllCustomers();
                    }
                  }}
                  className="p-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded-xl border border-rose-500/30 text-xs font-bold"
                  title="مسح جميع الأرقام"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full text-right text-xs text-[#2c2824]">
              <thead className="bg-[#f2ece1] text-[#6e685f] font-bold border-b border-[#e2d8c7]">
                <tr>
                  <th className="p-3.5">الكود المرجعي</th>
                  <th className="p-3.5">النوع</th>
                  <th className="p-3.5">رقم العميل</th>
                  <th className="p-3.5">الاهتمام / الملاحظات</th>
                  <th className="p-3.5">الموظف المكلف</th>
                  <th className="p-3.5">حالة التواصل</th>
                  <th className="p-3.5">الموعد المجدول</th>
                  <th className="p-3.5">إجراءات الإشراف</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#e8e0d0]">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((c) => (
                    <tr key={c.id} className="hover:bg-[#f5efe4] transition-colors">
                      <td className="p-3.5 font-bold font-mono text-[#8c622b]">
                        <span className="bg-[#f0e6d5] border border-[#d8cb3b]/30 px-2 py-1 rounded-md">
                          {c.refCode || 'N/A'}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {c.category === 'lead' ? (
                          <span className="bg-[#8c622b]/10 text-[#704d1f] border border-[#8c622b]/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            Lead 🎯
                          </span>
                        ) : c.category === 'owner' ? (
                          <span className="bg-purple-900/10 text-purple-800 border border-purple-800/20 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            Owner 🏢
                          </span>
                        ) : (
                          <span className="bg-[#e8dfcf] text-[#6e685f] border border-[#d8cebe] px-2 py-0.5 rounded-full text-[10px]">
                            Contact 📇
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-bold font-mono text-[#2c2824] dir-ltr text-right">{c.customerNumber}</td>

                      <td className="p-3.5 max-w-[200px] truncate">
                        {c.leadDetails?.interestType || c.notes || 'لا يوجد ملاحظات مدخلة'}
                      </td>

                      <td className="p-3.5">
                        {onReassignCustomer ? (
                          <select
                            value={c.assignedToEmail || ''}
                            onChange={(e) => onReassignCustomer(c.id, e.target.value || null)}
                            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg p-1.5 outline-none font-medium"
                          >
                            <option value="">غير مخصص</option>
                            {approvedUsers.map((u) => (
                              <option key={u.id} value={u.email}>
                                {u.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          c.assignedToName || 'غير مخصص'
                        )}
                      </td>

                      <td className="p-3.5">
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-1 rounded">
                          {c.status === 'pending'
                            ? 'بانتظار التواصل'
                            : c.status === 'interested'
                            ? 'مهتم جداً'
                            : 'تم التواصل'}
                        </span>
                      </td>

                      <td className="p-3.5 text-amber-300 font-bold">
                        {c.nextFollowUpDate ? c.nextFollowUpDate.split('T')[0] : '—'}
                      </td>

                      <td className="p-3.5">
                        <button
                          onClick={() => onDeleteCustomer(c.id)}
                          className="p-1.5 text-rose-400 hover:bg-rose-950/50 rounded-lg transition-colors"
                          title="حذف العميل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                      لا توجد نتائج تطابق خيارات البحث
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* UNIFIED SINGLE ANALYTICS, PERFORMANCE & REPORTS CENTER */}
      {(activeTab === 'analytics' || activeTab === 'activities') && (
        <div className="space-y-8 dir-rtl">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-slate-700/80 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#8c622b]/30 text-amber-400 rounded-2xl border border-[#8c622b]/40">
                  <BarChart2 className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span>مركز التقارير والأداء والتحليلات الشامل</span>
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 font-mono">
                      نسخة موحدة كاملة
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300 mt-1">
                    صفحة موحدة تجمع كافة لوحات الإحصائيات، عدد المكالمات والواتساب، ترتيب الإيجنتات، والعملاء المتجاوبين وسجلات الاستقصاء والأنشطة.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTasksDrawer(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#8c622b] text-white text-xs font-bold hover:bg-[#704d1f] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Calendar className="w-4 h-4" />
                  <span>لوحة المهام الجانبية 📅</span>
                </button>
              </div>
            </div>

            {/* TOP KPI CARDS GRID */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
              {/* Card 1: Total Calls */}
              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>إجمالي المكالمات الموثقة</span>
                  <PhoneCall className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-300">
                  {customers.filter(c => (c.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('اتصال'))).length}
                  <span className="text-xs text-slate-400 font-normal mr-1">مكالمة</span>
                </div>
                <p className="text-[11px] text-slate-400">مكالمات مسجلة بأسماء الموظفين</p>
              </div>

              {/* Card 2: Total WhatsApp */}
              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>رسائل الواتساب المرسلة</span>
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-300">
                  {customers.filter(c => (c.feedbackHistory || []).some(f => (f.text || '').includes('💬') || (f.text || '').includes('واتساب'))).length}
                  <span className="text-xs text-slate-400 font-normal mr-1">رسالة</span>
                </div>
                <p className="text-[11px] text-slate-400">محادثات واتساب موثقة حياً</p>
              </div>

              {/* Card 3: Favorable Responsive Clients */}
              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>العملاء المتجاوبون والراغبون</span>
                  <CheckCircle2 className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-300">
                  {customers.filter(c =>
                    c.status === 'interested' || c.status === 'converted' || c.status === 'interested_sale' || c.status === 'interested_rent' ||
                    (c.feedbackHistory || []).some(f =>
                      (f.text || '').includes('مهتم') || (f.text || '').includes('بيع') || (f.text || '').includes('إيجار') ||
                      (f.text || '').includes('معاينة') || (f.text || '').includes('حجز') || (f.text || '').includes('تعاقد') ||
                      (f.text || '').includes('تفاصيل') || (f.text || '').includes('برايس') || (f.text || '').includes('لوكيشن')
                    )
                  ).length}
                  <span className="text-xs text-slate-400 font-normal mr-1">عميل</span>
                </div>
                <p className="text-[11px] text-amber-400 font-bold">وافقوا على إرسال التفاصيل أو في صالحنا</p>
              </div>

              {/* Card 4: Rejected / Not Interested */}
              <div className="bg-slate-800/90 border border-slate-700/80 p-4 rounded-2xl space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>المرفوضون / غير المهتمين</span>
                  <UserX className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-300">
                  {customers.filter(c =>
                    c.status === 'not_interested' || (c.feedbackHistory || []).some(f => (f.text || '').includes('غير مهتم') || (f.text || '').includes('مرفوض'))
                  ).length}
                  <span className="text-xs text-slate-400 font-normal mr-1">عميل</span>
                </div>
                <p className="text-[11px] text-slate-400">الذين رفضوا أو غير مهتمين بالخدمة</p>
              </div>
            </div>
          </div>

          {/* AGENTS LEADERBOARD RANKING (ترتيب الإيجنتات من الأقوى للأضعف) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
                  <span>ترتيب الموظفين والإيجنتات (من الأقوى أداءً إلى الأضعف)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  تقييم تراكمي دقيق يعتمد على عدد العملاء المتجاوبين، المكالمات المحققة، محادثات الواتساب، ونسبة المعالجة.
                </p>
              </div>
              <span className="text-xs bg-slate-800 text-amber-300 px-3 py-1 rounded-xl border border-slate-700 font-bold self-start">
                عدد الإيجنتات: {approvedUsers.length}
              </span>
            </div>

            <div className="space-y-3">
              {approvedUsers
                .map((u) => {
                  const userCusts = customers.filter(c => c.assignedToEmail?.toLowerCase() === u.email.toLowerCase());
                  const userFavorable = userCusts.filter(c =>
                    c.status === 'interested' || c.status === 'converted' || c.status === 'interested_sale' || c.status === 'interested_rent' ||
                    (c.feedbackHistory || []).some(f =>
                      (f.text || '').includes('مهتم') || (f.text || '').includes('بيع') || (f.text || '').includes('إيجار') ||
                      (f.text || '').includes('معاينة') || (f.text || '').includes('حجز') || (f.text || '').includes('تعاقد') ||
                      (f.text || '').includes('تفاصيل') || (f.text || '').includes('برايس') || (f.text || '').includes('لوكيشن')
                    )
                  );
                  const userRejected = userCusts.filter(c =>
                    c.status === 'not_interested' || (c.feedbackHistory || []).some(f => (f.text || '').includes('غير مهتم') || (f.text || '').includes('مرفوض'))
                  );

                  let userCalls = 0;
                  let userWa = 0;
                  customers.forEach(c => {
                    const isAssigned = c.assignedToEmail?.toLowerCase() === u.email.toLowerCase();
                    const hasCall = (c.feedbackHistory || []).some(f => {
                      const text = f.text || '';
                      if (!text.includes('📞') && !text.includes('اتصال')) return false;
                      const authorMatch = f.authorEmail ? f.authorEmail.toLowerCase() === u.email.toLowerCase() : false;
                      return authorMatch || isAssigned;
                    });
                    const hasWa = (c.feedbackHistory || []).some(f => {
                      const text = f.text || '';
                      if (!text.includes('💬') && !text.includes('واتساب')) return false;
                      const authorMatch = f.authorEmail ? f.authorEmail.toLowerCase() === u.email.toLowerCase() : false;
                      return authorMatch || isAssigned;
                    });
                    if (hasCall) userCalls++;
                    if (hasWa) userWa++;
                  });

                  const processed = userCusts.filter(c => c.status !== 'pending' || (c.feedbackHistory || []).length > 0);
                  const completionPercent = userCusts.length > 0 ? Math.round((processed.length / userCusts.length) * 100) : 0;
                  
                  // Score calculation
                  const score = (userFavorable.length * 5) + (userCalls * 2) + (userWa * 2) + (processed.length * 1);

                  return {
                    user: u,
                    userCusts,
                    userFavorable,
                    userRejected,
                    userCalls,
                    userWa,
                    processed,
                    completionPercent,
                    score
                  };
                })
                .sort((a, b) => b.score - a.score)
                .map((agentData, idx) => {
                  const { user, userCusts, userFavorable, userRejected, userCalls, userWa, processed, completionPercent } = agentData;
                  const rank = idx + 1;

                  let rankBadge = (
                    <span className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center font-black text-xs">
                      #{rank}
                    </span>
                  );

                  if (rank === 1) {
                    rankBadge = (
                      <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1">
                        🥇 المركز الأول (الأقوى أداءً)
                      </span>
                    );
                  } else if (rank === 2) {
                    rankBadge = (
                      <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 font-black text-xs shadow-md flex items-center gap-1">
                        🥈 المركز الثاني
                      </span>
                    );
                  } else if (rank === 3) {
                    rankBadge = (
                      <span className="px-3 py-1 rounded-xl bg-gradient-to-r from-amber-700 to-amber-800 text-white font-black text-xs shadow-md flex items-center gap-1">
                        🥉 المركز الثالث
                      </span>
                    );
                  }

                  return (
                    <div
                      key={user.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                        rank === 1
                          ? 'bg-slate-800/90 border-amber-500/50 shadow-lg ring-1 ring-amber-500/30'
                          : 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          {rankBadge}
                          <div>
                            <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                              <span>{user.name}</span>
                              <span className="bg-[#8c622b] text-white text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                                {user.userCode || 'EMP-100'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{user.email}</div>
                          </div>
                        </div>

                        {/* Metrics Badges Bar */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-700/80 text-center">
                            <span className="text-[10px] text-slate-400 block">إجمالي المستلم</span>
                            <span className="font-bold text-slate-100">{userCusts.length} عميل</span>
                          </div>

                          <div className="bg-emerald-950/80 px-3 py-2 rounded-xl border border-emerald-500/40 text-center">
                            <span className="text-[10px] text-emerald-300 block">المتجاوبين (في صالحنا)</span>
                            <span className="font-black text-emerald-300 text-sm">{userFavorable.length} عميل</span>
                          </div>

                          <div className="bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-700/80 text-center">
                            <span className="text-[10px] text-slate-400 block">📞 اتصالات</span>
                            <span className="font-bold text-emerald-400">{userCalls}</span>
                          </div>

                          <div className="bg-slate-900/90 px-3 py-2 rounded-xl border border-slate-700/80 text-center">
                            <span className="text-[10px] text-slate-400 block">💬 واتساب</span>
                            <span className="font-bold text-emerald-400">{userWa}</span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                          <span>نسبة المعالجة اليومية والتواصل: {completionPercent}%</span>
                          <span>مكتمل {processed.length} من أصل {userCusts.length}</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              rank === 1
                                ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-emerald-400'
                                : 'bg-gradient-to-r from-emerald-500 to-amber-400'
                            }`}
                            style={{ width: `${completionPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Audit File Trigger Button */}
                      <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[11px] text-slate-400 font-mono">
                          نقاط التقييم التراكمية: <strong className="text-amber-300">{agentData.score} نقطة</strong>
                        </span>
                        <button
                          onClick={() => {
                            setSelectedAuditUserEmail(user.email);
                            setAuditSearchTerm('');
                            setAuditMethodFilter('all');
                            setAuditCategoryFilter('all');
                          }}
                          className="bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                        >
                          <PhoneCall className="w-3.5 h-3.5 text-amber-300" />
                          <span>تدقيق واستدعاء سجل اتصالات الموظف 📂</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* PROPERTY ANALYTICS WIDGET */}
          <PropertyAnalyticsWidget customers={customers} isAdmin={true} />

          {/* OUTCOMES & RESPONSIVE LEADS ANALYSIS */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-400" />
              <span>تفاصيل استجابات ومواقف العملاء (الذين وافقوا مقابل المرفوضين)</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
              {[
                { label: 'تم الحجز', color: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30' },
                { label: 'تم التعاقد', color: 'border-emerald-500/50 text-emerald-300 bg-emerald-950/30' },
                { label: 'تم تحديد معاينة', color: 'border-blue-500/50 text-blue-300 bg-blue-950/30' },
                { label: 'تمت المعاينة', color: 'border-blue-500/50 text-blue-300 bg-blue-950/30' },
                { label: 'مهتم', color: 'border-amber-500/50 text-amber-300 bg-amber-950/30' },
                { label: 'يريد لوكيشن', color: 'border-purple-500/50 text-purple-300 bg-purple-950/30' },
                { label: 'يريد برايس ليست', color: 'border-purple-500/50 text-purple-300 bg-purple-950/30' },
                { label: 'يريد تفاصيل أكثر', color: 'border-purple-500/50 text-purple-300 bg-purple-950/30' },
                { label: 'مالك - معروض للبيع', color: 'border-purple-500/50 text-purple-300 bg-purple-950/30' },
                { label: 'غير مهتم', color: 'border-rose-500/50 text-rose-300 bg-rose-950/30' },
                { label: 'الميزانية غير مناسبة', color: 'border-rose-500/50 text-rose-300 bg-rose-950/30' },
                { label: 'كلمني لاحقًا', color: 'border-slate-700 text-slate-300 bg-slate-800' },
              ].map((outcome) => {
                const count = customers.filter(c => c.status === outcome.label || (c.feedbackHistory || []).some(f => (f.text || '').includes(outcome.label))).length;
                return (
                  <div key={outcome.label} className={`p-3.5 rounded-xl border ${outcome.color} space-y-1`}>
                    <div className="text-[11px] font-medium truncate" title={outcome.label}>{outcome.label}</div>
                    <div className="text-xl font-black">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* INTERACTIVE ACTIVITY & INVESTIGATIVE AUDIT TRACKER */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <ActivityIcon className="w-5 h-5 text-amber-400" />
              <span>سجل الاستقصاء والتتبع التفاعلي المباشر للأنشطة والعمليات ⚡</span>
            </h3>

            <ActivityTracker
              currentUser={{
                id: 'admin-1',
                email: DEFAULT_ADMIN_EMAIL,
                name: 'حازم محي (المسؤول)',
                role: 'admin',
                status: 'approved',
                createdAt: ''
              }}
              customers={customers}
            />
          </div>
        </div>
      )}

      {/* TAB: ADMIN EXECUTIVE AI VOICE & DATA HUB */}
      {activeTab === 'ai_query' && (
        <GeminiVoiceAssistant
          currentUser={{
            id: 'admin-1',
            email: DEFAULT_ADMIN_EMAIL,
            name: 'حازم محي (المسؤول)',
            role: 'admin',
            status: 'approved',
            createdAt: ''
          }}
          users={users}
          customers={customers}
          onOpenAiSettings={() => setShowAiSettingsModal(true)}
        />
      )}

      {/* TASKS & APPOINTMENTS TAB */}
      {activeTab === 'tasks' && (
        <TaskManager
          currentUser={{
            id: 'admin-1',
            email: DEFAULT_ADMIN_EMAIL,
            name: 'حازم محي (المسؤول)',
            role: 'admin',
            status: 'approved',
            createdAt: ''
          }}
          users={users}
        />
      )}

      {/* BACKUP & ARCHIVE MANAGEMENT CENTER TAB */}
      {activeTab === 'backup_center' && (
        <BackupManagementCenter currentUser={currentUser} />
      )}

      {/* SLIDE-OVER SIDE DRAWER FOR TASKS & APPOINTMENTS */}
      {showTasksDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-all dir-rtl">
          <div className="w-full max-w-2xl bg-[#faf8f5] h-full shadow-2xl flex flex-col border-r border-[#e2d8c7] overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="p-4 bg-[#f2ece1] border-b border-[#e2d8c7] flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#8c622b]" />
                <h3 className="font-bold text-[#2c2824] text-sm">لوحة المهام والمواعيد الجانبية 📅</h3>
              </div>
              <button
                onClick={() => setShowTasksDrawer(false)}
                className="px-3 py-1 rounded-lg bg-[#8c622b] text-white text-xs font-bold hover:bg-[#704d1f] transition-all cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
            <div className="p-4 flex-1">
              <TaskManager
                currentUser={{
                  id: 'admin-1',
                  email: DEFAULT_ADMIN_EMAIL,
                  name: 'حازم محي (المسؤول)',
                  role: 'admin',
                  status: 'approved',
                  createdAt: ''
                }}
                users={users}
              />
            </div>
          </div>
        </div>
      )}

      {/* AI AGENT GOVERNANCE & SETTINGS MODAL */}
      <AiAgentSettingsModal
        isOpen={showAiSettingsModal}
        onClose={() => setShowAiSettingsModal(false)}
      />

      {/* DETAILED EMPLOYEE COMMUNICATIONS & CALLS AUDIT MODAL */}
      {selectedAuditUserEmail && (() => {
        const auditUser = users.find(u => u.email.toLowerCase() === selectedAuditUserEmail.toLowerCase());
        if (!auditUser) return null;

        // Find all assigned or contacted customers for this employee
        const userAssigned = customers.filter(c => c.assignedToEmail?.toLowerCase() === auditUser.email.toLowerCase());
        
        // Detailed classification helper
        const getCustomerContactInfo = (cust: Customer) => {
          const userFeedbacks = (cust.feedbackHistory || []).filter(f => 
            (f.authorEmail && f.authorEmail.toLowerCase() === auditUser.email.toLowerCase()) ||
            (f.authorName && f.authorName.toLowerCase() === auditUser.name.toLowerCase()) ||
            (!f.authorEmail && cust.assignedToEmail?.toLowerCase() === auditUser.email.toLowerCase())
          );

          const hasCall = userFeedbacks.some(f => {
            const t = (f.text || '').toLowerCase();
            return t.includes('📞') || t.includes('اتصال') || t.includes('مكالمة') || t.includes('هاتف');
          });

          const hasWa = userFeedbacks.some(f => {
            const t = (f.text || '').toLowerCase();
            return t.includes('💬') || t.includes('واتساب') || t.includes('واتس') || t.includes('whatsapp');
          });

          const hasFeedback = userFeedbacks.length > 0;

          let method: 'both' | 'phone_only' | 'wa_only' | 'note' | 'pending' = 'pending';
          if (hasCall && hasWa) method = 'both';
          else if (hasCall) method = 'phone_only';
          else if (hasWa) method = 'wa_only';
          else if (hasFeedback) method = 'note';

          return { userFeedbacks, hasCall, hasWa, method };
        };

        // All customer entries
        const auditCustomersList = userAssigned.map(cust => ({
          customer: cust,
          ...getCustomerContactInfo(cust)
        }));

        // Stats
        const totalAssigned = auditCustomersList.length;
        const phoneOnlyCount = auditCustomersList.filter(item => item.method === 'phone_only').length;
        const waOnlyCount = auditCustomersList.filter(item => item.method === 'wa_only').length;
        const bothCount = auditCustomersList.filter(item => item.method === 'both').length;
        const noteOnlyCount = auditCustomersList.filter(item => item.method === 'note').length;
        const pendingCount = auditCustomersList.filter(item => item.method === 'pending').length;
        const totalContacted = totalAssigned - pendingCount;

        // Filtered list
        const filteredAuditItems = auditCustomersList.filter(item => {
          const cust = item.customer;
          
          if (auditMethodFilter !== 'all') {
            if (auditMethodFilter === 'both' && item.method !== 'both') return false;
            if (auditMethodFilter === 'phone_only' && item.method !== 'phone_only') return false;
            if (auditMethodFilter === 'wa_only' && item.method !== 'wa_only') return false;
            if (auditMethodFilter === 'pending' && item.method !== 'pending') return false;
          }

          if (auditCategoryFilter !== 'all' && cust.category !== auditCategoryFilter) return false;

          if (auditSearchTerm.trim()) {
            const q = auditSearchTerm.toLowerCase();
            const matchName = (cust.name || '').toLowerCase().includes(q);
            const matchPhone = (cust.phone || '').includes(q);
            const matchRef = (cust.refCode || '').toLowerCase().includes(q);
            const matchFeedback = item.userFeedbacks.some(f => (f.text || '').toLowerCase().includes(q));
            return matchName || matchPhone || matchRef || matchFeedback;
          }

          return true;
        });

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 dir-rtl">
            <div className="bg-[#fcfbfa] border-2 border-[#8c622b] rounded-3xl w-full max-w-5xl max-h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-200">
              
              {/* Modal Header */}
              <div className="bg-[#f2ece1] border-b border-[#e2d8c7] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#8c622b] text-white flex items-center justify-center font-black text-lg shadow-md shrink-0">
                    {auditUser.userCode || 'EMP'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-extrabold text-[#2c2824]">{auditUser.name}</h2>
                      <span className="bg-[#8c622b]/15 text-[#704d1f] font-mono text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#8c622b]/30">
                        {auditUser.role === 'admin' ? 'مدير عام ⭐' : auditUser.role === 'marketing' ? 'مسؤول تسويق 📣' : 'موظف مبيعات 👤'}
                      </span>
                    </div>
                    <p className="text-xs text-[#6e685f] mt-0.5 font-mono">
                      📧 {auditUser.email} {auditUser.phone ? `| 📱 ${auditUser.phone}` : ''}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedAuditUserEmail(null)}
                  className="bg-[#e2d8c7] hover:bg-[#d5c7b3] text-[#2c2824] p-2 rounded-2xl transition-all font-bold text-xs flex items-center gap-1 cursor-pointer self-end sm:self-center"
                >
                  <X className="w-5 h-5 text-[#2c2824]" />
                  <span>إغلاق ✕</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto flex-1 space-y-5">
                
                {/* Audit Title Banner */}
                <div className="bg-[#f8f5ee] border border-[#e2d8c7] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#2c2824] flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-[#8c622b]" />
                      <span>سجل تدقيق مكالمات الموظف ورسائل الواتساب والردود المسجلة</span>
                    </h3>
                    <p className="text-xs text-[#6e685f] mt-0.5">
                      تفاصيل كل الأرقام المستلمة بواسطة هذا الموظف، مع توثيق طريقة التواصل (اتصال هاتفي 📞 / واتساب 💬 / كلاهما 📞💬) مع الملاحظات والردود الحية.
                    </p>
                  </div>
                </div>

                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="bg-[#f2ece1] border border-[#d8cebe] p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-[11px] text-[#6e685f] block font-bold">إجمالي المستلم</span>
                    <span className="text-xl font-extrabold text-[#2c2824]">{totalAssigned}</span>
                    <span className="text-[10px] text-[#857d72] block">رقم عميل</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-[11px] text-emerald-800 block font-bold flex items-center justify-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                      <span>اتصال هاتفي فقط</span>
                    </span>
                    <span className="text-xl font-extrabold text-emerald-800">{phoneOnlyCount}</span>
                    <span className="text-[10px] text-emerald-600 block">رقم</span>
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-[11px] text-emerald-800 block font-bold flex items-center justify-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>واتساب فقط</span>
                    </span>
                    <span className="text-xl font-extrabold text-emerald-800">{waOnlyCount}</span>
                    <span className="text-[10px] text-emerald-600 block">رقم</span>
                  </div>

                  <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-2xl text-center space-y-1">
                    <span className="text-[11px] text-amber-900 block font-bold flex items-center justify-center gap-1">
                      <span>📞💬 اتصال + واتساب</span>
                    </span>
                    <span className="text-xl font-extrabold text-amber-900">{bothCount}</span>
                    <span className="text-[10px] text-amber-700 block">تواصل مكثف</span>
                  </div>

                  <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl text-center space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-rose-800 block font-bold">لم يتم التواصل بعد</span>
                    <span className="text-xl font-extrabold text-rose-800">{pendingCount}</span>
                    <span className="text-[10px] text-rose-600 block">بانتظار الملاحظة</span>
                  </div>
                </div>

                {/* Filters & Search Toolbar */}
                <div className="bg-[#f8f5ee] border border-[#e2d8c7] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#857d72] absolute right-3 top-3" />
                      <input
                        type="text"
                        placeholder="ابحث باسم العميل أو رقم الهاتف أو محتوى الملاحظة..."
                        value={auditSearchTerm}
                        onChange={(e) => setAuditSearchTerm(e.target.value)}
                        className="w-full bg-[#ffffff] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-[#8c622b]"
                      />
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-[#6e685f] font-bold">التصنيف:</span>
                      <select
                        value={auditCategoryFilter}
                        onChange={(e) => setAuditCategoryFilter(e.target.value as any)}
                        className="bg-[#ffffff] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2 outline-none font-bold"
                      >
                        <option value="all">كافة الفئات (Leads + Owners)</option>
                        <option value="lead">🎯 العملاء المحتملين (Leads)</option>
                        <option value="owner">🏢 الملاك (Owners)</option>
                      </select>
                    </div>
                  </div>

                  {/* Method Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs">
                    <button
                      onClick={() => setAuditMethodFilter('all')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        auditMethodFilter === 'all'
                          ? 'bg-[#8c622b] text-white shadow-xs'
                          : 'bg-[#ffffff] text-[#6e685f] border border-[#d8cebe] hover:bg-[#f2ece1]'
                      }`}
                    >
                      الكل ({totalAssigned})
                    </button>

                    <button
                      onClick={() => setAuditMethodFilter('phone_only')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        auditMethodFilter === 'phone_only'
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'bg-[#ffffff] text-[#6e685f] border border-[#d8cebe] hover:bg-emerald-50'
                      }`}
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
                      <span>اتصال هاتفي فقط ({phoneOnlyCount})</span>
                    </button>

                    <button
                      onClick={() => setAuditMethodFilter('wa_only')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        auditMethodFilter === 'wa_only'
                          ? 'bg-emerald-800 text-white shadow-xs'
                          : 'bg-[#ffffff] text-[#6e685f] border border-[#d8cebe] hover:bg-emerald-50'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>واتساب فقط ({waOnlyCount})</span>
                    </button>

                    <button
                      onClick={() => setAuditMethodFilter('both')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        auditMethodFilter === 'both'
                          ? 'bg-amber-800 text-white shadow-xs'
                          : 'bg-[#ffffff] text-[#6e685f] border border-[#d8cebe] hover:bg-amber-50'
                      }`}
                    >
                      <span>📞💬 كلاهما معاً ({bothCount})</span>
                    </button>

                    <button
                      onClick={() => setAuditMethodFilter('pending')}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                        auditMethodFilter === 'pending'
                          ? 'bg-rose-800 text-white shadow-xs'
                          : 'bg-[#ffffff] text-[#6e685f] border border-[#d8cebe] hover:bg-rose-50'
                      }`}
                    >
                      <span>⏳ لم يتم التواصل ({pendingCount})</span>
                    </button>
                  </div>
                </div>

                {/* Audit Customer Cards List */}
                <div className="space-y-3">
                  {filteredAuditItems.length > 0 ? (
                    filteredAuditItems.map(({ customer: cust, userFeedbacks, hasCall, hasWa, method }) => {
                      const cleanPhone = cust.phone ? cust.phone.replace(/[^0-9+]/g, '') : '';
                      const waFormatted = formatWhatsAppPhone(cleanPhone);

                      return (
                        <div key={cust.id} className="bg-[#ffffff] border border-[#e2d8c7] rounded-2xl p-4 space-y-3 shadow-xs hover:border-[#8c622b]/50 transition-all">
                          
                          {/* Row Top: Info & Method Badge */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#f0e8dc] pb-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-[#2c2824] text-sm">{cust.name || 'عميل غير مسمى'}</span>
                                <span className="font-mono text-xs text-[#8c622b] font-bold bg-[#f5efe4] px-2 py-0.5 rounded border border-[#d8cebe]">
                                  {cust.phone}
                                </span>
                                {cust.category === 'lead' ? (
                                  <span className="bg-[#8c622b]/10 text-[#704d1f] font-bold text-[10px] px-2 py-0.5 rounded border border-[#8c622b]/20">
                                    🎯 Lead (محتمل)
                                  </span>
                                ) : (
                                  <span className="bg-purple-900/10 text-purple-800 font-bold text-[10px] px-2 py-0.5 rounded border border-purple-800/20">
                                    🏢 Owner (مالك)
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#6e685f] mt-0.5 flex items-center gap-3">
                                <span>كود المرجع: <strong className="font-mono text-[#2c2824]">{cust.refCode || 'N/A'}</strong></span>
                                {cust.updatedAt && <span>آخر تحديث: {new Date(cust.updatedAt).toLocaleString('ar-EG')}</span>}
                              </div>
                            </div>

                            {/* Contact Method Status Badge */}
                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                              {method === 'both' ? (
                                <span className="bg-gradient-to-r from-amber-800 to-emerald-800 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                                  <span>📞💬 تم الاتصال هاتفيًا وإرسال واتساب (تواصل مزدوج)</span>
                                </span>
                              ) : method === 'phone_only' ? (
                                <span className="bg-emerald-800 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                                  <PhoneCall className="w-3.5 h-3.5 text-emerald-300" />
                                  <span>📞 تم الاتصال هاتفيًا فقط</span>
                                </span>
                              ) : method === 'wa_only' ? (
                                <span className="bg-emerald-800 text-white text-xs font-bold px-3 py-1 rounded-xl shadow-xs flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-300" />
                                  <span>💬 تم التواصل عبر الواتساب فقط</span>
                                </span>
                              ) : method === 'note' ? (
                                <span className="bg-slate-700 text-white text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5">
                                  <span>📝 تم توثيق ملاحظة / تحديث حالة</span>
                                </span>
                              ) : (
                                <span className="bg-rose-100 text-rose-800 border border-rose-300 text-xs font-bold px-3 py-1 rounded-xl flex items-center gap-1.5">
                                  <span>⏳ لم يتم التواصل بعد من الموظف</span>
                                </span>
                              )}

                              {/* Direct WhatsApp Action Link */}
                              {waFormatted && (
                                <a
                                  href={`https://wa.me/${waFormatted}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl border border-emerald-300 transition-all text-xs font-bold flex items-center gap-1"
                                  title="فتح محادثة الواتساب لهذا الرقم"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>فتح واتساب</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Feedbacks / Call Notes Audit Timeline */}
                          <div className="bg-[#fcfbfa] border border-[#e8e0d0] rounded-xl p-3 space-y-2 text-xs">
                            <div className="font-bold text-[#704d1f] text-[11px] flex items-center justify-between border-b border-[#e8e0d0] pb-1">
                              <span>سجل الردود والملاحظات الموثقة لهذا الرقم ({userFeedbacks.length}):</span>
                              <span className="font-mono text-[10px] text-[#857d72]">
                                الحالة الحالية: <strong className="text-[#2c2824]">{cust.status || 'معلق'}</strong>
                              </span>
                            </div>

                            {userFeedbacks.length > 0 ? (
                              <div className="space-y-2 divide-y divide-[#f2ece1]">
                                {userFeedbacks.map((f, idx) => (
                                  <div key={idx} className="pt-2 first:pt-0 space-y-1">
                                    <div className="flex items-center justify-between text-[11px] text-[#6e685f]">
                                      <span className="font-bold text-[#2c2824]">
                                        👤 {f.authorName || auditUser.name}
                                      </span>
                                      <span className="font-mono text-[10px] text-[#857d72]">{f.timestamp}</span>
                                    </div>
                                    <p className="text-xs text-[#2c2824] font-medium leading-relaxed bg-[#f5efe4] p-2 rounded-lg border border-[#e2d8c7]/60">
                                      {f.text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-[#857d72] text-[11px] italic py-1 text-center">
                                لا توجد ملاحظات أو ردود مدونة لهذا العميل بعد من الموظف.
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-[#f8f5ee] border border-[#e2d8c7] rounded-2xl p-8 text-center text-xs text-[#6e685f]">
                      لا توجد أرقام مطابقة لفلتر البحث المحدد لهذا الموظف.
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="bg-[#f2ece1] border-t border-[#e2d8c7] p-4 flex items-center justify-between text-xs">
                <span className="text-[#6e685f] font-mono">
                  تم عرض {filteredAuditItems.length} من أصل {totalAssigned} رقم مخصص للموظف ({auditUser.name})
                </span>
                <button
                  onClick={() => setSelectedAuditUserEmail(null)}
                  className="bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold px-5 py-2 rounded-xl transition-all cursor-pointer"
                >
                  إغلاق الملف ✕
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

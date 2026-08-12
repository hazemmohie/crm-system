export interface User {
  id: string;
  email: string;
  username?: string;
  userCode?: string; // e.g. EMP-001, EMP-102
  name: string;
  phone?: string;
  avatarUrl?: string;
  role: 'admin' | 'user' | 'marketing' | 'manager';
  jobTitles?: string[]; // Multiple Job Titles/Roles e.g. ['مدير مبيعات', 'مسؤول تسويق']
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  createdAt: string;
  agreedToTerms?: boolean;
  agreedAt?: string;
  password?: string;
  dailyQuota?: number; // Total Daily customer distribution ceiling
  dailyLeadQuota?: number; // Max Lead/Client ceiling per day
  dailyOwnerQuota?: number; // Max Owner ceiling per day
  earlyLeaveToday?: boolean; // Early day off toggle
  earlyLeaveDate?: string; // Date for early leave YYYY-MM-DD
  quotaIncrementPerDay?: number; // Daily quota growth per day
  offDays?: number[]; // Array of weekday numbers (0=Sunday, 5=Friday, 6=Saturday)
  addedByEmail?: string;
}

export type CustomerCategory = 'lead' | 'owner' | 'contact';
export type CustomerStatus = 'pending' | 'contacted' | 'no_answer' | 'not_interested' | 'interested' | 'converted';
export type LeadPriority = 'high' | 'medium' | 'low';
export type LeadSource = 'paid_ad' | 'organic_marketing' | 'direct_owner' | 'referral' | 'social_media' | string;

// Leads preset responses requested by user
export const LEAD_STATUS_OPTIONS = [
  'مهتم',
  'غير مهتم',
  'تم الحجز',
  'تم التعاقد',
  'تم تحديد معاينة',
  'تمت المعاينة',
  'يريد تفاصيل أكثر',
  'يريد صور',
  'يريد فيديو',
  'يريد لوكيشن',
  'يريد برايس ليست',
  'يريد أنظمة السداد',
  'الميزانية غير مناسبة',
  'المساحة غير مناسبة',
  'المنطقة غير مناسبة',
  'يؤجل القرار',
  'كلمني بعد ساعة',
  'كلمني لاحقًا',
  'كلمني غدًا',
  'كلمني الأسبوع القادم',
  'راسلني واتساب',
  'سأرسل التفاصيل على واتساب',
  'لم يرد',
  'الهاتف مغلق',
  'خارج الخدمة',
  'الرقم غير صحيح',
  'مشغول',
  'أنهى المكالمة',
  'تم تحويله إلى Agent',
  'بانتظار الرد',
  'متابعة لاحقًا',
  'عميل مكرر',
  'ليس عميلاً'
] as const;

// Property Owners preset responses requested by user
export const OWNER_STATUS_OPTIONS = [
  'مهتم بالتأجير',
  'مهتم بالبيع',
  'بيع وتأجير',
  'سيرسل التفاصيل',
  'الوحدة محجوزة',
  'الوحدة مؤجرة',
  'الوحدة مباعة',
  'لا توجد وحدة حاليًا',
  'لا يرغب في التعامل',
  'ليس المالك',
  'الرقم غير صحيح',
  'يحتاج معاينة للوحدة',
  'كلمني لاحقًا',
  'كلمني غدًا',
  'لم يرد',
  'الهاتف مغلق',
  'خارج الخدمة',
  'مشغول',
  'أنهى المكالمة',
  'بانتظار التفاصيل',
  'متابعة لاحقًا'
] as const;

export interface LeadDetails {
  interestType?: string; // نوع الخدمة أو الوحدة المطلوبة
  budget?: string; // الميزانية المتوقعة
  priority?: LeadPriority; // درجة الأهمية: عالي / متوسط / عادي
  companyOrRole?: string; // الشركة أو المسمى الوظيفي
  notes?: string;
}

export interface OwnerDetails {
  propertyType?: string; // نوع العقار (شقة، شاليه، فيلا، مكتب)
  unitLocation?: string; // موقع/منطقة الوحدة
  priceOrRent?: string; // السعر المطلوب أو الإيجار
  propertyLocation?: string; // alias for unitLocation
  desiredPrice?: string; // alias for priceOrRent
  notes?: string;
}

export interface FeedbackItem {
  id: string;
  text: string;
  status: string; // Dynamic status based on lead/owner presets
  date: string;
  authorEmail: string;
  authorName?: string;
  followUpDate?: string;
  audioUrl?: string; // Voice memo
}

export interface TransferRequest {
  id: string;
  requestedByEmail: string;
  requestedByName: string;
  targetEmail: string;
  targetName: string;
  reasonNote: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface OwnerWorkflowSteps {
  ownerAware?: boolean; // 1. توعية المالك بالوحدة المسجلة
  detailsReceived?: boolean; // 2. استلام التفاصيل والصور من المالك بعد التسجيل
  postedInAdsGroup?: boolean; // 3. تنزيل العرض على جروبات الإعلانات (Ads Group)
  postedOnFbMarketplace?: boolean; // 4. الإعلان والنشر على فيسبوك ماركت بليس (Facebook Marketplace)
  ownerResponded?: 'yes' | 'no' | 'pending'; // حالة استجابة وتفاعل المالك
  lastContactedForUnitDate?: string; // تاريخ التواصل بخصوص البيع/التأجير
}

export interface Customer {
  id: string;
  refCode?: string; // Sequential Identifier: CP-001 (Campaign), OW-001 (Owner), LD-001 (Lead)
  customerNumber: string;
  name?: string;
  phone?: string;
  notes?: string;
  category?: CustomerCategory; // 'lead' (عملاء محتملون) or 'owner' (الملاك)
  leadSource?: LeadSource; // 'paid_ad' (إعلان ممول 🔥) | 'organic_marketing' (تسويق محتوى 📣) | 'direct_owner' (مالك) | 'referral'
  campaignName?: string; // اسم الحملة الإعلانية / مصدر التسويق
  marketingAccountEmail?: string; // حساب التسويق الجالب للعميل
  uploadedByEmail?: string; // الإيميل الذي رفع الرقم
  leadDetails?: LeadDetails;
  ownerDetails?: OwnerDetails;
  ownerWorkflow?: OwnerWorkflowSteps; // خطوات وإجراءات تسويق المالك ومتابعة الاستجابة
  assignedToEmail?: string | null;
  assignedToName?: string | null;
  assignedAt?: string;
  protectionRole?: 'assigned' | 'unassigned_pool' | 'protected_owner' | 'supervisor_only';
  accessRights?: string[];
  ownerEmail?: string;
  isProtected?: boolean;
  status: CustomerStatus | string;
  lastOutcomePreset?: string; // Preset response chosen by broker
  feedbackHistory: FeedbackItem[];
  transferRequest?: TransferRequest | null;
  nextFollowUpDate?: string | null; // Format YYYY-MM-DD
  nextFollowUpNote?: string | null;
  createdByEmail?: string;
  createdByName?: string;
  createdByUserCode?: string;
  createdAt: string;
  updatedAt: string;
  isArchived?: boolean;
  archivedAt?: string;
}

export interface GoogleSheetConfig {
  sheetUrl: string;
  sheetId: string;
  lastSyncedAt?: string;
  autoSync: boolean;
}

export interface Activity {
  id: string;
  customerId?: string;
  customerName?: string;
  customerRefCode?: string;
  customerPhone?: string;
  type: 'call' | 'whatsapp' | 'meeting' | 'note' | 'status_change' | 'transfer' | 'workflow' | 'created' | 'audit' | 'system';
  title: string;
  details?: string;
  outcome?: string;
  performedByEmail: string;
  performedByName: string;
  performedByUserCode?: string;
  performedByPhone?: string;
  timestamp: string;
  followUpDate?: string;
}

export interface AppStats {
  totalCustomers: number;
  totalLeads: number;
  totalOwners: number;
  assignedCustomers: number;
  unassignedCustomers: number;
  totalUsers: number;
  approvedUsers: number;
  pendingUsers: number;
  totalFeedbacks: number;
  pendingTransfersCount: number;
  totalActivities?: number;
  totalTasks?: number;
  pendingTasksCount?: number;
}

export interface AppTask {
  id: string;
  title: string;
  description: string;
  assignedToEmail: string;
  assignedToName: string;
  assignedByEmail: string;
  assignedByName: string;
  dueDate: string; // ISO date string or YYYY-MM-DD
  dueTime?: string; // e.g. "05:00 PM"
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  relatedCustomerId?: string;
  relatedCustomerName?: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

export interface AppNotification {
  id: string;
  targetEmail: string; // User email or 'all' or 'admin'
  title: string;
  message: string;
  type: 'task_assigned' | 'appointment' | 'alert' | 'system' | 'security_anomaly';
  isRead: boolean;
  createdAt: string;
  linkToTaskId?: string;
  linkToCustomerId?: string;
  createdByName?: string;
}

export interface AiAgentPermissions {
  allowReadDatabase: boolean;
  allowDetectAnomalies: boolean;
  allowCreateTasks: boolean;
  allowSendNotifications: boolean;
  allowReassignLeads: boolean;
  allowModifyUserRoles: boolean;
  executionMode: 'auto' | 'require_approval';
  restrictScopeToWebAppOnly: boolean;
}

export interface AiAgentPendingAction {
  id: string;
  actionType: 'create_task' | 'reassign_lead' | 'update_role' | 'send_notification' | 'security_flag';
  title: string;
  details: string;
  payload: any;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}


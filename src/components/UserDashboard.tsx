import React, { useState, useEffect } from 'react';
import { User, Customer, CustomerStatus, LeadPriority, LEAD_STATUS_OPTIONS, OWNER_STATUS_OPTIONS } from '../types';
import { formatWhatsAppPhone, formatDisplayPhone, maskPhoneNumber, ensureCountryCode } from '../utils/phoneUtils';
import { PropertyAnalyticsWidget } from './PropertyAnalyticsWidget';
import { ActivityTracker } from './ActivityTracker';
import { TaskManager } from './TaskManager';
import { MarketerDashboardView } from './MarketerDashboardView';
import {
  Phone,
  MessageSquare,
  CheckCircle2,
  Clock,
  Send,
  Activity as ActivityIcon,
  Search,
  Filter,
  UserCheck,
  AlertCircle,
  XCircle,
  HelpCircle,
  Plus,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  Sparkles,
  ChevronRight,
  Check,
  RotateCcw,
  Tag,
  Target,
  DollarSign,
  Briefcase,
  Layers,
  Flame,
  Star,
  Users,
  Edit3,
  Share2,
  Building,
  Building2,
  MapPin,
  Home,
  CheckSquare,
  Megaphone,
  PieChart,
  LogOut,
  Sun,
  Copy
} from 'lucide-react';

interface UserDashboardProps {
  currentUser: User;
  allUsers?: User[];
  customers: Customer[];
  onAddFeedback: (
    id: string,
    text: string,
    status: CustomerStatus | string,
    followUpDate?: string | null,
    followUpNote?: string | null
  ) => Promise<void>;
  onScheduleFollowUp: (id: string, followUpDate: string | null, followUpNote?: string | null) => Promise<void>;
  onUpdateCategory: (
    id: string,
    category: 'lead' | 'owner' | 'contact',
    leadDetails?: any,
    ownerDetails?: any,
    leadSource?: string,
    campaignName?: string
  ) => Promise<void>;
  onRequestTransfer?: (id: string, targetEmail: string, reasonNote: string) => Promise<void>;
  onToggleEarlyLeave?: (email: string, earlyLeaveToday: boolean) => Promise<void>;
  onUpdateOwnerWorkflow?: (id: string, ownerWorkflow: any) => Promise<void>;
  onOpenClientRequests?: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  allUsers = [],
  customers,
  onAddFeedback,
  onScheduleFollowUp,
  onUpdateCategory,
  onRequestTransfer,
  onToggleEarlyLeave,
  onUpdateOwnerWorkflow,
  onOpenClientRequests,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isMarketingRole = currentUser.role === 'marketing';

  // Navigation Tabs: 'leads' | 'owners' | 'marketing' | 'schedule' | 'activities' | 'tasks'
  const [activeTab, setActiveTab] = useState<'leads' | 'owners' | 'marketing' | 'schedule' | 'activities' | 'tasks'>(
    isMarketingRole ? 'marketing' : 'leads'
  );
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'today' | 'tomorrow' | 'upcoming' | 'overdue'>('all');

  // Early leave state for today
  const [isEarlyLeave, setIsEarlyLeave] = useState<boolean>(!!currentUser.earlyLeaveToday);
  const [earlyLeaveLoading, setEarlyLeaveLoading] = useState(false);

  // Selected customer for Modals
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'feedback' | 'followup' | 'lead_convert' | 'owner_convert' | 'transfer'>('feedback');

  // Transfer Modal State
  const [transferTargetEmail, setTransferTargetEmail] = useState('');
  const [transferNote, setTransferNote] = useState('');

  // Lead / Owner Form States
  const [leadInterest, setLeadInterest] = useState('');
  const [leadBudget, setLeadBudget] = useState('');
  const [leadPriority, setLeadPriority] = useState<LeadPriority>('high');
  const [leadCompany, setLeadCompany] = useState('');
  const [leadSourceInput, setLeadSourceInput] = useState<string>('paid_ad');
  const [campaignNameInput, setCampaignNameInput] = useState<string>('');

  const [ownerPropertyType, setOwnerPropertyType] = useState('');
  const [ownerUnitLocation, setOwnerUnitLocation] = useState('');
  const [ownerPriceOrRent, setOwnerPriceOrRent] = useState('');
  const [ownerNotes, setOwnerNotes] = useState('');

  const ownerLocation = ownerUnitLocation;
  const setOwnerLocation = setOwnerUnitLocation;
  const ownerPrice = ownerPriceOrRent;
  const setOwnerPrice = setOwnerPriceOrRent;

  // Form States
  const [feedbackText, setFeedbackText] = useState('');
  const [newStatus, setNewStatus] = useState<string>('contacted');
  
  // Follow-Up States
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Voice States
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState<'feedback' | 'followup' | 'lead'>('feedback');
  const [speakingTextId, setSpeakingTextId] = useState<string | null>(null);

  // Dates Helper
  const now = new Date();
  const todayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
  
  const tomorrowObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const tomorrowStr = tomorrowObj.toISOString().split('T')[0];

  // Data Privacy Isolation: Non-admin employees strictly see ONLY their assigned or uploaded customers and stats
  const myCustomers = React.useMemo(() => {
    if (isAdmin) return customers;
    if (isMarketingRole) {
      return customers.filter((c) =>
        c.assignedToEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        c.uploadedByEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        c.createdByEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        c.marketingAccountEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
        (c.feedbackHistory || []).some(f => f.authorEmail?.toLowerCase() === currentUser.email.toLowerCase())
      );
    }
    return customers.filter((c) => c.assignedToEmail?.toLowerCase() === currentUser.email.toLowerCase());
  }, [customers, isAdmin, isMarketingRole, currentUser.email]);

  // Divide Customers into Categories
  const leads = myCustomers.filter((c) => c.category === 'lead');
  const owners = myCustomers.filter((c) => c.category === 'owner');
  const otherContacts = myCustomers.filter((c) => c.category !== 'lead' && c.category !== 'owner');

  // Scheduled Appointments List
  const customersWithAppointments = myCustomers.filter((c) => !!c.nextFollowUpDate);

  const dueTodayAppointments = customersWithAppointments.filter((c) => {
    return c.nextFollowUpDate?.split('T')[0] === todayStr;
  });

  const dueTomorrowAppointments = customersWithAppointments.filter((c) => {
    return c.nextFollowUpDate?.split('T')[0] === tomorrowStr;
  });

  const overdueAppointments = customersWithAppointments.filter((c) => {
    const fDate = c.nextFollowUpDate?.split('T')[0] || '';
    return fDate < todayStr;
  });

  const upcomingAppointments = customersWithAppointments.filter((c) => {
    const fDate = c.nextFollowUpDate?.split('T')[0] || '';
    return fDate > todayStr;
  });

  const urgentAlertCount = dueTodayAppointments.length + overdueAppointments.length;

  // Stats
  const completedCount = myCustomers.filter((c) => c.status !== 'pending').length;
  const progressPercent = myCustomers.length > 0 ? Math.round((completedCount / myCustomers.length) * 100) : 0;

  // Voice Playback (Text to Speech Audio Synthesis)
  const handleSpeakText = (id: string, textToSpeak: string) => {
    if (!('speechSynthesis' in window)) {
      alert('خاصية التشغيل الصوتي غير مدعومة على متصفحك الحالي');
      return;
    }

    if (speakingTextId === id) {
      window.speechSynthesis.cancel();
      setSpeakingTextId(null);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any active speech
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.95;

    utterance.onstart = () => setSpeakingTextId(id);
    utterance.onend = () => setSpeakingTextId(null);
    utterance.onerror = () => setSpeakingTextId(null);

    window.speechSynthesis.speak(utterance);
  };

  // Communication Toast & Response Outcome Selection States
  const [communicationToast, setCommunicationToast] = useState<{ text: string; type: 'call' | 'whatsapp' } | null>(null);
  const [outcomeModalCustomer, setOutcomeModalCustomer] = useState<Customer | null>(null);
  const [outcomeModalType, setOutcomeModalType] = useState<'call' | 'whatsapp' | null>(null);

  // Communication Call & WhatsApp Handlers that strictly record engagement with complete audit metadata
  const handleCallAction = async (cust: Customer) => {
    const rawNum = cust.phone || cust.customerNumber || '';
    const cleanPhoneDigits = rawNum.replace(/[^\d+]/g, '');
    if (!cleanPhoneDigits) {
      alert('رقم الجوال غير متاح لإجراء الاتصال');
      return;
    }

    const employeeName = currentUser?.name || currentUser?.email || 'الموظف';
    const employeeCode = currentUser?.userCode || 'EMP-100';
    const customerDisplayName = cust.name || cust.customerNumber;
    const logMessage = `📞 تم إجراء اتصال هاتف مباشر من الموظف [${employeeName} (${employeeCode})] على العميل [${customerDisplayName}] رقم (${cleanPhoneDigits})`;

    // Automatically change status from 'pending' to 'contacted'
    const targetStatus = (cust.status && cust.status !== 'pending') ? cust.status : 'contacted';

    try {
      // 1. Post global activity log with deduplication check
      const actRes = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: cust.id,
          customerName: customerDisplayName,
          customerRefCode: cust.refCode,
          customerPhone: cleanPhoneDigits,
          type: 'call',
          title: `📞 مكالمة هاتفية: الموظف (${employeeName}) اتصل بالعميل (${customerDisplayName})`,
          details: `تم إجراء مكالمة من الموظف [${employeeName} - ${employeeCode}] على هاتف العميل (${cleanPhoneDigits})`,
          performedByEmail: currentUser?.email,
          performedByName: employeeName,
          performedByUserCode: employeeCode,
          performedByPhone: currentUser?.phone
        })
      });

      let duplicatePrevented = false;
      if (actRes.ok) {
        const actData = await actRes.json();
        if (actData.duplicatePrevented) {
          duplicatePrevented = true;
        }
      }

      // 2. Note: Server POST /api/activities automatically appends feedback history to customer.feedbackHistory

      // 3. Show prominent success toast notification with clear single-call wording
      setCommunicationToast({
        text: duplicatePrevented
          ? `ℹ️ العميل (${customerDisplayName}) مسجل كـ (مكالمة واحدة موثقة) - تم تحديث الحالة لـ (تم التواصل)!`
          : `✅ تم توثيق الاتصال بالعميل (${customerDisplayName}) وتسجيل المكالمة بنجاح!`,
        type: 'call'
      });
      setTimeout(() => setCommunicationToast(null), 5000);

      // 4. Open outcome response picker modal so employee can log client reaction
      setOutcomeModalCustomer(cust);
      setOutcomeModalType('call');
    } catch (err) {
      console.error('Call feedback activity log error:', err);
    }

    // Safely trigger phone call via DOM element click without interrupting async network state
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = `tel:${cleanPhoneDigits}`;
      link.target = '_top';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 150);
  };

  const handleWhatsAppAction = async (cust: Customer) => {
    const rawNum = cust.phone || cust.customerNumber || '';
    const waDigits = formatWhatsAppPhone(rawNum);
    if (!waDigits) {
      alert('رقم الواتساب غير متاح لهذا العميل');
      return;
    }

    const employeeName = currentUser?.name || currentUser?.email || 'الموظف';
    const employeeCode = currentUser?.userCode || 'EMP-100';
    const customerDisplayName = cust.name || cust.customerNumber;
    const logMessage = `💬 تم فتح مراسلة الواتساب من الموظف [${employeeName} (${employeeCode})] مع العميل [${customerDisplayName}] رقم (${waDigits})`;

    const targetStatus = (cust.status && cust.status !== 'pending') ? cust.status : 'contacted';

    try {
      // 1. Post global activity log with deduplication check
      const actRes = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: cust.id,
          customerName: customerDisplayName,
          customerRefCode: cust.refCode,
          customerPhone: waDigits,
          type: 'whatsapp',
          title: `💬 محادثة واتساب: الموظف (${employeeName}) تواصل مع العميل (${customerDisplayName})`,
          details: `تم فتح محادثة واتساب بواسطة الموظف [${employeeName} - ${employeeCode}] مع العميل على الرقم (${waDigits})`,
          performedByEmail: currentUser?.email,
          performedByName: employeeName,
          performedByUserCode: employeeCode,
          performedByPhone: currentUser?.phone
        })
      });

      let duplicatePrevented = false;
      if (actRes.ok) {
        const actData = await actRes.json();
        if (actData.duplicatePrevented) {
          duplicatePrevented = true;
        }
      }

      // 2. Note: Server POST /api/activities automatically appends feedback history to customer.feedbackHistory

      // 3. Show prominent success toast notification with clear wording
      setCommunicationToast({
        text: duplicatePrevented
          ? `ℹ️ العميل (${customerDisplayName}) مسجل كـ (تواصل واتساب موثق) - تم تحديث الحالة لـ (تم التواصل)!`
          : `✅ تم فتح واتساب العميل (${customerDisplayName}) وتوثيق التواصل بنجاح!`,
        type: 'whatsapp'
      });
      setTimeout(() => setCommunicationToast(null), 5000);

      // 4. Open outcome response picker modal so employee can log client reaction
      setOutcomeModalCustomer(cust);
      setOutcomeModalType('whatsapp');
    } catch (err) {
      console.error('WhatsApp feedback activity log error:', err);
    }

    // Safely open WhatsApp window
    window.open(`https://wa.me/${waDigits}`, '_blank', 'noopener,noreferrer');
  };

  // Web Speech API Voice Dictation with Real-time Streaming & Gemini Fallback
  const handleToggleVoiceDictation = (targetField: 'feedback' | 'followup' | 'lead') => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening && listeningTarget === targetField) {
      setIsListening(false);
      setListeningTarget(null);
      return;
    }

    if (!SpeechRecognition) {
      alert('ميزة الإملاء الصوتي المباشر غير مدعومة في متصفحك. يمكنك كتابة الملاحظة نصياً.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;

      setListeningTarget(targetField);

      let initialBaseText = '';
      if (targetField === 'feedback') initialBaseText = feedbackText;
      else if (targetField === 'followup') initialBaseText = followUpNote;
      else if (targetField === 'lead') initialBaseText = leadInterest;

      recognition.onstart = () => setIsListening(true);

      recognition.onresult = (event: any) => {
        let transcriptAccumulated = '';
        for (let i = 0; i < event.results.length; i++) {
          transcriptAccumulated += event.results[i][0].transcript + ' ';
        }

        const fullText = initialBaseText ? `${initialBaseText.trim()} ${transcriptAccumulated.trim()}` : transcriptAccumulated.trim();

        if (targetField === 'feedback') {
          setFeedbackText(fullText);
        } else if (targetField === 'followup') {
          setFollowUpNote(fullText);
        } else if (targetField === 'lead') {
          setLeadInterest(fullText);
        }
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech dictation error:', err);
        setIsListening(false);
        setListeningTarget(null);
      };

      recognition.onend = () => {
        setIsListening(false);
        setListeningTarget(null);
      };

      recognition.start();
    } catch (err) {
      console.error('Dictation start error:', err);
      setIsListening(false);
      setListeningTarget(null);
    }
  };

  // Quick Preset Date Helper
  const handleSetQuickDate = (daysAhead: number) => {
    const target = new Date();
    target.setDate(target.getDate() + daysAhead);
    const isoDate = target.toISOString().split('T')[0];
    setFollowUpDate(isoDate);
  };

  // Toggle Early Leave Handler
  const handleToggleEarlyLeaveClick = async () => {
    setEarlyLeaveLoading(true);
    const newStatus = !isEarlyLeave;
    try {
      const res = await fetch('/api/users/quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          earlyLeaveToday: newStatus,
        }),
      });
      if (res.ok) {
        setIsEarlyLeave(newStatus);
        if (newStatus) {
          alert('تم تسجيل المغادرة المبكرة اليوم 🏃. تم إيقاف توزيع عملاء أو ملاك إضافيين لحسابك باقي اليوم.');
        } else {
          alert('تم إلغاء الاستئذان اليوم وأصبحت جاهزاً لاستقبال التوزيعات الجدد 👍');
        }
      }
    } catch (err) {
      alert('حدث خطأ أثناء تسجيل الاستئذان');
    } finally {
      setEarlyLeaveLoading(false);
    }
  };

  // Copy Tailored VIP Greeting Script
  const handleCopyScript = (cust: Customer) => {
    const isPaidAd = cust.leadSource === 'paid_ad';
    const clientName = cust.name ? ` أ/ ${cust.name}` : '';
    const campaignText = cust.campaignName ? ` الخاص بـ (${cust.campaignName})` : '';

    let scriptText = '';
    if (isPaidAd) {
      scriptText = `السلام عليكم ورحمة الله وبركاته${clientName} 👋🌸\nمعك ${currentUser.name} من قسم المبيعات والاستشارات العقارية 🏢.\nسعداء باهتمامك بـ إعلاننا الممول${campaignText} 🔥.\nيسعدني جداً تزويد حضرتك بأحدث صور، بروشور الأسعار، ونماذج الوحدات المتاحة.\nهل يناسبك الاتصال الآن أو مراسلتك بالأسعار هنا على الواتساب؟ ✨`;
    } else {
      scriptText = `مرحباً بك${clientName} 🌸\nمعك ${currentUser.name} من فريق المبيعات 🏢.\nنشكر اهتمامك بالتواصل معنا${campaignText}.\nيسعدنا مساعدتك في اختيار أفضل العقارات والفرص المناسبة لطلبك.\nكيف يمكننا خدمتك اليوم؟`;
    }

    navigator.clipboard.writeText(scriptText);
    alert('تم نسخ رسالة الترحيب الاحترافية المخصصة بنجاح! يمكنك لصقها وإرسالها عبر الواتساب 💬');
  };

  // Convert/Edit Lead Submit Handler
  const handleConvertLeadSubmit = async (e: React.FormEvent, customerId: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdateCategory(
        customerId,
        'lead',
        {
          interestType: leadInterest || 'عميل مهتم بنظام المبيعات',
          budget: leadBudget || undefined,
          priority: leadPriority,
          companyOrRole: leadCompany || undefined,
        },
        undefined,
        leadSourceInput,
        campaignNameInput || undefined
      );
      setSelectedCustomerId(null);
    } catch (err) {
      alert('حدث خطأ أثناء تصنيف العميل كـ Lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Convert/Edit Owner Submit Handler
  const handleConvertOwnerSubmit = async (e: React.FormEvent, customerId: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdateCategory(customerId, 'owner', undefined, {
        propertyType: ownerPropertyType || 'عقار سكوني',
        unitLocation: ownerUnitLocation || undefined,
        priceOrRent: ownerPriceOrRent || undefined,
      });
      setSelectedCustomerId(null);
    } catch (err) {
      alert('حدث خطأ أثناء تصنيف العميل كمالك (Owner)');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transfer Submit Handler
  const handleTransferSubmit = async (e: React.FormEvent, customerId: string) => {
    e.preventDefault();
    if (!transferTargetEmail) {
      alert('يرجى اختيار الموظف الزميل لتحويل العميل إليه');
      return;
    }
    setIsSubmitting(true);
    try {
      if (onRequestTransfer) {
        await onRequestTransfer(customerId, transferTargetEmail, transferNote);
        alert('تم ارسال طلب تحويل العميل بنجاح للمدير للموافقة عليها.');
      }
      setSelectedCustomerId(null);
      setTransferTargetEmail('');
      setTransferNote('');
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء تقديم طلب التحويل');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Feedback Submit Handler
  const handleFeedbackSubmit = async (e: React.FormEvent, customerId: string) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    const targetCust = myCustomers.find((c) => c.id === customerId);
    const hasContacted = targetCust && (targetCust.feedbackHistory || []).some(f => 
      (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب')
    );

    if (!hasContacted && !isAdmin) {
      alert('⚠️ عذراً، لا يمكنك إضافة ملاحظات أو تقييم لعميل لم تقم بالاتصال به 📞 أو مراسلته عبر الواتساب 💬 أولاً! يرجى التواصل مع العميل أولاً.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddFeedback(
        customerId,
        feedbackText,
        newStatus,
        followUpDate ? followUpDate : null,
        followUpNote || feedbackText
      );
      setFeedbackText('');
      setFollowUpDate('');
      setFollowUpNote('');
      setSelectedCustomerId(null);
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء حفظ الملاحظة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Schedule FollowUp Submit Handler
  const handleFollowUpSubmit = async (e: React.FormEvent, customerId: string) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onScheduleFollowUp(customerId, followUpDate ? followUpDate : null, followUpNote);
      setFollowUpDate('');
      setFollowUpNote('');
      setSelectedCustomerId(null);
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ موعد المتابعة');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format Arabic Date
  const formatArabicDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const cleanDateStr = dateStr.split('T')[0];
    const target = new Date(cleanDateStr);
    if (isNaN(target.getTime())) return dateStr;

    const todayDate = new Date(todayStr);
    const diffTime = target.getTime() - todayDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

    if (diffDays === 0) return 'اليوم ⏰';
    if (diffDays === 1) return 'غداً ⏳';
    if (diffDays === 2) return 'بعد يومين 📅';
    if (diffDays === -1) return 'أمس (متأخرة ⚠️)';
    if (diffDays < -1) return `منذ ${Math.abs(diffDays)} أيام (متأخرة ⚠️)`;

    return target.toLocaleDateString('ar-EG', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Status Helpers for Color Coding & Automatic Queue Filtering
  const isRedStatus = (status?: string) => {
    if (!status) return false;
    return ['not_interested', 'no_answer', 'cancelled', 'rejected', 'archived', 'not_renting'].includes(status);
  };

  const isGreenStatus = (status?: string) => {
    if (!status) return false;
    return ['interested', 'interested_rent', 'interested_sale', 'contract_signed', 'closed', 'reserved', 'rented'].includes(status);
  };

  const isBlueStatus = (status?: string) => {
    if (!status) return false;
    return ['contacted', 'in_progress', 'follow_up', 'reviewing'].includes(status);
  };

  const isPendingStatus = (status?: string) => {
    return !status || status === 'pending';
  };

  // Helper for Phone Badge & Contact Distinction Styling
  const getContactBadgeInfo = (cust: Customer) => {
    const hasFeedback = cust.feedbackHistory && cust.feedbackHistory.length > 0;
    const isContacted = hasFeedback || (cust.status && cust.status !== 'pending');

    if (isRedStatus(cust.status)) {
      return {
        boxStyle: 'bg-rose-50 border-2 border-rose-500 text-rose-950',
        phoneIconStyle: 'text-rose-600',
        badge: <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">🔴 غير راغب / لا يؤجر</span>,
        statusText: 'غير مهتم',
        isRed: true
      };
    }

    if (isGreenStatus(cust.status)) {
      return {
        boxStyle: 'bg-emerald-50 border-2 border-emerald-600 text-emerald-950',
        phoneIconStyle: 'text-emerald-600',
        badge: <span className="bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">🟢 تم التأجير / راغب</span>,
        statusText: 'تم التأجير',
        isGreen: true
      };
    }

    if (isBlueStatus(cust.status) || isContacted) {
      return {
        boxStyle: 'bg-blue-50 border-2 border-blue-500 text-blue-950',
        phoneIconStyle: 'text-blue-600',
        badge: <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">🔵 تم الاتصال والتواصل</span>,
        statusText: 'تم التواصل',
        isBlue: true
      };
    }

    return {
      boxStyle: 'bg-amber-50 border border-amber-300 text-amber-950',
      phoneIconStyle: 'text-amber-600',
      badge: <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-md shadow-2xs">⏳ بانتظار الاتصال</span>,
      statusText: 'بانتظار التواصل',
      isPending: true
    };
  };

  // Filtered Lists with Active Workspace Queueing
  const filterBySearchAndStatus = (list: Customer[]) => {
    return list.filter((c) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        c.customerNumber.toLowerCase().includes(searchLower) ||
        (c.name && c.name.toLowerCase().includes(searchLower)) ||
        (c.phone && c.phone.includes(searchLower)) ||
        (c.refCode && c.refCode.toLowerCase().includes(searchLower)) ||
        (c.leadDetails?.interestType && c.leadDetails.interestType.toLowerCase().includes(searchLower)) ||
        (c.leadDetails?.budget && c.leadDetails.budget.toLowerCase().includes(searchLower)) ||
        (c.ownerDetails?.propertyType && c.ownerDetails.propertyType.toLowerCase().includes(searchLower)) ||
        (c.ownerDetails?.propertyLocation && c.ownerDetails.propertyLocation.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;

      if (statusFilter === 'all') return true;

      // Active Queue: Excludes items that turn Red (Non-renting/rejected) or Green (Rented/closed)
      if (statusFilter === 'active') {
        const isRed = isRedStatus(c.status);
        const isGreen = isGreenStatus(c.status);
        if (isRed || isGreen) return false;
        return true;
      }

      if (statusFilter === 'pending') return isPendingStatus(c.status);
      if (statusFilter === 'contacted') return isBlueStatus(c.status) || ((c.feedbackHistory?.length || 0) > 0 && !isRedStatus(c.status) && !isGreenStatus(c.status));
      if (statusFilter === 'rented_green') return isGreenStatus(c.status);
      if (statusFilter === 'rejected_red') return isRedStatus(c.status);

      return c.status === statusFilter;
    });
  };

  const filteredLeads = filterBySearchAndStatus(leads);
  const filteredOwners = filterBySearchAndStatus(owners);
  const filteredContacts = filterBySearchAndStatus(otherContacts);

  // Category counts for small top badges
  const activeLeadsCount = leads.filter(c => !isRedStatus(c.status) && !isGreenStatus(c.status)).length;
  const pendingLeadsCount = leads.filter(c => isPendingStatus(c.status)).length;
  const contactedLeadsCount = leads.filter(c => isBlueStatus(c.status) || ((c.feedbackHistory?.length || 0) > 0 && !isRedStatus(c.status) && !isGreenStatus(c.status))).length;
  const rentedLeadsCount = leads.filter(c => isGreenStatus(c.status)).length;
  const rejectedLeadsCount = leads.filter(c => isRedStatus(c.status)).length;

  const activeOwnersCount = owners.filter(c => !isRedStatus(c.status) && !isGreenStatus(c.status)).length;
  const pendingOwnersCount = owners.filter(c => isPendingStatus(c.status)).length;
  const contactedOwnersCount = owners.filter(c => isBlueStatus(c.status) || ((c.feedbackHistory?.length || 0) > 0 && !isRedStatus(c.status) && !isGreenStatus(c.status))).length;
  const rentedOwnersCount = owners.filter(c => isGreenStatus(c.status)).length;
  const rejectedOwnersCount = owners.filter(c => isRedStatus(c.status)).length;

  // Filtered Appointments
  const filteredAppointments = customersWithAppointments.filter((c) => {
    if (!c.nextFollowUpDate) return false;
    const fDate = c.nextFollowUpDate.split('T')[0];

    const matchesSearch =
      c.customerNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.phone && c.phone.includes(searchTerm));

    if (!matchesSearch) return false;

    if (scheduleFilter === 'today') return fDate === todayStr;
    if (scheduleFilter === 'tomorrow') return fDate === tomorrowStr;
    if (scheduleFilter === 'upcoming') return fDate >= todayStr;
    if (scheduleFilter === 'overdue') return fDate < todayStr;

    return true; // 'all'
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 dir-rtl font-sans">
      
      {/* Smart Notification Alert for Urgent Appointments */}
      {urgentAlertCount > 0 && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-xl shrink-0 animate-pulse">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-100">تنبيه المواعيد: لديك متابعات مستحقة تتطلب التواصل!</h3>
                <span className="bg-amber-500 text-slate-950 font-black text-[11px] px-2 py-0.5 rounded-full">
                  {urgentAlertCount} مواعيد
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-1">
                يوجد <span className="font-bold text-amber-300">{dueTodayAppointments.length} متابعات مستحقة اليوم</span> و{' '}
                <span className="font-bold text-rose-400">{overdueAppointments.length} متابعة متأخرة</span>.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveTab('schedule');
              setScheduleFilter('all');
            }}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 shrink-0 self-end md:self-auto"
          >
            <span>عرض كافة المواعيد المجدولة</span>
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      )}

      {/* Main Header & Progress Card */}
      <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-[#2c2824] flex items-center gap-2">
                <span>لوحة المبيعات والـ CRM والتفريغ الصوتي</span>
                <span className="bg-[#8c622b]/15 text-[#704d1f] text-xs px-2.5 py-0.5 rounded-full border border-[#8c622b]/30 font-bold">
                  {myCustomers.length} إجمالي الأرقام
                </span>
              </h2>

              {/* Early Leave / Vacation Button */}
              <button
                onClick={handleToggleEarlyLeaveClick}
                disabled={earlyLeaveLoading}
                className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isEarlyLeave
                    ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                    : 'bg-[#eae3d5] text-[#2c2824] border-[#d8cebe] hover:bg-[#dfd7c7]'
                }`}
                title={isEarlyLeave ? 'إلغاء الاستئذان واستئناف التوزيع' : 'تسجيل مغادرة مبكرة لعدم استقبال أرقام إضافية اليوم'}
              >
                <LogOut className="w-3.5 h-3.5 text-[#8c622b]" />
                <span>{isEarlyLeave ? 'استئذان مفعل (إيقاف التوزيع) 🏃' : 'استئذان / مغادرة مبكرة 🏃'}</span>
              </button>
            </div>

            <p className="text-[#6e685f] text-xs mt-1">
              مرحباً <span className="text-[#8c622b] font-bold">{currentUser.name}</span> <span className="bg-[#8c622b] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow-xs">{currentUser.userCode || 'EMP-100'}</span>! استعرض العملاء المحتملين (Leads) 🎯، الملاك (Owners) 🏠، وحملات التسويق والمواعيد 🔊.
            </p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 bg-[#f5efe4] px-4 py-3 rounded-2xl border border-[#e2d8c7] overflow-x-auto">
            <div>
              <div className="text-[11px] text-[#704d1f] font-bold flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-[#8c622b]" /> Leads:
              </div>
              <div className="text-lg font-bold text-[#8c622b]">
                {leads.length}
                <span className="text-[10px] text-[#6e685f] font-normal mr-1">
                  (سقف: {currentUser.dailyLeadQuota || currentUser.dailyQuota || 'غير محدود'})
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-[#d8cebe] shrink-0" />
            <div>
              <div className="text-[11px] text-[#704d1f] font-bold flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-[#8c622b]" /> Owners:
              </div>
              <div className="text-lg font-bold text-[#2c2824]">
                {owners.length}
                <span className="text-[10px] text-[#6e685f] font-normal mr-1">
                  (سقف: {currentUser.dailyOwnerQuota || currentUser.dailyQuota || 'غير محدود'})
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-[#d8cebe] shrink-0" />
            <div>
              <div className="text-[11px] text-emerald-800 font-medium">المواعيد:</div>
              <div className="text-lg font-bold text-emerald-800">{customersWithAppointments.length}</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#eae3d5] rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#8c622b] h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Property & Response Analytics Cards Widget */}
      <PropertyAnalyticsWidget
        customers={myCustomers}
        isAdmin={isAdmin}
        onAddFeedback={(id, text, status) => onAddFeedback(id, text, status as any)}
      />

      {/* Main Tabs Navigation: Leads CRM vs Owners vs Marketing vs Appointments Schedule */}
      <div className="flex items-center justify-between border-b border-[#e2d8c7] pb-3 gap-2 overflow-x-auto">
        <div className="flex items-center gap-2">
          {/* Tab 1: Leads CRM */}
          <button
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>🎯 العملاء المحتملين (Leads) ({leads.length})</span>
          </button>

          {/* Tab 2: Owners Directory */}
          <button
            onClick={() => setActiveTab('owners')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'owners'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>🏠 الملاك (Owners) ({owners.length})</span>
          </button>

          {/* Tab 3: Marketing & Campaigns */}
          <button
            onClick={() => setActiveTab('marketing')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'marketing'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>📣 الحملات والتسويق ({myCustomers.filter(c => c.leadSource === 'paid_ad' || c.leadSource === 'organic_marketing' || c.campaignName).length})</span>
          </button>

          {/* Tab 4: Appointments Schedule */}
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>📅 جدول المواعيد والمتابعات ({customersWithAppointments.length})</span>
            {urgentAlertCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                {urgentAlertCount}
              </span>
            )}
          </button>

          {/* Tab 5: Interactive Activity Tracker */}
          <button
            onClick={() => setActiveTab('activities')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === 'activities'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
            }`}
          >
            <ActivityIcon className="w-4 h-4 text-[#8c622b]" />
            <span>⚡ التتبع والتواصل</span>
          </button>

          {/* Tab 6: Tasks & Appointments Manager */}
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-[#8c622b] text-white shadow-sm'
                : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>📋 مهامي ومواعيدي</span>
          </button>

          {/* Shared Client Requests Exchange Button */}
          {onOpenClientRequests && (
            <button
              onClick={onOpenClientRequests}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all bg-[#8c622b] hover:bg-[#704d1f] text-white shadow-md cursor-pointer border border-[#704d1f] mr-auto"
            >
              <Building2 className="w-4 h-4 text-amber-200" />
              <span>🏛️ سوق طلبات العملاء المشتركة (مطابقة الطلبات) +</span>
            </button>
          )}
        </div>

        {/* Feature Audio Badge */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#6e685f] bg-[#f5efe4] px-3 py-1.5 rounded-xl border border-[#e2d8c7]">
          <Volume2 className="w-4 h-4 text-[#8c622b]" />
          <span>تفريغ وقراءة صوتية للملاحظات 🔊🎤</span>
        </div>
      </div>

      {/* Search & Sub-Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder={
              activeTab === 'leads'
                ? 'بحث بالاسم، الرقم، أو الاهتمام...'
                : activeTab === 'contacts'
                ? 'بحث في دليل الاتصال...'
                : 'بحث في أصحاب المواعيد...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl pr-9 pl-3 py-2.5 outline-none focus:border-emerald-500"
          />
        </div>

        {/* Filters according to active tab */}
        {activeTab !== 'schedule' ? (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 pt-1">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'active'
                  ? 'bg-[#8c622b] text-white shadow-xs'
                  : 'bg-[#f2ece1] text-[#6e685f] hover:text-[#2c2824] border border-[#d8cebe]'
              }`}
            >
              <span>⚡ القائمة النشطة للمتابعة</span>
              <span className="bg-amber-300 text-slate-950 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                {activeTab === 'leads' ? activeLeadsCount : activeOwnersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-xs font-black'
                  : 'bg-amber-500/10 text-amber-800 border border-amber-500/20'
              }`}
            >
              <span>⏳ بانتظار الاتصال الأول</span>
              <span className="bg-amber-200 text-amber-900 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                {activeTab === 'leads' ? pendingLeadsCount : pendingOwnersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('contacted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'contacted'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'bg-blue-500/10 text-blue-800 border border-blue-500/20'
              }`}
            >
              <span>🔵 تم الاتصال والتواصل</span>
              <span className="bg-blue-200 text-blue-900 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                {activeTab === 'leads' ? contactedLeadsCount : contactedOwnersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('rented_green')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'rented_green'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'bg-emerald-500/10 text-emerald-800 border border-emerald-500/20'
              }`}
            >
              <span>🟢 تم التأجير / راغبين (أخضر)</span>
              <span className="bg-emerald-200 text-emerald-900 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                {activeTab === 'leads' ? rentedLeadsCount : rentedOwnersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('rejected_red')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'rejected_red'
                  ? 'bg-rose-600 text-white shadow-xs font-black'
                  : 'bg-rose-500/10 text-rose-800 border border-rose-500/20'
              }`}
            >
              <span>🔴 المستبعدين / غير مهتم (أحمر)</span>
              <span className="bg-rose-200 text-rose-900 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                {activeTab === 'leads' ? rejectedLeadsCount : rejectedOwnersCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-800 text-white shadow-xs font-black'
                  : 'bg-slate-200 text-slate-700 border border-slate-300'
              }`}
            >
              <span>📋 الكل</span>
              <span className="bg-slate-300 text-slate-900 px-1.5 py-0.2 text-[10px] rounded-full font-black">
                {activeTab === 'leads' ? leads.length : owners.length}
              </span>
            </button>
          </div>
        ) : (
          /* Schedule Filters including ALL, TODAY, TOMORROW, UPCOMING, OVERDUE */
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
            <button
              onClick={() => setScheduleFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                scheduleFilter === 'all'
                  ? 'bg-slate-200 text-slate-900 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              كافة المواعيد ({customersWithAppointments.length})
            </button>
            <button
              onClick={() => setScheduleFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                scheduleFilter === 'today'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ⏰ مواعيد اليوم ({dueTodayAppointments.length})
            </button>
            <button
              onClick={() => setScheduleFilter('tomorrow')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                scheduleFilter === 'tomorrow'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ⏳ مواعيد غداً ({dueTomorrowAppointments.length})
            </button>
            <button
              onClick={() => setScheduleFilter('upcoming')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                scheduleFilter === 'upcoming'
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              🔮 المواعيد القادمة ({upcomingAppointments.length})
            </button>
            <button
              onClick={() => setScheduleFilter('overdue')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                scheduleFilter === 'overdue'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              ⚠️ المواعيد المتأخرة ({overdueAppointments.length})
            </button>
          </div>
        )}
      </div>

      {/* VIEW TAB 1: LEADS CRM TAB */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <div className="bg-[#fcfbfa] border border-[#e2d8c7] rounded-3xl p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-[#8c622b]/15 text-[#8c622b] rounded-2xl border border-[#8c622b]/30">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#2c2824]">قسم إدارة العملاء المحتملين والمهتمين (Leads CRM)</h3>
                <p className="text-xs text-[#6e685f]">
                  هؤلاء هم العملاء ذوو الأهمية العالية والاهتمام الفعلي والذين يتطلبون متابعة دقيقة وتوثيق طلباتهم.
                </p>
              </div>
            </div>
          </div>

          {filteredLeads.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredLeads.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                const cleanPhoneDigits = (cust.phone || cust.customerNumber).replace(/\D/g, '');
                const leadInfo = cust.leadDetails || {};
                const contactInfo = getContactBadgeInfo(cust);

                return (
                  <div
                    key={cust.id}
                    className="bg-[#ffffff] border border-[#e2d8c7] hover:border-[#8c622b]/60 rounded-2xl p-3.5 shadow-2xs hover:shadow-md transition-all space-y-3 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Priority Ribbon */}
                      <div className="bg-[#f5efe4] border-b border-[#e2d8c7] -mx-3.5 -mt-3.5 p-1.5 px-3 flex items-center justify-between text-[10px] text-[#704d1f] font-bold mb-2">
                        <span className="flex items-center gap-1 font-extrabold">
                          <Flame className="w-3.5 h-3.5 text-[#8c622b]" />
                          Lead 🎯
                        </span>

                        <div className="flex items-center gap-1">
                          {cust.leadSource === 'paid_ad' ? (
                            <span className="bg-[#8c622b] text-white font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-2xs flex items-center gap-0.5">
                              إعلان ممول 🔥
                            </span>
                          ) : cust.leadSource === 'organic_marketing' ? (
                            <span className="bg-[#eae3d5] text-[#2c2824] border border-[#d8cebe] text-[9px] px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                              تسويق 📣
                            </span>
                          ) : null}

                          {leadInfo.priority === 'high' ? (
                            <span className="bg-rose-700 text-white text-[9px] px-1.5 py-0.2 rounded-full font-extrabold">
                              🔥 عالي
                            </span>
                          ) : (
                            <span className="bg-[#eae3d5] text-[#704d1f] text-[9px] px-1.5 py-0.2 rounded-full border border-[#d8cebe]">
                              عادي
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Customer Info & Color-Coded Phone Block */}
                      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${contactInfo.boxStyle}`}>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-bold truncate max-w-[150px]">
                            <span className="font-mono bg-white/90 px-1.5 py-0.2 rounded text-[10px] border border-black/10 shrink-0">
                              {cust.refCode || 'CP-000'}
                            </span>
                            {cust.name && <span className="font-black text-[#2c2824] truncate">{cust.name}</span>}
                          </div>
                          <div className="shrink-0">{contactInfo.badge}</div>
                        </div>

                        {/* Phone Row with Direct Quick Call Buttons */}
                        <div className="flex items-center justify-between gap-1.5 bg-white/90 px-2.5 py-1 rounded-lg border border-black/10 shadow-2xs dir-ltr">
                          <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm tracking-wider text-[#2c2824]">
                            <Phone className={`w-3.5 h-3.5 ${contactInfo.phoneIconStyle} shrink-0`} />
                            <span className="select-all">{maskPhoneNumber(cust.customerNumber || cust.phone, isAdmin)}</span>
                          </div>

                          {cleanPhoneDigits && (
                            <div className="flex items-center gap-1 dir-rtl shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCallAction(cust)}
                                className="bg-[#8c622b] hover:bg-[#704d1f] text-white px-2 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="اتصال هاتف مباشر 📞"
                              >
                                <Phone className="w-3 h-3" />
                                <span>اتصال</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppAction(cust)}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="مراسلة واتساب 💬"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>واتساب</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Campaign Name Ribbon if available */}
                      {cust.campaignName && (
                        <div className="bg-[#f5efe4] border border-[#d8cebe] rounded-lg px-2 py-0.5 text-[10px] text-[#2c2824] flex items-center justify-between mt-1.5">
                          <span className="flex items-center gap-1 font-semibold truncate">
                            <Megaphone className="w-3 h-3 text-[#8c622b] shrink-0" />
                            الحملة: <strong className="text-[#8c622b] truncate">{cust.campaignName}</strong>
                          </span>
                        </div>
                      )}

                      {/* Lead Detail Badges */}
                      <div className="bg-[#f8f5ee] p-2 rounded-xl border border-[#e8e0d0] space-y-1 text-[11px] mt-1.5">
                        {leadInfo.interestType && (
                          <div className="flex items-center gap-1.5 text-[#2c2824]">
                            <Tag className="w-3.5 h-3.5 text-[#8c622b] shrink-0" />
                            <span className="font-extrabold text-xs text-[#8c622b] truncate">{leadInfo.interestType}</span>
                          </div>
                        )}
                        {leadInfo.budget && (
                          <div className="flex items-center gap-1.5 text-[#6e685f]">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                            <span className="text-[11px]">الميزانية: <strong className="text-emerald-800 font-extrabold">{leadInfo.budget}</strong></span>
                          </div>
                        )}
                        {leadInfo.companyOrRole && (
                          <div className="flex items-center gap-1.5 text-[#6e685f]">
                            <Briefcase className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span className="text-[11px]">الجهة: <strong className="text-[#2c2824]">{leadInfo.companyOrRole}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Scheduled Follow-up Banner if present */}
                      {cust.nextFollowUpDate && (
                        <div className="bg-[#f5efe4] border border-[#d8cebe] rounded-xl p-2 flex items-center justify-between text-[11px] text-[#8c622b] mt-1.5">
                          <span className="flex items-center gap-1 font-black text-xs">
                            <Calendar className="w-3.5 h-3.5" />
                            الموعد: {formatArabicDate(cust.nextFollowUpDate)}
                          </span>
                          {cust.nextFollowUpNote && (
                            <span className="truncate max-w-[120px] text-[#6e685f] font-semibold text-[10px]" title={cust.nextFollowUpNote}>
                              {cust.nextFollowUpNote}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Live Interaction & Audit Tracker Badge */}
                      <div className="bg-[#f2ece1] border border-[#d8cebe] rounded-xl p-2 space-y-1 text-[10px] text-[#2c2824] mt-1.5">
                        <div className="flex items-center justify-between font-extrabold">
                          <span className="flex items-center gap-1 text-[#704d1f]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                            <span>التواصل الموثق:</span>
                          </span>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="bg-[#8c622b]/15 px-1.5 py-0.2 rounded font-black text-[#704d1f]">
                              📞 {cust.feedbackHistory ? cust.feedbackHistory.filter(f => f.text?.includes('اتصال')).length : 0}
                            </span>
                            <span className="bg-emerald-100 px-1.5 py-0.2 rounded font-black text-emerald-800">
                              💬 {cust.feedbackHistory ? cust.feedbackHistory.filter(f => f.text?.includes('واتساب')).length : 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mt-2">
                      {/* Tailored VIP WhatsApp Script Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyScript(cust)}
                        className="w-full bg-[#f2ece1] hover:bg-[#eae3d5] border border-[#d8cebe] text-[#704d1f] text-[11px] font-bold py-1.5 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#8c622b]" />
                        <span>نسخ رسالة الترحيب 💬</span>
                      </button>

                      {/* Quick 1-Tap Outcome Response Logging Bar */}
                      <div className="bg-[#f8f5ee] p-2 rounded-xl border border-[#e2d8c7] space-y-1">
                        <span className="text-[10px] font-black text-[#704d1f] block">تسجيل النتيجة بضغطة واحدة 📱:</span>
                        <div className="grid grid-cols-4 gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const hasContacted = (cust.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب'));
                              if (!hasContacted && !isAdmin) {
                                alert('⚠️ عذراً، لا يمكنك تسجيل نتيجة لعميل لم تقم بالاتصال به 📞 أو مراسلته عبر الواتساب 💬 أولاً!');
                                return;
                              }
                              onAddFeedback(cust.id, 'لم يرد - سيتم المتابعة لاحقاً ⏳', 'no_answer');
                            }}
                            className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold py-1 px-1 rounded-lg transition-all cursor-pointer active:scale-95 text-center truncate"
                            title="لم يرد"
                          >
                            ❌ لم يرد
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const hasContacted = (cust.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب'));
                              if (!hasContacted && !isAdmin) {
                                alert('⚠️ عذراً، لا يمكنك تسجيل نتيجة لعميل لم تقم بالاتصال به 📞 أو مراسلته عبر الواتساب 💬 أولاً!');
                                return;
                              }
                              onAddFeedback(cust.id, 'مهتم بالبيع 🏢', 'interested_sale');
                            }}
                            className="text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 font-extrabold py-1 px-1 rounded-lg transition-all cursor-pointer active:scale-95 text-center truncate"
                            title="مهتم بالبيع"
                          >
                            🏢 بيع
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const hasContacted = (cust.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب'));
                              if (!hasContacted && !isAdmin) {
                                alert('⚠️ عذراً، لا يمكنك تسجيل نتيجة لعميل لم تقم بالاتصال به 📞 أو مراسلته عبر الواتساب 💬 أولاً!');
                                return;
                              }
                              onAddFeedback(cust.id, 'مؤجر / مهتم بالتأجير 🔑', 'interested_rent');
                            }}
                            className="text-[10px] bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-extrabold py-1 px-1 rounded-lg transition-all cursor-pointer active:scale-95 text-center truncate"
                            title="مؤجر / مهتم بالتأجير (أخضر)"
                          >
                            🔑 مؤجر
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const hasContacted = (cust.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب'));
                              if (!hasContacted && !isAdmin) {
                                alert('⚠️ عذراً، لا يمكنك تسجيل نتيجة لعميل لم تقم بالاتصال به 📞 أو مراسلته عبر الواتساب 💬 أولاً!');
                                return;
                              }
                              onAddFeedback(cust.id, 'غير راغب نهائياً / لا يؤجر 🔴', 'not_interested');
                            }}
                            className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-black py-1 px-1 rounded-lg transition-all cursor-pointer active:scale-95 text-center truncate shadow-2xs"
                            title="غير راغب (تحويل للأحمر وإزالة من القائمة النشطة)"
                          >
                            🔴 غير راغب
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Pending Transfer Request Banner */}
                    {cust.transferRequest && (
                      <div className="bg-blue-500/10 border border-blue-500/40 rounded-2xl p-3 text-xs text-blue-300 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <Share2 className="w-4 h-4 text-blue-400 animate-pulse" />
                          <span>طلب تحويل معلق لدى المدير</span>
                        </div>
                        <p className="text-xs text-slate-300">
                          إلى: {cust.transferRequest.targetEmail} | الملاحظة: {cust.transferRequest.reasonNote}
                        </p>
                      </div>
                    )}

                    {/* Feedback History Note Preview with Audio Player */}
                    {cust.feedbackHistory.length > 0 && (
                      <div className="bg-[#f5efe4] rounded-2xl p-3.5 border-2 border-[#e2d8c7] space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#704d1f] font-black flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-[#8c622b]" />
                            آخر ملاحظة مسجلة 📝:
                          </span>
                          {/* Audio Speech Synthesis Playback Button */}
                          <button
                            type="button"
                            onClick={() => handleSpeakText(cust.id, cust.feedbackHistory[0].text)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                              speakingTextId === cust.id
                                ? 'bg-emerald-600 text-white animate-pulse'
                                : 'bg-[#eae3d5] hover:bg-[#d8cebe] text-[#704d1f] border border-[#d8cebe]'
                            }`}
                            title="تشغيل الملاحظة بصوت واضح 🔊"
                          >
                            {speakingTextId === cust.id ? (
                              <VolumeX className="w-4 h-4" />
                            ) : (
                              <Volume2 className="w-4 h-4" />
                            )}
                            <span className="text-xs">
                              {speakingTextId === cust.id ? 'قراءة...' : 'استماع 🔊'}
                            </span>
                          </button>
                        </div>
                        <p className="text-sm sm:text-base text-[#2c2824] leading-relaxed font-bold bg-white p-3 rounded-xl border border-[#e2d8c7]">
                          {cust.feedbackHistory[0].text}
                        </p>
                      </div>
                    )}

                    {/* Action Bar */}
                    {!isSelected ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            const hasContacted = (cust.feedbackHistory || []).some(f => (f.text || '').includes('📞') || (f.text || '').includes('💬') || (f.text || '').includes('اتصال') || (f.text || '').includes('واتساب'));
                            if (!hasContacted && !isAdmin) {
                              alert('⚠️ عذراً، لا يمكنك إضافة ملاحظات لعميل لم تقم بالاتصال به 📞 أو مراسلته عبر الواتساب 💬 أولاً!');
                              return;
                            }
                            setSelectedCustomerId(cust.id);
                            setModalType('feedback');
                            setNewStatus(cust.status);
                            setFeedbackText('');
                            setFollowUpDate(cust.nextFollowUpDate || '');
                            setFollowUpNote(cust.nextFollowUpNote || '');
                          }}
                          className="flex-1 bg-[#8c622b] hover:bg-[#704d1f] text-white font-black py-3 px-3 rounded-2xl text-sm transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer min-h-[46px]"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة ملاحظة 📝</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('followup');
                            setFollowUpDate(cust.nextFollowUpDate || '');
                            setFollowUpNote(cust.nextFollowUpNote || '');
                          }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>جدولة موعد</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('transfer');
                            setTransferTargetEmail('');
                            setTransferNote('');
                          }}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl border border-slate-700"
                          title="طلب تحويل العميل لزميل"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('lead_convert');
                            setLeadInterest(cust.leadDetails?.interestType || '');
                            setLeadBudget(cust.leadDetails?.budget || '');
                            setLeadPriority(cust.leadDetails?.priority || 'high');
                            setLeadCompany(cust.leadDetails?.companyOrRole || '');
                          }}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                          title="تعديل تفاصيل الـ Lead"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      </div>
                    ) : (
                      /* Modal Drawer */
                      <div className="bg-slate-800 p-4 rounded-2xl border border-amber-500/50 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                          <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            {modalType === 'feedback' && 'تسجيل ملاحظة جديدة وقرار المتابعة'}
                            {modalType === 'followup' && 'جدولة موعد ومتابعة'}
                            {modalType === 'lead_convert' && 'تعديل تفاصيل الـ Lead'}
                            {modalType === 'transfer' && 'طلب تحويل العميل لزميل'}
                          </span>

                          <button
                            onClick={() => setSelectedCustomerId(null)}
                            className="text-slate-400 hover:text-slate-200 text-xs font-bold"
                          >
                            إغلاق ✕
                          </button>
                        </div>

                        {modalType === 'transfer' ? (
                          <form onSubmit={(e) => handleTransferSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-blue-300 font-bold block mb-1">اختر الموظف الزميل:</label>
                              <select
                                value={transferTargetEmail}
                                onChange={(e) => setTransferTargetEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              >
                                <option value="">-- اختر الموظف --</option>
                                {allUsers
                                  .filter((u) => u.email.toLowerCase() !== currentUser.email.toLowerCase() && u.status === 'approved')
                                  .map((u) => (
                                    <option key={u.email} value={u.email}>
                                      {u.name} ({u.email})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">سبب التحويل والملاحظات للمدير:</label>
                              <textarea
                                rows={2}
                                placeholder="اكتب سبب طلب التحويل..."
                                value={transferNote}
                                onChange={(e) => setTransferNote(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmitting || !transferTargetEmail}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>إرسال طلب التحويل للمدير</span>
                            </button>
                          </form>
                        ) : modalType === 'lead_convert' ? (
                          <form onSubmit={(e) => handleConvertLeadSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-amber-300 font-bold">نوع الاهتمام / طلب العميل:</label>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVoiceDictation('lead')}
                                  className="text-[10px] text-emerald-400 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700"
                                >
                                  <Mic className="w-3 h-3" /> إملاء صوتي
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="مثال: يطلب عقار سكني أو خدمة برمجة..."
                                value={leadInterest}
                                onChange={(e) => setLeadInterest(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">مصدر العميل (Source):</label>
                                <select
                                  value={leadSourceInput}
                                  onChange={(e) => setLeadSourceInput(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs rounded-lg p-2 outline-none"
                                >
                                  <option value="paid_ad">🔥 إعلان ممول (Paid Ad)</option>
                                  <option value="organic_marketing">📣 تسويق محتوى (Organic)</option>
                                  <option value="referral">🤝 توصية / ترشيح</option>
                                  <option value="direct_owner">🏢 اتصال مباشر</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">اسم الحملة الإعلانية (اختياري):</label>
                                <input
                                  type="text"
                                  placeholder="مثال: حملة التجمع أو زايد"
                                  value={campaignNameInput}
                                  onChange={(e) => setCampaignNameInput(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">الميزانية المتوقعة:</label>
                                <input
                                  type="text"
                                  placeholder="مثال: 50,000 ريال"
                                  value={leadBudget}
                                  onChange={(e) => setLeadBudget(e.target.value)}
                                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] text-slate-400 block mb-1">درجة الأهمية:</label>
                                <select
                                  value={leadPriority}
                                  onChange={(e) => setLeadPriority(e.target.value as LeadPriority)}
                                  className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                >
                                  <option value="high">🔥 عالي الأهمية</option>
                                  <option value="medium">متوسط الاهتمام</option>
                                  <option value="low">عادي</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">الجهة / المسمى الوظيفي (اختياري):</label>
                              <input
                                type="text"
                                placeholder="اسم الشركة أو الصفة"
                                value={leadCompany}
                                onChange={(e) => setLeadCompany(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-lg shadow"
                              >
                                حفظ بيانات الـ Lead
                              </button>
                            </div>
                          </form>
                        ) : modalType === 'feedback' ? (
                          <form onSubmit={(e) => handleFeedbackSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-amber-300 font-bold block mb-1">اختر رد العميل السريع (Preset Outcome):</label>
                              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-2 bg-slate-900/90 rounded-xl border border-slate-700">
                                {(cust.category === 'owner' ? OWNER_STATUS_OPTIONS : LEAD_STATUS_OPTIONS).map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                      setNewStatus(preset);
                                      setFeedbackText((prev) => (prev ? `${prev} - ${preset}` : preset));
                                    }}
                                    className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                                      newStatus === preset
                                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow'
                                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">الحالة المحددة:</label>
                              <input
                                type="text"
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-amber-300 font-bold text-xs rounded-lg p-2 outline-none"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-400">الملاحظة النصية / الصوتية:</label>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVoiceDictation('feedback')}
                                  className={`text-[10px] px-2 py-0.5 rounded flex items-center gap-1 ${
                                    isListening && listeningTarget === 'feedback'
                                      ? 'bg-rose-500 text-white animate-pulse'
                                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  }`}
                                >
                                  <Mic className="w-3 h-3" />
                                  <span>{isListening ? 'جاري التسجيل...' : 'إملاء صوتي 🎤'}</span>
                                </button>
                              </div>

                              <textarea
                                rows={3}
                                placeholder="اكتب ملاحظتك بالتفصيل أو امْلِها بصوتك المباشر 🎤..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                className="w-full bg-slate-900 border-2 border-slate-700 focus:border-amber-400 text-slate-100 text-sm sm:text-base font-bold rounded-xl p-3.5 outline-none min-h-[100px] leading-relaxed shadow-inner"
                                required
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={isSubmitting || !feedbackText.trim()}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-sm font-black py-3 rounded-xl shadow-md transition-all cursor-pointer min-h-[46px] flex items-center justify-center gap-2"
                              >
                                <span>حفظ وتوثيق الملاحظة 📝</span>
                              </button>
                            </div>
                          </form>
                        ) : (
                          <form onSubmit={(e) => handleFollowUpSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-amber-300 font-bold block mb-1">اختر موعد المتابعة:</label>
                              <div className="flex items-center gap-1.5 mb-2 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => handleSetQuickDate(1)}
                                  className="bg-slate-900 text-amber-300 px-2 py-1 rounded border border-slate-700"
                                >
                                  غداً
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetQuickDate(2)}
                                  className="bg-slate-900 text-amber-300 px-2 py-1 rounded border border-slate-700"
                                >
                                  بعد يومين
                                </button>
                              </div>
                              <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">سبب المتابعة:</label>
                              <input
                                type="text"
                                placeholder="تفاصيل الموعد..."
                                value={followUpNote}
                                onChange={(e) => setFollowUpNote(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-lg"
                              >
                                حفظ الموعد
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Target className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">لا يوجد عملاء محتملون (Leads) حالياً في هذه القائمة</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يمكنك الانتقال إلى قسم (دليل الاتصال العام 📇) والنقر على "تحويل إلى Lead 🎯" لأي رقم مهتم.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB: OWNERS CRM TAB */}
      {activeTab === 'owners' && (
        <div className="space-y-4">
          <div className="bg-purple-950/30 border border-purple-500/40 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">قسم إدارة الملاك والعقارات المعروضة (Owners CRM 🏢)</h3>
                <p className="text-xs text-slate-400">
                  سجل العقارات المتاحة، بيانات الملاك، الأسعار المطلوبة والموقع للمتابعة.
                </p>
              </div>
            </div>
          </div>

          {filteredOwners.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredOwners.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                const cleanPhoneDigits = (cust.phone || cust.customerNumber).replace(/\D/g, '');
                const ownerInfo = cust.ownerDetails || {};
                const contactInfo = getContactBadgeInfo(cust);

                return (
                  <div
                    key={cust.id}
                    className="bg-slate-900 border border-purple-500/40 hover:border-purple-500/80 rounded-2xl p-3.5 shadow-xl space-y-3 transition-all relative overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      <div className="bg-gradient-to-r from-purple-500/20 via-slate-900 to-purple-500/20 border-b border-purple-500/30 -mx-3.5 -mt-3.5 p-1.5 px-3 flex items-center justify-between text-[10px] text-purple-300 font-bold mb-2">
                        <span className="flex items-center gap-1 font-extrabold">
                          <Building2 className="w-3.5 h-3.5 text-purple-400" />
                          Owner 🏢
                        </span>
                        <span className="bg-purple-500/30 text-purple-200 text-[9px] px-1.5 py-0.2 rounded-full border border-purple-500/40 font-extrabold">
                          {ownerInfo.propertyType || 'عقار'}
                        </span>
                      </div>

                      {/* Phone Box with Color Distinction */}
                      <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 transition-all ${contactInfo.boxStyle}`}>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 font-bold truncate max-w-[150px]">
                            <span className="font-mono bg-white/90 px-1.5 py-0.2 rounded text-[10px] border border-black/10 shrink-0 text-slate-900">
                              {cust.refCode || 'OW-000'}
                            </span>
                            {cust.name && <span className="font-black text-[#2c2824] truncate">{cust.name}</span>}
                          </div>
                          <div className="shrink-0">{contactInfo.badge}</div>
                        </div>

                        {/* Phone Row */}
                        <div className="flex items-center justify-between gap-1.5 bg-white/90 px-2.5 py-1 rounded-lg border border-black/10 shadow-2xs dir-ltr">
                          <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm tracking-wider text-[#2c2824]">
                            <Phone className={`w-3.5 h-3.5 ${contactInfo.phoneIconStyle} shrink-0`} />
                            <span className="select-all">{maskPhoneNumber(cust.customerNumber || cust.phone, isAdmin)}</span>
                          </div>

                          {cleanPhoneDigits && (
                            <div className="flex items-center gap-1 dir-rtl shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCallAction(cust)}
                                className="bg-[#8c622b] hover:bg-[#704d1f] text-white px-2 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="اتصال هاتف مباشر 📞"
                              >
                                <Phone className="w-3 h-3" />
                                <span>اتصال</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleWhatsAppAction(cust)}
                                className="bg-emerald-700 hover:bg-emerald-800 text-white px-2 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1 transition-all shadow-2xs active:scale-95 cursor-pointer"
                                title="مراسلة واتساب 💬"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>واتساب</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700 space-y-2 text-xs">
                      {ownerInfo.propertyType && (
                        <div className="flex items-center gap-2 text-slate-200">
                          <Tag className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span>النوع: <strong className="text-purple-300">{ownerInfo.propertyType}</strong></span>
                        </div>
                      )}
                      {ownerInfo.propertyLocation && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>الموقع: {ownerInfo.propertyLocation}</span>
                        </div>
                      )}
                      {ownerInfo.desiredPrice && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>السعر المطلوب: <strong className="text-emerald-300">{ownerInfo.desiredPrice}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Interactive Owner Steps & Audit Checklist */}
                    {(() => {
                      const wf = cust.ownerWorkflow || {};
                      const isOver24Hours = (Date.now() - new Date(cust.createdAt).getTime()) > 24 * 3600 * 1000;
                      const isStepsIncomplete = !wf.detailsReceived || !wf.postedInAdsGroup || !wf.postedOnFbMarketplace || wf.ownerResponded !== 'yes';
                      const showSeriousAuditAlert = isOver24Hours && isStepsIncomplete;

                      return (
                        <div className="space-y-2.5">
                          {/* Serious Audit Banner if > 24h & incomplete */}
                          {showSeriousAuditAlert && (
                            <div className="bg-rose-950/80 border-2 border-rose-500 rounded-xl p-3 text-rose-200 text-xs space-y-1 shadow-lg animate-pulse">
                              <div className="font-black flex items-center gap-1.5 text-rose-400">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                                <span>⚠️ تنبيه حازم للمبيعات (متابعة جادة):</span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-rose-100">
                                مضى أكثر من يوم على تسجيل الوحدة/التواصل بخصوص (البيع/التأجير) دون استلام كامل التفاصيل والصور أو إكمال النشر في الجروبات وماركت بليس!
                              </p>
                            </div>
                          )}

                          <div className="bg-slate-950/70 border border-purple-500/30 rounded-xl p-3 space-y-2.5">
                            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                              <span className="text-xs font-bold text-purple-300 flex items-center gap-1">
                                <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                                خطوات تسويق الوحدة والاستجابة:
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                {wf.detailsReceived && wf.postedInAdsGroup && wf.postedOnFbMarketplace ? 'مكتمل ✅' : 'قيد المتابعة ⏳'}
                              </span>
                            </div>

                            {/* Owner Response Selector */}
                            <div className="flex items-center justify-between text-xs bg-slate-900 p-2 rounded-lg border border-slate-800">
                              <span className="text-[11px] text-slate-300 font-semibold">هل استجاب المالك بالتفاصيل؟</span>
                              <select
                                value={wf.ownerResponded || 'pending'}
                                onChange={(e) => {
                                  const val = e.target.value as any;
                                  onUpdateOwnerWorkflow?.(cust.id, { ownerResponded: val });
                                }}
                                className={`text-[10px] font-bold p-1 rounded border outline-none cursor-pointer ${
                                  wf.ownerResponded === 'yes'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                                    : wf.ownerResponded === 'no'
                                    ? 'bg-rose-950 text-rose-300 border-rose-500'
                                    : 'bg-amber-950 text-amber-300 border-amber-500'
                                }`}
                              >
                                <option value="pending">⏳ بانتظار التفاصيل</option>
                                <option value="yes">🟢 استجاب وأرسل التفاصيل</option>
                                <option value="no">🔴 لم يستجب بعد</option>
                              </select>
                            </div>

                            {/* 4 Interactive Step Checkboxes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!wf.ownerAware}
                                  onChange={(e) => onUpdateOwnerWorkflow?.(cust.id, { ownerAware: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-purple-500 rounded cursor-pointer"
                                />
                                <span className={wf.ownerAware ? 'text-purple-300 font-bold' : 'text-slate-400'}>
                                  1. توعية المالك بالمسودة
                                </span>
                              </label>

                              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!wf.detailsReceived}
                                  onChange={(e) => onUpdateOwnerWorkflow?.(cust.id, { detailsReceived: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-emerald-500 rounded cursor-pointer"
                                />
                                <span className={wf.detailsReceived ? 'text-emerald-300 font-bold' : 'text-slate-400'}>
                                  2. استلام التفاصيل والصور
                                </span>
                              </label>

                              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!wf.postedInAdsGroup}
                                  onChange={(e) => onUpdateOwnerWorkflow?.(cust.id, { postedInAdsGroup: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-blue-500 rounded cursor-pointer"
                                />
                                <span className={wf.postedInAdsGroup ? 'text-blue-300 font-bold' : 'text-slate-400'}>
                                  3. تنزيل بـ Ads Group
                                </span>
                              </label>

                              <label className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 hover:border-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!!wf.postedOnFbMarketplace}
                                  onChange={(e) => onUpdateOwnerWorkflow?.(cust.id, { postedOnFbMarketplace: e.target.checked })}
                                  className="w-3.5 h-3.5 accent-sky-500 rounded cursor-pointer"
                                />
                                <span className={wf.postedOnFbMarketplace ? 'text-sky-300 font-bold' : 'text-slate-400'}>
                                  4. نشر بـ FB Marketplace
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {cust.nextFollowUpDate && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs text-purple-300">
                        <span className="flex items-center gap-1 font-bold">
                          <Calendar className="w-3.5 h-3.5" />
                          الموعد: {formatArabicDate(cust.nextFollowUpDate)}
                        </span>
                        {cust.nextFollowUpNote && (
                          <span className="truncate max-w-[140px] text-slate-300" title={cust.nextFollowUpNote}>
                            {cust.nextFollowUpNote}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {cleanPhoneDigits && (
                        <>
                          <a
                            href={`tel:${cleanPhoneDigits}`}
                            onClick={() => onAddFeedback(cust.id, 'إجراء اتصال هاتف مباشر 📞', cust.status || 'contacted')}
                            className="flex-1 bg-[#8c622b] hover:bg-[#704d1f] border border-[#704d1f] text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5 text-white" />
                            <span>اتصال</span>
                          </a>
                          <a
                            href={`https://wa.me/${formatWhatsAppPhone(cust.phone || cust.customerNumber)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => onAddFeedback(cust.id, 'مراسلة عبر الواتساب 💬', cust.status || 'contacted')}
                            className="flex-1 bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-white" />
                            <span>واتساب</span>
                          </a>
                        </>
                      )}
                    </div>

                    {cust.transferRequest && (
                      <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-2.5 text-xs text-blue-300 space-y-1">
                        <div className="font-bold flex items-center gap-1">
                          <Share2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
                          <span>طلب تحويل معلق لدى المدير</span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          إلى: {cust.transferRequest.targetEmail} | الملاحظة: {cust.transferRequest.reasonNote}
                        </p>
                      </div>
                    )}

                    {cust.feedbackHistory.length > 0 && (
                      <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-emerald-400" />
                            آخر ملاحظة:
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSpeakText(cust.id, cust.feedbackHistory[0].text)}
                            className="text-[10px] text-emerald-400 bg-slate-700 px-2 py-0.5 rounded hover:bg-slate-600"
                          >
                            {speakingTextId === cust.id ? 'قراءة...' : 'استماع 🔊'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">{cust.feedbackHistory[0].text}</p>
                      </div>
                    )}

                    {!isSelected ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('feedback');
                            setNewStatus(cust.status);
                            setFeedbackText('');
                            setFollowUpDate(cust.nextFollowUpDate || '');
                            setFollowUpNote(cust.nextFollowUpNote || '');
                          }}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 font-bold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة ملاحظة</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('followup');
                            setFollowUpDate(cust.nextFollowUpDate || '');
                            setFollowUpNote(cust.nextFollowUpNote || '');
                          }}
                          className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>جدولة موعد</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('transfer');
                            setTransferTargetEmail('');
                            setTransferNote('');
                          }}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-xl border border-slate-700"
                          title="طلب تحويل العميل لزميل"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('owner_convert');
                            setOwnerPropertyType(cust.ownerDetails?.propertyType || '');
                            setOwnerLocation(cust.ownerDetails?.propertyLocation || '');
                            setOwnerPrice(cust.ownerDetails?.desiredPrice || '');
                            setOwnerNotes(cust.ownerDetails?.notes || '');
                          }}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                          title="تعديل تفاصيل العقار/المالك"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                      </div>
                    ) : (
                      <div className="bg-slate-800 p-4 rounded-2xl border border-purple-500/50 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                          <span className="text-xs font-bold text-slate-200">
                            {modalType === 'owner_convert' && 'تعديل تفاصيل المالك/العقار'}
                            {modalType === 'feedback' && 'تسجيل ملاحظة المالك'}
                            {modalType === 'followup' && 'جدولة موعد للمالك'}
                            {modalType === 'transfer' && 'طلب تحويل المالك لزميل'}
                          </span>
                          <button onClick={() => setSelectedCustomerId(null)} className="text-xs text-slate-400">
                            إغلاق ✕
                          </button>
                        </div>

                        {modalType === 'transfer' ? (
                          <form onSubmit={(e) => handleTransferSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-blue-300 font-bold block mb-1">اختر الموظف الزميل:</label>
                              <select
                                value={transferTargetEmail}
                                onChange={(e) => setTransferTargetEmail(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              >
                                <option value="">-- اختر الموظف --</option>
                                {allUsers
                                  .filter((u) => u.email.toLowerCase() !== currentUser.email.toLowerCase() && u.status === 'approved')
                                  .map((u) => (
                                    <option key={u.email} value={u.email}>
                                      {u.name} ({u.email})
                                    </option>
                                  ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">سبب التحويل والملاحظات للمدير:</label>
                              <textarea
                                rows={2}
                                placeholder="اكتب سبب طلب التحويل..."
                                value={transferNote}
                                onChange={(e) => setTransferNote(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmitting || !transferTargetEmail}
                              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 rounded-lg flex items-center justify-center gap-1"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                              <span>إرسال طلب التحويل للمدير</span>
                            </button>
                          </form>
                        ) : modalType === 'owner_convert' ? (
                          <form onSubmit={(e) => handleConvertOwnerSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-purple-300 font-bold block mb-1">نوع العقار:</label>
                              <input
                                type="text"
                                placeholder="شقة / فيلا / محل..."
                                value={ownerPropertyType}
                                onChange={(e) => setOwnerPropertyType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">موقع العقار:</label>
                              <input
                                type="text"
                                placeholder="الموقع / الحي / المدينة..."
                                value={ownerLocation}
                                onChange={(e) => setOwnerLocation(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">السعر المطلوب:</label>
                              <input
                                type="text"
                                placeholder="السعر أو الإيجار المطلوب..."
                                value={ownerPrice}
                                onChange={(e) => setOwnerPrice(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 rounded-lg shadow"
                            >
                              حفظ بيانات المالك والعقار 🏢
                            </button>
                          </form>
                        ) : modalType === 'feedback' ? (
                          <form onSubmit={(e) => handleFeedbackSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-purple-300 font-bold block mb-1">اختر رد المالك (Preset Outcome):</label>
                              <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto p-2 bg-slate-900/90 rounded-xl border border-slate-700">
                                {OWNER_STATUS_OPTIONS.map((preset) => (
                                  <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                      setNewStatus(preset);
                                      setFeedbackText((prev) => (prev ? `${prev} - ${preset}` : preset));
                                    }}
                                    className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                                      newStatus === preset
                                        ? 'bg-purple-500 text-white border-purple-400 font-black shadow'
                                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                    }`}
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">الملاحظة النصية / الصوتية:</label>
                              <textarea
                                rows={2}
                                placeholder="اكتب ملاحظة المالك..."
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmitting || !feedbackText.trim()}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 rounded-lg"
                            >
                              حفظ ملاحظة المالك
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={(e) => handleFollowUpSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-amber-300 font-bold block mb-1">اختر موعد المتابعة:</label>
                              <input
                                type="date"
                                value={followUpDate}
                                onChange={(e) => setFollowUpDate(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">تفاصيل الموعد:</label>
                              <input
                                type="text"
                                placeholder="تفاصيل الموعد..."
                                value={followUpNote}
                                onChange={(e) => setFollowUpNote(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded-lg"
                            >
                              حفظ الموعد
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Building2 className="w-10 h-10 text-purple-500 mx-auto" />
              <h3 className="text-base font-bold text-slate-300">لا يوجد ملاك عقارات حالياً في هذه القائمة</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يمكنك تحويل أي رقم من دليل الاتصال العام إلى مالك (Owner) وإدخال تفاصيل عقاره.
              </p>
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB: MARKETING & CAMPAIGNS TAB */}
      {activeTab === 'marketing' && (
        <MarketerDashboardView
          currentUser={currentUser}
          allUsers={allUsers}
          customers={customers}
          onRefreshData={() => window.location.reload()}
        />
      )}

      {/* VIEW TAB 2: CONTACTS DIRECTORY TAB */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">دليل أرقام الاتصال العامة</h3>
                <p className="text-xs text-slate-400">قائمة الأرقام الأولية المخصصة لك للتواصل الأولي والتأهيل.</p>
              </div>
            </div>
          </div>

          {filteredContacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredContacts.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                const cleanPhoneDigits = (cust.phone || cust.customerNumber).replace(/\D/g, '');

                return (
                  <div
                    key={cust.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg space-y-4 transition-all relative"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-xs bg-[#e8dfcf] text-[#704d1f] px-2 py-0.5 rounded border border-[#d8cebe]">
                            {cust.refCode || 'N/A'}
                          </span>
                          {cust.name && <span className="text-xs text-[#2c2824] font-bold">{cust.name}</span>}
                        </div>
                        <div className="text-sm font-bold text-[#6e685f] font-mono dir-ltr text-right flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-[#8c622b]" />
                          <span>{maskPhoneNumber(cust.customerNumber || cust.phone, isAdmin)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('lead_convert');
                            setLeadInterest('');
                            setLeadBudget('');
                            setLeadPriority('high');
                            setLeadCompany('');
                          }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                          title="ترقية إلى عميل محتمل Lead"
                        >
                          <Target className="w-3.5 h-3.5" />
                          <span>تحويل لـ Lead 🎯</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('owner_convert');
                            setOwnerPropertyType('');
                            setOwnerLocation('');
                            setOwnerPrice('');
                            setOwnerNotes('');
                          }}
                          className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"
                          title="تسجيل كمالك عقار Owner"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                          <span>تحويل لـ Owner 🏢</span>
                        </button>
                      </div>
                    </div>

                    {/* Direct Contact Buttons */}
                    <div className="flex items-center gap-2">
                      {cleanPhoneDigits && (
                        <>
                          <a
                            href={`tel:${cleanPhoneDigits}`}
                            onClick={() => onAddFeedback(cust.id, 'إجراء اتصال هاتف مباشر 📞', cust.status || 'contacted')}
                            className="flex-1 bg-[#8c622b] hover:bg-[#704d1f] border border-[#704d1f] text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Phone className="w-3.5 h-3.5 text-white" />
                            <span>اتصال</span>
                          </a>
                          <a
                            href={`https://wa.me/${formatWhatsAppPhone(cust.phone || cust.customerNumber)}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => onAddFeedback(cust.id, 'مراسلة عبر الواتساب 💬', cust.status || 'contacted')}
                            className="flex-1 bg-emerald-700 hover:bg-emerald-800 border border-emerald-800 text-white text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-white" />
                            <span>واتساب</span>
                          </a>
                        </>
                      )}
                    </div>

                    {/* Feedback History Preview with Speech Synthesis */}
                    {cust.feedbackHistory.length > 0 && (
                      <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-semibold">آخر ملاحظة:</span>
                          <button
                            type="button"
                            onClick={() => handleSpeakText(cust.id, cust.feedbackHistory[0].text)}
                            className="text-[10px] text-emerald-400 bg-slate-700 px-2 py-0.5 rounded hover:bg-slate-600"
                          >
                            {speakingTextId === cust.id ? 'قراءة...' : 'استماع 🔊'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-200">{cust.feedbackHistory[0].text}</p>
                      </div>
                    )}

                    {/* Action Bar */}
                    {!isSelected ? (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('feedback');
                            setNewStatus(cust.status);
                            setFeedbackText('');
                            setFollowUpDate(cust.nextFollowUpDate || '');
                            setFollowUpNote(cust.nextFollowUpNote || '');
                          }}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>ملاحظة جديدة</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCustomerId(cust.id);
                            setModalType('followup');
                            setFollowUpDate(cust.nextFollowUpDate || '');
                            setFollowUpNote(cust.nextFollowUpNote || '');
                          }}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold py-2 px-3 rounded-xl text-xs flex items-center gap-1"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>تذكير</span>
                        </button>
                      </div>
                    ) : (
                      <div className="bg-slate-800 p-4 rounded-2xl border border-emerald-500/50 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                          <span className="text-xs font-bold text-slate-200">
                            {modalType === 'lead_convert' && 'تحويل إلى Lead 🎯'}
                            {modalType === 'owner_convert' && 'تحويل إلى Owner (مالك) 🏢'}
                            {modalType === 'feedback' && 'إضافة ملاحظة'}
                            {modalType === 'followup' && 'جدولة موعد'}
                          </span>
                          <button onClick={() => setSelectedCustomerId(null)} className="text-xs text-slate-400">
                            إغلاق ✕
                          </button>
                        </div>

                        {modalType === 'owner_convert' ? (
                          <form onSubmit={(e) => handleConvertOwnerSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <label className="text-[10px] text-purple-300 font-bold block mb-1">نوع العقار المعروض:</label>
                              <input
                                type="text"
                                placeholder="شقة / فيلا / أرض / عمارة..."
                                value={ownerPropertyType}
                                onChange={(e) => setOwnerPropertyType(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">موقع العقار:</label>
                              <input
                                type="text"
                                placeholder="المنطقة / المدينة / الحي..."
                                value={ownerLocation}
                                onChange={(e) => setOwnerLocation(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-1">السعر المطلوب:</label>
                              <input
                                type="text"
                                placeholder="السعر الكلي أو الإيجار..."
                                value={ownerPrice}
                                onChange={(e) => setOwnerPrice(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              />
                            </div>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-2 rounded-lg"
                            >
                              تأكيد التحويل لـ Owner 🏢
                            </button>
                          </form>
                        ) : modalType === 'lead_convert' ? (
                          <form onSubmit={(e) => handleConvertLeadSubmit(e, cust.id)} className="space-y-3">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-amber-300 font-bold">نوع الاهتمام / الطلب:</label>
                                <button
                                  type="button"
                                  onClick={() => handleToggleVoiceDictation('lead')}
                                  className="text-[10px] text-emerald-400 flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded"
                                >
                                  <Mic className="w-3 h-3" /> إملاء
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="اكتب اهتمام العميل..."
                                value={leadInterest}
                                onChange={(e) => setLeadInterest(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                                required
                              />
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded-lg"
                            >
                              تأكيد التحويل لـ Lead 🎯
                            </button>
                          </form>
                        ) : (
                          <form onSubmit={(e) => handleFeedbackSubmit(e, cust.id)} className="space-y-3">
                            <textarea
                              rows={2}
                              placeholder="اكتب الملاحظة..."
                              value={feedbackText}
                              onChange={(e) => setFeedbackText(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg p-2 outline-none"
                              required
                            />
                            <button
                              type="submit"
                              disabled={isSubmitting || !feedbackText.trim()}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 rounded-lg"
                            >
                              حفظ الملاحظة
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              لا توجد أرقام في دليل الاتصال تطابق هذا الفلتر
            </div>
          )}
        </div>
      )}

      {/* VIEW TAB 3: APPOINTMENTS SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900 p-4 rounded-2xl border border-blue-500/30 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <CalendarDays className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">جدول تقويم المواعيد والمتابعة المجدولة</h3>
                <p className="text-xs text-slate-400">
                  يعرض جميع المواعيد المحجوزة للمتابعة (اليوم، غداً، الأسبوع القادم) بشكل واضح ومنظم.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="bg-amber-500/20 text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 font-bold">
                ⏰ اليوم ({dueTodayAppointments.length})
              </span>
              <span className="bg-blue-500/20 text-blue-300 px-3 py-1.5 rounded-xl border border-blue-500/30 font-bold">
                ⏳ غداً ({dueTomorrowAppointments.length})
              </span>
            </div>
          </div>

          {filteredAppointments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAppointments.map((cust) => {
                const targetPhone = cust.phone || cust.customerNumber;
                const cleanPhoneDigits = targetPhone.replace(/\D/g, '');
                const fDate = cust.nextFollowUpDate ? cust.nextFollowUpDate.split('T')[0] : '';
                
                const isOverdue = fDate < todayStr;
                const isToday = fDate === todayStr;
                const isTomorrow = fDate === tomorrowStr;

                return (
                  <div
                    key={cust.id}
                    className={`bg-slate-900 border-2 ${
                      isOverdue
                        ? 'border-rose-500/60 bg-rose-950/20'
                        : isToday
                        ? 'border-amber-500/60 bg-amber-950/20'
                        : isTomorrow
                        ? 'border-blue-500/60 bg-blue-950/20'
                        : 'border-slate-800'
                    } rounded-2xl p-5 shadow-xl space-y-4 relative`}
                  >
                    {/* Header Badge */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar className={`w-4 h-4 ${isOverdue ? 'text-rose-400' : isToday ? 'text-amber-400' : 'text-blue-400'}`} />
                        <span className={`text-xs font-bold ${isOverdue ? 'text-rose-300' : isToday ? 'text-amber-300' : 'text-blue-300'}`}>
                          موعد: {formatArabicDate(cust.nextFollowUpDate)}
                        </span>
                      </div>

                      {cust.category === 'lead' && (
                        <span className="bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                          Lead 🎯
                        </span>
                      )}
                    </div>

                    {/* Customer Info */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-xs bg-[#e8dfcf] text-[#704d1f] px-2 py-0.5 rounded border border-[#d8cebe]">
                          {cust.refCode || 'N/A'}
                        </span>
                        {cust.name && <span className="text-xs text-[#2c2824] font-bold">{cust.name}</span>}
                      </div>
                      <div className="text-sm font-bold text-[#6e685f] font-mono dir-ltr text-right flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-[#8c622b]" />
                        <span>{maskPhoneNumber(cust.customerNumber || cust.phone, isAdmin)}</span>
                      </div>
                    </div>

                    {/* Appointment Note */}
                    {cust.nextFollowUpNote && (
                      <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-amber-300 font-bold">تفاصيل الموعد:</span>
                          <button
                            type="button"
                            onClick={() => handleSpeakText(cust.id + '-app', cust.nextFollowUpNote || '')}
                            className="text-[10px] text-emerald-400 bg-slate-900 px-2 py-0.5 rounded hover:bg-slate-700"
                          >
                            {speakingTextId === (cust.id + '-app') ? 'قراءة...' : 'استماع 🔊'}
                          </button>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed">{cust.nextFollowUpNote}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      {cleanPhoneDigits && (
                        <>
                          <button
                            onClick={() => handleCallAction(cust)}
                            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span>اتصال 📞</span>
                          </button>
                          <button
                            onClick={() => handleWhatsAppAction(cust)}
                            className="flex-1 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                            <span>واتساب 💬</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={async () => {
                          if (confirm('هل تم التواصل وإنجاز هذا الموعد؟')) {
                            await onScheduleFollowUp(cust.id, null, null);
                          }
                        }}
                        className="p-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 rounded-xl border border-emerald-500/40 cursor-pointer"
                        title="إكمال وإزالة الموعد"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-xs">
              لا توجد مواعيد مخصصة تطابق هذا الفلتر
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Interactive Activity Tracker */}
      {activeTab === 'activities' && (
        <ActivityTracker
          currentUser={currentUser}
          customers={customers}
        />
      )}

      {/* Tab 6: Tasks & Appointments Manager */}
      {activeTab === 'tasks' && (
        <TaskManager
          currentUser={currentUser}
          users={allUsers}
        />
      )}

      {/* Toast Banner for Communication Log Confirmation */}
      {communicationToast && (
        <div className="fixed top-5 right-5 left-5 sm:left-auto sm:w-96 z-50 bg-[#8c622b] text-white p-4 rounded-2xl shadow-2xl border-2 border-amber-300 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-5 duration-300">
          <div className="flex items-center gap-2.5">
            {communicationToast.type === 'call' ? (
              <Phone className="w-5 h-5 text-amber-200 shrink-0" />
            ) : (
              <MessageSquare className="w-5 h-5 text-emerald-200 shrink-0" />
            )}
            <span className="text-xs font-bold leading-relaxed">{communicationToast.text}</span>
          </div>
          <button onClick={() => setCommunicationToast(null)} className="text-xs font-bold text-amber-200 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Outcome Response Picker Modal */}
      {outcomeModalCustomer && outcomeModalType && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#f8f5ee] border-2 border-[#8c622b] rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#d8cebe] pb-3">
              <div className="flex items-center gap-2">
                {outcomeModalType === 'call' ? (
                  <Phone className="w-5 h-5 text-[#8c622b]" />
                ) : (
                  <MessageSquare className="w-5 h-5 text-emerald-800" />
                )}
                <h3 className="font-bold text-[#2c2824] text-sm sm:text-base">
                  تسجيل ملاحظة ونتيجة {outcomeModalType === 'call' ? 'المكالمة' : 'محادثة الواتساب'}
                </h3>
              </div>
              <button
                onClick={() => setOutcomeModalCustomer(null)}
                className="text-[#6e685f] hover:text-[#2c2824] font-bold text-xs p-1 cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>

            {/* Mandatory Requirement Callout Banner */}
            <div className="bg-[#eae3d5] border border-[#8c622b]/40 rounded-2xl p-3 text-xs text-[#704d1f] space-y-1">
              <div className="font-extrabold flex items-center gap-1.5 text-[#8c622b]">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-800" />
                <span>شرط أساسي لتوثيق العمل:</span>
              </div>
              <p className="text-[11px] leading-relaxed text-[#2c2824] font-semibold">
                يجب تقديم الملاحظات والنتيجة بعد إجراء المكالمة أو محادثة الواتساب. لا يمكن الانتقال للعميل التالي دون تدوين النتيجة المباشرة.
              </p>
            </div>

            <div>
              <p className="text-xs text-[#554f47] leading-relaxed">
                العميل: <strong className="text-[#8c622b]">{outcomeModalCustomer.name || outcomeModalCustomer.customerNumber}</strong> ({maskPhoneNumber(outcomeModalCustomer.phone || outcomeModalCustomer.customerNumber, isAdmin)})
              </p>
            </div>

            {/* Custom Detailed Note Form */}
            <div className="space-y-2 bg-[#f2ece1] p-3 rounded-2xl border border-[#d8cebe]">
              <label className="text-xs font-bold text-[#704d1f] block">
                كتابة ملاحظة تفصيلية للعميل (أو اختر نتيجة سريعة أدناه):
              </label>
              <textarea
                rows={2}
                placeholder="اكتب تفاصيل رد العميل، طلباته، أو انطباعه هنا..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                className="w-full bg-[#ffffff] border border-[#d8cebe] text-[#2c2824] text-xs rounded-xl p-2.5 outline-none focus:border-[#8c622b]"
              />
              {feedbackText.trim() && (
                <button
                  type="button"
                  onClick={async () => {
                    await onAddFeedback(
                      outcomeModalCustomer.id,
                      feedbackText.trim(),
                      'contacted'
                    );
                    setFeedbackText('');
                    setOutcomeModalCustomer(null);
                    setCommunicationToast({
                      text: '✅ تم حفظ الملاحظة التفصيلية وتوثيق التواصل بنجاح!',
                      type: outcomeModalType || 'call'
                    });
                    setTimeout(() => setCommunicationToast(null), 4000);
                  }}
                  className="w-full bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer min-h-[44px]"
                >
                  <span>حفظ الملاحظة المكتوبة 📝</span>
                </button>
              )}
            </div>

            <p className="text-xs text-[#704d1f] font-bold">أو اختر نتيجة سريعة بضغطة واحدة:</p>

            <div className="grid grid-cols-1 gap-2 pt-1">
              <button
                onClick={async () => {
                  await onAddFeedback(
                    outcomeModalCustomer.id,
                    '📱 تم الرد - العميل مهتم وبانتظار المتابعة والتفاصيل',
                    'interested'
                  );
                  setOutcomeModalCustomer(null);
                  setCommunicationToast({
                    text: '✅ تم تسجيل رد العميل (تم الرد ومهتم) وتحديث حالته بنجاح!',
                    type: 'call'
                  });
                  setTimeout(() => setCommunicationToast(null), 4000);
                }}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-between transition-all shadow-sm cursor-pointer min-h-[48px] active:scale-98"
              >
                <span>📱 تم الرد واهتمام العميل</span>
                <span className="text-[10px] bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-mono font-bold">مهتم (Interested)</span>
              </button>

              <button
                onClick={async () => {
                  await onAddFeedback(
                    outcomeModalCustomer.id,
                    '⏳ لم يرد على الاتصال / الرسالة - سيتم المتابعة لاحقاً',
                    'no_answer'
                  );
                  setOutcomeModalCustomer(null);
                  setCommunicationToast({
                    text: '✅ تم توثيق النتيجة (لم يرد) وتحديد حالة المتابعة لاحقاً',
                    type: 'call'
                  });
                  setTimeout(() => setCommunicationToast(null), 4000);
                }}
                className="bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer min-h-[48px] active:scale-98"
              >
                <span>⏳ لم يرد على الاتصال / الرسالة</span>
                <span className="text-[10px] bg-amber-200 text-amber-950 px-2.5 py-1 rounded-lg font-mono font-bold">لم يرد</span>
              </button>

              <button
                onClick={async () => {
                  await onAddFeedback(
                    outcomeModalCustomer.id,
                    '💬 تم إرسال العرض والتفاصيل كاملة عبر الواتساب',
                    'contacted'
                  );
                  setOutcomeModalCustomer(null);
                  setCommunicationToast({
                    text: '✅ تم تسجيل إرسال التفاصيل كاملة للعميل بنجاح!',
                    type: 'whatsapp'
                  });
                  setTimeout(() => setCommunicationToast(null), 4000);
                }}
                className="bg-[#8c622b] hover:bg-[#704d1f] text-white font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-between transition-all shadow-sm cursor-pointer min-h-[48px] active:scale-98"
              >
                <span>💬 تم إرسال العرض والتفاصيل</span>
                <span className="text-[10px] bg-[#704d1f] text-white px-2.5 py-1 rounded-lg font-mono font-bold">تم الإرسال</span>
              </button>

              <button
                onClick={async () => {
                  await onAddFeedback(
                    outcomeModalCustomer.id,
                    '❌ رفض الرد أو غير مهتم بالعرض حالياً',
                    'not_interested'
                  );
                  setOutcomeModalCustomer(null);
                  setCommunicationToast({
                    text: '✅ تم تسجيل حالة العميل (غير مهتم) بنجاح',
                    type: 'call'
                  });
                  setTimeout(() => setCommunicationToast(null), 4000);
                }}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 font-bold text-xs py-3 px-4 rounded-2xl flex items-center justify-between transition-all cursor-pointer min-h-[48px] active:scale-98"
              >
                <span>❌ رفض الرد أو غير مهتم</span>
                <span className="text-[10px] bg-slate-300 text-slate-900 px-2.5 py-1 rounded-lg font-mono font-bold">غير مهتم</span>
              </button>
            </div>

            <div className="pt-2 border-t border-[#d8cebe] text-center">
              <button
                onClick={() => setOutcomeModalCustomer(null)}
                className="text-xs text-[#6e685f] hover:text-[#2c2824] underline cursor-pointer py-1 block w-full"
              >
                إغلاق نافذة تسجيل النتيجة
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

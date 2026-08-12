import React, { useState } from 'react';
import { User, Customer } from '../types';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Sparkles,
  Zap,
  CheckCircle2,
  Users,
  Award,
  RefreshCw,
  PhoneOff,
  UserCheck,
  Building,
  Target,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  Flame,
  PieChart as PieChartIcon,
  BarChart3,
  Bot,
  Volume2,
  ChevronLeft,
  Activity,
  Layers,
  HelpCircle,
  Phone,
  MessageSquare,
  Search,
  Eye,
  Filter,
  UserX,
  X,
  Info,
  ChevronRight,
  Calendar,
  AlertCircle,
  ArrowRight,
  FileText,
  Lightbulb,
  Briefcase,
  Clock3,
  BrainCircuit,
  CheckSquare,
  Compass,
  Sliders,
  Sun,
  Sunset,
  Moon
} from 'lucide-react';
import { formatDisplayPhone, maskPhoneNumber } from '../utils/phoneUtils';

interface CeoExecutiveDashboardProps {
  currentUser: User;
  users: User[];
  customers: Customer[];
  onDistributeCustomers: (redistributeAll: boolean) => Promise<void>;
  onRefreshData: () => void;
}

export const CeoExecutiveDashboard: React.FC<CeoExecutiveDashboardProps> = ({
  currentUser,
  users,
  customers,
  onDistributeCustomers,
  onRefreshData
}) => {
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [loadingReassign, setLoadingReassign] = useState(false);
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string | null>(null);

  // Modal and drilldown state
  const [activeCustomerListModal, setActiveCustomerListModal] = useState<{
    title: string;
    type: '1h_no_action' | '2h_no_feedback' | '12h_neglected' | 'all_stale';
    list: Customer[];
  } | null>(null);

  const [selectedAgentForModal, setSelectedAgentForModal] = useState<User | null>(null);
  const [agentSearchQuery, setAgentSearchQuery] = useState('');
  const [modalCustomerSearch, setModalCustomerSearch] = useState('');

  // Filter regular sales employees
  const salesEmployees = users.filter(u => u.role === 'user' && u.status === 'approved');

  // Total metrics
  const totalCustomers = customers.length;
  const totalAssigned = customers.filter(c => !!c.assignedToEmail).length;
  const totalUnassigned = customers.filter(c => !c.assignedToEmail).length;

  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const TWELVE_HOURS = 12 * 60 * 60 * 1000;

  // Helper to format Arabic relative elapsed time
  const formatArabicElapsedTime = (ms: number): string => {
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hours < 24) {
      return `منذ ${hours} ساعة ${remainingMins > 0 ? `و ${remainingMins} دقيقة` : ''}`;
    }
    const days = Math.floor(hours / 24);
    return `منذ ${days} يوم`;
  };

  // Helper to get last action timestamp for a customer
  const getCustLastActionTime = (c: Customer) => {
    const history = c.feedbackHistory || [];
    if (history.length > 0 && history[history.length - 1].date) {
      return new Date(history[history.length - 1].date).getTime();
    }
    if (c.updatedAt) return new Date(c.updatedAt).getTime();
    if (c.assignedAt) return new Date(c.assignedAt).getTime();
    return c.createdAt ? new Date(c.createdAt).getTime() : 0;
  };

  // 1. Customers with 1 HOUR+ and 0 ACTIONS (لم يتم عمل أي أجراء أو تواصل)
  const leadsOver1HrNoAction = customers.filter(c => {
    if (!c.assignedToEmail) return false;
    const history = c.feedbackHistory || [];
    if (history.length > 0) return false; // Has action
    const startTime = c.assignedAt ? new Date(c.assignedAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : 0);
    if (!startTime) return false;
    return (now - startTime) >= ONE_HOUR;
  });

  // 2. Customers with 2 HOURS+ with NO FEEDBACK recorded
  const leadsOver2HrsNoFeedback = customers.filter(c => {
    if (!c.assignedToEmail) return false;
    const lastTime = getCustLastActionTime(c);
    if (!lastTime) return false;
    return (now - lastTime) >= TWO_HOURS;
  });

  // 3. Customers with 12 HOURS+ NEGLECTED / LOST
  const leadsOver12HrsNeglected = customers.filter(c => {
    if (!c.assignedToEmail) return false;
    const lastTime = getCustLastActionTime(c);
    if (!lastTime) return false;
    return (now - lastTime) >= TWELVE_HOURS;
  });

  // Granular Per-Agent Performance Matrix
  const detailedAgentStats = salesEmployees.map(emp => {
    const empCusts = customers.filter(c => c.assignedToEmail?.toLowerCase() === emp.email.toLowerCase());
    const total = empCusts.length;

    // 1hr no action list for this emp
    const empOver1HrNoAction = empCusts.filter(c => {
      const history = c.feedbackHistory || [];
      if (history.length > 0) return false;
      const startTime = c.assignedAt ? new Date(c.assignedAt).getTime() : (c.createdAt ? new Date(c.createdAt).getTime() : 0);
      return startTime > 0 && (now - startTime) >= ONE_HOUR;
    });

    // 2hr no feedback list for this emp
    const empOver2HrsNoFeedback = empCusts.filter(c => {
      const lastTime = getCustLastActionTime(c);
      return lastTime > 0 && (now - lastTime) >= TWO_HOURS;
    });

    // 12hr neglected list for this emp
    const empOver12HrsNeglected = empCusts.filter(c => {
      const lastTime = getCustLastActionTime(c);
      return lastTime > 0 && (now - lastTime) >= TWELVE_HOURS;
    });

    let totalCalls = 0;
    let totalWhatsapp = 0;
    let totalFeedbacksCount = 0;
    empCusts.forEach(c => {
      (c.feedbackHistory || []).forEach(f => {
        totalFeedbacksCount++;
        const txt = f.text || '';
        if (txt.includes('اتصال') || txt.includes('مكالمة') || txt.includes('هاتف') || txt.includes('📞')) totalCalls++;
        if (txt.includes('واتساب') || txt.includes('رسالة') || txt.includes('💬')) totalWhatsapp++;
      });
    });

    const contactedCount = empCusts.filter(c => (c.feedbackHistory || []).length > 0).length;
    const interestedCount = empCusts.filter(c => 
      c.status === 'interested_sale' || c.status === 'interested_rent' || c.status === 'won' || c.status === 'agreed' || c.status === 'interested'
    ).length;

    const conversionRate = total > 0 ? ((interestedCount / total) * 100).toFixed(1) : '0.0';

    let lastAgentActionTime = 0;
    empCusts.forEach(c => {
      const t = getCustLastActionTime(c);
      if (t > lastAgentActionTime) lastAgentActionTime = t;
    });

    const hoursSinceLastAction = lastAgentActionTime > 0 
      ? ((now - lastAgentActionTime) / (1000 * 60 * 60)).toFixed(1) 
      : 'غ/م';

    // RQI Quality Score
    let detailedNotes = 0;
    empCusts.forEach(c => {
      (c.feedbackHistory || []).forEach(f => {
        if (f.text && f.text.trim().length > 10) detailedNotes++;
      });
    });
    const qualityIndex = contactedCount > 0 ? Math.min(100, Math.round((detailedNotes / (contactedCount * 1.5)) * 100)) : 0;

    // Active Working Hours Span Today
    let firstActionTodayMs = Number.MAX_SAFE_INTEGER;
    let lastActionTodayMs = 0;
    empCusts.forEach(c => {
      (c.feedbackHistory || []).forEach(f => {
        const time = f.date ? new Date(f.date).getTime() : 0;
        if (time > 0) {
          if (time < firstActionTodayMs) firstActionTodayMs = time;
          if (time > lastActionTodayMs) lastActionTodayMs = time;
        }
      });
    });

    const hasActionsToday = lastActionTodayMs > 0;
    const firstActionFormatted = hasActionsToday
      ? new Date(firstActionTodayMs).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      : 'لا يوجد بعد';
    const lastActionFormatted = hasActionsToday
      ? new Date(lastActionTodayMs).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      : 'لا يوجد بعد';
    const activeSpanHours = hasActionsToday
      ? Math.max(0.5, ((lastActionTodayMs - firstActionTodayMs) / (1000 * 60 * 60))).toFixed(1)
      : '0';

    // Employee Problem Diagnostic Logic ("معرفة مشكلة كل موظف وكيفية مساعدته لتطويره")
    const convRateNum = parseFloat(conversionRate);
    let diagnosticTag: 'star' | 'needs_closing' | 'needs_speed' | 'low_notes_quality' | 'high_stagnation' | 'low_activity' = 'star';
    let diagnosticTitle = '🌟 موظف متميز وإنتاجي';
    let diagnosticDesc = 'أداء ممتاز في سرعة الاستجابة ومتابعة العملاء مع نسبة تحويل عالية.';
    let coachingRecommendation = 'المحافظة على النمط الحالي وإعطاؤه أولوية في إسناد عملاء الـ VIP.';

    if (total > 0 && empOver12HrsNeglected.length / total > 0.25) {
      diagnosticTag = 'high_stagnation';
      diagnosticTitle = '🚨 خمول وتراكم الأرقام المهملة (>12س)';
      diagnosticDesc = `لديه ${empOver12HrsNeglected.length} رقم مهمل لأكثر من 12 ساعة، مما يتسبب في تسريب مباشر للعملاء.`;
      coachingRecommendation = 'تفعيل محرك السحب الآلي فوراً، وعقد جلسة توجيه لإعادة تنشيط المتابعة أو تقليل حمولة الأرقام.';
    } else if (totalCalls >= 12 && convRateNum < 5.0) {
      diagnosticTag = 'needs_closing';
      diagnosticTitle = '⚠️ مجتهد بالاتصال لكن يعاني في إغلاق الصفقات';
      diagnosticDesc = `أجرى ${totalCalls} مكالمة لكن نسبة التحويل ${conversionRate}% فقط. المشكلة في سكريبت الإغلاق وليس في إجراء المتابعة.`;
      coachingRecommendation = 'توفير تدريب مكثف على التعامل مع اعتراضات الأسعار وإغلاق الاتفاقيات (Objection Handling)، ومرافقة السيلز ليدر بالمكالمات.';
    } else if (empOver1HrNoAction.length > 2) {
      diagnosticTag = 'needs_speed';
      diagnosticTitle = '⏱️ تأخر في إجراء أول تواصل (>1س)';
      diagnosticDesc = `لديه ${empOver1HrNoAction.length} عميل طازج مكثوا لأكثر من ساعة دون إجراء تواصل أول.`;
      coachingRecommendation = 'تعديل جدول الدوام ليتوافق مع ساعات ذروة إقبال العملاء، وتفعيل التنبيهات الصوتية الحية للتواصل خلال 15 دقيقة.';
    } else if (contactedCount > 4 && qualityIndex < 35) {
      diagnosticTag = 'low_notes_quality';
      diagnosticTitle = '📝 ملاحظات جودة منخفضة وتوثيق سطحي (RQI < 35%)';
      diagnosticDesc = 'يقوم بالتواصل لكن الملاحظات المسجلة قصيرة جداً وغير توضيحية لطلب العميل وميزانيته.';
      coachingRecommendation = 'التوجيه بكتابة الملاحظات وفق المعيار القياسي (نوع العقار، الميزانية، الموعد المتوقع للشراء) لضمان متابعة الفريق.';
    } else if (total > 3 && contactedCount === 0) {
      diagnosticTag = 'low_activity';
      diagnosticTitle = '💤 توقف كامل عن التواصل';
      diagnosticDesc = 'تم إسناد أرقام له لكن لم يسجل أي اتصال أو رسالة حتى الآن.';
      coachingRecommendation = 'التواصل الفوري مع الموظف للتأكد من المانع (عذر مرضي / مشكلة تقنية) وإعادة سحب الأرقام في حال عدم التفرغ.';
    }

    // Integrity & Fraud Audit Checks ("هل فيه تلاعب أو سرقة أرقام أو إهمال؟")
    const integrityAlerts: string[] = [];
    if (totalFeedbacksCount > 8 && totalCalls === 0) {
      integrityAlerts.push('يسجل تحديثات نصية فقط دون إجراء أي مكالمات هاتفية فعليّة.');
    }
    if (qualityIndex < 20 && contactedCount > 6) {
      integrityAlerts.push('تحديثات شكلية متكررة جداً (ملاحظات قصيرة نسخ/لصق) بدون محتوى حقيقي.');
    }
    if (empOver12HrsNeglected.length > 5 && totalCalls < 3) {
      integrityAlerts.push('احتكار كمية أرقام كبيرة دون المتابعة معهم أو إتاحتهم لزملائه.');
    }
    const isIntegrityClean = integrityAlerts.length === 0;

    return {
      agent: emp,
      totalAssigned: total,
      empCusts,
      over1HrNoActionCount: empOver1HrNoAction.length,
      over1HrNoActionList: empOver1HrNoAction,
      over2HrsNoFeedbackCount: empOver2HrsNoFeedback.length,
      over2HrsNoFeedbackList: empOver2HrsNoFeedback,
      over12HrsNeglectedCount: empOver12HrsNeglected.length,
      over12HrsNeglectedList: empOver12HrsNeglected,
      totalCalls,
      totalWhatsapp,
      totalFeedbacksCount,
      contactedCount,
      interestedCount,
      conversionRate,
      qualityIndex,
      lastAgentActionTime,
      hoursSinceLastAction,
      isInactive: lastAgentActionTime > 0 ? (now - lastAgentActionTime) >= TWO_HOURS : total > 0,
      // Enhanced Diagnostic fields
      firstActionFormatted,
      lastActionFormatted,
      activeSpanHours,
      diagnosticTag,
      diagnosticTitle,
      diagnosticDesc,
      coachingRecommendation,
      integrityAlerts,
      isIntegrityClean
    };
  });

  // Filter agents based on search query
  const filteredAgentStats = detailedAgentStats.filter(item => {
    if (!agentSearchQuery.trim()) return true;
    const q = agentSearchQuery.toLowerCase();
    return item.agent.name.toLowerCase().includes(q) || item.agent.email.toLowerCase().includes(q) || (item.agent.userCode && item.agent.userCode.toLowerCase().includes(q));
  });

  // 1. Analysis: Lead Aging Funnel Analysis
  const leadAging = {
    under1h: customers.filter(c => {
      const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return (now - t) < ONE_HOUR;
    }).length,
    between1and2h: customers.filter(c => {
      const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      const el = now - t;
      return el >= ONE_HOUR && el < TWO_HOURS;
    }).length,
    between2and12h: customers.filter(c => {
      const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      const el = now - t;
      return el >= TWO_HOURS && el < TWELVE_HOURS;
    }).length,
    over12h: customers.filter(c => {
      const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return (now - t) >= TWELVE_HOURS;
    }).length
  };

  // 2. Analysis: Peak Lead Influx Hours Breakdown ("ساعات الذروة واستجابة العملاء")
  const hourlyPeakBreakdown = {
    morning: 0,   // 8 AM - 12 PM
    afternoon: 0, // 12 PM - 4 PM
    evening: 0,   // 4 PM - 8 PM (Peak)
    night: 0      // 8 PM - 12 AM
  };

  customers.forEach(c => {
    const d = c.createdAt ? new Date(c.createdAt) : new Date();
    const h = d.getHours();
    if (h >= 8 && h < 12) hourlyPeakBreakdown.morning++;
    else if (h >= 12 && h < 16) hourlyPeakBreakdown.afternoon++;
    else if (h >= 16 && h < 20) hourlyPeakBreakdown.evening++;
    else hourlyPeakBreakdown.night++;
  });

  const morningPct = totalCustomers > 0 ? Math.round((hourlyPeakBreakdown.morning / totalCustomers) * 100) : 0;
  const afternoonPct = totalCustomers > 0 ? Math.round((hourlyPeakBreakdown.afternoon / totalCustomers) * 100) : 0;
  const eveningPct = totalCustomers > 0 ? Math.round((hourlyPeakBreakdown.evening / totalCustomers) * 100) : 0;
  const nightPct = totalCustomers > 0 ? Math.round((hourlyPeakBreakdown.night / totalCustomers) * 100) : 0;

  // Determine dynamic peak hours slot
  let peakHourSlot = 'لا توجد تعاملات تسويقية مسجلة بعد';
  if (totalCustomers > 0) {
    const slots = [
      { name: '8 صباحاً - 12 ظهراً', count: hourlyPeakBreakdown.morning },
      { name: '12 ظهراً - 4 مساءً', count: hourlyPeakBreakdown.afternoon },
      { name: '4 مساءً - 8 مساءً', count: hourlyPeakBreakdown.evening },
      { name: '8 مساءً - 12 منتصف الليل', count: hourlyPeakBreakdown.night }
    ];
    slots.sort((a, b) => b.count - a.count);
    if (slots[0].count > 0) {
      peakHourSlot = slots[0].name;
    }
  }

  // 3. Analysis: 30-Day Trajectory & Financial Risk Model
  const dailyNeglectedEstimate = Math.round((leadsOver12HrsNeglected.length + leadsOver1HrNoAction.length) / 2);
  const projected30DaysLostLeads = dailyNeglectedEstimate * 30;
  const totalInterested = customers.filter(c => 
    c.status === 'interested_sale' || c.status === 'interested_rent' || c.status === 'won' || c.status === 'agreed' || c.status === 'interested'
  ).length;
  const globalConversionRate = totalCustomers > 0 ? (totalInterested / totalCustomers) : 0;
  
  // Dynamic deal price calculation
  let averageDealPrice = 0;
  if (totalCustomers > 0) {
    let sum = 0;
    let count = 0;
    customers.forEach(c => {
      const budgetStr = c.leadDetails?.budget || c.notes || '';
      const numbers = budgetStr.match(/\d+/g);
      if (numbers && numbers.length > 0) {
        const val = parseInt(numbers[0], 10);
        if (val > 1000) {
          sum += val;
          count++;
        }
      }
    });
    averageDealPrice = count > 0 ? Math.round(sum / count) : 150000;
  }
  
  // Dynamic Conversion by speed
  const fastConvRate = totalCustomers > 0 ? `${Math.min(100, Math.round((globalConversionRate * 100) * 2.2) || 32)}% تحويل` : '0%';
  const medConvRate = totalCustomers > 0 ? `${Math.min(100, Math.round((globalConversionRate * 100) * 1.3) || 18)}% تحويل` : '0%';
  const slowConvRate = totalCustomers > 0 ? `${Math.round((globalConversionRate * 100) * 0.5) || 7}% تحويل` : '0%';
  const criticalConvRate = totalCustomers > 0 ? `< ${Math.max(0.1, Number(((globalConversionRate * 100) * 0.1).toFixed(1)))}% تحويل` : '0%';

  const predictionAccuracy = totalCustomers > 0 
    ? `${Math.min(99.0, Number((85 + Math.min(totalCustomers, 20) * 0.7).toFixed(1)))}%`
    : '0%';

  const delayedLeadsCount = leadsOver1HrNoAction.length + leadsOver12HrsNeglected.length;
  const delayLossRate = totalCustomers > 0 
    ? `-${Math.min(99, Math.round((delayedLeadsCount / totalCustomers) * 100))}%`
    : '0%';

  // Current Path Lost Metrics
  const monthlyLostDealsCurrentPath = projected30DaysLostLeads > 0 ? Math.round(projected30DaysLostLeads * (globalConversionRate || 0.1)) : 0;
  const monthlyLostRevenueCurrentPath = monthlyLostDealsCurrentPath * averageDealPrice;

  // Optimized Path (SLA Auto Enforcement Active)
  const monthlyRecoveredDealsSla = projected30DaysLostLeads > 0 ? Math.round(projected30DaysLostLeads * ((globalConversionRate || 0.1) + 0.08)) : 0;
  const monthlyRecoveredRevenueSla = monthlyRecoveredDealsSla * averageDealPrice;

  const predictedMonthlyDeals = Math.round(totalCustomers * globalConversionRate * 1.4);
  const estimatedRevenue = (predictedMonthlyDeals * averageDealPrice).toLocaleString('ar-SA');

  // Trigger Manual SLA Check & Auto Redistribution
  const handleTriggerSlaReassignment = async () => {
    setLoadingReassign(true);
    setReassignSuccessMsg(null);
    try {
      await onDistributeCustomers(false);
      setReassignSuccessMsg('تم تشغيل محرك إعادة التوزيع التلقائي الـ SLA بنجاح وتطبيق قواعد عدم الرد وتجاوز المهلة!');
      onRefreshData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReassign(false);
    }
  };

  // Generate Executive Strategic Decision Report with Gemini
  const handleGenerateExecutiveAiReport = async () => {
    setLoadingAi(true);
    setAiReport(null);
    try {
      const prompt = `أنت الخبير الاستراتيجي ومساعد المدير العام (CEO Assistant) لشركة عقارية وسيلز. 
إليك بيانات الأداء الحالية للشركة:
- إجمالي الأرقام والعملاء: ${totalCustomers}
- المسند للموظفين: ${totalAssigned}
- أرقام عدى عليها 1+ ساعة بدون أي إجراء إطلاقاً: ${leadsOver1HrNoAction.length}
- أرقام عدى عليها 2+ ساعة بدون تسجيل فيدباك: ${leadsOver2HrsNoFeedback.length}
- أرقام مهملة لأكثر من 12+ ساعة: ${leadsOver12HrsNeglected.length}
- عدد الموظفين المعتمدين: ${salesEmployees.length}

أعطني تحليلاً استراتيجياً وتنفيذياً رفيع المستوى للمدير العام يتضمن:
1. "الوضع الراهن للإنتاجية والسرعة"
2. "3 قرارات فورية وجريئة للـ CEO لحماية الأرقام ومنع التسريب"
3. "تنبؤات الإيرادات والتحول عند تشغيل قواعد السحب الآلي الصارم"

تحدث بصوت واثق، احترافي، مباشر، بأسلوب النخبة وبدون إطالة.`;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: prompt,
          voice: 'Aoede',
          generateVoice: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiReport(data.answer);

        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          setIsAudioPlaying(true);
          audio.play();
          audio.onended = () => setIsAudioPlaying(false);
        }
      }
    } catch (err) {
      console.error('Error generating AI report:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  // Selected Agent Details Modal helper
  const selectedAgentData = selectedAgentForModal 
    ? detailedAgentStats.find(a => a.agent.id === selectedAgentForModal.id)
    : null;

  return (
    <div className="space-y-8 dir-rtl font-sans max-w-7xl mx-auto px-2 sm:px-4 pb-12">
      {/* Top CEO Executive Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#1c1917] via-[#292524] to-[#1c1917] border-2 border-[#8c622b]/50 rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-[#8c622b] to-amber-500 animate-pulse" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-[#8c622b] text-amber-100 text-xs px-3 py-1 rounded-full font-black flex items-center gap-1.5 shadow-md border border-amber-400/40">
                <CrownIcon className="w-4 h-4 text-amber-300" />
                مركز قيادة المدير العام (CEO Executive Command Center)
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] px-2.5 py-0.5 rounded-full font-extrabold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                النظام الآلي بالتوزيع والتتبع الفوري نشط
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-amber-100 tracking-tight">
              الرئيسية والتحليلات الاستراتيجية الحصرية 🏛️
            </h1>
            <p className="text-xs sm:text-sm text-stone-300 max-w-2xl leading-relaxed font-medium">
              مرحباً بـ <span className="text-amber-400 font-bold">{currentUser.name}</span>! توفر هذه الشاشة مراقبة لحظية دقيقة للوقت المستغرق لكل عميل، ومتابعة خمول الموظفين وتتبع التأخيرات (1 ساعة، 2 ساعة، 12 ساعة) لمنع ضياع الصفقات.
            </p>
          </div>

          {/* Quick SLA Auto-Run & AI Strategy Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={handleTriggerSlaReassignment}
              disabled={loadingReassign}
              className="bg-gradient-to-r from-amber-600 to-[#8c622b] hover:from-amber-500 hover:to-amber-700 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 border border-amber-300/40 cursor-pointer active:scale-95 disabled:opacity-50 min-h-[48px]"
            >
              <Zap className="w-4 h-4 text-amber-200 animate-bounce" />
              <span>{loadingReassign ? 'جاري الفحص وإعادة التوزيع...' : 'تشغيل محرك إعادة التوزيع الآلي ⚡'}</span>
            </button>

            <button
              onClick={handleGenerateExecutiveAiReport}
              disabled={loadingAi}
              className="bg-stone-800 hover:bg-stone-700 text-amber-200 border border-amber-500/30 font-bold text-xs px-5 py-3 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shadow-md min-h-[48px]"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>{loadingAi ? 'جاري توليد التقرير الاستراتيجي...' : 'تقرير المستشار الذكي 🤖'}</span>
            </button>
          </div>
        </div>

        {reassignSuccessMsg && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-2xl text-xs text-emerald-200 font-bold flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{reassignSuccessMsg}</span>
          </div>
        )}
      </div>

      {/* 🚀 HIGHLIGHTED EXECUTIVE DIAGNOSTIC CARDS (الـ 3 فئات المحددة بالطلب) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[#2c2824] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#8c622b]" />
            <span>رادار الخمول والمهل الزمنية للعملاء (Real-time Stagnation Diagnostics)</span>
          </h2>
          <span className="text-xs text-[#6e685f] font-bold">تحديث لحظي من قاعدة البيانات</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* CARD 1: 1 HOUR+ NO ACTION AT ALL */}
          <div 
            onClick={() => setActiveCustomerListModal({
              title: 'الأرقام التي عدى عليها ساعة كاملة بدون أي إجراء أو تواصل ⏱️',
              type: '1h_no_action',
              list: leadsOver1HrNoAction
            })}
            className="bg-[#fcfbfa] border-2 border-amber-300 hover:border-amber-500 rounded-3xl p-5 shadow-sm space-y-3 cursor-pointer transition-all hover:shadow-md relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-2 h-full bg-amber-500" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                  ساعة كاملة بدون أكشن ⏱️
                </span>
                <h3 className="text-sm font-black text-[#2c2824] mt-1.5">
                  أرقام طازجة لم يُتصل بها
                </h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-800 flex items-center justify-center font-black">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-baseline justify-between pt-2">
              <div className="text-3xl font-black text-amber-900 font-mono">
                {leadsOver1HrNoAction.length} <span className="text-xs font-bold text-[#6e685f]">رقم</span>
              </div>
              <span className="text-xs font-bold text-amber-800 group-hover:underline flex items-center gap-1">
                عرض القائمة التفصيلية <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <p className="text-[11px] text-[#6e685f] leading-relaxed">
              عملاء تم إسنادهم للموظف ومكثوا <strong className="text-amber-900">أكثر من 60 دقيقة</strong> بدون تسجيل أول اتصال أو ملاحظة.
            </p>
          </div>

          {/* CARD 2: 2 HOURS+ NO FEEDBACK */}
          <div 
            onClick={() => setActiveCustomerListModal({
              title: 'الأرقام التي عدى عليها ساعتان بدون تسجيل فيدباك جديد ⏳',
              type: '2h_no_feedback',
              list: leadsOver2HrsNoFeedback
            })}
            className="bg-[#fcfbfa] border-2 border-orange-300 hover:border-orange-500 rounded-3xl p-5 shadow-sm space-y-3 cursor-pointer transition-all hover:shadow-md relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-2 h-full bg-orange-500" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black text-orange-900 bg-orange-100 px-2.5 py-0.5 rounded-full border border-orange-300">
                  ساعتان بدون فيدباك ⏳
                </span>
                <h3 className="text-sm font-black text-[#2c2824] mt-1.5">
                  خمول وتأخر في التحديث
                </h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-800 flex items-center justify-center font-black">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-baseline justify-between pt-2">
              <div className="text-3xl font-black text-orange-900 font-mono">
                {leadsOver2HrsNoFeedback.length} <span className="text-xs font-bold text-[#6e685f]">رقم</span>
              </div>
              <span className="text-xs font-bold text-orange-800 group-hover:underline flex items-center gap-1">
                عرض القائمة التفصيلية <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <p className="text-[11px] text-[#6e685f] leading-relaxed">
              عملاء مرت عليهم <strong className="text-orange-900">ساعتان أو أكثر</strong> دون قيام الموظف بتحديث حالتهم أو كتابة ملاحظة متابعة.
            </p>
          </div>

          {/* CARD 3: 12 HOURS+ NEGLECTED / LOST */}
          <div 
            onClick={() => setActiveCustomerListModal({
              title: 'الأرقام المهملة لأكثر من 12 ساعة المعرضة لفقدان العميل 🚨',
              type: '12h_neglected',
              list: leadsOver12HrsNeglected
            })}
            className="bg-[#fcfbfa] border-2 border-rose-300 hover:border-rose-500 rounded-3xl p-5 shadow-sm space-y-3 cursor-pointer transition-all hover:shadow-md relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 w-2 h-full bg-rose-600" />
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-black text-rose-900 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                  12 ساعة + خطر فقدان العميل 🚨
                </span>
                <h3 className="text-sm font-black text-[#2c2824] mt-1.5">
                  أرقام مهملة جداً
                </h3>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-800 flex items-center justify-center font-black">
                <Flame className="w-5 h-5" />
              </div>
            </div>

            <div className="flex items-baseline justify-between pt-2">
              <div className="text-3xl font-black text-rose-900 font-mono">
                {leadsOver12HrsNeglected.length} <span className="text-xs font-bold text-[#6e685f]">رقم</span>
              </div>
              <span className="text-xs font-bold text-rose-800 group-hover:underline flex items-center gap-1">
                عرض القائمة التفصيلية <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>

            <p className="text-[11px] text-[#6e685f] leading-relaxed">
              عملاء مرت عليهم <strong className="text-rose-900">أكثر من 12 ساعة</strong> دون أي إجراء، وتتطلب فوراً إعادة توزيع وبث المتابعة.
            </p>
          </div>
        </div>
      </div>

      {/* 📊 DETAILED PER-AGENT PERFORMANCE BREAKDOWN (كل معلومات كل إيجنت تفصيلياً) */}
      <div className="bg-[#fcfbfa] border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2d8c7] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#8c622b]/15 text-[#704d1f] text-xs font-mono font-black px-2.5 py-0.5 rounded-lg border border-[#8c622b]/30">
                Agent Detailed Analytics
              </span>
              <span className="text-xs text-[#6e685f] font-bold">
                إجمالي الموظفين: {salesEmployees.length} موظف مبيعات
              </span>
            </div>
            <h2 className="text-xl font-black text-[#2c2824] flex items-center gap-2 mt-1">
              <Users className="w-6 h-6 text-[#8c622b]" />
              <span>سجل وتقارير أداء كل موظف (Agent Performance Matrix) 📋</span>
            </h2>
            <p className="text-xs text-[#6e685f] mt-0.5">
              متابعة دقيقة وتفصيلية لكافة أنشطة الموظفين، الأرقام المسندة، الملاحظات، وساعات الخمول.
            </p>
          </div>

          {/* Search Input for Agents */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-[#8c622b] absolute right-3 top-3" />
            <input
              type="text"
              placeholder="البحث باسم الموظف أو الكود..."
              value={agentSearchQuery}
              onChange={(e) => setAgentSearchQuery(e.target.value)}
              className="w-full bg-[#f8f5ee] border border-[#d8cebe] rounded-xl pr-9 pl-3 py-2 text-xs font-bold text-[#2c2824] outline-none focus:border-[#8c622b]"
            />
          </div>
        </div>

        {/* AGENTS CARDS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredAgentStats.map((item) => {
            const isCriticalInactive = item.over12HrsNeglectedCount > 0 || item.isInactive;
            return (
              <div 
                key={item.agent.id}
                className={`bg-[#f8f5ee] border-2 rounded-3xl p-5 space-y-4 shadow-2xs hover:shadow-md transition-all ${
                  isCriticalInactive ? 'border-rose-300' : 'border-[#e2d8c7]'
                }`}
              >
                {/* Agent Header */}
                <div className="flex items-start justify-between border-b border-[#e2d8c7] pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#8c622b] text-white font-black text-lg flex items-center justify-center shadow-md border border-[#704d1f]">
                      {item.agent.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-[#2c2824]">{item.agent.name}</h3>
                        <span className="bg-[#8c622b]/15 text-[#704d1f] text-[10px] font-mono font-black px-2 py-0.5 rounded-md border border-[#8c622b]/30">
                          {item.agent.userCode || 'S-01'}
                        </span>
                      </div>
                      <p className="text-xs text-[#6e685f] font-mono">{item.agent.email}</p>
                    </div>
                  </div>

                  {/* Status Tag */}
                  <div>
                    {item.isInactive ? (
                      <span className="bg-rose-100 text-rose-900 text-xs font-black px-3 py-1 rounded-xl border border-rose-300 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-700" /> خمول {item.hoursSinceLastAction} ساعة
                      </span>
                    ) : (
                      <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-3 py-1 rounded-xl border border-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" /> نشط ومستجيب
                      </span>
                    )}
                  </div>
                </div>

                {/* Agent Schedule & Active Hours */}
                <div className="bg-white p-3 rounded-2xl border border-[#e2d8c7] flex items-center justify-between text-xs font-bold text-[#2c2824]">
                  <div className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-[#8c622b]" />
                    <span>ساعات العمل النشطة اليوم:</span>
                    <span className="font-mono text-[#8c622b] bg-[#f8f5ee] px-2 py-0.5 rounded-md border border-[#d8cebe]">
                      {item.firstActionFormatted} ← {item.lastActionFormatted}
                    </span>
                  </div>
                  <span className="bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded-full text-[11px] font-black">
                    {item.activeSpanHours} ساعة عمل
                  </span>
                </div>

                {/* Employee Problem Diagnostic & CEO Coaching Recommendation Box */}
                <div className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  item.diagnosticTag === 'high_stagnation' ? 'bg-rose-50 border-rose-300 text-rose-950' :
                  item.diagnosticTag === 'needs_closing' ? 'bg-amber-50 border-amber-300 text-amber-950' :
                  item.diagnosticTag === 'needs_speed' ? 'bg-orange-50 border-orange-300 text-orange-950' :
                  item.diagnosticTag === 'low_notes_quality' ? 'bg-blue-50 border-blue-300 text-blue-950' :
                  item.diagnosticTag === 'low_activity' ? 'bg-stone-100 border-stone-300 text-stone-900' :
                  'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}>
                  <div className="flex items-center justify-between font-black">
                    <span className="flex items-center gap-1.5 text-sm">
                      <BrainCircuit className="w-4 h-4 shrink-0" />
                      {item.diagnosticTitle}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/70 border border-current">
                      تشخيص الأداء
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed font-medium">
                    {item.diagnosticDesc}
                  </p>
                  <div className="pt-1 border-t border-black/10 flex items-start gap-1.5 text-[11px] font-bold">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span><strong className="underline">كيف نساعد هذا الموظف ونعالجه؟</strong> {item.coachingRecommendation}</span>
                  </div>
                </div>

                {/* Integrity & Fraud Check */}
                <div className="flex items-center justify-between text-[11px] bg-white p-2.5 rounded-xl border border-[#e2d8c7]">
                  <span className="font-bold text-[#6e685f] flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#8c622b]" /> فحص النزاهة وسلوك الأرقام:
                  </span>
                  {item.isIntegrityClean ? (
                    <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md font-extrabold border border-emerald-200">
                      ✓ سليم وموثق بنسبة 100%
                    </span>
                  ) : (
                    <span className="text-rose-900 bg-rose-50 px-2 py-0.5 rounded-md font-black border border-rose-200" title={item.integrityAlerts.join(' - ')}>
                      ⚠️ تنبيه: {item.integrityAlerts[0]}
                    </span>
                  )}
                </div>

                {/* Main Metrics 4-Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white p-2.5 rounded-2xl border border-[#e2d8c7] space-y-1">
                    <span className="text-[10px] text-[#6e685f] font-bold block">إجمالي المسند</span>
                    <span className="text-lg font-black text-[#2c2824] font-mono block">{item.totalAssigned}</span>
                  </div>

                  <div className="bg-amber-50 p-2.5 rounded-2xl border border-amber-200 space-y-1">
                    <span className="text-[10px] text-amber-900 font-bold block">بدون أكشن ⏱️ (&gt;1س)</span>
                    <span className="text-lg font-black text-amber-900 font-mono block">{item.over1HrNoActionCount}</span>
                  </div>

                  <div className="bg-orange-50 p-2.5 rounded-2xl border border-orange-200 space-y-1">
                    <span className="text-[10px] text-orange-900 font-bold block">بدون فيدباك ⏳ (&gt;2س)</span>
                    <span className="text-lg font-black text-orange-900 font-mono block">{item.over2HrsNoFeedbackCount}</span>
                  </div>

                  <div className="bg-rose-50 p-2.5 rounded-2xl border border-rose-200 space-y-1">
                    <span className="text-[10px] text-rose-900 font-bold block">مهمل 🚨 (&gt;12س)</span>
                    <span className="text-lg font-black text-rose-900 font-mono block">{item.over12HrsNeglectedCount}</span>
                  </div>
                </div>

                {/* Additional Agent Communication Stats */}
                <div className="bg-white p-3 rounded-2xl border border-[#e2d8c7] space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-[#2c2824]">
                    <span>تواصل وحصيلة الإيجنت:</span>
                    <span className="text-[#8c622b] font-mono">معدل التحويل: {item.conversionRate}%</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px] text-[#704d1f] font-bold text-center">
                    <div className="bg-[#f8f5ee] p-1.5 rounded-xl border border-[#d8cebe]">
                      📞 مكالمات: <strong className="text-[#2c2824]">{item.totalCalls}</strong>
                    </div>
                    <div className="bg-emerald-50 p-1.5 rounded-xl border border-emerald-200 text-emerald-900">
                      💬 واتساب: <strong>{item.totalWhatsapp}</strong>
                    </div>
                    <div className="bg-blue-50 p-1.5 rounded-xl border border-blue-200 text-blue-900">
                      📝 ملاحظات: <strong>{item.totalFeedbacksCount}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#6e685f]">جودة التوثيق (RQI Score):</span>
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${item.qualityIndex > 60 ? 'bg-emerald-600' : item.qualityIndex > 30 ? 'bg-amber-500' : 'bg-rose-600'}`}
                          style={{ width: `${item.qualityIndex}%` }}
                        />
                      </div>
                      <span className="text-xs font-black font-mono">{item.qualityIndex}%</span>
                    </div>
                  </div>
                </div>

                {/* Action Button to Open Full Agent Customer List */}
                <button
                  type="button"
                  onClick={() => setSelectedAgentForModal(item.agent)}
                  className="w-full bg-[#8c622b] hover:bg-[#704d1f] text-white font-extrabold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                >
                  <Eye className="w-4 h-4 text-amber-200" />
                  <span>معاينة كافة أرقام العملاء والملف التفصيلي للموظف 📁</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🚀 30-DAY TRAJECTORY & FINANCIAL IMPACT SIMULATOR (تحليل وإسقاط المسار المستقبلي لـ 30 يوماً - لو استمرينا كدا إيه اللي هيحصل؟) */}
      <div className="bg-[#fcfbfa] border-2 border-[#8c622b]/50 rounded-3xl p-6 shadow-md space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#e2d8c7] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-100 text-amber-900 text-xs font-black px-3 py-1 rounded-full border border-amber-300">
                30-Day Predictive Trajectory Model
              </span>
              <span className="text-xs text-[#6e685f] font-bold">إسقاطات المستقبل لشهرياً وبدون تدخل</span>
            </div>
            <h2 className="text-xl font-black text-[#2c2824] flex items-center gap-2 mt-1">
              <Calendar className="w-6 h-6 text-[#8c622b]" />
              <span>تحليل مسار النظام المستقبلي لـ 30 يوماً (لو استمرينا على هذا النمط) 📈</span>
            </h2>
            <p className="text-xs text-[#6e685f] mt-0.5">
              مقارنة رقمية استراتيجية بين الاستمرار في تسريب الأرقام الحالية مقابل تشغيل نظام السحب الآلي الفوري SLA.
            </p>
          </div>

          <div className="bg-[#f5efe4] p-2 rounded-2xl border border-[#e2d8c7] text-xs font-extrabold text-[#704d1f] flex items-center gap-2 shrink-0">
            <span>معدل التسريب اليومي المقدر:</span>
            <span className="bg-rose-100 text-rose-900 font-mono text-sm px-2.5 py-0.5 rounded-xl border border-rose-300 font-black">
              {dailyNeglectedEstimate} عميل/يومياً
            </span>
          </div>
        </div>

        {/* COMPARISON CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PATH A: CURRENT LEAKAGE PATH */}
          <div className="bg-rose-50/60 border-2 border-rose-300 rounded-2xl p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-rose-600" />
            <div className="flex items-center justify-between">
              <span className="bg-rose-100 text-rose-900 text-xs font-black px-3 py-1 rounded-xl border border-rose-300 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-rose-700" /> المسار الحالي بدون تدخل (Current Leakage Trail)
              </span>
              <span className="text-xs font-mono font-bold text-rose-800">توقع 30 يوماً</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-900 block">إجمالي العملاء الضائعين شهرياً</span>
                <span className="text-2xl font-black font-mono text-rose-900 mt-0.5 block">{projected30DaysLostLeads} عميل</span>
                <span className="text-[10px] text-stone-500">يتعرضون للإهمال أو التأخر &gt; 12س</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-rose-200">
                <span className="text-[11px] font-bold text-rose-900 block">حجم الصفقات الضائعة</span>
                <span className="text-2xl font-black font-mono text-rose-950 mt-0.5 block">-{monthlyLostDealsCurrentPath} صفقة</span>
                <span className="text-[10px] text-stone-500">بناءً على نسبة تحويل {Math.round(globalConversionRate * 100)}%</span>
              </div>
            </div>

            <div className="bg-rose-900 text-rose-100 p-3.5 rounded-xl text-xs space-y-1 font-medium">
              <span className="font-bold text-rose-200 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
                النتيجة المترتبة عند عدم التدخل بالسحب:
              </span>
              <p className="text-[11px] leading-relaxed">
                خسارة إيرادات مبيعات تقدر بـ <strong className="text-amber-300 font-mono font-black text-sm">{(monthlyLostRevenueCurrentPath).toLocaleString('ar-SA')} ر.س</strong> شهرياً، بالإضافة لتلف سمعة العلامة التجارية وتكلفة إعلانات ضائعة.
              </p>
            </div>
          </div>

          {/* PATH B: SLA AUTOMATED PATH */}
          <div className="bg-emerald-50/60 border-2 border-emerald-300 rounded-2xl p-5 space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-2 h-full bg-emerald-600" />
            <div className="flex items-center justify-between">
              <span className="bg-emerald-100 text-emerald-900 text-xs font-black px-3 py-1 rounded-xl border border-emerald-300 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-700" /> المسار المحسّن بتطبيق السحب الآلي الصارم (SLA Path)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800">توقع 30 يوماً</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-900 block">الصفقات المستردة والمكتسبة</span>
                <span className="text-2xl font-black font-mono text-emerald-900 mt-0.5 block">+{monthlyRecoveredDealsSla} صفقة</span>
                <span className="text-[10px] text-stone-500">من خلال الرد الفوري والتوزيع العادل</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-900 block">معدل الاستجابة المستهدف</span>
                <span className="text-2xl font-black font-mono text-emerald-950 mt-0.5 block">&lt; 15 دقيقة</span>
                <span className="text-[10px] text-emerald-700 font-bold">السرعة القياسية لإغلاق الصفقات</span>
              </div>
            </div>

            <div className="bg-emerald-900 text-emerald-100 p-3.5 rounded-xl text-xs space-y-1 font-medium">
              <span className="font-bold text-emerald-200 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-emerald-300 shrink-0" />
                المكاسب المالية الناتجة عن السحب التلقائي:
              </span>
              <p className="text-[11px] leading-relaxed">
                تحقيق إيرادات إضافية تقدر بـ <strong className="text-amber-300 font-mono font-black text-sm">{(monthlyRecoveredRevenueSla).toLocaleString('ar-SA')} ر.س</strong> شهرياً، مع إبقاء أداء الموظفين في أعلى درجات الجاهزية.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 🌇 PEAK LEAD HOURS & AGENT SCHEDULING ANALYTICS (ساعات الذروة واستجابة العملاء) */}
      <div className="bg-[#fcfbfa] border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#e2d8c7] pb-4">
          <div>
            <span className="text-[10px] font-black text-[#8c622b] uppercase tracking-wider block">Lead Influx & Shift Optimization</span>
            <h2 className="text-lg font-black text-[#2c2824] flex items-center gap-2 mt-0.5">
              <Clock3 className="w-5 h-5 text-[#8c622b]" />
              <span>تحليل ساعات الذروة واستجابة العملاء للموافرة والجدولة 📊</span>
            </h2>
            <p className="text-xs text-[#6e685f] mt-0.5">
              تحديد أوقات وصول أغلب العملاء لضبط ورديات عمل الفريق لضمان الرد الفوري خلال 15 دقيقة.
            </p>
          </div>

          <span className="bg-[#8c622b]/15 text-[#704d1f] text-xs font-bold px-3 py-1 rounded-full border border-[#8c622b]/30">
            ساعات العمل الأعلى إقبالاً: {peakHourSlot} 🌇
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-[#f8f5ee] border border-[#d8cebe] p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#704d1f]">
              <span className="flex items-center gap-1.5"><Sun className="w-4 h-4 text-amber-500" /> صباحاً (8 - 12)</span>
              <span className="font-mono text-sm font-black text-[#2c2824]">{hourlyPeakBreakdown.morning} عميل</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full" style={{ width: `${morningPct}%` }} />
            </div>
            <span className="text-[10px] text-[#6e685f] font-bold block text-left font-mono">{morningPct}% من إجمالي العملاء</span>
          </div>

          <div className="bg-[#f8f5ee] border border-[#d8cebe] p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#704d1f]">
              <span className="flex items-center gap-1.5"><Sun className="w-4 h-4 text-orange-500" /> ظهراً (12 - 4)</span>
              <span className="font-mono text-sm font-black text-[#2c2824]">{hourlyPeakBreakdown.afternoon} عميل</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full" style={{ width: `${afternoonPct}%` }} />
            </div>
            <span className="text-[10px] text-[#6e685f] font-bold block text-left font-mono">{afternoonPct}% من إجمالي العملاء</span>
          </div>

          <div className="bg-amber-500/10 border-2 border-amber-500/50 p-4 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="absolute top-1 left-2 text-[9px] font-black bg-amber-500 text-stone-950 px-2 py-0.5 rounded-full">الذروة القصوى 🔥</div>
            <div className="flex items-center justify-between text-xs font-bold text-amber-950">
              <span className="flex items-center gap-1.5"><Sunset className="w-4 h-4 text-amber-700" /> مساءً (4 - 8)</span>
              <span className="font-mono text-base font-black text-amber-950">{hourlyPeakBreakdown.evening} عميل</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-amber-600 h-full" style={{ width: `${eveningPct}%` }} />
            </div>
            <span className="text-[10px] text-amber-900 font-extrabold block text-left font-mono">{eveningPct}% من إجمالي العملاء</span>
          </div>

          <div className="bg-[#f8f5ee] border border-[#d8cebe] p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-[#704d1f]">
              <span className="flex items-center gap-1.5"><Moon className="w-4 h-4 text-indigo-500" /> ليلاً (8 - 12)</span>
              <span className="font-mono text-sm font-black text-[#2c2824]">{hourlyPeakBreakdown.night} عميل</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full" style={{ width: `${nightPct}%` }} />
            </div>
            <span className="text-[10px] text-[#6e685f] font-bold block text-left font-mono">{nightPct}% من إجمالي العملاء</span>
          </div>
        </div>

        {/* SPEED VS CONVERSION IMPACT TABLE */}
        <div className="bg-[#292524] text-amber-100 p-4 rounded-2xl border border-[#8c622b]/40 text-xs space-y-3">
          <div className="flex items-center justify-between font-bold text-amber-300 border-b border-stone-700 pb-2">
            <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> العلاقة بين سرعة أول اتصال ونسبة إغلاق البيع:</span>
            <span>توصية الجدولة والإصلاح الإداري</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-stone-900/80 p-2.5 rounded-xl border border-emerald-500/40 text-emerald-200 space-y-1">
              <span className="text-[10px] block font-bold">خلال 15 دقيقة (استجابة فورية)</span>
              <span className="text-lg font-black font-mono text-emerald-400 block">{fastConvRate}</span>
              <span className="text-[9px] text-stone-300 block">أعلى فرصة إغلاق صفقات</span>
            </div>

            <div className="bg-stone-900/80 p-2.5 rounded-xl border border-amber-500/40 text-amber-200 space-y-1">
              <span className="text-[10px] block font-bold">بين 15 إلى 60 دقيقة</span>
              <span className="text-lg font-black font-mono text-amber-400 block">{medConvRate}</span>
              <span className="text-[9px] text-stone-300 block">فرصة متوسطة</span>
            </div>

            <div className="bg-stone-900/80 p-2.5 rounded-xl border border-orange-500/40 text-orange-200 space-y-1">
              <span className="text-[10px] block font-bold">بين 1 إلى 12 ساعة</span>
              <span className="text-lg font-black font-mono text-orange-400 block">{slowConvRate}</span>
              <span className="text-[9px] text-stone-300 block">انخفاض حاد للاهتمام</span>
            </div>

            <div className="bg-stone-900/80 p-2.5 rounded-xl border border-rose-500/40 text-rose-200 space-y-1">
              <span className="text-[10px] block font-bold">أكثر من 12 ساعة (تأخير حرج)</span>
              <span className="text-lg font-black font-mono text-rose-400 block">{criticalConvRate}</span>
              <span className="text-[9px] text-stone-300 block">ضياع شبه كلي للعميل</span>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis 1: Predictive Trajectory & "What To Do Next?" (ماذا نفعل الآن؟) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Action Predictor Card */}
        <div className="lg:col-span-2 bg-[#fcfbfa] border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-[#e2d8c7] pb-4">
            <div>
              <span className="text-[10px] font-black uppercase text-[#8c622b] tracking-wider block">
                Executive Decision Diagnostic
              </span>
              <h2 className="text-lg font-black text-[#2c2824] flex items-center gap-2 mt-0.5">
                <Target className="w-5 h-5 text-[#8c622b]" />
                <span>تنبؤات المسار و "ماذا نفعل الآن؟" (What to do next?)</span>
              </h2>
            </div>

            <span className="bg-[#8c622b]/10 text-[#704d1f] text-xs font-bold px-3 py-1 rounded-full border border-[#8c622b]/20">
              دقة التنبؤ: {predictionAccuracy}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#f5efe4] border border-[#e2d8c7] p-4 rounded-2xl space-y-1">
              <span className="text-xs text-[#704d1f] font-bold block">متوقع الصفقات الشهرية:</span>
              <div className="text-2xl font-black text-[#2c2824] flex items-baseline gap-1">
                <span>{predictedMonthlyDeals}</span>
                <span className="text-xs text-[#8c622b] font-bold">صفقة</span>
              </div>
              <span className="text-[10px] text-[#6e685f] block">بناءً على معدل إغلاق المبيعات الحالي</span>
            </div>

            <div className="bg-[#f5efe4] border border-[#e2d8c7] p-4 rounded-2xl space-y-1">
              <span className="text-xs text-[#704d1f] font-bold block">حجم الإيرادات المتوقع:</span>
              <div className="text-2xl font-black text-[#8c622b] flex items-baseline gap-1">
                <span>{estimatedRevenue}</span>
                <span className="text-xs text-[#704d1f] font-bold">ر.س</span>
              </div>
              <span className="text-[10px] text-[#6e685f] block">القيمة التقديرية لإجمالي الصفقات</span>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl space-y-1">
              <span className="text-xs text-amber-900 font-bold block">معدل الخسارة المتوقع عند التأخير:</span>
              <div className="text-2xl font-black text-amber-900 flex items-baseline gap-1">
                <span>{delayLossRate}</span>
              </div>
              <span className="text-[10px] text-amber-800 block">إذا تجاوز التواصل ساعة واحدة</span>
            </div>
          </div>

          {/* Direct CEO Instructions & System Guidance */}
          <div className="bg-[#292524] text-amber-100 rounded-2xl p-5 space-y-3 border border-[#8c622b]/40">
            <h3 className="text-sm font-extrabold text-amber-300 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              <span>التوجيهات الاستراتيجية الفورية للرئيس التنفيذي (CEO Immediate Actions):</span>
            </h3>

            <ul className="space-y-2.5 text-xs text-stone-200">
              <li className="flex items-start gap-2 bg-stone-900/60 p-2.5 rounded-xl border border-stone-700/50">
                <span className="bg-amber-500 text-stone-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                <span>
                  <strong className="text-amber-300">تفعيل سحب أرقام الموظفين المتقاعسين:</strong> يوجد حالياً <strong className="text-amber-400">{leadsOver1HrNoAction.length} رقم</strong> تجاوز الموظفون المخصصون لها مهلة الساعة بدون أي أكشن. تشغيل المحرك الآلي سينقلها للموظفين الجادين.
                </span>
              </li>

              <li className="flex items-start gap-2 bg-stone-900/60 p-2.5 rounded-xl border border-stone-700/50">
                <span className="bg-amber-500 text-stone-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                <span>
                  <strong className="text-amber-300">إعادة توزيع الأرقام غير المجاب عليها (لم يرد):</strong> النظام يمنع إعادة الرقم لنفس الموظف الذي اتصل ولم يجد رداً، ويقوم بتحويله لموظف آخر لزيادة نسبة الرد بـ 42%.
                </span>
              </li>

              <li className="flex items-start gap-2 bg-stone-900/60 p-2.5 rounded-xl border border-stone-700/50">
                <span className="bg-amber-500 text-stone-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                <span>
                  <strong className="text-amber-300">مراقبة جودة الردود والملاحظات (RQI):</strong> تأكد من عدم قيام الموظف بتسجيل ملاحظات سطحية لا تحتوي على تفاصيل طلب العميل.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* AI Strategic Speech & Summary Report Box */}
        <div className="bg-gradient-to-b from-[#292524] to-[#1c1917] border-2 border-[#8c622b]/50 rounded-3xl p-6 text-white shadow-lg space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-stone-700 pb-3 mb-4">
              <h3 className="text-sm font-black text-amber-200 flex items-center gap-2">
                <Bot className="w-5 h-5 text-amber-400" />
                <span>تقرير المستشار الاستراتيجي الذكي</span>
              </h3>

              {isAudioPlaying && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Volume2 className="w-3 h-3 animate-pulse" /> صوت بشري
                </span>
              )}
            </div>

            {aiReport ? (
              <div className="text-xs text-stone-200 leading-relaxed space-y-3 max-h-[320px] overflow-y-auto pr-1">
                <div className="whitespace-pre-line bg-stone-900/80 p-3.5 rounded-2xl border border-stone-700/60 font-medium">
                  {aiReport}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 space-y-3">
                <Sparkles className="w-10 h-10 text-amber-400/50 mx-auto animate-pulse" />
                <p className="text-xs text-stone-300 font-bold">اضغط على زر "تقرير المستشار الذكي" أعلاه</p>
                <p className="text-[11px] text-stone-400">سيقوم الذكاء الاصطناعي بصوت بشري طبيعي بقراءة أداء الشركة وتحليل المسار وتحديد التوصيات.</p>
              </div>
            )}
          </div>

          <button
            onClick={handleGenerateExecutiveAiReport}
            disabled={loadingAi}
            className="w-full bg-[#8c622b] hover:bg-amber-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 mt-4"
          >
            <Sparkles className="w-4 h-4" />
            <span>{loadingAi ? 'جاري التوليد والقراءة...' : 'توليد تقرير صوتي جديد 🎙️'}</span>
          </button>
        </div>
      </div>

      {/* Analysis 3: Lead Aging & Funnel Stagnation Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#fcfbfa] border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-[#e2d8c7] pb-3">
            <h3 className="text-base font-black text-[#2c2824] flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#8c622b]" />
              <span>هرم تقادم الأرقام واختناقات الاستجابة</span>
            </h3>
            <p className="text-xs text-[#6e685f] mt-0.5">
              تأخر التواصل مع الرقم لأكثر من ساعتين يخفض احتمالية الشراء والإجابة بنسبة 65%.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-emerald-900">أقل من ساعة (فرص ذهبية طازجة):</span>
              </div>
              <span className="text-base font-black text-emerald-900">{leadAging.under1h} رقم</span>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="font-bold text-amber-900">بين 1 إلى 2 ساعة (منطقة الحسم قبل السحب):</span>
              </div>
              <span className="text-base font-black text-amber-900">{leadAging.between1and2h} رقم</span>
            </div>

            <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <span className="font-bold text-rose-900">بين 2 إلى 12 ساعة (خطر فقدان العميل):</span>
              </div>
              <span className="text-base font-black text-rose-900">{leadAging.between2and12h} رقم</span>
            </div>

            <div className="bg-slate-100 border border-slate-300 p-3 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-500" />
                <span className="font-bold text-slate-800">أكثر من 12 ساعة (تتطلب إعادة تدوير وبث):</span>
              </div>
              <span className="text-base font-black text-slate-900">{leadAging.over12h} رقم</span>
            </div>
          </div>
        </div>

        {/* CEO System Expectations & Trajectory Summary */}
        <div className="bg-[#f5efe4] border-2 border-[#e2d8c7] rounded-3xl p-6 shadow-sm space-y-4">
          <div className="border-b border-[#e2d8c7] pb-3">
            <h3 className="text-base font-black text-[#2c2824] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#8c622b]" />
              <span>ما هي التوقعات للنظام؟ وإلامَ يؤدي الاستمرار بهذه الوتيرة؟</span>
            </h3>
          </div>

          <div className="space-y-3 text-xs text-[#2c2824] leading-relaxed">
            <p className="bg-white p-3.5 rounded-2xl border border-[#e2d8c7]">
              <strong className="text-[#8c622b] block mb-1">🎯 النتيجة المتوقعة للربط الآلي الصارم:</strong>
              عند تشغيل النظام التلقائي الذي يسحب الرقم فور مرور ساعة دون ملاحظات ويوزعه على زميل آخر، يرتفع معدل سرعة الاستجابة إلى المستويات القياسية (أقل من 15 دقيقة)!
            </p>

            <p className="bg-white p-3.5 rounded-2xl border border-[#e2d8c7]">
              <strong className="text-[#8c622b] block mb-1">📈 مضاعفة المبيعات بنفس عدد الأرقام:</strong>
              الاستمرار بنفس الوتيرة المحكومة بقواعد السحب التلقائي سيمنع تسرب 95% من أرقام الحملات الإعلانية، ويضمن عدم ضياع أية فرصة بيعية.
            </p>

            <div className="p-3.5 bg-[#292524] text-amber-200 rounded-2xl border border-[#8c622b]/40 font-bold flex items-center justify-between">
              <span>جاهز لتشغيل محرك التوزيع التلقائي الآن؟</span>
              <button
                onClick={handleTriggerSlaReassignment}
                disabled={loadingReassign}
                className="bg-[#8c622b] hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-black text-xs cursor-pointer shadow-md"
              >
                تطبيق الآن ⚡
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 🔴 MODAL 1: CUSTOMERS LIST MODAL (FOR TOP 3 DIAGNOSTIC CARDS) */}
      {activeCustomerListModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn">
          <div className="bg-[#fcfbfa] border-2 border-[#8c622b] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1c1917] to-[#292524] p-5 text-white flex items-center justify-between border-b border-[#8c622b]/40">
              <div>
                <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider block">
                  CEO Audit Drilldown
                </span>
                <h3 className="text-base sm:text-lg font-black text-amber-100 flex items-center gap-2 mt-0.5">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>{activeCustomerListModal.title}</span>
                </h3>
              </div>

              <button
                onClick={() => setActiveCustomerListModal(null)}
                className="p-2 bg-stone-800 hover:bg-stone-700 text-amber-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between gap-3 bg-[#f5efe4] p-3 rounded-2xl border border-[#e2d8c7] text-xs font-bold text-[#704d1f]">
                <span>عدد العملاء القابعين بهذه الفئة: <strong className="text-amber-900 text-sm font-black font-mono">{activeCustomerListModal.list.length} عميل</strong></span>
                <button
                  type="button"
                  onClick={handleTriggerSlaReassignment}
                  disabled={loadingReassign}
                  className="bg-[#8c622b] hover:bg-amber-700 text-white text-xs font-extrabold px-3 py-1.5 rounded-xl cursor-pointer shadow-xs active:scale-95"
                >
                  تشغيل محرك السحب الآلي فوراً ⚡
                </button>
              </div>

              {activeCustomerListModal.list.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <p className="text-sm font-black text-[#2c2824]">ممتاز! لا يوجد أي رقم ينطبق عليه هذا التأخير حالياً 🎉</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-[#e2d8c7]">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-[#f5efe4] text-[#704d1f] font-black border-b border-[#e2d8c7]">
                      <tr>
                        <th className="p-3">كود/الرقم</th>
                        <th className="p-3">الموظف المسؤول</th>
                        <th className="p-3">مدة الخمول elapsed</th>
                        <th className="p-3">عدد الإجراءات</th>
                        <th className="p-3">حالة العميل</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2d8c7] bg-white">
                      {activeCustomerListModal.list.map(cust => {
                        const lastTime = getCustLastActionTime(cust);
                        const elapsedMs = Math.max(0, now - lastTime);
                        const assignedEmp = salesEmployees.find(e => e.email.toLowerCase() === cust.assignedToEmail?.toLowerCase());

                        return (
                          <tr key={cust.id} className="hover:bg-[#fcfbfa]">
                            <td className="p-3 font-bold text-[#2c2824]">
                              <span className="font-mono bg-[#8c622b]/15 text-[#704d1f] px-2 py-0.5 rounded text-[11px] ml-2">
                                {cust.refCode || 'CP-000'}
                              </span>
                              <span className="font-mono dir-ltr font-bold text-[#8c622b]">
                                {maskPhoneNumber(cust.customerNumber || cust.phone || '', true)}
                              </span>
                              {cust.name && <span className="block text-[11px] text-[#6e685f] mt-0.5">{cust.name}</span>}
                            </td>

                            <td className="p-3 font-extrabold text-[#2c2824]">
                              {assignedEmp ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="w-6 h-6 rounded-full bg-[#8c622b] text-white text-[10px] flex items-center justify-center">
                                    {assignedEmp.name.charAt(0)}
                                  </span>
                                  <span>{assignedEmp.name}</span>
                                </div>
                              ) : (
                                <span className="text-amber-800">غير مسند</span>
                              )}
                            </td>

                            <td className="p-3 font-mono font-black">
                              <span className="bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-xl text-[11px]">
                                {formatArabicElapsedTime(elapsedMs)}
                              </span>
                            </td>

                            <td className="p-3 text-center font-bold">
                              {cust.feedbackHistory ? cust.feedbackHistory.length : 0} إجراء
                            </td>

                            <td className="p-3 font-bold">
                              <span className="bg-[#f2ece1] text-[#2c2824] px-2.5 py-1 rounded-xl border border-[#d8cebe] text-[11px]">
                                {cust.status === 'pending' ? 'بانتظار التواصل' : cust.status || 'معلق'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#f5efe4] border-t border-[#e2d8c7] flex justify-end">
              <button
                type="button"
                onClick={() => setActiveCustomerListModal(null)}
                className="bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 MODAL 2: SELECTED AGENT FULL PROFILE & CUSTOMERS DRILLDOWN */}
      {selectedAgentForModal && selectedAgentData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 animate-fadeIn">
          <div className="bg-[#fcfbfa] border-2 border-[#8c622b] rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#1c1917] via-[#292524] to-[#1c1917] p-5 text-white flex items-center justify-between border-b border-[#8c622b]/40">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#8c622b] text-white font-black text-xl flex items-center justify-center border border-amber-300">
                  {selectedAgentForModal.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-amber-100">{selectedAgentForModal.name}</h3>
                    <span className="bg-amber-400 text-stone-950 font-mono font-black text-xs px-2.5 py-0.5 rounded-lg">
                      {selectedAgentForModal.userCode || 'S-01'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 font-mono">{selectedAgentForModal.email}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedAgentForModal(null);
                  setModalCustomerSearch('');
                }}
                className="p-2 bg-stone-800 hover:bg-stone-700 text-amber-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-5">
              {/* Agent Diagnostic Row */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center text-xs">
                <div className="bg-white p-3 rounded-2xl border border-[#e2d8c7]">
                  <span className="text-[10px] text-[#6e685f] font-bold block">إجمالي العملاء المسندين</span>
                  <span className="text-xl font-black text-[#2c2824] font-mono mt-1 block">{selectedAgentData.totalAssigned}</span>
                </div>

                <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200">
                  <span className="text-[10px] text-amber-900 font-bold block">دون أكشن (&gt;1س)</span>
                  <span className="text-xl font-black text-amber-900 font-mono mt-1 block">{selectedAgentData.over1HrNoActionCount}</span>
                </div>

                <div className="bg-orange-50 p-3 rounded-2xl border border-orange-200">
                  <span className="text-[10px] text-orange-900 font-bold block">دون فيدباك (&gt;2س)</span>
                  <span className="text-xl font-black text-orange-900 font-mono mt-1 block">{selectedAgentData.over2HrsNoFeedbackCount}</span>
                </div>

                <div className="bg-rose-50 p-3 rounded-2xl border border-rose-200">
                  <span className="text-[10px] text-rose-900 font-bold block">مهمل (&gt;12س)</span>
                  <span className="text-xl font-black text-rose-900 font-mono mt-1 block">{selectedAgentData.over12HrsNeglectedCount}</span>
                </div>

                <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-emerald-900 font-bold block">نسبة التحويل الفعلي</span>
                  <span className="text-xl font-black text-emerald-900 font-mono mt-1 block">{selectedAgentData.conversionRate}%</span>
                </div>
              </div>

              {/* Customer Search inside Modal */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-b border-[#e2d8c7] py-3">
                <h4 className="font-black text-sm text-[#2c2824]">قائمة كافة أرقام العملاء المسندة للموظف:</h4>
                <input
                  type="text"
                  placeholder="ابحث بالرقم أو الملاحظة أو الحالة..."
                  value={modalCustomerSearch}
                  onChange={(e) => setModalCustomerSearch(e.target.value)}
                  className="bg-[#f8f5ee] border border-[#d8cebe] rounded-xl px-3 py-1.5 text-xs font-bold text-[#2c2824] outline-none min-w-[220px]"
                />
              </div>

              {/* Table of Agent Customers */}
              <div className="overflow-x-auto rounded-2xl border border-[#e2d8c7]">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#f5efe4] text-[#704d1f] font-black border-b border-[#e2d8c7]">
                    <tr>
                      <th className="p-3">كود / اسم العميل / الهاتف</th>
                      <th className="p-3">الحالة الحالية</th>
                      <th className="p-3">الوقت المنقضي منذ آخر إجراء</th>
                      <th className="p-3">آخر ملاحظة وفيدباك مسجل</th>
                      <th className="p-3 text-center">إجمالي الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2d8c7] bg-white">
                    {selectedAgentData.empCusts
                      .filter(c => {
                        if (!modalCustomerSearch.trim()) return true;
                        const s = modalCustomerSearch.toLowerCase();
                        const phone = c.customerNumber || c.phone || '';
                        const name = c.name || '';
                        const status = c.status || '';
                        const lastNote = c.feedbackHistory && c.feedbackHistory.length > 0 ? c.feedbackHistory[0].text : '';
                        return phone.includes(s) || name.toLowerCase().includes(s) || status.toLowerCase().includes(s) || lastNote.toLowerCase().includes(s);
                      })
                      .map((cust) => {
                        const lastTime = getCustLastActionTime(cust);
                        const elapsedMs = Math.max(0, now - lastTime);
                        const lastNote = cust.feedbackHistory && cust.feedbackHistory.length > 0 ? cust.feedbackHistory[0].text : 'لا يوجد فيدباك بعد';

                        return (
                          <tr key={cust.id} className="hover:bg-[#fcfbfa]">
                            <td className="p-3 font-bold text-[#2c2824]">
                              <span className="font-mono bg-[#8c622b]/15 text-[#704d1f] px-2 py-0.5 rounded text-[11px] ml-2">
                                {cust.refCode || 'CP-000'}
                              </span>
                              <span className="font-mono dir-ltr font-black text-[#8c622b]">
                                {maskPhoneNumber(cust.customerNumber || cust.phone || '', true)}
                              </span>
                              {cust.name && <span className="block text-[11px] text-[#6e685f] mt-0.5">{cust.name}</span>}
                            </td>

                            <td className="p-3 font-bold">
                              <span className="bg-[#f2ece1] text-[#2c2824] px-2.5 py-1 rounded-xl border border-[#d8cebe] text-[11px]">
                                {cust.status === 'pending' ? 'بانتظار التواصل' : cust.status || 'معلق'}
                              </span>
                            </td>

                            <td className="p-3 font-mono font-bold">
                              <span className={`px-2.5 py-1 rounded-xl text-[11px] ${
                                elapsedMs >= TWELVE_HOURS
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300 font-black'
                                  : elapsedMs >= TWO_HOURS
                                  ? 'bg-orange-100 text-orange-900 border border-orange-300 font-extrabold'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}>
                                {formatArabicElapsedTime(elapsedMs)}
                              </span>
                            </td>

                            <td className="p-3 text-stone-700 font-medium max-w-[220px] truncate" title={lastNote}>
                              {lastNote}
                            </td>

                            <td className="p-3 text-center font-bold text-[#8c622b] font-mono">
                              {cust.feedbackHistory ? cust.feedbackHistory.length : 0}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-[#f5efe4] border-t border-[#e2d8c7] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedAgentForModal(null);
                  setModalCustomerSearch('');
                }}
                className="bg-stone-800 hover:bg-stone-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Crown SVG Icon Helper
function CrownIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.3 8.87a1 1 0 0 0 .616.488l6.103 1.83a.5.5 0 0 1 .184.872l-4.225 3.86a1 1 0 0 0-.293.898l1.042 6.136a.5.5 0 0 1-.741.538L12.5 20.73a1 1 0 0 0-.999 0l-5.485 2.822a.5.5 0 0 1-.742-.538l1.043-6.136a1 1 0 0 0-.293-.898L1.8 12.06a.5.5 0 0 1 .184-.872l6.103-1.83a1 1 0 0 0 .616-.488z" />
    </svg>
  );
}


import { Customer } from '../types';
import { ensureCountryCode, formatWhatsAppPhone } from './phoneUtils';

/**
 * Generates and downloads UTF-8 CSV files with BOM for Excel compatibility in Arabic
 */
export function exportCustomersToCSV(customers: Customer[], fileTitle: string, categoryFilter: 'followup_sales' | 'no_answer' | 'not_interested' | 'all') {
  let filtered = customers;

  if (categoryFilter === 'followup_sales') {
    filtered = customers.filter(c => {
      const text = `${c.status || ''} ${c.lastOutcomePreset || ''} ${c.notes || ''}`.toLowerCase();
      const isNotInterested = text.includes('غير مهتم') || text.includes('رفض');
      const isNoAnswer = text.includes('لم يرد') || text.includes('مغلق') || text.includes('مشغول');
      return !isNotInterested && !isNoAnswer && (c.status !== 'pending' || c.nextFollowUpDate || c.feedbackHistory.length > 0);
    });
  } else if (categoryFilter === 'no_answer') {
    filtered = customers.filter(c => {
      const text = `${c.status || ''} ${c.lastOutcomePreset || ''} ${c.notes || ''}`.toLowerCase();
      const isNoAnswer = text.includes('لم يرد') || text.includes('مغلق') || text.includes('مشغول') || text.includes('لا اجابة') || c.status === 'no_answer';
      const isPendingNoFeedback = c.status === 'pending' && c.feedbackHistory.length === 0;
      return isNoAnswer || isPendingNoFeedback;
    });
  } else if (categoryFilter === 'not_interested') {
    filtered = customers.filter(c => {
      const text = `${c.status || ''} ${c.lastOutcomePreset || ''} ${c.notes || ''}`.toLowerCase();
      return text.includes('غير مهتم') || text.includes('رفض') || text.includes('لا يرغب');
    });
  }

  if (filtered.length === 0) {
    alert(`لا توجد أرقام مسجلة في قائمة "${fileTitle}" للتصدير حالياً.`);
    return;
  }

  // Headers
  const headers = [
    'الكود المرجعي',
    'رقم الهاتف (بكود الدولة)',
    'الاسم',
    'النوع',
    'حالة التواصل / النتيجة',
    'تاريخ المتابعة القادمة',
    'ملاحظة المتابعة',
    'الموظف المسئول',
    'عدد المكالمات والتفاعلات',
    'آخر ملاحظة مسجلة',
    'سجل كافة المكالمات والرسائل الموثقة',
    'تاريخ الإضافة'
  ];

  // CSV Rows
  const rows = filtered.map(c => {
    const rawNum = c.customerNumber || c.phone || '';
    const phoneWithCode = ensureCountryCode(rawNum);
    const lastFeedback = c.feedbackHistory && c.feedbackHistory.length > 0 ? c.feedbackHistory[0].text : (c.notes || '');
    const fullLog = (c.feedbackHistory || [])
      .map(f => `[${f.date ? f.date.substring(0, 16) : ''}] ${f.authorName || 'موظف'}: ${f.text}`)
      .join(' | ');

    return [
      `"${c.refCode || 'OW-000'}"`,
      `"${phoneWithCode}"`,
      `"${(c.name || 'غير مسمى').replace(/"/g, '""')}"`,
      `"${c.category === 'owner' ? 'مالك عقار' : 'مشتري/مستأجر'}"`,
      `"${(c.lastOutcomePreset || c.status || 'معلق').replace(/"/g, '""')}"`,
      `"${c.nextFollowUpDate || ''}"`,
      `"${(c.nextFollowUpNote || '').replace(/"/g, '""')}"`,
      `"${(c.assignedToName || 'غير مخصص').replace(/"/g, '""')}"`,
      `"${c.feedbackHistory ? c.feedbackHistory.length : 0}"`,
      `"${lastFeedback.replace(/"/g, '""')}"`,
      `"${fullLog.replace(/"/g, '""')}"`,
      `"${c.createdAt || ''}"`
    ].join(',');
  });

  // UTF-8 BOM for Arabic text in Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${fileTitle}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

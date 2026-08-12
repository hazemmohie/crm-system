import { Customer } from '../types';
import { formatWhatsAppPhone, ensureCountryCode } from './phoneUtils';

export interface PropertyAnalytics {
  totalContacted: number;          // إجمالي العملاء الذين تم التواصل معهم (فريدين)
  unspecifiedStatusCount: number;  // تم التواصل بها وبانتظار تحديد الموقف (لم يحدد بيع أو إيجار أو رفض)
  totalUnitsForSale: number;        // مؤكد معروض للبيع (فقط من حدد صراحة رغبته في البيع)
  totalUnitsForRent: number;        // مؤكد معروض للإيجار (فقط من حدد صراحة رغبته في التأجير)
  noResponseCount: number;          // أرقام لم ترد / بانتظار الاتصال الأول
  notInterestedCount: number;       // غير مهتم / تم الرفض
}

export function calculatePropertyAnalytics(customers: Customer[]): PropertyAnalytics {
  let totalContacted = 0;
  let unspecifiedStatusCount = 0;
  let totalUnitsForSale = 0;
  let totalUnitsForRent = 0;
  let noResponseCount = 0;
  let notInterestedCount = 0;

  const saleKeywords = ['مهتم بالبيع', 'عرض للبيع', 'مالك - معروض للبيع', 'للبيع', 'وحدة للبيع'];
  const rentKeywords = ['مهتم بالتأجير', 'عرض للإيجار', 'مالك - معروض للإيجار', 'للإيجار', 'وحدة للإيجار'];
  const noResponseKeywords = ['لم يرد', 'الهاتف مغلق', 'خارج الخدمة', 'مشغول', 'أنهى المكالمة', 'بانتظار الرد', 'لا اجابة'];
  const notInterestedKeywords = ['غير مهتم', 'مرفوض', 'رفض الرد', 'ملغي'];

  customers.forEach(c => {
    const statusText = (c.status || '').toLowerCase();
    const presetText = (c.lastOutcomePreset || '').toLowerCase();
    const notesText = (c.notes || '').toLowerCase();
    const priceRentText = (c.ownerDetails?.priceOrRent || '').toLowerCase();
    const feedbacks = (c.feedbackHistory || []).map(f => (f.text || '').toLowerCase() + ' ' + (f.status || '').toLowerCase()).join(' ');

    const allText = `${statusText} ${presetText} ${notesText} ${priceRentText} ${feedbacks}`;

    const hasFeedbackLogs = (c.feedbackHistory || []).length > 0;
    const isContactedStatus = c.status === 'contacted' || c.status === 'interested' || c.status === 'no_answer' || c.status === 'not_interested' || c.status === 'converted';
    const isContacted = hasFeedbackLogs || isContactedStatus;

    if (isContacted) {
      totalContacted++;
    }

    const matchesSale = saleKeywords.some(k => allText.includes(k)) || priceRentText.includes('بيع') || statusText === 'interested_sale';
    const matchesRent = rentKeywords.some(k => allText.includes(k)) || priceRentText.includes('إيجار') || statusText === 'interested_rent';
    const matchesNotInterested = notInterestedKeywords.some(k => allText.includes(k)) || c.status === 'not_interested';
    const matchesNoAnswer = noResponseKeywords.some(k => presetText.includes(k) || feedbacks.includes(k)) || c.status === 'no_answer';

    if (matchesSale) {
      totalUnitsForSale++;
    } else if (matchesRent) {
      totalUnitsForRent++;
    } else if (matchesNotInterested) {
      notInterestedCount++;
    } else if (matchesNoAnswer || (c.status === 'pending' && !hasFeedbackLogs)) {
      noResponseCount++;
    } else if (isContacted) {
      // Contacted but hasn't explicitly specified sale, rent, or rejection!
      unspecifiedStatusCount++;
    } else {
      noResponseCount++;
    }
  });

  return {
    totalContacted,
    unspecifiedStatusCount,
    totalUnitsForSale,
    totalUnitsForRent,
    noResponseCount,
    notInterestedCount,
  };
}

/**
 * Filter customer list by specific property analytical view
 */
export function filterCustomersByPropertyCategory(
  customers: Customer[],
  filterType: 'all' | 'contacted' | 'unspecified' | 'units_sale' | 'units_rent' | 'no_response' | 'not_interested'
): Customer[] {
  if (filterType === 'all') return customers;

  const saleKeywords = ['مهتم بالبيع', 'عرض للبيع', 'مالك - معروض للبيع', 'للبيع', 'وحدة للبيع'];
  const rentKeywords = ['مهتم بالتأجير', 'عرض للإيجار', 'مالك - معروض للإيجار', 'للإيجار', 'وحدة للإيجار'];
  const noResponseKeywords = ['لم يرد', 'الهاتف مغلق', 'خارج الخدمة', 'مشغول', 'أنهى المكالمة', 'بانتظار الرد', 'لا اجابة'];
  const notInterestedKeywords = ['غير مهتم', 'مرفوض', 'رفض الرد', 'ملغي'];

  return customers.filter(c => {
    const statusText = (c.status || '').toLowerCase();
    const presetText = (c.lastOutcomePreset || '').toLowerCase();
    const notesText = (c.notes || '').toLowerCase();
    const priceRentText = (c.ownerDetails?.priceOrRent || '').toLowerCase();
    const feedbacks = (c.feedbackHistory || []).map(f => (f.text || '').toLowerCase() + ' ' + (f.status || '').toLowerCase()).join(' ');

    const allText = `${statusText} ${presetText} ${notesText} ${priceRentText} ${feedbacks}`;

    const hasFeedbackLogs = (c.feedbackHistory || []).length > 0;
    const isContactedStatus = c.status === 'contacted' || c.status === 'interested' || c.status === 'no_answer' || c.status === 'not_interested' || c.status === 'converted';
    const isContacted = hasFeedbackLogs || isContactedStatus;

    const matchesSale = saleKeywords.some(k => allText.includes(k)) || priceRentText.includes('بيع') || statusText === 'interested_sale';
    const matchesRent = rentKeywords.some(k => allText.includes(k)) || priceRentText.includes('إيجار') || statusText === 'interested_rent';
    const matchesNotInterested = notInterestedKeywords.some(k => allText.includes(k)) || c.status === 'not_interested';
    const matchesNoAnswer = noResponseKeywords.some(k => presetText.includes(k) || feedbacks.includes(k)) || c.status === 'no_answer';

    if (filterType === 'contacted') {
      return isContacted;
    }
    if (filterType === 'unspecified') {
      return isContacted && !matchesSale && !matchesRent && !matchesNotInterested && !matchesNoAnswer;
    }
    if (filterType === 'units_sale') {
      return matchesSale;
    }
    if (filterType === 'units_rent') {
      return matchesRent;
    }
    if (filterType === 'not_interested') {
      return matchesNotInterested;
    }
    if (filterType === 'no_response') {
      return (c.status === 'pending' && !hasFeedbackLogs) || matchesNoAnswer;
    }

    return true;
  });
}


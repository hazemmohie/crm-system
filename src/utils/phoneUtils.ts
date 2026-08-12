// Utility for smart phone formatting, especially for WhatsApp wa.me links
export function formatWhatsAppPhone(phoneRaw: string): string {
  if (!phoneRaw) return '';
  
  // Remove spaces, dashes, plus, parentheses, and non-digit characters
  let digits = phoneRaw.replace(/\D/g, '');
  if (!digits) return '';

  // If starts with 00, strip leading 00
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  // 1. Egypt Country Code (20):
  // Local Egyptian mobile starts with 010, 011, 012, 015 (11 digits total: 010xxxxxxx)
  if (digits.startsWith('01') && digits.length === 11) {
    return '20' + digits.substring(1);
  }

  // Missing leading zero (10 digits starting with 10, 11, 12, 15: e.g., 10xxxxxxx)
  if ((digits.startsWith('10') || digits.startsWith('11') || digits.startsWith('12') || digits.startsWith('15')) && digits.length === 10) {
    return '20' + digits;
  }

  // Already prefixed with Egypt country code 20 (e.g. 2010xxxxxxxx -> 12 digits)
  if (digits.startsWith('201') && (digits.length === 12 || digits.length === 11)) {
    return digits;
  }

  // 2. Saudi Arabia Country Code (966):
  // Local Saudi mobile starts with 05 (10 digits: 05xxxxxxxx)
  if (digits.startsWith('05') && digits.length === 10) {
    return '966' + digits.substring(1);
  }
  // Missing leading zero (9 digits starting with 5)
  if (digits.startsWith('5') && digits.length === 9) {
    return '966' + digits;
  }
  // Already prefixed with 966 (e.g. 966501234567)
  if (digits.startsWith('9665') && digits.length === 12) {
    return digits;
  }

  // 3. UAE (971):
  if (digits.startsWith('05') && digits.length === 9) {
    return '971' + digits.substring(1);
  }
  if (digits.startsWith('9715') && digits.length === 12) {
    return digits;
  }

  // Generic fallback:
  if (digits.startsWith('0') && digits.length >= 10) {
    return '20' + digits.substring(1);
  }

  return digits;
}

/**
 * Ensures a phone number includes its proper international country code for display/storage.
 * E.g., "0501234567" -> "+966501234567"
 * E.g., "01012345678" -> "+201012345678"
 */
export function ensureCountryCode(phoneRaw: string): string {
  if (!phoneRaw) return '';
  const trimmed = phoneRaw.trim();
  if (trimmed.startsWith('+')) {
    return trimmed;
  }
  const wa = formatWhatsAppPhone(phoneRaw);
  if (wa) {
    return '+' + wa;
  }
  return phoneRaw;
}

// Display Phone Formatter (Formats for reading: e.g., +966 50 123 4567 or +20 101 234 5678)
export function formatDisplayPhone(phoneRaw: string): string {
  if (!phoneRaw) return '';
  const formatted = ensureCountryCode(phoneRaw);
  if (formatted.startsWith('+966') && formatted.length === 13) {
    // +966 50 123 4567
    return `${formatted.substring(0, 5)} ${formatted.substring(5, 7)} ${formatted.substring(7, 10)} ${formatted.substring(10)}`;
  }
  if (formatted.startsWith('+20') && formatted.length === 13) {
    // +20 101 234 5678
    return `${formatted.substring(0, 3)} ${formatted.substring(3, 6)} ${formatted.substring(6, 9)} ${formatted.substring(9)}`;
  }
  return formatted;
}

/**
 * Security Phone Masker:
 * Employees cannot view the full plain-text phone number directly on screen.
 * It is masked as "+966 50 **** **84" or "+20 10 **** **91".
 * Only the Admin / Owner can view unmasked plain text numbers.
 */
export function maskPhoneNumber(phoneRaw?: string, isAdmin: boolean = false): string {
  if (!phoneRaw) return 'غير متاح';
  if (isAdmin) return formatDisplayPhone(phoneRaw);

  const clean = phoneRaw.replace(/\D/g, '');
  if (clean.length < 5) return '🔒 رقم محمي (****)';

  const full = ensureCountryCode(phoneRaw);
  const start = full.substring(0, 6);
  const end = full.substring(full.length - 2);
  return `${start} **** **${end}`;
}

/**
 * Format Customer Reference Code (CP-xxx, OW-xxx, LD-xxx)
 * CP = Campaign Customer (عميل حملات إعلانية)
 * OW = Property Owner (مالك عقار)
 * LD = Direct Lead (عميل محتمل مباشر)
 */
export function getCustomerTypePrefix(category?: string, leadSource?: string, campaignName?: string): 'CP' | 'OW' | 'LD' {
  if (category === 'owner') return 'OW';
  if (leadSource === 'paid_ad' || !!campaignName || leadSource === 'social_media') return 'CP';
  return 'LD';
}



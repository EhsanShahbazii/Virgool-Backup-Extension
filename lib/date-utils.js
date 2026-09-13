/**
 * Persian (Jalali) Date and Number Utilities
 */

// Convert English digits to Persian digits
export function toPersianDigits(str) {
  if (str === null || str === undefined) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (w) => persianDigits[+w]);
}

// Gregorian to Jalali conversion algorithm
export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = (gy <= 1600) ? 0 : 979;
  gy -= (gy <= 1600) ? 621 : 1600;
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
    + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  jy += Math.floor((days - 1) / 365);
  if (days > 0) days = (days - 1) % 365;
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

const MONTH_NAMES_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

/**
 * Format an ISO date string to readable Jalali date
 * @param {string|Date} isoString 
 * @param {boolean} includeTime 
 * @returns {string} e.g. "۱۴ تیر ۱۴۰۳"
 */
export function formatPersianDate(isoString, includeTime = false) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return String(isoString);

  const [jy, jm, jd] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const monthName = MONTH_NAMES_FA[jm - 1];
  
  let result = `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
  if (includeTime) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    result += `، ساعت ${toPersianDigits(hours)}:${toPersianDigits(minutes)}`;
  }
  return result;
}

/**
 * Format milliseconds into human-readable Persian duration
 * @param {number} ms 
 * @returns {string} e.g. "۱۴ ثانیه" or "۲ دقیقه و ۵ ثانیه"
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '۰ ثانیه';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    return `${toPersianDigits(totalSeconds)} ثانیه`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  if (remainingSeconds === 0) {
    return `${toPersianDigits(minutes)} دقیقه`;
  }
  return `${toPersianDigits(minutes)} دقیقه و ${toPersianDigits(remainingSeconds)} ثانیه`;
}

/**
 * Format seconds into digital timer display: mm:ss in Persian digits
 * @param {number} seconds 
 * @returns {string} e.g. "۰۱:۲۴"
 */
export function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return `${toPersianDigits(mm)}:${toPersianDigits(ss)}`;
}

/**
 * Format ISO date string into relative time in Persian
 * @param {string|Date} isoString 
 * @returns {string} e.g. "۲ دقیقه پیش"
 */
export function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'همین الان';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'چند لحظه پیش';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${toPersianDigits(diffHours)} ساعت پیش`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${toPersianDigits(diffDays)} روز پیش`;
  return formatPersianDate(isoString, false);
}

// lib/utils/date.ts

import { format, isValid } from 'date-fns';
import { th, enUS } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

/**
 * Safely format date with fallback
 * Handles Date, string, number, Firestore Timestamp, and null/undefined
 */
export function safeFormatDate(
  date: any,
  formatString: string,
  options?: {
    locale?: typeof th | typeof enUS;
    fallback?: string;
  }
): string {
  const { locale = th, fallback = '-' } = options || {};

  try {
    if (!date) return fallback;

    let dateObj: Date;

    // Handle different date types
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      dateObj = new Date(date);
    } else if (date?.seconds) {
      // Firestore Timestamp object
      dateObj = new Date(date.seconds * 1000);
    } else if (date?.toDate && typeof date.toDate === 'function') {
      // Firestore Timestamp with toDate method
      dateObj = date.toDate();
    } else if (date?._seconds) {
      // Alternative Firestore Timestamp format
      dateObj = new Date(date._seconds * 1000);
    } else {
      return fallback;
    }

    // Check if valid date
    if (!isValid(dateObj)) {
      console.warn('Invalid date:', date);
      return fallback;
    }

    return format(dateObj, formatString, { locale });
  } catch (error) {
    console.error('Date formatting error:', error, date);
    return fallback;
  }
}

/**
 * Convert any date format to Date object
 */
export function toDate(date: any): Date | null {
  try {
    if (!date) return null;

    if (date instanceof Date) {
      return isValid(date) ? date : null;
    }

    if (typeof date === 'string' || typeof date === 'number') {
      const dateObj = new Date(date);
      return isValid(dateObj) ? dateObj : null;
    }

    if (date?.seconds) {
      const dateObj = new Date(date.seconds * 1000);
      return isValid(dateObj) ? dateObj : null;
    }

    if (date?.toDate && typeof date.toDate === 'function') {
      const dateObj = date.toDate();
      return isValid(dateObj) ? dateObj : null;
    }

    if (date?._seconds) {
      const dateObj = new Date(date._seconds * 1000);
      return isValid(dateObj) ? dateObj : null;
    }

    return null;
  } catch (error) {
    console.error('Date conversion error:', error, date);
    return null;
  }
}

/**
 * Check if date is valid
 */
export function isValidDate(date: any): boolean {
  const dateObj = toDate(date);
  return dateObj !== null && isValid(dateObj);
}

/**
 * Format date range
 */
export function formatDateRange(
  startDate: any,
  endDate: any,
  formatString: string = 'dd MMM yyyy',
  options?: {
    locale?: typeof th | typeof enUS;
    separator?: string;
    fallback?: string;
  }
): string {
  const { separator = ' - ', fallback = '-' } = options || {};

  const start = safeFormatDate(startDate, formatString, options);
  const end = safeFormatDate(endDate, formatString, options);

  if (start === fallback || end === fallback) {
    return fallback;
  }

  return `${start}${separator}${end}`;
}

/**
 * Calculate days between two dates
 */
export function calculateDaysBetween(startDate: any, endDate: any): number {
  try {
    const start = toDate(startDate);
    const end = toDate(endDate);

    if (!start || !end) return 0;

    // Reset time to start of day
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // +1 to include both start and end date
    return diffDays + 1;
  } catch (error) {
    console.error('Error calculating days:', error);
    return 0;
  }
}

/**
 * Common date formats
 */
export const DATE_FORMATS = {
  DATE_ONLY: 'dd/MM/yyyy',
  DATE_FULL: 'dd MMM yyyy',
  DATE_FULL_THAI: 'dd MMMM yyyy',
  TIME_ONLY: 'HH:mm',
  TIME_WITH_SECONDS: 'HH:mm:ss',
  DATETIME: 'dd/MM/yyyy HH:mm',
  DATETIME_FULL: 'dd MMM yyyy HH:mm',
  DATETIME_FULL_THAI: 'dd MMMM yyyy HH:mm น.',
  DAY_MONTH: 'dd MMM',
  MONTH_YEAR: 'MMM yyyy',
  WEEKDAY: 'EEEE',
  WEEKDAY_DATE: 'EEEE dd MMM yyyy',
} as const;

/**
 * Format shortcuts
 */
export const formatDate = (date: any) => safeFormatDate(date, DATE_FORMATS.DATE_FULL);
export const formatDateTime = (date: any) => safeFormatDate(date, DATE_FORMATS.DATETIME_FULL);
export const formatTime = (date: any) => safeFormatDate(date, DATE_FORMATS.TIME_ONLY);
export const formatDateThai = (date: any) => safeFormatDate(date, DATE_FORMATS.DATE_FULL_THAI);
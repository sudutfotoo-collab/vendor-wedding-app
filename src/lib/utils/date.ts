import { APP_TIMEZONE, getTodayInAppTimezone, getFutureDateInAppTimezone } from '@/lib/config';

/**
 * Helper untuk format tanggal dan mata uang.
 * Seluruh referensi zona waktu merujuk ke APP_TIMEZONE di @/lib/config.
 */

export { getTodayInAppTimezone, getFutureDateInAppTimezone };

// Alias kompatibilitas jika dibutuhkan
export const getMakassarTodayString = getTodayInAppTimezone;
export const getMakassarFutureDateString = getFutureDateInAppTimezone;

/**
 * Format tanggal ramah pengguna berbahasa Indonesia (contoh: "Selasa, 10 Nov 2026").
 */
export function formatIndonesianDate(dateString: string): string {
  if (!dateString) return '-';
  try {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: APP_TIMEZONE,
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(date);
    }
    return dateString;
  } catch {
    return dateString;
  }
}

/**
 * Format mata uang Rupiah (contoh: "Rp 1.500.000").
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

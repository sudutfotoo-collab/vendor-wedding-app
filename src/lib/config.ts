/**
 * Konfigurasi aplikasi terpusat.
 * Seluruh referensi zona waktu aplikasi didefinisikan HANYA di file ini.
 */
export const APP_TIMEZONE = 'Asia/Makassar';

/**
 * Mengembalikan tanggal dalam format 'YYYY-MM-DD' sesuai zona waktu aplikasi (Asia/Makassar).
 * Menerima parameter opsional `now: Date = new Date()` untuk pengujian deterministik instan waktu.
 */
export function getTodayInAppTimezone(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Menghitung tanggal N hari dari `now` dalam format 'YYYY-MM-DD' sesuai zona waktu aplikasi.
 */
export function getFutureDateInAppTimezone(daysAhead = 7, now: Date = new Date()): string {
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(future);
}


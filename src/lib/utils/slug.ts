/**
 * Menghasilkan slug URL yang bersih dari nama usaha.
 * Contoh: "Lestari Wedding & MUA" -> "lestari-wedding-mua"
 */
export function generateSlug(nama: string): string {
  const clean = nama
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Hapus diakritik
    .replace(/[^a-z0-9]+/g, '-')     // Ganti karakter non-alfanumerik dengan -
    .replace(/^-+|-+$/g, '');        // Hapus strip di awal/akhir

  return clean || 'usaha';
}

/**
 * Menghasilkan akhiran acak 4 karakter (huruf/angka) untuk fallback bentrok slug.
 */
export function generateRandomSuffix(length = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


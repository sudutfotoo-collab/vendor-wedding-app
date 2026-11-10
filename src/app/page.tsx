import { createClient } from '@/lib/supabase/server';

export const instant = false;

export default async function Home() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let isConnected = false;
  let statusMessage = '';
  let details = '';

  // 1. Validasi variabel lingkungan
  if (
    !supabaseUrl ||
    !supabaseKey ||
    supabaseUrl === 'your-supabase-url' ||
    supabaseKey === 'your-publishable-key' ||
    supabaseKey === 'your-anon-key'
  ) {
    isConnected = false;
    statusMessage = 'Belum Dikonfigurasi';
    details =
      'NEXT_PUBLIC_SUPABASE_URL atau NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diisi di .env.local';
  } else {
    try {
      const supabase = await createClient();

      // 2. Kirim request ke PostgREST Supabase.
      // Melakukan request ke endpoint PostgREST untuk memastikan URL valid dan API Key diterima.
      const { error } = await supabase
        .from('_connection_test')
        .select('*')
        .limit(1);

      if (error) {
        // Jika error kode 42P01 (relation does not exist) atau PGRST205 (table not found in schema cache),
        // ini menandakan autentikasi API Key berhasil diverifikasi oleh Supabase,
        // URL valid, dan PostgREST merespons dengan benar.
        if (
          error.code === '42P01' ||
          error.code === 'PGRST205' ||
          error.message.toLowerCase().includes('does not exist') ||
          error.message.toLowerCase().includes('schema cache')
        ) {
          isConnected = true;
          statusMessage = 'Terhubung';
          details =
            'Berhasil tersambung ke project Supabase (Autentikasi & URL valid).';
        } else {
          // Jika key salah (misal 401 Unauthorized / Invalid API Key),
          // atau error izin lainnya, koneksi gagal.
          isConnected = false;
          statusMessage = 'Gagal Terhubung';
          details = `Error dari Supabase: ${error.message} (kode: ${error.code ?? 'unknown'})`;
        }
      } else {
        isConnected = true;
        statusMessage = 'Terhubung';
        details = 'Berhasil tersambung ke project Supabase.';
      }
    } catch (err: unknown) {
      // Menangkap error jaringan, URL tidak valid / domain tidak ditemukan, dll.
      isConnected = false;
      statusMessage = 'Gagal Terhubung';
      details =
        err instanceof Error
          ? `Error koneksi: ${err.message}`
          : 'Terjadi kesalahan jaringan atau server tidak dapat dihubungi.';
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-sm border border-zinc-200">
        <h1 className="text-xl font-bold tracking-tight text-center mb-6">
          Aplikasi Manajemen Vendor Wedding
        </h1>

        <div
          className={`p-4 rounded-xl border text-center transition-colors ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="text-2xl mb-1">{isConnected ? '🟢' : '🔴'}</div>
          <div className="font-semibold text-lg">{statusMessage}</div>
          <p className="text-xs mt-2 opacity-80 break-words leading-relaxed">
            {details}
          </p>
        </div>

        {isConnected && (
          <div className="mt-6 flex flex-col gap-2">
            <a
              href="/app"
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg text-center transition-colors"
            >
              Buka Aplikasi (/app)
            </a>
            <div className="flex gap-2">
              <a
                href="/masuk"
                className="flex-1 py-2 px-3 border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold rounded-lg text-center transition-colors"
              >
                Masuk
              </a>
              <a
                href="/daftar"
                className="flex-1 py-2 px-3 border border-zinc-300 hover:bg-zinc-100 text-zinc-800 text-xs font-semibold rounded-lg text-center transition-colors"
              >
                Daftar Usaha
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-zinc-100 text-center text-xs text-zinc-500">
          Tahap 1 &amp; 2 Selesai • Tahap 3: Login &amp; Peran
        </div>
      </div>
    </main>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generateSlug, generateRandomSuffix } from '@/lib/utils/slug';

export default function CreateWorkspaceFallback({
  userEmail,
}: {
  userEmail?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [nama, setNama] = useState('');
  const [jenisUsaha, setJenisUsaha] = useState<'mua' | 'fotografer' | 'wo' | 'seserahan'>('mua');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) {
      setErrorMsg('Nama usaha wajib diisi.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const baseSlug = generateSlug(nama);

      // Coba percobaan 1 dengan slug standar
      let rpcRes = await supabase.rpc('create_workspace', {
        p_nama: nama.trim(),
        p_jenis_usaha: jenisUsaha,
        p_slug: baseSlug,
      });

      // Jika bentrok (unique constraint violation / duplicate key), coba percobaan 2 dengan 4 karakter acak
      if (
        rpcRes.error &&
        (rpcRes.error.code === '23505' ||
          rpcRes.error.message.toLowerCase().includes('unique') ||
          rpcRes.error.message.toLowerCase().includes('slug'))
      ) {
        const fallbackSlug = `${baseSlug}-${generateRandomSuffix(4)}`;
        rpcRes = await supabase.rpc('create_workspace', {
          p_nama: nama.trim(),
          p_jenis_usaha: jenisUsaha,
          p_slug: fallbackSlug,
        });
      }

      if (rpcRes.error) {
        if (rpcRes.error.code === '23505') {
          setErrorMsg('Nama atau tautan usaha sudah digunakan. Silakan gunakan variasi nama lain.');
        } else {
          setErrorMsg('Gagal membuat profil usaha. Silakan periksa kembali data Anda.');
        }
        setLoading(false);
        return;
      }

      // Berhasil, refresh halaman /app
      router.refresh();
      window.location.reload();
    } catch {
      setErrorMsg('Terjadi kendala jaringan. Silakan coba beberapa saat lagi.');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/masuk');
    router.refresh();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-sm border border-zinc-200">
        <div className="text-center mb-6">
          <span className="text-3xl">💍</span>
          <h1 className="text-xl font-bold mt-2">Daftarkan Usaha Anda</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Akun Anda ({userEmail || 'Terdaftar'}) belum memiliki profil usaha. Silakan lengkapi data di bawah ini.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Nama Usaha
            </label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Lestari Wedding Organizer"
              required
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Jenis Usaha
            </label>
            <select
              value={jenisUsaha}
              onChange={(e) => setJenisUsaha(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            >
              <option value="mua">Make Up Artist (MUA)</option>
              <option value="fotografer">Fotografer / Dokumentasi</option>
              <option value="wo">Wedding Organizer (WO)</option>
              <option value="seserahan">Mahar &amp; Seserahan</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Menyimpan...' : 'Buat Usaha Sekarang'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-100 text-center">
          <button
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-zinc-800 underline"
          >
            Keluar dari Akun
          </button>
        </div>
      </div>
    </div>
  );
}


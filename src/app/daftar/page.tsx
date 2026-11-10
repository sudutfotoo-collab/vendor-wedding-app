'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { generateSlug, generateRandomSuffix } from '@/lib/utils/slug';

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [namaUsaha, setNamaUsaha] = useState('');
  const [jenisUsaha, setJenisUsaha] = useState<'mua' | 'fotografer' | 'wo' | 'seserahan'>('mua');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email.trim() || !password || !namaUsaha.trim()) {
      setErrorMsg('Semua kolom wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);

    try {
      // 1. Daftarkan akun baru ke Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
          setErrorMsg('Email ini sudah terdaftar. Silakan gunakan email lain atau langsung masuk.');
        } else if (authError.message.toLowerCase().includes('password')) {
          setErrorMsg('Kata sandi terlalu lemah. Gunakan minimal 6 karakter.');
        } else {
          setErrorMsg('Pendaftaran gagal. Silakan periksa kembali email dan kata sandi Anda.');
        }
        setLoading(false);
        return;
      }

      // Jika project Supabase mewajibkan konfirmasi email sebelum login
      if (!authData.session) {
        setInfoMsg(
          'Pendaftaran akun berhasil! Silakan periksa kotak masuk/spam email Anda untuk verifikasi akun sebelum masuk.'
        );
        setLoading(false);
        return;
      }

      // 2. Jika sesi sudah aktif, buat workspace baru via RPC create_workspace
      const baseSlug = generateSlug(namaUsaha);

      let { error: rpcError } = await supabase.rpc('create_workspace', {
        p_nama: namaUsaha.trim(),
        p_jenis_usaha: jenisUsaha,
        p_slug: baseSlug,
      });

      // Jika bentrok slug (unique constraint), tambahkan 4 karakter acak dan coba lagi sekali
      if (
        rpcError &&
        (rpcError.code === '23505' ||
          rpcError.message.toLowerCase().includes('unique') ||
          rpcError.message.toLowerCase().includes('slug'))
      ) {
        const fallbackSlug = `${baseSlug}-${generateRandomSuffix(4)}`;
        const retryRes = await supabase.rpc('create_workspace', {
          p_nama: namaUsaha.trim(),
          p_jenis_usaha: jenisUsaha,
          p_slug: fallbackSlug,
        });
        rpcError = retryRes.error;
      }

      // Jika masih ada error pada workspace, halaman /app memiliki form fallback otomatis
      router.push('/app');
      router.refresh();
      window.location.href = '/app';
    } catch {
      setErrorMsg('Terjadi kendala jaringan saat mendaftar. Silakan coba lagi.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-sm border border-zinc-200">
        <div className="text-center mb-6">
          <span className="text-4xl">💍</span>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Daftar Akun Vendor</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Mulai kelola bisnis wedding Anda lebih rapi dan profesional
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
            {errorMsg}
          </div>
        )}

        {infoMsg && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
            {infoMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Kata Sandi
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
              minLength={6}
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Nama Usaha
            </label>
            <input
              type="text"
              value={namaUsaha}
              onChange={(e) => setNamaUsaha(e.target.value)}
              placeholder="Contoh: Cantika Make Up Artist"
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
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Mendaftarkan Usaha...' : 'Daftar Sekarang'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-100 text-center text-xs text-zinc-600">
          Sudah memiliki akun?{' '}
          <Link href="/masuk" className="font-semibold text-zinc-900 underline hover:text-black">
            Masuk di sini
          </Link>
        </div>
      </div>
    </main>
  );
}


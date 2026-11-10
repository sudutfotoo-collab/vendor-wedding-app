'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('invalid login credentials') ||
          error.message.toLowerCase().includes('invalid credentials')
        ) {
          setErrorMsg('Email atau kata sandi yang Anda masukkan salah.');
        } else if (error.message.toLowerCase().includes('email not confirmed')) {
          setErrorMsg('Email belum dikonfirmasi. Silakan periksa kotak masuk email Anda.');
        } else {
          setErrorMsg('Gagal masuk. Silakan periksa kembali data Anda.');
        }
        setLoading(false);
        return;
      }

      // Berhasil login
      router.push('/app');
      router.refresh();
      window.location.href = '/app';
    } catch {
      setErrorMsg('Terjadi kendala jaringan. Silakan coba beberapa saat lagi.');
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-sm border border-zinc-200">
        <div className="text-center mb-6">
          <span className="text-4xl">💍</span>
          <h1 className="text-2xl font-bold tracking-tight mt-2">Masuk ke Akun</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Kelola jadwal, klien, dan pembayaran vendor wedding Anda
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
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
              placeholder="••••••••"
              required
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-zinc-100 text-center text-xs text-zinc-600">
          Belum memiliki akun?{' '}
          <Link href="/daftar" className="font-semibold text-zinc-900 underline hover:text-black">
            Daftar Usaha Baru
          </Link>
        </div>
      </div>
    </main>
  );
}


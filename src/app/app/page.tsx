import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentWorkspace, getCurrentRole } from '@/lib/auth';
import CreateWorkspaceFallback from '@/components/CreateWorkspaceFallback';
import SignOutButton from '@/components/SignOutButton';

export const instant = false;

export default async function AppPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/masuk');
  }

  const workspace = await getCurrentWorkspace();
  const role = await getCurrentRole();

  // Jika user sudah terdaftar tapi belum punya workspace (misal create_workspace gagal saat signup),
  // tampilkan form pembuatan workspace, BUKAN error.
  if (!workspace) {
    return <CreateWorkspaceFallback userEmail={user.email} />;
  }

  const jenisUsahaLabel: Record<string, string> = {
    mua: 'Make Up Artist (MUA)',
    fotografer: 'Fotografer / Dokumentasi',
    wo: 'Wedding Organizer (WO)',
    seserahan: 'Mahar & Seserahan',
  };

  const roleBadge: Record<string, { label: string; color: string }> = {
    owner: { label: 'Pemilik (Owner)', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    staff: { label: 'Staf', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    crew: { label: 'Kru Lapangan', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  };

  const currentRoleInfo = role
    ? roleBadge[role] ?? { label: role, color: 'bg-zinc-100 text-zinc-800 border-zinc-200' }
    : { label: 'Anggota', color: 'bg-zinc-100 text-zinc-800 border-zinc-200' };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-zinc-50 text-zinc-900">
      <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-sm border border-zinc-200">
        <div className="text-center pb-4 border-b border-zinc-100">
          <span className="text-4xl">🎉</span>
          <h1 className="text-xl font-bold mt-2">{workspace.nama}</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {jenisUsahaLabel[workspace.jenis_usaha] ?? workspace.jenis_usaha}
          </p>
        </div>

        <div className="py-4 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Tautan Usaha (Slug):</span>
            <span className="font-mono bg-zinc-100 px-2 py-0.5 rounded text-zinc-700">
              {workspace.slug}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Peran Anda:</span>
            <span className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${currentRoleInfo.color}`}>
              {currentRoleInfo.label}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Email Akun:</span>
            <span className="font-medium text-zinc-700 truncate max-w-[200px]">
              {user.email}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-zinc-100 space-y-3">
          <div className="p-3 bg-zinc-50 rounded-xl text-center text-xs text-zinc-600">
            ✅ Autentikasi dan isolasi workspace aktif untuk akun ini.
          </div>

          <SignOutButton />
        </div>
      </div>
    </main>
  );
}

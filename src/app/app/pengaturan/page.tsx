import { requireRole } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

export const instant = false;

export default async function PengaturanPage() {
  await requireRole(['owner']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          Pengaturan Usaha
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Profil vendor, kapasitas harian booking, dan preferensi notifikasi
        </p>
      </div>

      <EmptyState
        title="Pengaturan Profil Segera Hadir"
        description="Kelola nama usaha, paket default, dan batasan kapasitas acara per hari."
      />
    </div>
  );
}


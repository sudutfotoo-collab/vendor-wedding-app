import { requireRole } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

export const instant = false;

export default async function KlienPage() {
  await requireRole(['owner', 'staff']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          Klien Pengantin
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Daftar kontak calon pengantin, riwayat acara, dan catatan preferensi
        </p>
      </div>

      <EmptyState
        title="Modul Klien Segera Hadir"
        description="Fitur daftar pencarian klien, tambah kontak calon pengantin, dan riwayat pesanan akan aktif pada Tahap 5."
      />
    </div>
  );
}


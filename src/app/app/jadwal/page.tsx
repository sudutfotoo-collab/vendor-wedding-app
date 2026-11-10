import { requireRole } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

export const instant = false;

export default async function JadwalPage() {
  await requireRole(['owner', 'staff', 'crew']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          Jadwal Saya
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Daftar jadwal acara pernikahan yang ditugaskan kepada Anda
        </p>
      </div>

      <EmptyState
        title="Belum Ada Jadwal Penugasan"
        description="Saat pemilik atau staf menugaskan Anda ke acara pernikahan, jadwal Anda akan muncul otomatis di sini."
      />
    </div>
  );
}


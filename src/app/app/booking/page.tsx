import { requireRole } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

export const instant = false;

export default async function BookingPage() {
  await requireRole(['owner', 'staff']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          Booking &amp; Jadwal Acara
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Kelola reservasi tanggal pernikahan, paket layanan, dan jadwal fitting
        </p>
      </div>

      <EmptyState
        title="Modul Booking Segera Hadir"
        description="Fitur kalender booking bulanan, detail acara, dan penugasan kru akan tersedia pada Tahap 5."
      />
    </div>
  );
}


import { requireRole } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

export const instant = false;

export default async function TagihanPage() {
  await requireRole(['owner', 'staff']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          Tagihan &amp; Pembayaran DP
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Pantau riwayat pembayaran uang muka (DP), cicilan, dan pelunasan klien
        </p>
      </div>

      <EmptyState
        title="Modul Keuangan Segera Hadir"
        description="Fitur pencatatan kwitansi DP, termin cicilan, dan status pelunasan otomatis."
      />
    </div>
  );
}


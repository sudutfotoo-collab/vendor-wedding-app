import { requireRole } from '@/lib/auth';
import { EmptyState } from '@/components/ui/EmptyState';

export const instant = false;

export default async function TimPage() {
  await requireRole(['owner']);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
          Tim &amp; Kru
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 mt-1">
          Undang staf dan kru lapangan, atur peran hak akses di workspace
        </p>
      </div>

      <EmptyState
        title="Modul Manajemen Tim Segera Hadir"
        description="Fitur kode undangan kru, daftar asisten perias / fotografer lapangan, dan pembagian tugas."
      />
    </div>
  );
}


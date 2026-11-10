import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import CreateWorkspaceFallback from '@/components/CreateWorkspaceFallback';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { getTodayInAppTimezone, getFutureDateInAppTimezone } from '@/lib/config';
import {
  formatIndonesianDate,
  formatRupiah,
} from '@/lib/utils/date';

export const instant = false;

export default async function DashboardPage() {
  const authInfo = await requireRole(['owner', 'staff', 'crew']);
  const { user, workspace, role } = authInfo;

  if (!workspace || !role) {
    return <CreateWorkspaceFallback userEmail={user.email} />;
  }

  const supabase = await createClient();

  // Tanggal berdasarkan konfigurasi zona waktu aplikasi (APP_TIMEZONE)
  const today = getTodayInAppTimezone();
  const next7Days = getFutureDateInAppTimezone(7);

  // =========================================================================
  // DASHBOARD KHUSUS CREW
  // =========================================================================
  if (role === 'crew') {
    // Ambil booking yang ditugaskan ke kru ini
    const { data: assignments } = await supabase
      .from('booking_assignments')
      .select('id, tugas, bookings(id, tanggal_acara, lokasi, status, total_harga, packages(nama))')
      .eq('workspace_id', workspace.id);

    const myAssignments = assignments || [];

    return (
      <div className="space-y-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
            Kru Lapangan
          </span>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 mt-2">
            Jadwal Tugas Saya
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Daftar acara pernikahan di mana Anda bertugas hari ini dan yang akan datang.
          </p>
        </div>

        {myAssignments.length === 0 ? (
          <EmptyState
            title="Belum Ada Tugas Acara"
            description="Anda belum memiliki tugas acara yang dijadwalkan. Hubungi pemilik atau koordinator bila Anda ditugaskan ke acara pernikahan."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myAssignments.map((item: any) => {
              const b = item.bookings;
              return (
                <Card key={item.id} padding="md" className="space-y-2">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700">
                      {item.tugas || 'Kru Lapangan'}
                    </span>
                    <span className="text-xs font-bold text-rose-600">
                      {formatIndonesianDate(b?.tanggal_acara)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">
                      {b?.packages?.nama || 'Layanan Pernikahan'}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      📍 {b?.lokasi || 'Lokasi belum ditentukan'}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // DASHBOARD OWNER & STAFF
  // =========================================================================

  // 1. KPI: Jumlah booking berstatus 'baru'
  const { count: countBaru } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .eq('status', 'baru');

  // 2. KPI: Acara 7 hari ke depan (non-batal)
  const { count: count7Hari } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)
    .neq('status', 'batal')
    .gte('tanggal_acara', today)
    .lte('tanggal_acara', next7Days);

  // 3. KPI: Total belum lunas
  // CATATAN PERFORMA: Pada dataset besar di masa mendatang, agregasi ini sebaiknya dipindahkan
  // ke fungsi SQL / view di PostgreSQL agar kalkulasi dilakukan langsung di sisi database.
  const { data: bookingsData } = await supabase
    .from('bookings')
    .select('id, total_harga')
    .eq('workspace_id', workspace.id)
    .neq('status', 'batal');

  const { data: paymentsData } = await supabase
    .from('payments')
    .select('booking_id, jumlah')
    .eq('workspace_id', workspace.id);

  // Peta total pembayaran per booking
  const paymentMap: Record<string, number> = {};
  (paymentsData || []).forEach((p) => {
    paymentMap[p.booking_id] = (paymentMap[p.booking_id] || 0) + Number(p.jumlah || 0);
  });

  // Hitung sisa piutang (tidak boleh negatif per booking)
  let totalBelumLunas = 0;
  (bookingsData || []).forEach((b) => {
    const totalHarga = Number(b.total_harga || 0);
    const totalBayar = paymentMap[b.id] || 0;
    const sisa = Math.max(0, totalHarga - totalBayar);
    totalBelumLunas += sisa;
  });

  // 4. Jadwal Hari Ini (tanggal_acara = today, non-batal)
  const { data: jadwalHariIni } = await supabase
    .from('bookings')
    .select('id, tanggal_acara, lokasi, status, total_harga, clients(nama, no_hp), packages(nama)')
    .eq('workspace_id', workspace.id)
    .eq('tanggal_acara', today)
    .neq('status', 'batal')
    .order('created_at', { ascending: false });

  const eventsToday = jadwalHariIni || [];

  return (
    <div className="space-y-6">
      {/* Header Sambutan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900">
            Halo, {workspace.nama}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Ringkasan operasional dan agenda pernikahan hari ini ({formatIndonesianDate(today)} WITA)
          </p>
        </div>
      </div>

      {/* 3 Kartu Ringkasan (KPI) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Kartu 1: Booking Baru */}
        <Card padding="md" className="border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Booking Baru
            </span>
            <span className="p-2 rounded-lg bg-amber-50 text-amber-600 text-sm">
              ✨
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
              {countBaru ?? 0}
            </span>
            <span className="text-xs text-zinc-500">perlu fitting/konfirmasi</span>
          </div>
        </Card>

        {/* Kartu 2: Acara 7 Hari ke Depan */}
        <Card padding="md" className="border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Acara 7 Hari Ke Depan
            </span>
            <span className="p-2 rounded-lg bg-rose-50 text-rose-600 text-sm">
              📅
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-zinc-900">
              {count7Hari ?? 0}
            </span>
            <span className="text-xs text-zinc-500">acara terjadwal</span>
          </div>
        </Card>

        {/* Kartu 3: Total Belum Lunas */}
        <Card padding="md" className="border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Belum Lunas
            </span>
            <span className="p-2 rounded-lg bg-emerald-50 text-emerald-600 text-sm">
              💰
            </span>
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-extrabold text-zinc-900 break-words">
              {formatRupiah(totalBelumLunas)}
            </span>
            <p className="text-[11px] text-zinc-500 mt-0.5">Sisa tagihan aktif klien</p>
          </div>
        </Card>
      </div>

      {/* Bagian Jadwal Hari Ini */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold text-zinc-900 flex items-center gap-2">
            <span>Jadwal Hari Ini</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {eventsToday.length}
            </span>
          </h2>
        </div>

        {eventsToday.length === 0 ? (
          <EmptyState
            title="Tidak Ada Acara Hari Ini"
            description="Belum ada jadwal acara pernikahan untuk hari ini. Waktu yang tepat untuk merencanakan fitting, mengelola klien, atau menyiapkan agenda besok."
          />
        ) : (
          <div className="space-y-2">
            {eventsToday.map((event: any) => {
              const client = Array.isArray(event.clients) ? event.clients[0] : event.clients;
              const pkg = Array.isArray(event.packages) ? event.packages[0] : event.packages;

              return (
                <Card key={event.id} padding="md" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-300 transition-colors">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-zinc-900">
                        {client?.nama || 'Klien Tanpa Nama'}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-medium">
                        {pkg?.nama || 'Paket Layanan'}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">
                      📍 {event.lokasi || 'Lokasi belum diisi'} • 📞 {client?.no_hp || '-'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-semibold text-zinc-700">
                      {formatRupiah(Number(event.total_harga || 0))}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

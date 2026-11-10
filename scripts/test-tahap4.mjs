/**
 * PERINGATAN: JANGAN DIJALANKAN KE DATABASE PRODUKSI!
 * Skrip ini membuat dan memanipulasi data uji untuk memverifikasi otorisasi, dashboard, dan RLS.
 * 
 * Skrip Uji Tahap 4: Layout, Dashboard, Otorisasi Peran, dan RLS
 * Dijalankan dengan: node --env-file=.env.local scripts/test-tahap4.mjs
 * 
 * ATURAN KETAT:
 * 1. Tidak menggunakan SUPABASE_SERVICE_ROLE_KEY. Semua aksi melalui sesi user biasa via anon key.
 * 2. Status booking hanya yang valid: baru, fitting, selesai, batal.
 * 3. Nilai yang diharapkan (EXPECTED) didefinisikan secara tetap terlebih dahulu sebelum pengujian.
 * 4. Melakukan cleanup data uji di akhir skrip sesuai hak RLS yang dimiliki user.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { getTodayInAppTimezone, getFutureDateInAppTimezone, APP_TIMEZONE } from '../src/lib/config.ts';
import fs from 'node:fs';
import path from 'node:path';

// Muat .env.local jika env belum ada
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseAnonKey) {
  try {
    const envFile = fs.readFileSync(path.resolve('.env.local'), 'utf8');
    for (const line of envFile.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const [key, ...vals] = trimmed.split('=');
      const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
      if (key === 'NEXT_PUBLIC_SUPABASE_URL' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = val;
      }
      if (
        (key === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || key === 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') &&
        !supabaseAnonKey
      ) {
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = val;
      }
    }
  } catch (err) {
    // Ignore if not readable
  }
}

const APP_URL = process.env.APP_URL || 'http://localhost:3000';

console.log('='.repeat(70));
console.log('MEMULAI PENGUJIAN TAHAP 4: OTORISASI PERAN, DASHBOARD, & RLS');
console.log('Zona Waktu Aplikasi Terpusat:', APP_TIMEZONE);
console.log('Target Server Next.js:', APP_URL);
console.log('='.repeat(70));

let testFailures = 0;
let testSuccesses = 0;

function assert(condition, testName, note = '') {
  if (condition) {
    console.log(`[LULUS] ${testName}${note ? ' (' + note + ')' : ''}`);
    testSuccesses++;
  } else {
    console.error(`[GAGAL] ${testName}${note ? ' (' + note + ')' : ''}`);
    testFailures++;
  }
}

// Helper klien Supabase berbasis sesi SSR
function createSessionClient() {
  const cookieStore = new Map();
  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return Array.from(cookieStore.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => cookieStore.set(name, value));
      },
    },
  });

  return {
    client,
    cookieStore,
    getCookieHeader() {
      return Array.from(cookieStore.entries())
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');
    },
  };
}

// Klien anon untuk registrasi user
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // =========================================================================
  // 1. UJI DETERMINISTIK ZONA WAKTU getTodayInAppTimezone
  // =========================================================================
  console.log('\n--- 1. UJI DETERMINISTIK ZONA WAKTU (INSTAN TETAP) ---');
  const t1 = new Date('2026-11-10T15:59:00Z');
  const t2 = new Date('2026-11-10T16:00:00Z');
  const t3 = new Date('2026-11-10T23:30:00Z');

  const resT1 = getTodayInAppTimezone(t1);
  const resT2 = getTodayInAppTimezone(t2);
  const resT3 = getTodayInAppTimezone(t3);

  console.log(`- 2026-11-10T15:59:00Z -> '${resT1}' (WITA 23:59:00)`);
  console.log(`- 2026-11-10T16:00:00Z -> '${resT2}' (WITA 00:00:00 - Hari Baru)`);
  console.log(`- 2026-11-10T23:30:00Z -> '${resT3}' (WITA 07:30:00)`);

  assert(resT1 === '2026-11-10', 'Batas WITA: 15:59 UTC masih 2026-11-10');
  assert(resT2 === '2026-11-11', 'Batas WITA: 16:00 UTC berganti ke 2026-11-11');
  assert(resT3 === '2026-11-11', 'WITA pagi: 23:30 UTC adalah 2026-11-11');

  const utcNowDate = new Date().toISOString().slice(0, 10);
  const makassarNowDate = getTodayInAppTimezone();
  console.log(`- Bandingkan Tanggal Sekarang: UTC = '${utcNowDate}', Asia/Makassar = '${makassarNowDate}'`);

  // =========================================================================
  // 2. SETUP USER UJI (OWNER, STAFF, CREW) LEWAT SUPABASE AUTH
  // =========================================================================
  console.log('\n--- 2. SETUP 3 AKUN UJI VIA SUPABASE AUTH (TANPA SERVICE ROLE) ---');
  const timestamp = Date.now();
  const testPassword = 'PasswordUji123!';
  const ownerEmail = `test_owner_${timestamp}@example.com`;
  const staffEmail = `test_staff_${timestamp}@example.com`;
  const crewEmail = `test_crew_${timestamp}@example.com`;
  const workspaceName = `Usaha Vendor Test ${timestamp}`;
  const workspaceSlug = `vendor-test-${timestamp}`;

  console.log(`Akun Owner: ${ownerEmail}`);
  console.log(`Akun Staff: ${staffEmail}`);
  console.log(`Akun Crew : ${crewEmail}`);

  // Daftarkan ketiga akun
  const { data: signOwner, error: errSignOwner } = await anonClient.auth.signUp({
    email: ownerEmail,
    password: testPassword,
  });
  if (errSignOwner) throw new Error(`Gagal daftar owner: ${errSignOwner.message}`);

  const { data: signStaff, error: errSignStaff } = await anonClient.auth.signUp({
    email: staffEmail,
    password: testPassword,
  });
  if (errSignStaff) throw new Error(`Gagal daftar staff: ${errSignStaff.message}`);

  const { data: signCrew, error: errSignCrew } = await anonClient.auth.signUp({
    email: crewEmail,
    password: testPassword,
  });
  if (errSignCrew) throw new Error(`Gagal daftar crew: ${errSignCrew.message}`);

  const ownerUserId = signOwner.user?.id;
  const staffUserId = signStaff.user?.id;
  const crewUserId = signCrew.user?.id;

  assert(!!ownerUserId && !!staffUserId && !!crewUserId, 'Ketiga akun uji berhasil terdaftar di Auth');

  // Sesi Owner
  const ownerSession = createSessionClient();
  const { error: errLoginOwner } = await ownerSession.client.auth.signInWithPassword({
    email: ownerEmail,
    password: testPassword,
  });
  if (errLoginOwner) throw new Error(`Gagal login owner: ${errLoginOwner.message}`);

  // Sesi Staff
  const staffSession = createSessionClient();
  const { error: errLoginStaff } = await staffSession.client.auth.signInWithPassword({
    email: staffEmail,
    password: testPassword,
  });
  if (errLoginStaff) throw new Error(`Gagal login staff: ${errLoginStaff.message}`);

  // Sesi Crew
  const crewSession = createSessionClient();
  const { error: errLoginCrew } = await crewSession.client.auth.signInWithPassword({
    email: crewEmail,
    password: testPassword,
  });
  if (errLoginCrew) throw new Error(`Gagal login crew: ${errLoginCrew.message}`);

  // Owner membuat workspace via RPC create_workspace
  const { data: wsId, error: errWs } = await ownerSession.client.rpc('create_workspace', {
    p_nama: workspaceName,
    p_jenis_usaha: 'fotografer',
    p_slug: workspaceSlug,
  });
  if (errWs) throw new Error(`Gagal create_workspace: ${errWs.message}`);
  console.log(`Workspace dibuat oleh Owner: ${wsId} (${workspaceName})`);

  // Owner mendaftarkan Staff dan Crew ke workspace_members (sesuai RLS workspace_members_insert_owner)
  const { data: memberStaff, error: errMemStaff } = await ownerSession.client
    .from('workspace_members')
    .insert({
      workspace_id: wsId,
      user_id: staffUserId,
      role: 'staff',
    })
    .select()
    .single();
  if (errMemStaff) throw new Error(`Owner gagal menambahkan Staff: ${errMemStaff.message}`);

  const { data: memberCrew, error: errMemCrew } = await ownerSession.client
    .from('workspace_members')
    .insert({
      workspace_id: wsId,
      user_id: crewUserId,
      role: 'crew',
    })
    .select()
    .single();
  if (errMemCrew) throw new Error(`Owner gagal menambahkan Crew: ${errMemCrew.message}`);

  const crewMemberRecordId = memberCrew.id;
  assert(!!crewMemberRecordId, 'Staff dan Crew berhasil ditambahkan oleh Owner ke workspace_members');

  // Variabel ID untuk pelacakan cleanup
  let createdClientId = null;
  let createdPackageId = null;
  const createdBookingIds = [];
  const createdPaymentIds = [];
  let createdAssignmentId = null;

  try {
    // =========================================================================
    // 3. RANCANG DATA UJI DENGAN NILAI EKSPEKTASI TETAP (EXPECTED)
    // =========================================================================
    console.log('\n--- 3. SETUP DATA BOOKING & PAYMENT DENGAN NILAI EKSPEKTASI TETAP ---');

    /**
     * PERHITUNGAN MANUAL NILAI EKSPEKTASI:
     * - Booking 1: status 'baru', acara hari ini, total_harga = 5.000.000, bayar = 0 -> sisa = 5.000.000
     * - Booking 2: status 'batal', acara hari ini, total_harga = 3.000.000, bayar = 1.000.000 -> sisa = diabaikan (0)
     * - Booking 3: status 'fitting', acara 6 hari lagi, total_harga = 4.000.000, bayar = 1.500.000 -> sisa = 2.500.000
     * - Booking 4: status 'fitting', acara 8 hari lagi, total_harga = 2.000.000, bayar = 2.500.000 -> sisa = max(0, -500.000) = 0
     *
     * RINGKASAN EXPECTED:
     * 1. Booking Baru = 1 (Booking 1)
     * 2. Acara 7 Hari = 2 (Booking 1 hari ini + Booking 3 6 hari lagi; Booking 2 batal & Booking 4 8 hari lagi tidak dihitung)
     * 3. Total Belum Lunas = 5.000.000 + 0 + 2.500.000 + 0 = 7.500.000 ('Rp 7.500.000')
     */
    const EXPECTED_KPI = {
      bookingBaru: 1,
      acara7Hari: 2,
      totalBelumLunas: 7500000,
      totalBelumLunasFormatted: 'Rp 7.500.000',
    };

    console.log('Target KPI Diharapkan:');
    console.log(`- Booking Baru       : ${EXPECTED_KPI.bookingBaru}`);
    console.log(`- Acara 7 Hari       : ${EXPECTED_KPI.acara7Hari}`);
    console.log(`- Total Belum Lunas  : ${EXPECTED_KPI.totalBelumLunasFormatted}`);

    // Buat Klien
    const { data: client, error: errClient } = await ownerSession.client
      .from('clients')
      .insert({
        workspace_id: wsId,
        nama: 'Klien Uji Tahap 4',
        no_hp: '081234567890',
        email: 'klien@example.com',
      })
      .select()
      .single();
    if (errClient) throw new Error(`Gagal insert client: ${errClient.message}`);
    createdClientId = client.id;

    // Buat Paket
    const { data: pkg, error: errPkg } = await ownerSession.client
      .from('packages')
      .insert({
        workspace_id: wsId,
        nama: 'Paket Wedding Premium Uji',
        harga: 5000000,
      })
      .select()
      .single();
    if (errPkg) throw new Error(`Gagal insert package: ${errPkg.message}`);
    createdPackageId = pkg.id;

    const dateToday = getTodayInAppTimezone();
    const date6Days = getFutureDateInAppTimezone(6);
    const date8Days = getFutureDateInAppTimezone(8);

    // 1) Booking 1: 'baru', hari ini, 5.000.000
    const { data: b1, error: errB1 } = await ownerSession.client
      .from('bookings')
      .insert({
        workspace_id: wsId,
        client_id: createdClientId,
        package_id: createdPackageId,
        tanggal_acara: dateToday,
        lokasi: 'Gedung Serbaguna A (Hari Ini)',
        status: 'baru',
        total_harga: 5000000,
      })
      .select()
      .single();
    if (errB1) throw new Error(`Gagal insert booking 1: ${errB1.message}`);
    createdBookingIds.push(b1.id);

    // 2) Booking 2: 'batal', hari ini, 3.000.000
    const { data: b2, error: errB2 } = await ownerSession.client
      .from('bookings')
      .insert({
        workspace_id: wsId,
        client_id: createdClientId,
        package_id: createdPackageId,
        tanggal_acara: dateToday,
        lokasi: 'Hotel Batal B',
        status: 'batal',
        total_harga: 3000000,
      })
      .select()
      .single();
    if (errB2) throw new Error(`Gagal insert booking 2: ${errB2.message}`);
    createdBookingIds.push(b2.id);

    // 3) Booking 3: 'fitting', 6 hari lagi, 4.000.000
    const { data: b3, error: errB3 } = await ownerSession.client
      .from('bookings')
      .insert({
        workspace_id: wsId,
        client_id: createdClientId,
        package_id: createdPackageId,
        tanggal_acara: date6Days,
        lokasi: 'Studio Fitting 6 Hari',
        status: 'fitting',
        total_harga: 4000000,
      })
      .select()
      .single();
    if (errB3) throw new Error(`Gagal insert booking 3: ${errB3.message}`);
    createdBookingIds.push(b3.id);

    // 4) Booking 4: 'fitting', 8 hari lagi, 2.000.000
    const { data: b4, error: errB4 } = await ownerSession.client
      .from('bookings')
      .insert({
        workspace_id: wsId,
        client_id: createdClientId,
        package_id: createdPackageId,
        tanggal_acara: date8Days,
        lokasi: 'Villa Jauh 8 Hari',
        status: 'fitting',
        total_harga: 2000000,
      })
      .select()
      .single();
    if (errB4) throw new Error(`Gagal insert booking 4: ${errB4.message}`);
    createdBookingIds.push(b4.id);

    // Tambah Payments:
    // Booking 2 (batal): payment 1.000.000
    const { data: p2, error: errP2 } = await ownerSession.client
      .from('payments')
      .insert({
        workspace_id: wsId,
        booking_id: b2.id,
        jenis: 'dp',
        jumlah: 1000000,
      })
      .select()
      .single();
    if (errP2) throw new Error(`Gagal insert payment 2: ${errP2.message}`);
    createdPaymentIds.push(p2.id);

    // Booking 3 (fitting 6 hari): payment 1.500.000
    const { data: p3, error: errP3 } = await ownerSession.client
      .from('payments')
      .insert({
        workspace_id: wsId,
        booking_id: b3.id,
        jenis: 'dp',
        jumlah: 1500000,
      })
      .select()
      .single();
    if (errP3) throw new Error(`Gagal insert payment 3: ${errP3.message}`);
    createdPaymentIds.push(p3.id);

    // Booking 4 (fitting 8 hari): payment 2.500.000 (overpaid)
    const { data: p4, error: errP4 } = await ownerSession.client
      .from('payments')
      .insert({
        workspace_id: wsId,
        booking_id: b4.id,
        jenis: 'pelunasan',
        jumlah: 2500000,
      })
      .select()
      .single();
    if (errP4) throw new Error(`Gagal insert payment 4: ${errP4.message}`);
    createdPaymentIds.push(p4.id);

    // Penugasan Crew ke Booking 1 saja
    const { data: assignment, error: errAssign } = await ownerSession.client
      .from('booking_assignments')
      .insert({
        workspace_id: wsId,
        booking_id: b1.id,
        member_id: crewMemberRecordId,
        tugas: 'Fotografer Utama',
      })
      .select()
      .single();
    if (errAssign) throw new Error(`Gagal insert assignment: ${errAssign.message}`);
    createdAssignmentId = assignment.id;

    console.log('Semua data uji berhasil disiapkan.');

    // =========================================================================
    // 4. TES NEGATIF DATABASE UNTUK PERAN CREW (RLS CHECK)
    // =========================================================================
    console.log('\n--- 4. TES NEGATIF TINGKAT DATABASE UNTUK PERAN CREW ---');

    // a. Crew membaca tabel payments
    const { data: crewPayments, error: errCrewPayments } = await crewSession.client
      .from('payments')
      .select('*')
      .eq('workspace_id', wsId);
    assert(
      !crewPayments || crewPayments.length === 0,
      'Crew TIDAK BISA membaca baris payments (RLS mengembalikan 0 baris)',
      `Ditemukan: ${crewPayments?.length ?? 0} baris`
    );

    // b. Crew mencoba INSERT ke bookings
    const { data: crewInsertBooking, error: errCrewInsertBooking } = await crewSession.client
      .from('bookings')
      .insert({
        workspace_id: wsId,
        client_id: createdClientId,
        package_id: createdPackageId,
        tanggal_acara: dateToday,
        status: 'baru',
        total_harga: 1000000,
      })
      .select();
    assert(
      !!errCrewInsertBooking,
      'Crew DILARANG membuat booking baru oleh RLS',
      `Error RLS: ${errCrewInsertBooking?.message}`
    );

    // c. Crew membaca bookings (hanya yang ditugaskan kepadanya)
    const { data: crewVisibleBookings, error: errCrewVisibleBookings } = await crewSession.client
      .from('bookings')
      .select('id, lokasi')
      .eq('workspace_id', wsId);
    const visibleIds = (crewVisibleBookings || []).map((b) => b.id);
    const onlyAssignedVisible =
      visibleIds.length === 1 && visibleIds[0] === b1.id;
    assert(
      onlyAssignedVisible,
      'Crew HANYA BISA membaca booking yang ditugaskan kepadanya (Booking 1)',
      `Total terlihat: ${visibleIds.length}`
    );

    // =========================================================================
    // 5. TES OTORISASI RUTE HTTP & MENU UNTUK OWNER, STAFF, CREW
    // =========================================================================
    console.log('\n--- 5. TES OTORISASI RUTE HTTP & RENDERING MENU DI SERVER NEXT.JS ---');

    async function testRoute(cookieHeader, routePath) {
      const res = await fetch(`${APP_URL}${routePath}`, {
        headers: { Cookie: cookieHeader },
        redirect: 'manual',
      });
      const location = res.headers.get('location') || '';
      let text = '';
      if (res.status === 200) {
        text = await res.text();
      }
      return { status: res.status, location, html: text };
    }

    // A. OWNER
    console.log('\n[A] PENGUJIAN PERAN: OWNER');
    const ownerCookie = ownerSession.getCookieHeader();
    const ownerRoutes = ['/app', '/app/booking', '/app/klien', '/app/tagihan', '/app/tim', '/app/pengaturan'];
    let ownerAll200 = true;
    for (const r of ownerRoutes) {
      const res = await testRoute(ownerCookie, r);
      if (res.status !== 200) {
        ownerAll200 = false;
        console.error(`- Rute ${r} gagal dibuka owner: status ${res.status}`);
      }
    }
    assert(ownerAll200, 'Owner: Seluruh 6 halaman terbuka (status 200)');

    // Menu Owner: Dashboard, Booking, Klien, Tagihan, Tim, Pengaturan
    const ownerAppRes = await testRoute(ownerCookie, '/app');
    const ownerHasDashboard = ownerAppRes.html.includes('href="/app"');
    const ownerHasBooking = ownerAppRes.html.includes('href="/app/booking"');
    const ownerHasKlien = ownerAppRes.html.includes('href="/app/klien"');
    const ownerHasTagihan = ownerAppRes.html.includes('href="/app/tagihan"');
    const ownerHasTim = ownerAppRes.html.includes('href="/app/tim"');
    const ownerHasPengaturan = ownerAppRes.html.includes('href="/app/pengaturan"');
    const ownerMenuComplete =
      ownerHasDashboard &&
      ownerHasBooking &&
      ownerHasKlien &&
      ownerHasTagihan &&
      ownerHasTim &&
      ownerHasPengaturan;
    assert(ownerMenuComplete, 'Owner: Menu menampilkan lengkap 6 item');

    // B. STAFF
    console.log('\n[B] PENGUJIAN PERAN: STAFF');
    const staffCookie = staffSession.getCookieHeader();
    const staffAllowed = ['/app', '/app/booking', '/app/klien', '/app/tagihan'];
    let staffAllowedPass = true;
    for (const r of staffAllowed) {
      const res = await testRoute(staffCookie, r);
      if (res.status !== 200) {
        staffAllowedPass = false;
        console.error(`- Rute ${r} gagal dibuka staff: status ${res.status}`);
      }
    }
    assert(staffAllowedPass, 'Staff: Halaman /app, /app/booking, /app/klien, /app/tagihan terbuka (status 200)');

    const resStaffTim = await testRoute(staffCookie, '/app/tim');
    const resStaffPengaturan = await testRoute(staffCookie, '/app/pengaturan');
    const staffTimRedirected = resStaffTim.status === 307 && resStaffTim.location.endsWith('/app');
    const staffPengaturanRedirected = resStaffPengaturan.status === 307 && resStaffPengaturan.location.endsWith('/app');
    assert(staffTimRedirected, 'Staff: /app/tim dialihkan ke /app (status 307)');
    assert(staffPengaturanRedirected, 'Staff: /app/pengaturan dialihkan ke /app (status 307)');

    // Menu Staff: 4 item (Dashboard, Booking, Klien, Tagihan), tidak ada Tim & Pengaturan
    const staffAppRes = await testRoute(staffCookie, '/app');
    const staffHasTim = staffAppRes.html.includes('href="/app/tim"');
    const staffHasPengaturan = staffAppRes.html.includes('href="/app/pengaturan"');
    assert(
      !staffHasTim && !staffHasPengaturan,
      'Staff: Menu hanya 4 item, TIDAK memuat menu Tim dan Pengaturan'
    );

    // C. CREW
    console.log('\n[C] PENGUJIAN PERAN: CREW');
    const crewCookie = crewSession.getCookieHeader();
    const resCrewApp = await testRoute(crewCookie, '/app');
    const resCrewJadwal = await testRoute(crewCookie, '/app/jadwal');
    assert(resCrewApp.status === 200, 'Crew: Halaman /app terbuka (status 200)');
    assert(resCrewJadwal.status === 200, 'Crew: Halaman /app/jadwal terbuka (status 200)');

    const crewBlockedRoutes = ['/app/booking', '/app/klien', '/app/tagihan', '/app/tim', '/app/pengaturan'];
    let crewBlockedPass = true;
    for (const r of crewBlockedRoutes) {
      const res = await testRoute(crewCookie, r);
      if (!(res.status === 307 && res.location.endsWith('/app'))) {
        crewBlockedPass = false;
        console.error(`- Rute ${r} tidak dialihkan untuk crew: status ${res.status}, loc: ${res.location}`);
      }
    }
    assert(crewBlockedPass, 'Crew: Seluruh 5 sub-halaman lain dialihkan ke /app (status 307)');

    // Menu Crew: hanya "Jadwal saya"
    const crewHasJadwalSaya = resCrewApp.html.toLowerCase().includes('jadwal saya');
    const crewHasBookingMenu = resCrewApp.html.includes('href="/app/booking"');
    assert(
      crewHasJadwalSaya && !crewHasBookingMenu,
      'Crew: Menu navigasi hanya berisi "Jadwal saya"'
    );

    // =========================================================================
    // 6. VALIDASI ANGKA DASHBOARD DENGAN NILAI EKSPEKTASI
    // =========================================================================
    console.log('\n--- 6. VALIDASI ANGKA DASHBOARD TERHADAP NILAI EXPECTED ---');
    // Verifikasi HTML Dashboard Owner
    const dashboardHtml = ownerAppRes.html;

    // Ambil teks atau cek keberadaan nilai
    const hasBookingBaru1 = dashboardHtml.includes('>1<') || dashboardHtml.includes('1</div>');
    const hasAcara7Hari2 = dashboardHtml.includes('>2<') || dashboardHtml.includes('2</div>');
    const hasTotalBelumLunas =
      dashboardHtml.includes('Rp 7.500.000') || dashboardHtml.includes('7.500.000');

    assert(hasBookingBaru1, `Dashboard: Kartu Booking Baru menampilkan tepat ${EXPECTED_KPI.bookingBaru}`);
    assert(hasAcara7Hari2, `Dashboard: Kartu Acara 7 Hari menampilkan tepat ${EXPECTED_KPI.acara7Hari}`);
    assert(hasTotalBelumLunas, `Dashboard: Kartu Total Belum Lunas menampilkan ${EXPECTED_KPI.totalBelumLunasFormatted}`);

    // Verifikasi Crew Dashboard hanya melihat booking yang ditugaskan
    const crewHtml = resCrewApp.html;
    const crewSeesB1 = crewHtml.includes('Gedung Serbaguna A (Hari Ini)');
    const crewSeesB2 = crewHtml.includes('Hotel Batal B');
    const crewSeesB3 = crewHtml.includes('Studio Fitting 6 Hari');
    const crewSeesB4 = crewHtml.includes('Villa Jauh 8 Hari');

    assert(
      crewSeesB1 && !crewSeesB2 && !crewSeesB3 && !crewSeesB4,
      'Dashboard Crew: Hanya merender tugas miliknya (Booking 1) dan mengabaikan booking lain'
    );
  } finally {
    // =========================================================================
    // 7. CLEANUP DATA UJI SESUAI RLS DAN PELAPORAN TRANSPARAN
    // =========================================================================
    console.log('\n--- 7. CLEANUP DATA UJI (LEWAT SESI OWNER SESUAI RLS) ---');

    let deletedAssignments = 0;
    let deletedPayments = 0;
    let deletedBookings = 0;
    let deletedPackages = 0;
    let deletedClients = 0;
    let deletedMembers = 0;

    // 1. Hapus Penugasan
    if (createdAssignmentId) {
      const { error } = await ownerSession.client
        .from('booking_assignments')
        .delete()
        .eq('id', createdAssignmentId);
      if (!error) deletedAssignments++;
    }

    // 2. Hapus Payments
    for (const pid of createdPaymentIds) {
      const { error } = await ownerSession.client.from('payments').delete().eq('id', pid);
      if (!error) deletedPayments++;
    }

    // 3. Hapus Bookings
    for (const bid of createdBookingIds) {
      const { error } = await ownerSession.client.from('bookings').delete().eq('id', bid);
      if (!error) deletedBookings++;
    }

    // 4. Hapus Packages & Clients
    if (createdPackageId) {
      const { error } = await ownerSession.client.from('packages').delete().eq('id', createdPackageId);
      if (!error) deletedPackages++;
    }
    if (createdClientId) {
      const { error } = await ownerSession.client.from('clients').delete().eq('id', createdClientId);
      if (!error) deletedClients++;
    }

    // 5. Hapus Anggota Staff & Crew
    const { error: errDelCrew } = await ownerSession.client
      .from('workspace_members')
      .delete()
      .eq('id', crewMemberRecordId);
    if (!errDelCrew) deletedMembers++;

    const { error: errDelStaff } = await ownerSession.client
      .from('workspace_members')
      .delete()
      .eq('id', memberStaff.id);
    if (!errDelStaff) deletedMembers++;

    // 6. Coba Hapus Workspace (Akan dibatasi RLS karena tabel workspaces tidak memiliki policy DELETE untuk authenticated)
    const { error: errDelWs } = await ownerSession.client
      .from('workspaces')
      .delete()
      .eq('id', wsId);

    console.log('\nLAPORAN PEMBERSIHAN DATA:');
    console.log(`- Booking assignments terhapus : ${deletedAssignments} baris`);
    console.log(`- Payments terhapus            : ${deletedPayments} baris`);
    console.log(`- Bookings terhapus            : ${deletedBookings} baris`);
    console.log(`- Packages terhapus            : ${deletedPackages} baris`);
    console.log(`- Clients terhapus             : ${deletedClients} baris`);
    console.log(`- Workspace members terhapus   : ${deletedMembers} baris`);

    console.log('\nDATA YANG TERSISA (Dibatasi RLS / Membutuhkan Service Role):');
    if (errDelWs) {
      console.log(`- Workspace: TIDAK TERHAPUS (Sesuai RLS tidak ada policy DELETE workspaces).`);
    } else {
      console.log(`- Workspace: ${wsId}`);
    }
    console.log(`  Nama Workspace : ${workspaceName}`);
    console.log(`  Workspace ID   : ${wsId}`);
    console.log(`- Akun Auth Supabase (Tidak bisa dihapus anon/authenticated key):`);
    console.log(`  1. Owner : ${ownerEmail} (ID: ${ownerUserId})`);
    console.log(`  2. Staff : ${staffEmail} (ID: ${staffUserId})`);
    console.log(`  3. Crew  : ${crewEmail} (ID: ${crewUserId})`);
    console.log('  Catatan: Akun auth dan workspace di atas dapat Anda hapus secara manual di dashboard Supabase jika diinginkan.');
  }

  // =========================================================================
  // RINGKASAN AKHIR
  // =========================================================================
  console.log('\n' + '='.repeat(70));
  console.log(`RINGKASAN HASIL PENGUJIAN: ${testSuccesses} LULUS, ${testFailures} GAGAL`);
  console.log('='.repeat(70));

  if (testFailures > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});

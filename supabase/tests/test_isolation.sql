-- ==============================================================================
-- SUITE PENGUJIAN ISOLASI MULTI-TENANT & ROW LEVEL SECURITY (RLS)
-- FILE: supabase/tests/test_isolation.sql
-- PERHATIAN: Jalankan skrip ini di Supabase SQL Editor.
-- Seluruh pengujian dibungkus dalam transaksi (BEGIN ... RAISE EXCEPTION)
-- sehingga database otomatis ter-rollback dan tetap bersih.
-- ==============================================================================

BEGIN;

-- Buat tabel temporer untuk mengumpulkan hasil pengujian
CREATE TEMP TABLE test_results (
    nomor INT PRIMARY KEY,
    nama_tes TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('LULUS', 'GAGAL')),
    catatan TEXT
) ON COMMIT DROP;

-- Beri izin akses tabel temp ke authenticated & anon agar pengujian impersonasi bisa menulis hasil
GRANT ALL ON test_results TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 1. SETUP DATA AWAL (Sebagai superuser / bypass RLS)
-- ------------------------------------------------------------------------------
SET LOCAL role = postgres;

-- Dummy Users (1: Owner A, 2: Owner B, 3: Crew A, 4: User Baru, 5: Calon Anggota A)
INSERT INTO auth.users (id, email)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'owner_a@test.com'),
    ('00000000-0000-0000-0000-000000000002', 'owner_b@test.com'),
    ('00000000-0000-0000-0000-000000000003', 'crew_a@test.com'),
    ('00000000-0000-0000-0000-000000000004', 'user_baru@test.com'),
    ('00000000-0000-0000-0000-000000000005', 'staff_baru@test.com')
ON CONFLICT (id) DO NOTHING;

-- Dummy Workspaces
INSERT INTO public.workspaces (id, nama, jenis_usaha, slug)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'MUA Lestari (Workspace A)', 'mua', 'mua-lestari'),
    ('22222222-2222-2222-2222-222222222222', 'Kencana WO (Workspace B)', 'wo', 'kencana-wo')
ON CONFLICT (id) DO NOTHING;

-- Anggota Workspace
INSERT INTO public.workspace_members (id, workspace_id, user_id, role)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'owner'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000002', 'owner'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'crew')
ON CONFLICT (id) DO NOTHING;

-- Paket Layanan di Workspace A
INSERT INTO public.packages (id, workspace_id, nama, harga, deskripsi)
VALUES 
    ('e1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Paket Akad MUA', 3500000, 'Rias akad nikah + busana')
ON CONFLICT (id) DO NOTHING;

-- Data Klien di Workspace A dan Workspace B
INSERT INTO public.clients (id, workspace_id, nama, no_hp)
VALUES 
    ('11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Klien MUA A', '081111111'),
    ('22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Klien WO B', '082222222')
ON CONFLICT (id) DO NOTHING;

-- Data Booking di Workspace A:
-- Booking 1 (ditugaskan ke Crew C) & Booking 2 (tidak ditugaskan ke Crew C)
INSERT INTO public.bookings (id, workspace_id, client_id, package_id, tanggal_acara, total_harga, status)
VALUES 
    ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1111111-1111-1111-1111-111111111111', CURRENT_DATE + 5, 5000000, 'baru'),
    ('b2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'e1111111-1111-1111-1111-111111111111', CURRENT_DATE + 10, 3000000, 'baru'),
    ('b3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NULL, CURRENT_DATE + 7, 10000000, 'baru')
ON CONFLICT (id) DO NOTHING;

-- Booking 1 ditugaskan ke Crew C
INSERT INTO public.booking_assignments (booking_id, workspace_id, member_id, tugas)
VALUES ('b1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Asisten Rias')
ON CONFLICT DO NOTHING;

-- Data Pembayaran di Workspace A (UUID valid: d1111111-...)
INSERT INTO public.payments (id, workspace_id, booking_id, jenis, jumlah)
VALUES ('d1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', 'dp', 1500000)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- TES 1: Pembuatan Workspace via create_workspace()
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

DO $$
DECLARE
    v_new_ws_id UUID;
    v_is_owner BOOLEAN;
BEGIN
    v_new_ws_id := public.create_workspace('Mahar Indah', 'seserahan', 'mahar-indah');
    
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = v_new_ws_id
          AND user_id = '00000000-0000-0000-0000-000000000004'
          AND role = 'owner'
    ) INTO v_is_owner;

    IF v_is_owner THEN
        INSERT INTO test_results VALUES (1, 'create_workspace() membuat workspace & mendaftarkan owner', 'LULUS', 'Workspace dan role owner berhasil dibuat via RPC.');
    ELSE
        INSERT INTO test_results VALUES (1, 'create_workspace() membuat workspace & mendaftarkan owner', 'GAGAL', 'Role owner tidak ditemukan pada membership.');
    END IF;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES (1, 'create_workspace() membuat workspace & mendaftarkan owner', 'GAGAL', SQLERRM);
END $$;

-- ------------------------------------------------------------------------------
-- TES 2 (Negatif): User biasa TIDAK BISA INSERT langsung ke tabel workspaces
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

DO $$
DECLARE
    v_rls_rejected BOOLEAN := false;
    v_err_msg TEXT := '';
BEGIN
    BEGIN
        INSERT INTO public.workspaces (nama, jenis_usaha, slug)
        VALUES ('Ilegal WO', 'wo', 'ilegal-wo');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_rls_rejected := true;
    WHEN OTHERS THEN
        v_err_msg := 'SQLSTATE: ' || SQLSTATE || ' - ' || SQLERRM;
    END;

    IF v_rls_rejected THEN
        INSERT INTO test_results VALUES (2, 'User biasa tidak bisa INSERT langsung ke workspaces', 'LULUS', 'Ditolak RLS dengan SQLSTATE 42501 (insufficient_privilege).');
    ELSE
        INSERT INTO test_results VALUES (2, 'User biasa tidak bisa INSERT langsung ke workspaces', 'GAGAL', COALESCE(NULLIF(v_err_msg, ''), 'Operasi tidak ditolak RLS.'));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 3 (Negatif): User B menyisipkan dirinya sebagai owner di Workspace A
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';

DO $$
DECLARE
    v_rls_rejected BOOLEAN := false;
    v_err_msg TEXT := '';
BEGIN
    BEGIN
        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000002', 'owner');
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_rls_rejected := true;
    WHEN OTHERS THEN
        v_err_msg := 'SQLSTATE: ' || SQLSTATE || ' - ' || SQLERRM;
    END;

    IF v_rls_rejected THEN
        INSERT INTO test_results VALUES (3, 'User B menyisipkan diri sebagai owner di Workspace A', 'LULUS', 'Ditolak RLS dengan SQLSTATE 42501 (insufficient_privilege).');
    ELSE
        INSERT INTO test_results VALUES (3, 'User B menyisipkan diri sebagai owner di Workspace A', 'GAGAL', COALESCE(NULLIF(v_err_msg, ''), 'Operasi tidak ditolak RLS.'));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 4 (Kontrol Positif): Owner A melihat tepat data milik Workspace A
-- (1 klien, 2 booking, 1 payment)
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_c INT;
    v_b INT;
    v_p INT;
BEGIN
    SELECT count(*) INTO v_c FROM public.clients;
    SELECT count(*) INTO v_b FROM public.bookings;
    SELECT count(*) INTO v_p FROM public.payments;

    IF v_c = 1 AND v_b = 2 AND v_p = 1 THEN
        INSERT INTO test_results VALUES (4, 'Kontrol positif: Owner A melihat tepat 1 klien, 2 booking, 1 payment', 'LULUS', 'Jumlah data sesuai dengan isi Workspace A.');
    ELSE
        INSERT INTO test_results VALUES (4, 'Kontrol positif: Owner A melihat tepat 1 klien, 2 booking, 1 payment', 'GAGAL', format('Terlihat: %s klien, %s booking, %s payment', v_c, v_b, v_p));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 5 (Kontrol Positif): Owner A bisa INSERT klien baru di Workspace A
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
    INSERT INTO public.clients (workspace_id, nama, no_hp)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Klien Baru Sah', '08123456789');

    INSERT INTO test_results VALUES (5, 'Kontrol positif: Owner A bisa INSERT klien baru di Workspace A', 'LULUS', 'Insert klien baru berhasil dilakukan oleh owner.');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES (5, 'Kontrol positif: Owner A bisa INSERT klien baru di Workspace A', 'GAGAL', SQLERRM);
END $$;

-- ------------------------------------------------------------------------------
-- TES 6 (Kontrol Positif): Owner A bisa INSERT anggota baru di Workspace A
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000005', 'staff');

    INSERT INTO test_results VALUES (6, 'Kontrol positif: Owner A bisa INSERT anggota baru di Workspace A', 'LULUS', 'Penambahan anggota oleh owner berhasil.');
EXCEPTION WHEN OTHERS THEN
    INSERT INTO test_results VALUES (6, 'Kontrol positif: Owner A bisa INSERT anggota baru di Workspace A', 'GAGAL', SQLERRM);
END $$;

-- ------------------------------------------------------------------------------
-- TES 7 (Kontrol Positif): Crew bisa membaca paket di workspace-nya
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

DO $$
DECLARE
    v_pkg_count INT;
BEGIN
    SELECT count(*) INTO v_pkg_count FROM public.packages;

    IF v_pkg_count >= 1 THEN
        INSERT INTO test_results VALUES (7, 'Kontrol positif: Crew bisa membaca paket layanan di workspace-nya', 'LULUS', format('Crew melihat %s paket layanan.', v_pkg_count));
    ELSE
        INSERT INTO test_results VALUES (7, 'Kontrol positif: Crew bisa membaca paket layanan di workspace-nya', 'GAGAL', 'Crew tidak dapat membaca paket layanan.');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 8 (Negatif): Isolasi SELECT (Owner A tidak bisa membaca klien Workspace B)
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_b_clients INT;
BEGIN
    SELECT count(*) INTO v_b_clients
    FROM public.clients
    WHERE workspace_id = '22222222-2222-2222-2222-222222222222';

    IF v_b_clients = 0 THEN
        INSERT INTO test_results VALUES (8, 'Owner A tidak bisa membaca data klien Workspace B', 'LULUS', 'Data klien Workspace B terisolasi (0 baris terlihat).');
    ELSE
        INSERT INTO test_results VALUES (8, 'Owner A tidak bisa membaca data klien Workspace B', 'GAGAL', 'Owner A dapat melihat ' || v_b_clients || ' data dari Workspace B.');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 9 (Negatif): Isolasi UPDATE (Owner A tidak bisa mengupdate data Workspace B)
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_rows_affected INT;
BEGIN
    UPDATE public.clients
    SET nama = 'Diretas oleh A'
    WHERE id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    IF v_rows_affected = 0 THEN
        INSERT INTO test_results VALUES (9, 'Owner A tidak bisa UPDATE data di Workspace B', 'LULUS', '0 baris terpengaruh (RLS menyaring baris sebelum update).');
    ELSE
        INSERT INTO test_results VALUES (9, 'Owner A tidak bisa UPDATE data di Workspace B', 'GAGAL', 'Data Workspace B berhasil diubah oleh Owner A!');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 10 (Negatif): Isolasi DELETE (Owner A tidak bisa menghapus data Workspace B)
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

DO $$
DECLARE
    v_rows_affected INT;
BEGIN
    DELETE FROM public.clients
    WHERE id = '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

    IF v_rows_affected = 0 THEN
        INSERT INTO test_results VALUES (10, 'Owner A tidak bisa DELETE data di Workspace B', 'LULUS', '0 baris terpengaruh (RLS menyaring baris sebelum delete).');
    ELSE
        INSERT INTO test_results VALUES (10, 'Owner A tidak bisa DELETE data di Workspace B', 'GAGAL', 'Data Workspace B berhasil dihapus oleh Owner A!');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 11 (Negatif): Crew TIDAK BISA membaca tabel payments (keuangan)
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

DO $$
DECLARE
    v_pay_count INT;
BEGIN
    SELECT count(*) INTO v_pay_count FROM public.payments;

    IF v_pay_count = 0 THEN
        INSERT INTO test_results VALUES (11, 'Crew tidak bisa membaca data pembayaran/keuangan', 'LULUS', 'Data keuangan tertutup untuk crew (0 baris terlihat).');
    ELSE
        INSERT INTO test_results VALUES (11, 'Crew tidak bisa membaca data pembayaran/keuangan', 'GAGAL', 'Crew dapat membaca data pembayaran.');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 12 (Negatif): Crew TIDAK BISA membuat booking baru
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

DO $$
DECLARE
    v_rls_rejected BOOLEAN := false;
    v_err_msg TEXT := '';
BEGIN
    BEGIN
        INSERT INTO public.bookings (workspace_id, client_id, tanggal_acara, total_harga)
        VALUES (
            '11111111-1111-1111-1111-111111111111',
            '11111111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            CURRENT_DATE + 30,
            2000000
        );
    EXCEPTION WHEN SQLSTATE '42501' THEN
        v_rls_rejected := true;
    WHEN OTHERS THEN
        v_err_msg := 'SQLSTATE: ' || SQLSTATE || ' - ' || SQLERRM;
    END;

    IF v_rls_rejected THEN
        INSERT INTO test_results VALUES (12, 'Crew tidak bisa membuat booking baru', 'LULUS', 'Ditolak RLS dengan SQLSTATE 42501 (insufficient_privilege).');
    ELSE
        INSERT INTO test_results VALUES (12, 'Crew tidak bisa membuat booking baru', 'GAGAL', COALESCE(NULLIF(v_err_msg, ''), 'Operasi tidak ditolak RLS.'));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 13: Crew HANYA BISA membaca booking yang ditugaskan kepadanya
-- ------------------------------------------------------------------------------
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

DO $$
DECLARE
    v_visible_count INT;
    v_unassigned_visible INT;
BEGIN
    SELECT count(*) INTO v_visible_count FROM public.bookings;
    
    SELECT count(*) INTO v_unassigned_visible
    FROM public.bookings
    WHERE id = 'b2222222-2222-2222-2222-222222222222'; -- Booking 2 tidak ditugaskan ke crew

    IF v_visible_count = 1 AND v_unassigned_visible = 0 THEN
        INSERT INTO test_results VALUES (13, 'Crew hanya bisa melihat booking yang ditugaskan', 'LULUS', 'Hanya booking tugas yang terlihat (1 booking).');
    ELSE
        INSERT INTO test_results VALUES (13, 'Crew hanya bisa melihat booking yang ditugaskan', 'GAGAL', 'Crew melihat ' || v_visible_count || ' booking.');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- TES 14 (Negatif): Booking tidak bisa menunjuk klien dari workspace lain (Composite FK)
-- ------------------------------------------------------------------------------
SET LOCAL role = postgres;

DO $$
DECLARE
    v_fk_rejected BOOLEAN := false;
    v_err_msg TEXT := '';
BEGIN
    BEGIN
        -- Coba buat booking di Workspace A tetapi client_id milik Workspace B
        INSERT INTO public.bookings (workspace_id, client_id, tanggal_acara, total_harga)
        VALUES (
            '11111111-1111-1111-1111-111111111111',
            '22222222-bbbb-bbbb-bbbb-bbbbbbbbbbbb', -- Klien milik Workspace B
            CURRENT_DATE + 15,
            1000000
        );
    EXCEPTION WHEN foreign_key_violation THEN -- SQLSTATE 23503
        v_fk_rejected := true;
    WHEN OTHERS THEN
        v_err_msg := 'SQLSTATE: ' || SQLSTATE || ' - ' || SQLERRM;
    END;

    IF v_fk_rejected THEN
        INSERT INTO test_results VALUES (14, 'Booking tidak bisa menunjuk client dari workspace lain', 'LULUS', 'Ditolak oleh constraint composite foreign key (SQLSTATE 23503).');
    ELSE
        INSERT INTO test_results VALUES (14, 'Booking tidak bisa menunjuk client dari workspace lain', 'GAGAL', COALESCE(NULLIF(v_err_msg, ''), 'Foreign key lintas-workspace lolos.'));
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- SUSUN LAPORAN HASIL & TRIGGER AUTO-ROLLBACK VIA RAISE EXCEPTION
-- ------------------------------------------------------------------------------
SET LOCAL role = postgres;

DO $$
DECLARE
    r RECORD;
    v_summary TEXT;
    v_passed INT := 0;
    v_failed INT := 0;
    v_total INT := 0;
    v_details TEXT := '';
BEGIN
    SELECT count(*) FILTER (WHERE status = 'LULUS'),
           count(*) FILTER (WHERE status = 'GAGAL'),
           count(*)
    INTO v_passed, v_failed, v_total
    FROM test_results;

    v_summary := format(
        E'\n======================= HASIL PENGUJIAN RLS =======================\nRingkasan: %s LULUS, %s GAGAL (Total: %s Pengujian)\n-------------------------------------------------------------------\n',
        v_passed, v_failed, v_total
    );

    FOR r IN SELECT nomor, status, nama_tes, catatan FROM test_results ORDER BY nomor LOOP
        v_details := v_details || format(E'[%s] Tes %s: %s\n      Catatan: %s\n', r.status, r.nomor, r.nama_tes, r.catatan);
    END LOOP;

    RAISE EXCEPTION '%', v_summary || v_details || E'===================================================================\n(Pesan error ini sengaja dipicu untuk memastikan seluruh transaksi otomatis di-ROLLBACK dan database tetap bersih.)';
END $$;
 
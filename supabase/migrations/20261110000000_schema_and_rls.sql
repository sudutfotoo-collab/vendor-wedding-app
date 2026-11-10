-- ==============================================================================
-- MIGRASI: 20261110000000_schema_and_rls.sql
-- DESKRIPSI: Skema multi-tenant Vendor Wedding App + Row-Level Security (RLS)
-- REVISI: Composite Foreign Keys lintas-workspace, create_workspace RPC, & strict RLS
-- ==============================================================================

BEGIN;

-- 1. TABEL WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    nama TEXT NOT NULL,
    jenis_usaha TEXT NOT NULL CHECK (jenis_usaha IN ('mua', 'fotografer', 'wo', 'seserahan')),
    slug TEXT NOT NULL UNIQUE
);

-- 2. TABEL WORKSPACE_MEMBERS
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'staff', 'crew')),
    CONSTRAINT uq_workspace_members_user UNIQUE (workspace_id, user_id),
    CONSTRAINT uq_workspace_members_ws_id UNIQUE (workspace_id, id)
);

-- 3. TABEL CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    no_hp TEXT,
    email TEXT,
    catatan TEXT,
    CONSTRAINT uq_clients_ws_id UNIQUE (workspace_id, id)
);

-- 4. TABEL PACKAGES (Paket Layanan)
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    nama TEXT NOT NULL,
    harga NUMERIC(14, 2) NOT NULL DEFAULT 0,
    deskripsi TEXT,
    CONSTRAINT uq_packages_ws_id UNIQUE (workspace_id, id)
);

-- 5. TABEL BOOKINGS
-- Menggunakan composite foreign key (workspace_id, client_id) dan (workspace_id, package_id)
-- untuk menjamin booking tidak bisa menunjuk client atau package dari workspace lain.
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    client_id UUID NOT NULL,
    package_id UUID,
    tanggal_acara DATE NOT NULL,
    lokasi TEXT,
    status TEXT NOT NULL DEFAULT 'baru' CHECK (status IN ('baru', 'fitting', 'selesai', 'batal')),
    total_harga NUMERIC(14, 2) NOT NULL DEFAULT 0,
    catatan TEXT,
    CONSTRAINT uq_bookings_ws_id UNIQUE (workspace_id, id),
    CONSTRAINT fk_bookings_client
        FOREIGN KEY (workspace_id, client_id)
        REFERENCES public.clients(workspace_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_bookings_package
        FOREIGN KEY (workspace_id, package_id)
        REFERENCES public.packages(workspace_id, id)
        ON DELETE SET NULL (package_id)
);

-- 6. TABEL PAYMENTS
-- Menggunakan composite foreign key (workspace_id, booking_id)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL,
    jenis TEXT NOT NULL CHECK (jenis IN ('dp', 'cicilan', 'pelunasan')),
    jumlah NUMERIC(14, 2) NOT NULL DEFAULT 0,
    tanggal_bayar DATE NOT NULL DEFAULT CURRENT_DATE,
    catatan TEXT,
    CONSTRAINT uq_payments_ws_id UNIQUE (workspace_id, id),
    CONSTRAINT fk_payments_booking
        FOREIGN KEY (workspace_id, booking_id)
        REFERENCES public.bookings(workspace_id, id)
        ON DELETE CASCADE
);

-- 7. TABEL BOOKING_ASSIGNMENTS (Penugasan Kru)
-- Menggunakan composite foreign key (workspace_id, booking_id) dan (workspace_id, member_id)
CREATE TABLE IF NOT EXISTS public.booking_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL,
    member_id UUID NOT NULL,
    tugas TEXT,
    CONSTRAINT uq_booking_assignments_booking_member UNIQUE (booking_id, member_id),
    CONSTRAINT fk_booking_assignments_booking
        FOREIGN KEY (workspace_id, booking_id)
        REFERENCES public.bookings(workspace_id, id)
        ON DELETE CASCADE,
    CONSTRAINT fk_booking_assignments_member
        FOREIGN KEY (workspace_id, member_id)
        REFERENCES public.workspace_members(workspace_id, id)
        ON DELETE CASCADE
);

-- ==============================================================================
-- INDEXING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_packages_workspace_id ON public.packages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bookings_workspace_id ON public.bookings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tanggal_acara ON public.bookings(tanggal_acara);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_payments_workspace_id ON public.payments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_assignments_workspace_id ON public.booking_assignments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_booking_assignments_booking_id ON public.booking_assignments(booking_id);

-- ==============================================================================
-- FUNGSI HELPER KEAMANAN (SECURITY DEFINER + search_path public)
-- Mencegah rekursi RLS pada tabel workspace_members
-- ==============================================================================

-- Mengecek keanggotaan user di workspace tertentu
CREATE OR REPLACE FUNCTION public.is_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
    );
$$;

-- Mengecek peran user di workspace tertentu
CREATE OR REPLACE FUNCTION public.has_role(ws_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = ws_id
          AND user_id = auth.uid()
          AND role = ANY(allowed_roles)
    );
$$;

-- Mengecek apakah user adalah crew yang ditugaskan ke booking tertentu
CREATE OR REPLACE FUNCTION public.is_assigned_crew(b_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.booking_assignments ba
        JOIN public.workspace_members wm ON wm.id = ba.member_id
        WHERE ba.booking_id = b_id
          AND wm.user_id = auth.uid()
    );
$$;

-- Batasi hak eksekusi helper hanya untuk authenticated
REVOKE ALL ON FUNCTION public.is_member(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, TEXT[]) TO authenticated;

REVOKE ALL ON FUNCTION public.is_assigned_crew(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assigned_crew(UUID) TO authenticated;

-- ==============================================================================
-- FUNGSI ONBOARDING PENDAFTARAN (create_workspace)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_workspace(
    p_nama TEXT,
    p_jenis_usaha TEXT,
    p_slug TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_workspace_id UUID;
BEGIN
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Pengguna harus terautentikasi untuk membuat workspace.';
    END IF;

    IF p_jenis_usaha NOT IN ('mua', 'fotografer', 'wo', 'seserahan') THEN
        RAISE EXCEPTION 'Jenis usaha tidak valid. Pilih mua, fotografer, wo, atau seserahan.';
    END IF;

    -- 1. Buat workspace baru
    INSERT INTO public.workspaces (nama, jenis_usaha, slug)
    VALUES (p_nama, p_jenis_usaha, p_slug)
    RETURNING id INTO v_workspace_id;

    -- 2. Daftarkan pembuat sebagai Owner di workspace_members
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_user_id, 'owner');

    RETURN v_workspace_id;
END;
$$;

-- Batasi hak eksekusi create_workspace hanya untuk authenticated
REVOKE ALL ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_workspace(TEXT, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- AKTIFKAN ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_assignments ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- KEBIJAKAN RLS (POLICIES)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. WORKSPACES
-- TIDAK ADA POLICY INSERT: Semua pembuatan workspace harus lewat create_workspace()
-- ------------------------------------------------------------------------------
-- Member hanya bisa melihat workspace tempat ia bergabung
CREATE POLICY "workspaces_select_member"
ON public.workspaces FOR SELECT
TO authenticated
USING (public.is_member(id));

-- Hanya Owner yang bisa mengedit informasi workspace
CREATE POLICY "workspaces_update_owner"
ON public.workspaces FOR UPDATE
TO authenticated
USING (public.has_role(id, ARRAY['owner']))
WITH CHECK (public.has_role(id, ARRAY['owner']));

-- ------------------------------------------------------------------------------
-- 2. WORKSPACE_MEMBERS
-- ------------------------------------------------------------------------------
-- Member bisa melihat siapa saja anggota di workspace miliknya
CREATE POLICY "workspace_members_select"
ON public.workspace_members FOR SELECT
TO authenticated
USING (public.is_member(workspace_id));

-- Hanya Owner workspace yang berhak menambahkan anggota baru (staff/crew)
CREATE POLICY "workspace_members_insert_owner"
ON public.workspace_members FOR INSERT
TO authenticated
WITH CHECK (public.has_role(workspace_id, ARRAY['owner']));

-- Hanya Owner yang bisa mengubah peran anggota
CREATE POLICY "workspace_members_update_owner"
ON public.workspace_members FOR UPDATE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner']))
WITH CHECK (public.has_role(workspace_id, ARRAY['owner']));

-- Hanya Owner yang bisa menghapus anggota (atau anggota keluar sendiri)
CREATE POLICY "workspace_members_delete"
ON public.workspace_members FOR DELETE
TO authenticated
USING (
    public.has_role(workspace_id, ARRAY['owner'])
    OR user_id = auth.uid()
);

-- ------------------------------------------------------------------------------
-- 3. CLIENTS
-- ------------------------------------------------------------------------------
CREATE POLICY "clients_select_staff"
ON public.clients FOR SELECT
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "clients_insert_staff"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "clients_update_staff"
ON public.clients FOR UPDATE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']))
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "clients_delete_staff"
ON public.clients FOR DELETE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']));

-- ------------------------------------------------------------------------------
-- 4. PACKAGES
-- ------------------------------------------------------------------------------
-- Semua anggota (termasuk crew) bisa membaca daftar paket layanan
CREATE POLICY "packages_select_member"
ON public.packages FOR SELECT
TO authenticated
USING (public.is_member(workspace_id));

-- Hanya Owner & Staff yang bisa mengelola paket layanan
CREATE POLICY "packages_all_staff"
ON public.packages FOR ALL
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']))
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

-- ------------------------------------------------------------------------------
-- 5. BOOKINGS
-- ------------------------------------------------------------------------------
-- Owner & Staff bisa membaca semua booking di workspace-nya.
-- Crew HANYA bisa membaca booking yang ditugaskan kepadanya.
CREATE POLICY "bookings_select_member"
ON public.bookings FOR SELECT
TO authenticated
USING (
    public.has_role(workspace_id, ARRAY['owner', 'staff'])
    OR (
        public.has_role(workspace_id, ARRAY['crew'])
        AND public.is_assigned_crew(id)
    )
);

CREATE POLICY "bookings_insert_staff"
ON public.bookings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "bookings_update_staff"
ON public.bookings FOR UPDATE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']))
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "bookings_delete_staff"
ON public.bookings FOR DELETE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']));

-- ------------------------------------------------------------------------------
-- 6. PAYMENTS
-- ------------------------------------------------------------------------------
-- Keuangan tertutup untuk crew; Hanya Owner & Staff yang bisa akses
CREATE POLICY "payments_select_staff"
ON public.payments FOR SELECT
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "payments_insert_staff"
ON public.payments FOR INSERT
TO authenticated
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "payments_update_staff"
ON public.payments FOR UPDATE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']))
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

CREATE POLICY "payments_delete_staff"
ON public.payments FOR DELETE
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']));

-- ------------------------------------------------------------------------------
-- 7. BOOKING_ASSIGNMENTS
-- ------------------------------------------------------------------------------
-- Owner & Staff bisa melihat semua penugasan; Crew bisa melihat tugas miliknya
CREATE POLICY "booking_assignments_select"
ON public.booking_assignments FOR SELECT
TO authenticated
USING (
    public.has_role(workspace_id, ARRAY['owner', 'staff'])
    OR member_id IN (
        SELECT id FROM public.workspace_members WHERE user_id = auth.uid()
    )
);

-- Hanya Owner & Staff yang bisa menambah, mengubah, dan menghapus penugasan kru
CREATE POLICY "booking_assignments_all_staff"
ON public.booking_assignments FOR ALL
TO authenticated
USING (public.has_role(workspace_id, ARRAY['owner', 'staff']))
WITH CHECK (public.has_role(workspace_id, ARRAY['owner', 'staff']));

COMMIT;


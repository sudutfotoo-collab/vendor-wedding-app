import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface Workspace {
  id: string;
  created_at: string;
  nama: string;
  jenis_usaha: 'mua' | 'fotografer' | 'wo' | 'seserahan';
  slug: string;
}

export interface CurrentMembership {
  id: string;
  workspace_id: string;
  user_id: string;
  role: 'owner' | 'staff' | 'crew';
  created_at: string;
  workspace: Workspace | null;
}

/**
 * Mengambil data user yang sedang login saat ini.
 * Dibungkus dengan React cache() untuk mencegah duplicate request dalam satu render tree.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Mengambil keanggotaan aktif user saat ini berserta relasi workspace-nya.
 * Dibungkus dengan React cache().
 */
export const getCurrentMembership = cache(async (): Promise<CurrentMembership | null> => {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, user_id, role, created_at, workspaces(id, nama, jenis_usaha, slug, created_at)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const ws = Array.isArray(data.workspaces)
    ? data.workspaces[0]
    : data.workspaces;

  return {
    id: data.id,
    workspace_id: data.workspace_id,
    user_id: data.user_id,
    role: data.role as 'owner' | 'staff' | 'crew',
    created_at: data.created_at,
    workspace: (ws as unknown as Workspace) ?? null,
  };
});

/**
 * Mengambil workspace aktif user saat ini.
 */
export const getCurrentWorkspace = cache(async (): Promise<Workspace | null> => {
  const membership = await getCurrentMembership();
  return membership?.workspace ?? null;
});

/**
 * Mengambil role aktif user saat ini ('owner' | 'staff' | 'crew' | null).
 */
export const getCurrentRole = cache(async (): Promise<'owner' | 'staff' | 'crew' | null> => {
  const membership = await getCurrentMembership();
  return membership?.role ?? null;
});

/**
 * Helper otorisasi peran halaman.
 * Memastikan pengguna memiliki salah satu peran yang diizinkan.
 * Jika belum login -> diarahkan ke /masuk.
 * Jika login tetapi perannya tidak sesuai -> dialihkan kembali ke /app.
 */
export async function requireRole(allowedRoles: ('owner' | 'staff' | 'crew')[]) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/masuk');
  }

  const membership = await getCurrentMembership();

  // Jika belum memiliki workspace, biarkan melewati requireRole agar halaman /app
  // bisa menampilkan form pembuatan workspace fallback
  if (!membership || !membership.workspace) {
    return {
      user,
      workspace: null,
      role: null,
    };
  }

  if (!allowedRoles.includes(membership.role)) {
    redirect('/app');
  }

  return {
    user,
    workspace: membership.workspace,
    role: membership.role,
  };
}

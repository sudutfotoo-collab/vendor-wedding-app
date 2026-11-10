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
 * Mengambil data user yang sedang login saat ini dari sesi server.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Mengambil keanggotaan aktif user saat ini berserta relasi workspace-nya.
 */
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
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

  // Supabase mengembalikan relasi single/array tergantung schema foreign key
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
}

/**
 * Mengambil workspace aktif user saat ini.
 */
export async function getCurrentWorkspace(): Promise<Workspace | null> {
  const membership = await getCurrentMembership();
  return membership?.workspace ?? null;
}

/**
 * Mengambil role aktif user saat ini ('owner' | 'staff' | 'crew' | null).
 */
export async function getCurrentRole(): Promise<'owner' | 'staff' | 'crew' | null> {
  const membership = await getCurrentMembership();
  return membership?.role ?? null;
}


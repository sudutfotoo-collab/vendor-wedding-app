import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentWorkspace, getCurrentRole } from '@/lib/auth';
import AppNavigation from '@/components/AppNavigation';

export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/masuk');
  }

  const workspace = await getCurrentWorkspace();
  const role = await getCurrentRole();

  // Jika user belum memiliki workspace (create_workspace gagal saat pendaftaran),
  // tampilkan children langsung (page.tsx akan merender CreateWorkspaceFallback).
  if (!workspace || !role) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Sidebar Desktop & Header/Bottom Navigation Mobile */}
      <AppNavigation
        workspaceName={workspace.nama}
        userRole={role}
        userEmail={user.email ?? ''}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 pb-20 md:pb-8 px-4 sm:px-6 md:px-8 pt-4 md:pt-6">
        <div className="max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}


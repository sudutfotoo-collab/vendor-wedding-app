'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export interface AppNavigationProps {
  workspaceName: string;
  userRole: 'owner' | 'staff' | 'crew';
  userEmail: string;
}

export default function AppNavigation({
  workspaceName,
  userRole,
  userEmail,
}: AppNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/masuk');
    router.refresh();
    window.location.href = '/masuk';
  };

  // Definisi daftar menu
  const ownerNav = [
    {
      label: 'Dashboard',
      href: '/app',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Booking',
      href: '/app/booking',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Klien',
      href: '/app/klien',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: 'Tagihan',
      href: '/app/tagihan',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Tim',
      href: '/app/tim',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Pengaturan',
      href: '/app/pengaturan',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  const staffNav = [
    ownerNav[0], // Dashboard
    ownerNav[1], // Booking
    ownerNav[2], // Klien
    ownerNav[3], // Tagihan
  ];

  const crewNav = [
    {
      label: 'Jadwal Saya',
      href: '/app',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  const navItems =
    userRole === 'owner' ? ownerNav : userRole === 'staff' ? staffNav : crewNav;

  const roleLabelMap = {
    owner: { text: 'Owner', bg: 'bg-amber-100 text-amber-800' },
    staff: { text: 'Staff', bg: 'bg-blue-100 text-blue-800' },
    crew: { text: 'Crew', bg: 'bg-emerald-100 text-emerald-800' },
  };

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-zinc-200 h-screen sticky top-0 shrink-0 select-none">
        {/* Brand & Workspace Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div className="overflow-hidden">
            <div className="flex items-center gap-2">
              <span className="text-xl">💍</span>
              <span className="font-bold text-base tracking-tight text-zinc-900 truncate">
                {workspaceName}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${roleLabelMap[userRole].bg}`}
              >
                {roleLabelMap[userRole].text}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === '/app'
                ? pathname === '/app'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-rose-50 text-rose-700 font-semibold shadow-xs'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <span className={isActive ? 'text-rose-600' : 'text-zinc-400'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout Button */}
        <div className="p-4 border-t border-zinc-100 bg-zinc-50/50">
          <div className="text-xs text-zinc-500 truncate mb-2">{userEmail}</div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Keluar Akun
          </button>
        </div>
      </aside>

      {/* ================= MOBILE TOP HEADER ================= */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">💍</span>
          <div className="truncate">
            <h1 className="text-sm font-bold text-zinc-900 truncate leading-tight">
              {workspaceName}
            </h1>
            <span
              className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-full inline-block ${roleLabelMap[userRole].bg}`}
            >
              {roleLabelMap[userRole].text}
            </span>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="p-2 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 transition-colors"
          aria-label="Keluar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </header>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200 shadow-lg px-2 py-1 flex items-center justify-around safe-area-bottom">
        {navItems.map((item) => {
          const isActive =
            item.href === '/app'
              ? pathname === '/app'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 min-h-[48px] rounded-lg transition-colors ${
                isActive ? 'text-rose-600 font-semibold' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <div className={isActive ? 'text-rose-600' : 'text-zinc-400'}>
                {item.icon}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight truncate max-w-[56px]">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}


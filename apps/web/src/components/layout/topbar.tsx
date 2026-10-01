'use client';

import { Bell, HelpCircle, LogOut, Menu, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/features/auth/auth-context';
import { initials } from '@/lib/utils';
import { PropertySelector } from './property-selector';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
      <button type="button" onClick={onMenu} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <PropertySelector />

      <div className="relative ml-2 hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
        <input
          disabled
          aria-label="Global search (coming soon)"
          placeholder="Search guests, reservations, rooms…  (coming soon)"
          className="w-full cursor-not-allowed rounded-lg border-0 bg-slate-50 py-2 pl-9 pr-3 text-sm ring-1 ring-inset ring-slate-200 placeholder:text-slate-400"
        />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <button type="button" disabled title="Notifications: coming soon" aria-label="Notifications (coming soon)" className="cursor-not-allowed rounded-lg p-2 text-slate-400">
          <Bell className="h-5 w-5" />
        </button>
        <button type="button" disabled title="Help: coming soon" aria-label="Help (coming soon)" className="hidden cursor-not-allowed rounded-lg p-2 text-slate-400 sm:block">
          <HelpCircle className="h-5 w-5" />
        </button>

        <div className="relative">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
            {user ? initials(user.firstName, user.lastName) : '?'}
          </button>
          {open && (
            <>
              <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
              <div role="menu" className="absolute right-0 z-20 mt-2 w-64 rounded-xl bg-white py-2 shadow-lg ring-1 ring-slate-200">
                <div className="border-b border-slate-100 px-4 pb-2">
                  <p className="text-sm font-medium text-slate-900">{user?.firstName} {user?.lastName}</p>
                  <p className="truncate text-xs text-slate-500">{user?.email}</p>
                  <p className="truncate text-xs text-slate-500">{user?.organization.name}</p>
                </div>
                <button type="button" role="menuitem" onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

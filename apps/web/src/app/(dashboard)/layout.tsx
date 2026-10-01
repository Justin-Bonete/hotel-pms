'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { MobileNav } from '@/components/layout/mobile-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Spinner } from '@/components/ui/ui';
import { useAuth } from '@/features/auth/auth-context';
import { PropertyProvider } from '@/features/properties/property-context';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <PropertyProvider>
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 hidden w-64 lg:block">
          <Sidebar />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-slate-900/50" onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
              <Sidebar onNavigate={() => setDrawer(false)} />
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-lg p-1 text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          <Topbar onMenu={() => setDrawer(true)} />
          <main className="flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-10">{children}</main>
        </div>
      </div>
      <MobileNav onMore={() => setDrawer(true)} />
    </PropertyProvider>
  );
}

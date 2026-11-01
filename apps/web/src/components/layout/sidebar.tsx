'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex h-16 shrink-0 items-center gap-2 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">PMS</div>
        <span className="font-semibold text-white">{APP_NAME}</span>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6" aria-label="Main">
        {NAV_ITEMS.map(({ label, href, icon: Icon, ready }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/60 hover:text-white',
                !ready && !active && 'text-slate-500',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="flex-1">{label}</span>
              {!ready && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">Soon</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

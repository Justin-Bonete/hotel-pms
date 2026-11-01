'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NAV_ITEMS } from './nav-items';

const PINNED = ['/dashboard', '/properties', '/settings'];

/** Phone layout: bottom bar with the working pages; everything else lives in the menu drawer. */
export function MobileNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => PINNED.includes(i.href));
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      {items.map(({ label, href, icon: Icon }) => (
        <Link key={href} href={href} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-xs', pathname.startsWith(href) ? 'text-indigo-600' : 'text-slate-500')}>
          <Icon className="h-5 w-5" aria-hidden />
          {label}
        </Link>
      ))}
      <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-slate-500">
        <span className="text-lg leading-5" aria-hidden>≡</span>
        More
      </button>
    </nav>
  );
}

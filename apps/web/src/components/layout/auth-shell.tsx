import type { ReactNode } from 'react';
import { APP_NAME } from '@/lib/constants';

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">PMS</div>
        <span className="text-lg font-semibold text-slate-900">{APP_NAME}</span>
      </div>
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">{children}</div>
    </div>
  );
}

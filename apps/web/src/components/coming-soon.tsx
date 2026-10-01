import { Construction } from 'lucide-react';
import { Badge } from '@/components/ui/ui';

export function ComingSoon({ title, phase }: { title: string; phase?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Construction className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="mt-5 text-xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-2">
        <Badge tone="info">Coming soon{phase ? ` · ${phase}` : ''}</Badge>
      </div>
      <p className="mt-4 text-sm text-slate-500">
        This module is planned but not built yet, so there is nothing to show. It will appear here when its phase is delivered.
      </p>
    </div>
  );
}

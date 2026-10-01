'use client';

import { Building2, Check, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { ALL_PROPERTIES, useProperties } from '@/features/properties/property-context';
import { cn } from '@/lib/utils';

export function PropertySelector() {
  const { properties, selected, selectedId, select, isLoading, error, refetch } = useProperties();
  const [open, setOpen] = useState(false);
  const label = selected?.name ?? 'All properties';

  const choose = (id: string) => {
    select(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex max-w-[14rem] items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
      >
        <Building2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>

      {open && (
        <>
          <button type="button" aria-label="Close" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute left-0 z-20 mt-2 w-72 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-slate-200">
            <Option active={selectedId === ALL_PROPERTIES} onClick={() => choose(ALL_PROPERTIES)} title="All properties" hint={`${properties.length} in your organization`} />
            {isLoading && <p className="px-4 py-2 text-sm text-slate-500">Loading properties…</p>}
            {error && (
              <p className="px-4 py-2 text-sm text-red-600">
                Could not load properties.{' '}
                <button type="button" className="underline" onClick={refetch}>
                  Retry
                </button>
              </p>
            )}
            {properties.map((p) => (
              <Option key={p.id} active={selectedId === p.id} onClick={() => choose(p.id)} title={p.name} hint={[p.city, p.region].filter(Boolean).join(', ')} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Option({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button type="button" role="option" aria-selected={active} onClick={onClick} className={cn('flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50', active && 'bg-indigo-50/60')}>
      <span className="flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      {active && <Check className="h-4 w-4 text-indigo-600" aria-hidden />}
    </button>
  );
}

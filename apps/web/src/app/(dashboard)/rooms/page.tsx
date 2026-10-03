'use client';

import { useState } from 'react';
import { Button, EmptyState } from '@/components/ui/ui';
import { useProperties } from '@/features/properties/property-context';
import { RoomBoard } from '@/features/rooms/room-board';
import { RoomTypesPanel } from '@/features/rooms/room-types-panel';
import { RoomsTable } from '@/features/rooms/rooms-table';
import { StructurePanel } from '@/features/rooms/structure-panel';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'board', label: 'Status board' },
  { id: 'rooms', label: 'Rooms' },
  { id: 'types', label: 'Room types' },
  { id: 'structure', label: 'Buildings & floors' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function RoomsPage() {
  const { selected, properties, select } = useProperties();
  const [tab, setTab] = useState<TabId>('board');

  if (!selected) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Choose a property"
          description="Rooms belong to one property. Pick one here, or use the property selector at the top."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {properties.map((p) => <Button key={p.id} variant="secondary" onClick={() => select(p.id)}>{p.name}</Button>)}
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Rooms</h1>
        <p className="mt-1 text-sm text-slate-500">{selected.name}</p>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn('whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium', tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'board' && <RoomBoard propertyId={selected.id} />}
      {tab === 'rooms' && <RoomsTable propertyId={selected.id} />}
      {tab === 'types' && <RoomTypesPanel propertyId={selected.id} />}
      {tab === 'structure' && <StructurePanel propertyId={selected.id} />}
    </div>
  );
}

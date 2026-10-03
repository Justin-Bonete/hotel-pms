'use client';

import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, EmptyState, Field, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { keys, useStructure } from './queries';

export function StructurePanel({ propertyId }: { propertyId: string }) {
  const structure = useStructure(propertyId);
  const { can } = useAccess();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: keys.structure(propertyId) });
  const manage = can('property.update', propertyId);
  const [building, setBuilding] = useState('');

  const addBuilding = useMutation({
    mutationFn: () => api.post(`/properties/${propertyId}/buildings`, { name: building }),
    onSuccess: async () => { setBuilding(''); await refresh(); },
  });

  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (building.trim()) addBuilding.mutate(); };

  return (
    <div className="space-y-4">
      {structure.isLoading && <Spinner />}
      {structure.error && <Alert tone="error">{structure.error.message}</Alert>}
      {addBuilding.error && <Alert tone="error">{addBuilding.error.message}</Alert>}
      {structure.data?.length === 0 && <EmptyState title="No buildings yet" description="Add a building, then its floors, so rooms can be placed on the status board by floor." />}

      <div className="grid gap-4 md:grid-cols-2">
        {structure.data?.map((b) => (
          <Card key={b.id}>
            <h3 className="font-semibold text-slate-900">{b.name}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {b.floors.length === 0 && <li className="text-slate-400">No floors yet</li>}
              {b.floors.map((f) => <li key={f.id}>Floor {f.level}{f.name ? ` · ${f.name}` : ''}</li>)}
            </ul>
            {manage && <AddFloor propertyId={propertyId} buildingId={b.id} onDone={refresh} />}
          </Card>
        ))}
      </div>

      {manage && (
        <form onSubmit={onSubmit} className="flex max-w-md items-end gap-2">
          <div className="flex-1"><Field label="New building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="e.g. Main Tower" /></div>
          <Button type="submit" loading={addBuilding.isPending}>Add building</Button>
        </form>
      )}
    </div>
  );
}

function AddFloor({ propertyId, buildingId, onDone }: { propertyId: string; buildingId: string; onDone: () => Promise<unknown> }) {
  const [level, setLevel] = useState('');
  const [name, setName] = useState('');
  const add = useMutation({
    mutationFn: () => api.post(`/properties/${propertyId}/buildings/${buildingId}/floors`, { level: Number(level), name }),
    onSuccess: async () => { setLevel(''); setName(''); await onDone(); },
  });
  const valid = level !== '' && Number.isInteger(Number(level));

  return (
    <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
      <div className="flex items-end gap-2">
        <div className="w-24"><Field label="Floor #" type="number" value={level} onChange={(e) => setLevel(e.target.value)} /></div>
        <div className="flex-1"><Field label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <Button variant="secondary" disabled={!valid} loading={add.isPending} onClick={() => add.mutate()}>Add</Button>
      </div>
      {add.error && <Alert tone="error">{add.error.message}</Alert>}
    </div>
  );
}

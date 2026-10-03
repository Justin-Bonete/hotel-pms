'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, EmptyState, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { PropertyFormModal, typeLabel } from '@/features/properties/property-form';
import { PropertyGroupsCard } from '@/features/properties/property-groups-card';
import { useProperties } from '@/features/properties/property-context';
import { api } from '@/lib/api';

export default function PropertiesPage() {
  const { properties, isLoading, error, refetch, select } = useProperties();
  const { can } = useAccess();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ open: boolean; id?: string }>({ open: false });
  const [archiving, setArchiving] = useState<{ id: string; name: string } | null>(null);

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/properties/${id}`),
    onSuccess: async () => {
      setArchiving(null);
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });

  const openRooms = (id: string) => {
    select(id);
    router.push('/rooms');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-500">Every hotel, resort or unit in your organization.</p>
        </div>
        {can('property.create') && <Button onClick={() => setForm({ open: true })}>Add property</Button>}
      </div>

      {isLoading && <Spinner label="Loading properties" />}
      {error && <Alert tone="error" action={<Button variant="secondary" onClick={refetch}>Retry</Button>}>We could not load your properties. {error.message}</Alert>}
      {!isLoading && !error && properties.length === 0 && (
        <EmptyState
          title="No properties yet"
          description="Add your first property to start setting up rooms."
          action={can('property.create') ? <Button onClick={() => setForm({ open: true })}>Add property</Button> : undefined}
        />
      )}

      {properties.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Rooms</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {properties.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{typeLabel(p.type)}</td>
                  <td className="px-4 py-3 text-slate-600">{[p.city, p.region].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.groupName ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.roomCount}</td>
                  <td className="px-4 py-3"><Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status.toLowerCase()}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => openRooms(p.id)}>Rooms</Button>
                    {can('property.update', p.id) && <Button variant="ghost" onClick={() => setForm({ open: true, id: p.id })}>Edit</Button>}
                    {can('property.delete') && <Button variant="ghost" onClick={() => { archive.reset(); setArchiving({ id: p.id, name: p.name }); }}>Archive</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PropertyGroupsCard />

      <PropertyFormModal open={form.open} propertyId={form.id} onClose={() => setForm({ open: false })} />

      <Modal open={archiving !== null} title="Archive property?" onClose={() => setArchiving(null)}>
        <p className="text-sm text-slate-600">
          <strong>{archiving?.name}</strong> will be hidden from your lists. Nothing is permanently deleted. A property with rooms can’t be archived until its rooms are archived.
        </p>
        {archive.error && <div className="mt-3"><Alert tone="error">{archive.error.message}</Alert></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setArchiving(null)}>Cancel</Button>
          <Button variant="danger" loading={archive.isPending} onClick={() => archiving && archive.mutate(archiving.id)}>Archive</Button>
        </div>
      </Modal>
    </div>
  );
}

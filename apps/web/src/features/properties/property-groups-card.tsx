'use client';

import type { PropertyGroupView } from '@pms/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Alert, Button, Card, Field, Spinner } from '@/components/ui/ui';
import { api } from '@/lib/api';
import { useAccess } from '../access/access-context';

export function PropertyGroupsCard() {
  const { can } = useAccess();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const groups = useQuery({ queryKey: ['property-groups'], queryFn: () => api.get<PropertyGroupView[]>('/property-groups'), enabled: can('property_group.read') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['property-groups'] }).then(() => queryClient.invalidateQueries({ queryKey: ['properties'] }));

  const add = useMutation({ mutationFn: () => api.post('/property-groups', { name }), onSuccess: () => { setName(''); return refresh(); } });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/property-groups/${id}`), onSuccess: refresh });

  if (!can('property_group.read')) return null;
  const manage = can('property_group.manage');
  const onSubmit = (e: FormEvent) => { e.preventDefault(); if (name.trim().length >= 2) add.mutate(); };

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Property groups</h2>
      <p className="mt-1 text-sm text-slate-500">Group properties (for example by region) so you can give staff access to a whole group.</p>
      <div className="mt-4 space-y-2">
        {groups.isLoading && <Spinner />}
        {groups.error && <Alert tone="error">{groups.error.message}</Alert>}
        {groups.data?.length === 0 && <p className="text-sm text-slate-500">No groups yet.</p>}
        {groups.data?.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-slate-800">{g.name} <span className="font-normal text-slate-500">· {g.propertyCount} {g.propertyCount === 1 ? 'property' : 'properties'}</span></span>
            {manage && g.propertyCount === 0 && <Button variant="ghost" loading={remove.isPending && remove.variables === g.id} onClick={() => remove.mutate(g.id)}>Remove</Button>}
          </div>
        ))}
        {(add.error || remove.error) && <Alert tone="error">{(add.error ?? remove.error)?.message}</Alert>}
      </div>
      {manage && (
        <form onSubmit={onSubmit} className="mt-4 flex items-end gap-2">
          <div className="flex-1"><Field label="New group" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northern Luzon" /></div>
          <Button type="submit" loading={add.isPending}>Add</Button>
        </form>
      )}
    </Card>
  );
}

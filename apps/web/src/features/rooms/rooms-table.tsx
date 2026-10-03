'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RoomView } from '@pms/types';
import { roomSchema, type RoomInput } from '@pms/validation';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { api } from '@/lib/api';
import { useRefreshRooms, useRoomTypes, useRooms, useStructure } from './queries';
import { STATUS_META, compareRoomNumbers } from './status';

export function RoomsTable({ propertyId }: { propertyId: string }) {
  const rooms = useRooms(propertyId);
  const { can } = useAccess();
  const refresh = useRefreshRooms(propertyId);
  const [form, setForm] = useState<{ open: boolean; room?: RoomView }>({ open: false });
  const [archiving, setArchiving] = useState<RoomView | null>(null);
  const manage = can('room.manage', propertyId);

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/rooms/${id}`),
    onSuccess: async () => {
      setArchiving(null);
      await refresh();
    },
  });

  const sorted = useMemo(() => [...(rooms.data ?? [])].sort((a, b) => compareRoomNumbers(a.number, b.number)), [rooms.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{rooms.data ? `${rooms.data.length} rooms` : ''}</p>
        {manage && <Button onClick={() => setForm({ open: true })}>Add room</Button>}
      </div>

      {rooms.isLoading && <Spinner label="Loading rooms" />}
      {rooms.error && <Alert tone="error">{rooms.error.message}</Alert>}
      {rooms.data && sorted.length === 0 && <EmptyState title="No rooms yet" description="Add your first room to this property." action={manage ? <Button onClick={() => setForm({ open: true })}>Add room</Button> : undefined} />}

      {sorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Floor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.number}</td>
                  <td className="px-4 py-3 text-slate-600">{r.roomTypeName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.floorLabel ?? '—'}</td>
                  <td className="px-4 py-3"><Badge tone={r.status === 'AVAILABLE' ? 'success' : r.status === 'OUT_OF_ORDER' ? 'warning' : 'neutral'}>{STATUS_META[r.status].label}</Badge></td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {manage && <Button variant="ghost" onClick={() => setForm({ open: true, room: r })}>Edit</Button>}
                    {manage && <Button variant="ghost" onClick={() => { archive.reset(); setArchiving(r); }}>Archive</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RoomFormModal open={form.open} propertyId={propertyId} room={form.room} onClose={() => setForm({ open: false })} />

      <Modal open={archiving !== null} title="Archive room?" onClose={() => setArchiving(null)}>
        <p className="text-sm text-slate-600">Room <strong>{archiving?.number}</strong> will be hidden from the board. Nothing is permanently deleted, and its number can be reused.</p>
        {archive.error && <div className="mt-3"><Alert tone="error">{archive.error.message}</Alert></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setArchiving(null)}>Cancel</Button>
          <Button variant="danger" loading={archive.isPending} onClick={() => archiving && archive.mutate(archiving.id)}>Archive</Button>
        </div>
      </Modal>
    </div>
  );
}

function RoomFormModal({ open, propertyId, room, onClose }: { open: boolean; propertyId: string; room?: RoomView; onClose: () => void }) {
  const types = useRoomTypes(propertyId);
  const structure = useStructure(propertyId);
  const refresh = useRefreshRooms(propertyId);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RoomInput>({
    resolver: zodResolver(roomSchema),
    defaultValues: { number: '', roomTypeId: '', floorId: '', notes: '' },
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(room ? { number: room.number, roomTypeId: room.roomTypeId, floorId: room.floorId ?? '', notes: room.notes ?? '' } : { number: '', roomTypeId: '', floorId: '', notes: '' });
  }, [open, room, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      if (room) await api.patch(`/rooms/${room.id}`, values);
      else await api.post(`/properties/${propertyId}/rooms`, values);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the room.');
    }
  });

  const noTypes = types.data?.length === 0;
  return (
    <Modal open={open} onClose={onClose} title={room ? `Edit room ${room.number}` : 'Add room'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {noTypes && <Alert tone="warning">This property has no room types yet. Create one in the Room types tab first.</Alert>}
        <Field label="Room number" error={errors.number?.message} {...register('number')} />
        <SelectField label="Room type" error={errors.roomTypeId?.message} {...register('roomTypeId')}>
          <option value="">Choose a type…</option>
          {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </SelectField>
        <SelectField label="Floor (optional)" error={errors.floorId?.message} {...register('floorId')}>
          <option value="">No floor</option>
          {structure.data?.flatMap((b) => b.floors.map((f) => <option key={f.id} value={f.id}>{b.name} · {f.name ?? `Floor ${f.level}`}</option>))}
        </SelectField>
        <TextareaField label="Notes (optional)" error={errors.notes?.message} {...register('notes')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting} disabled={noTypes}>{room ? 'Save changes' : 'Add room'}</Button>
        </div>
      </form>
    </Modal>
  );
}

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { RoomTypeView } from '@pms/types';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { api } from '@/lib/api';
import { useRefreshRooms, useRoomTypes } from './queries';

// Form version of roomTypeSchema: amenities are typed as a comma-separated list.
const formSchema = z.object({
  name: z.string().trim().min(2, 'Enter a name').max(80),
  description: z.string().trim().max(500),
  maxOccupancy: z.number({ invalid_type_error: 'Enter a number' }).int('Whole number').min(1).max(20),
  bedConfiguration: z.string().trim().max(120),
  amenitiesText: z.string().max(600),
});
type FormValues = z.infer<typeof formSchema>;

const toAmenities = (text: string): string[] => text.split(',').map((a) => a.trim()).filter(Boolean);
const EMPTY: FormValues = { name: '', description: '', maxOccupancy: 2, bedConfiguration: '', amenitiesText: '' };

export function RoomTypesPanel({ propertyId }: { propertyId: string }) {
  const types = useRoomTypes(propertyId);
  const { can } = useAccess();
  const refresh = useRefreshRooms(propertyId);
  const [form, setForm] = useState<{ open: boolean; type?: RoomTypeView }>({ open: false });
  const manage = can('room_type.manage', propertyId);

  const archive = useMutation({ mutationFn: (id: string) => api.delete(`/room-types/${id}`), onSuccess: refresh });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{manage && <Button onClick={() => setForm({ open: true })}>Add room type</Button>}</div>
      {types.isLoading && <Spinner />}
      {types.error && <Alert tone="error">{types.error.message}</Alert>}
      {archive.error && <Alert tone="error">{archive.error.message}</Alert>}
      {types.data?.length === 0 && <EmptyState title="No room types yet" description="Room types (Standard, Deluxe, Suite…) group rooms that share beds and amenities." action={manage ? <Button onClick={() => setForm({ open: true })}>Add room type</Button> : undefined} />}

      <div className="grid gap-4 md:grid-cols-2">
        {types.data?.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                <p className="mt-0.5 text-sm text-slate-500">Sleeps {t.maxOccupancy}{t.bedConfiguration ? ` · ${t.bedConfiguration}` : ''}</p>
              </div>
              <Badge>{t.roomCount} {t.roomCount === 1 ? 'room' : 'rooms'}</Badge>
            </div>
            {t.description && <p className="mt-2 text-sm text-slate-600">{t.description}</p>}
            {t.amenities.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{t.amenities.map((a) => <span key={a} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a}</span>)}</div>}
            {manage && (
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setForm({ open: true, type: t })}>Edit</Button>
                <Button variant="ghost" loading={archive.isPending && archive.variables === t.id} onClick={() => archive.mutate(t.id)}>Archive</Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <RoomTypeFormModal open={form.open} propertyId={propertyId} type={form.type} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function RoomTypeFormModal({ open, propertyId, type, onClose }: { open: boolean; propertyId: string; type?: RoomTypeView; onClose: () => void }) {
  const refresh = useRefreshRooms(propertyId);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(type ? { name: type.name, description: type.description ?? '', maxOccupancy: type.maxOccupancy, bedConfiguration: type.bedConfiguration ?? '', amenitiesText: type.amenities.join(', ') } : EMPTY);
  }, [open, type, reset]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const body = { name: v.name, description: v.description, maxOccupancy: v.maxOccupancy, bedConfiguration: v.bedConfiguration, amenities: toAmenities(v.amenitiesText) };
    try {
      if (type) await api.patch(`/room-types/${type.id}`, body);
      else await api.post(`/properties/${propertyId}/room-types`, body);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the room type.');
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={type ? 'Edit room type' : 'Add room type'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name" error={errors.name?.message} {...register('name')} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Sleeps (max guests)" type="number" min={1} max={20} error={errors.maxOccupancy?.message} {...register('maxOccupancy', { valueAsNumber: true })} />
          <Field label="Bed configuration" placeholder="e.g. 1 King bed" error={errors.bedConfiguration?.message} {...register('bedConfiguration')} />
        </div>
        <Field label="Amenities (comma separated)" placeholder="Wi-Fi, Air conditioning, TV" error={errors.amenitiesText?.message} {...register('amenitiesText')} />
        <TextareaField label="Description (optional)" error={errors.description?.message} {...register('description')} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{type ? 'Save changes' : 'Add room type'}</Button>
        </div>
      </form>
    </Modal>
  );
}

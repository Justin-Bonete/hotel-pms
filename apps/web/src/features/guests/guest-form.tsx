'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { GuestDetail } from '@pms/types';
import { guestSchema, type GuestInput } from '@pms/validation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '@/components/ui/modal';
import { Alert, Button, Field, TextareaField } from '@/components/ui/ui';
import { useRefreshReservations } from '@/features/reservations/queries';
import { api } from '@/lib/api';

const EMPTY: GuestInput = { firstName: '', lastName: '', email: '', phone: '', country: 'PH', preferences: '', notes: '', isVip: false };

export function GuestFormModal({ open, guest, onClose }: { open: boolean; guest?: GuestDetail; onClose: () => void }) {
  const refresh = useRefreshReservations();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<GuestInput>({ resolver: zodResolver(guestSchema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(guest ? { firstName: guest.firstName, lastName: guest.lastName, email: guest.email ?? '', phone: guest.phone ?? '', country: guest.country ?? '', preferences: guest.preferences ?? '', notes: guest.notes ?? '', isVip: guest.isVip } : EMPTY);
  }, [open, guest, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      if (guest) await api.patch(`/guests/${guest.id}`, values);
      else await api.post('/guests', values);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the guest.');
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={guest ? 'Edit guest' : 'Add guest'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <Field label="Last name" error={errors.lastName?.message} {...register('lastName')} />
          <Field label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Field label="Phone" error={errors.phone?.message} {...register('phone')} />
          <Field label="Country (2 letters)" maxLength={2} error={errors.country?.message} {...register('country')} />
        </div>
        <TextareaField label="Preferences (optional)" placeholder="e.g. High floor, extra pillows" error={errors.preferences?.message} {...register('preferences')} />
        <TextareaField label="Internal notes (optional)" error={errors.notes?.message} {...register('notes')} />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" {...register('isVip')} /> VIP guest
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>{guest ? 'Save changes' : 'Add guest'}</Button>
        </div>
      </form>
    </Modal>
  );
}

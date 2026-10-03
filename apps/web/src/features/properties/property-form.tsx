'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PROPERTY_TYPES, type PropertyDetail, type PropertyGroupView } from '@pms/types';
import { propertyFormSchema, type PropertyFormInput } from '@pms/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Field, SelectField, Spinner } from '@/components/ui/ui';
import { Modal } from '@/components/ui/modal';
import { api } from '@/lib/api';
import { useAccess } from '../access/access-context';

export const typeLabel = (t: string): string => t.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const EMPTY: PropertyFormInput = {
  name: '', type: 'HOTEL', groupId: '', addressLine1: '', addressLine2: '', city: '', region: '', postalCode: '',
  country: 'PH', phone: '', email: '', timezone: 'Asia/Manila', currency: 'PHP', checkInTime: '14:00', checkOutTime: '12:00',
};

const fromDetail = (p: PropertyDetail): PropertyFormInput => ({
  name: p.name, type: p.type as PropertyFormInput['type'], groupId: p.groupId ?? '', addressLine1: p.addressLine1 ?? '',
  addressLine2: p.addressLine2 ?? '', city: p.city ?? '', region: p.region ?? '', postalCode: p.postalCode ?? '',
  country: p.country, phone: p.phone ?? '', email: p.email ?? '', timezone: p.timezone, currency: p.currency,
  checkInTime: p.checkInTime, checkOutTime: p.checkOutTime,
});

export function PropertyFormModal({ open, propertyId, onClose }: { open: boolean; propertyId?: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { can } = useAccess();
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(propertyId);

  const detail = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => api.get<PropertyDetail>(`/properties/${propertyId}`),
    enabled: open && editing,
  });
  const groups = useQuery({
    queryKey: ['property-groups'],
    queryFn: () => api.get<PropertyGroupView[]>('/property-groups'),
    enabled: open && can('property_group.read'),
  });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PropertyFormInput>({
    resolver: zodResolver(propertyFormSchema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    reset(editing ? (detail.data ? fromDetail(detail.data) : EMPTY) : EMPTY);
  }, [open, editing, detail.data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      if (editing) await api.patch(`/properties/${propertyId}`, values);
      else await api.post('/properties', values);
      await queryClient.invalidateQueries({ queryKey: ['properties'] });
      await queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the property.');
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit property' : 'Add property'}>
      {editing && detail.isLoading ? (
        <Spinner />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Property name" error={errors.name?.message} {...register('name')} />
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Type" error={errors.type?.message} {...register('type')}>
              {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{typeLabel(t)}</option>)}
            </SelectField>
            <SelectField label="Group" error={errors.groupId?.message} {...register('groupId')}>
              <option value="">No group</option>
              {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </SelectField>
          </div>
          <Field label="Address" error={errors.addressLine1?.message} {...register('addressLine1')} />
          <Field label="Address line 2 (optional)" error={errors.addressLine2?.message} {...register('addressLine2')} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" error={errors.city?.message} {...register('city')} />
            <Field label="Region / province" error={errors.region?.message} {...register('region')} />
            <Field label="Postal code" error={errors.postalCode?.message} {...register('postalCode')} />
            <Field label="Country (2 letters)" maxLength={2} error={errors.country?.message} {...register('country')} />
            <Field label="Phone" error={errors.phone?.message} {...register('phone')} />
            <Field label="Email" type="email" error={errors.email?.message} {...register('email')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Timezone" list="timezones" error={errors.timezone?.message} {...register('timezone')} />
            <Field label="Currency" maxLength={3} error={errors.currency?.message} {...register('currency')} />
            <Field label="Check-in time" type="time" error={errors.checkInTime?.message} {...register('checkInTime')} />
            <Field label="Check-out time" type="time" error={errors.checkOutTime?.message} {...register('checkOutTime')} />
          </div>
          <datalist id="timezones">
            {typeof Intl.supportedValuesOf === 'function' && Intl.supportedValuesOf('timeZone').map((z) => <option key={z} value={z} />)}
          </datalist>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isSubmitting}>{editing ? 'Save changes' : 'Create property'}</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

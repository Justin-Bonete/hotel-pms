'use client';

import { addDays, todayIn } from '@pms/types';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, EmptyState, Field, SelectField, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { AvailabilityTable } from '@/features/calendar/availability-table';
import { Timeline } from '@/features/calendar/timeline';
import { useProperties } from '@/features/properties/property-context';
import { usePropertyDetail } from '@/features/properties/queries';
import { ReservationDetailModal } from '@/features/reservations/reservation-detail';
import { ReservationFormModal } from '@/features/reservations/reservation-form';
import { useCalendar } from '@/features/reservations/queries';
import type { ReservationView } from '@pms/types';

export default function CalendarPage() {
  const { selected, properties, select } = useProperties();
  const { can } = useAccess();
  if (!selected) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Choose a property"
          description="The calendar shows one property at a time. Pick one here, or use the property selector at the top."
          action={<div className="flex flex-wrap justify-center gap-2">{properties.map((p) => <Button key={p.id} variant="secondary" onClick={() => select(p.id)}>{p.name}</Button>)}</div>}
        />
      </div>
    );
  }
  return <PropertyCalendar propertyId={selected.id} propertyName={selected.name} canCreate={can('reservation.manage', selected.id)} />;
}

function PropertyCalendar({ propertyId, propertyName, canCreate }: { propertyId: string; propertyName: string; canCreate: boolean }) {
  const detail = usePropertyDetail(propertyId);
  const timezone = detail.data?.timezone ?? 'Asia/Manila';
  const today = useMemo(() => todayIn(timezone), [timezone]);
  const [from, setFrom] = useState<string | null>(null);
  const [days, setDays] = useState(14);
  const start = from ?? addDays(today, -1);
  const calendar = useCalendar(propertyId, start, days);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; reservation?: ReservationView; arrivalDate?: string; roomTypeId?: string }>({ open: false });

  useEffect(() => setFrom(null), [propertyId]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="secondary" onClick={() => setFrom(addDays(start, -7))}>← Week</Button>
          <Button variant="secondary" onClick={() => setFrom(null)}>Today</Button>
          <Button variant="secondary" onClick={() => setFrom(addDays(start, 7))}>Week →</Button>
          <div className="w-40"><Field label="Start date" type="date" value={start} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
          <div className="w-28">
            <SelectField label="Range" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </SelectField>
          </div>
          <Button disabled={!canCreate} onClick={() => setForm({ open: true })}>New reservation</Button>
        </div>
      </div>

      {calendar.isLoading && <Spinner label="Loading calendar" />}
      {calendar.error && <Alert tone="error" action={<Button variant="secondary" onClick={() => calendar.refetch()}>Retry</Button>}>We could not load the calendar. {calendar.error.message}</Alert>}
      {calendar.data && (
        <Timeline
          view={calendar.data}
          canCreate={canCreate}
          onOpen={setOpenId}
          onCreate={(roomTypeId, date) => setForm({ open: true, roomTypeId, arrivalDate: date })}
        />
      )}
      <AvailabilityTable propertyId={propertyId} from={start} days={days} />

      <ReservationDetailModal id={openId} onClose={() => setOpenId(null)} onEdit={(r) => { setOpenId(null); setForm({ open: true, reservation: r }); }} />
      <ReservationFormModal
        open={form.open}
        onClose={() => setForm({ open: false })}
        propertyId={propertyId}
        propertyName={propertyName}
        timezone={timezone}
        reservation={form.reservation}
        defaults={{ arrivalDate: form.arrivalDate, roomTypeId: form.roomTypeId }}
      />
    </div>
  );
}

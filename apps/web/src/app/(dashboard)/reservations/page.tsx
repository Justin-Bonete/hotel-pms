'use client';

import { RESERVATION_STATUSES, formatMoney, type ReservationView } from '@pms/types';
import { useState } from 'react';
import { Alert, Button, EmptyState, Field, SelectField, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useProperties } from '@/features/properties/property-context';
import { usePropertyDetail } from '@/features/properties/queries';
import { ReservationDetailModal } from '@/features/reservations/reservation-detail';
import { ReservationFormModal } from '@/features/reservations/reservation-form';
import { useReservations } from '@/features/reservations/queries';
import { RESERVATION_META, shortDate } from '@/features/reservations/status';
import { useDebouncedValue } from '@/lib/hooks';

export default function ReservationsPage() {
  const { selected, properties } = useProperties();
  const { can } = useAccess();
  const detail = usePropertyDetail(selected?.id);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; reservation?: ReservationView }>({ open: false });
  const debounced = useDebouncedValue(search.trim(), 300);

  const list = useReservations({ propertyId: selected?.id, status: status || undefined, search: debounced || undefined, page });
  const rows = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;
  const pages = Math.max(Math.ceil(total / 25), 1);
  const canCreate = Boolean(selected) && can('reservation.manage', selected?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reservations</h1>
          <p className="mt-1 text-sm text-slate-500">{selected ? selected.name : `All properties (${properties.length})`}</p>
        </div>
        <Button disabled={!canCreate} title={selected ? undefined : 'Choose a property in the top bar to create a reservation'} onClick={() => setForm({ open: true })}>
          New reservation
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Field label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Guest name or reservation code" />
        <SelectField label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {RESERVATION_STATUSES.map((s) => <option key={s} value={s}>{RESERVATION_META[s].label}</option>)}
        </SelectField>
      </div>

      {list.isLoading && <Spinner label="Loading reservations" />}
      {list.error && <Alert tone="error" action={<Button variant="secondary" onClick={() => list.refetch()}>Retry</Button>}>We could not load reservations. {list.error.message}</Alert>}
      {!list.isLoading && !list.error && rows.length === 0 && (
        <EmptyState
          title={debounced || status ? 'No matching reservations' : 'No reservations yet'}
          description={debounced || status ? 'Try a different search or status.' : 'Create your first reservation to start filling the calendar.'}
          action={canCreate && !debounced && !status ? <Button onClick={() => setForm({ open: true })}>New reservation</Button> : undefined}
        />
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Guest</th>
                {!selected && <th className="px-4 py-3 font-medium">Property</th>}
                <th className="px-4 py-3 font-medium">Stay</th>
                <th className="px-4 py-3 font-medium">Room</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Room charges</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(r.id)}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.guestName}</td>
                  {!selected && <td className="px-4 py-3 text-slate-600">{r.propertyName}</td>}
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{shortDate(r.arrivalDate)} → {shortDate(r.departureDate)} <span className="text-slate-400">· {r.nights}n</span></td>
                  <td className="px-4 py-3 text-slate-600">{r.roomNumber ? `${r.roomNumber} · ` : ''}{r.roomTypeName}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${RESERVATION_META[r.status].badge}`}>{RESERVATION_META[r.status].label}</span></td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(r.totalMinor, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 25 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pages} · {total} reservations</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <ReservationDetailModal id={openId} onClose={() => setOpenId(null)} onEdit={(r) => { setOpenId(null); setForm({ open: true, reservation: r }); }} />
      {(selected || form.reservation) && (
        <ReservationFormModal
          open={form.open}
          onClose={() => setForm({ open: false })}
          propertyId={form.reservation?.propertyId ?? selected!.id}
          propertyName={form.reservation?.propertyName ?? selected!.name}
          timezone={detail.data?.timezone}
          reservation={form.reservation}
        />
      )}
    </div>
  );
}

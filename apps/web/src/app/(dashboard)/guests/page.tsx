'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, EmptyState, Field, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { GuestFormModal } from '@/features/guests/guest-form';
import { useGuest, useGuests } from '@/features/reservations/queries';
import { RESERVATION_META, shortDate } from '@/features/reservations/status';
import { formatMoney } from '@pms/types';
import { useDebouncedValue } from '@/lib/hooks';

export default function GuestsPage() {
  const { can } = useAccess();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState(false);
  const debounced = useDebouncedValue(search, 300);
  const list = useGuests(debounced, page);
  const rows = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;
  const pages = Math.max(Math.ceil(total / 20), 1);
  const manage = can('guest.manage');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Guests</h1>
          <p className="mt-1 text-sm text-slate-500">One profile per guest across all your properties. Opening a profile is recorded in the audit log.</p>
        </div>
        {manage && <Button onClick={() => setForm(true)}>Add guest</Button>}
      </div>

      <Field label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name, email or phone" />

      {list.isLoading && <Spinner label="Loading guests" />}
      {list.error && <Alert tone="error" action={<Button variant="secondary" onClick={() => list.refetch()}>Retry</Button>}>{list.error.message}</Alert>}
      {!list.isLoading && !list.error && rows.length === 0 && (
        <EmptyState title={debounced ? 'No matching guests' : 'No guests yet'} description={debounced ? 'Try a different name, email or phone.' : 'Guests appear here when you add them or create a reservation.'} action={manage && !debounced ? <Button onClick={() => setForm(true)}>Add guest</Button> : undefined} />
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Guest</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Completed stays</th>
                <th className="px-4 py-3 font-medium">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((g) => (
                <tr key={g.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(g.id)}>
                  <td className="px-4 py-3 font-medium text-slate-900">{g.fullName}</td>
                  <td className="px-4 py-3 text-slate-600">{g.email ?? g.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{g.country ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{g.stayCount}</td>
                  <td className="px-4 py-3 space-x-1">
                    {g.isVip && <Badge tone="warning">VIP</Badge>}
                    <Badge tone={g.stayCount > 0 ? 'success' : 'info'}>{g.stayCount > 0 ? 'Returning' : 'New'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pages} · {total} guests</span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      <GuestDetailModal id={openId} canManage={manage} onClose={() => setOpenId(null)} />
      <GuestFormModal open={form} onClose={() => setForm(false)} />
    </div>
  );
}

function GuestDetailModal({ id, canManage, onClose }: { id: string | null; canManage: boolean; onClose: () => void }) {
  const guest = useGuest(id);
  const [editing, setEditing] = useState(false);
  if (!id) return null;
  const g = guest.data;
  return (
    <>
      <Modal open={!editing} title={g?.fullName ?? 'Guest'} onClose={onClose}>
        {guest.isLoading && <Spinner />}
        {guest.error && <Alert tone="error">{guest.error.message}</Alert>}
        {g && (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              {g.isVip && <Badge tone="warning">VIP</Badge>}
              <Badge tone={g.stayCount > 0 ? 'success' : 'info'}>{g.stayCount > 0 ? `Returning · ${g.stayCount} completed stays` : 'New guest'}</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Info label="Email" value={g.email} />
              <Info label="Phone" value={g.phone} />
              <Info label="Country" value={g.country} />
              <Info label="Profile created" value={new Date(g.createdAt).toLocaleDateString()} />
            </dl>
            {g.preferences && <Info label="Preferences" value={g.preferences} />}
            {g.notes && <Info label="Internal notes" value={g.notes} />}

            <div>
              <h3 className="mb-2 font-semibold text-slate-800">Stays you can see</h3>
              {g.stays.length === 0 ? (
                <p className="text-slate-500">No stays yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                  {g.stays.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>
                        <span className="font-medium text-slate-800">{s.propertyName}</span>
                        <span className="block text-xs text-slate-500">{shortDate(s.arrivalDate)} → {shortDate(s.departureDate)} · {s.roomTypeName}{s.roomNumber ? ` · ${s.roomNumber}` : ''}</span>
                      </span>
                      <span className="text-right">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESERVATION_META[s.status].badge}`}>{RESERVATION_META[s.status].label}</span>
                        <span className="block text-xs text-slate-500">{formatMoney(s.totalMinor, s.currency)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canManage && <div className="flex justify-end"><Button variant="secondary" onClick={() => setEditing(true)}>Edit guest</Button></div>}
          </div>
        )}
      </Modal>
      <GuestFormModal open={editing} guest={g} onClose={() => setEditing(false)} />
    </>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value || '—'}</dd>
    </div>
  );
}

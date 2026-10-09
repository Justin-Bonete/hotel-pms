'use client';

import type { ReservationAction, ReservationView } from '@pms/types';
import { formatMoney } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useRooms } from '@/features/rooms/queries';
import { STATUS_META } from '@/features/rooms/status';
import { api } from '@/lib/api';
import { useRefreshReservations, useReservation } from './queries';
import { RESERVATION_META, SOURCE_LABELS, shortDate } from './status';

export function ReservationDetailModal({ id, onClose, onEdit }: { id: string | null; onClose: () => void; onEdit: (r: ReservationView) => void }) {
  const query = useReservation(id);
  if (!id) return null;
  return (
    <Modal open title={query.data ? `Reservation ${query.data.code}` : 'Reservation'} onClose={onClose}>
      {query.isLoading && <Spinner />}
      {query.error && <Alert tone="error">{query.error.message}</Alert>}
      {query.data && <Body r={query.data} onEdit={onEdit} />}
    </Modal>
  );
}

function Body({ r, onEdit }: { r: ReservationView; onEdit: (r: ReservationView) => void }) {
  const { can } = useAccess();
  const refresh = useRefreshReservations();
  const rooms = useRooms(r.propertyId);
  const [roomId, setRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const act = useMutation({
    mutationFn: (v: { action: ReservationAction; roomId?: string; reason?: string }) => api.post(`/reservations/${r.id}/transition`, v),
    onSuccess: async () => {
      setCancelling(false);
      setReason('');
      setRoomId('');
      await refresh();
    },
  });

  const manage = can('reservation.manage', r.propertyId);
  const frontDesk = can('reservation.check_in', r.propertyId);

  // Rooms of the booked type that can take a guest now (clean, not occupied). Server re-checks everything.
  const choices = useMemo(
    () =>
      (rooms.data ?? [])
        .filter((room) => room.roomTypeId === r.roomTypeId || r.status === 'CHECKED_IN')
        .filter((room) => ['AVAILABLE', 'INSPECTED'].includes(room.status) && room.derived !== 'OCCUPIED' && room.derived !== 'DUE_OUT')
        .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    [rooms.data, r.roomTypeId, r.status],
  );
  const run = (action: ReservationAction, extra: { roomId?: string; reason?: string } = {}) => act.mutate({ action, ...extra });

  const status = RESERVATION_META[r.status];
  const open = ['INQUIRY', 'PENDING', 'CONFIRMED'].includes(r.status);
  const holding = ['PENDING', 'CONFIRMED'].includes(r.status);

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.badge}`}>{status.label}</span>
        <span className="text-slate-500">{r.propertyName}</span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Item label="Guest" value={r.guestName} />
        <Item label="Source" value={SOURCE_LABELS[r.source] ?? r.source} />
        <Item label="Stay" value={`${shortDate(r.arrivalDate)} → ${shortDate(r.departureDate)} (${r.nights} ${r.nights === 1 ? 'night' : 'nights'})`} />
        <Item label="Guests" value={`${r.adults} adult${r.adults === 1 ? '' : 's'}${r.children ? `, ${r.children} child${r.children === 1 ? '' : 'ren'}` : ''}`} />
        <Item label="Room type" value={r.roomTypeName} />
        <Item label="Room" value={r.roomNumber ?? 'Not assigned yet'} />
        <Item label="Rate plan" value={r.ratePlanName ?? '—'} />
        <Item label="Room charges" value={formatMoney(r.totalMinor, r.currency)} />
      </dl>
      {r.specialRequests && <Item label="Special requests" value={r.specialRequests} />}
      {r.notes && <Item label="Internal notes" value={r.notes} />}
      {r.cancelReason && <Item label="Cancellation reason" value={r.cancelReason} />}

      <Alert tone="info">Folio, extra charges and payments arrive in Phase 3b. The amount above is the room charge only.</Alert>
      {act.error && <Alert tone="error">{act.error.message}</Alert>}

      {(holding || r.status === 'CHECKED_IN') && frontDesk && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="font-medium text-slate-700">{r.status === 'CHECKED_IN' ? 'Change room' : 'Room'}</p>
          <div className="flex flex-wrap items-center gap-2">
            <select value={roomId} onChange={(e) => setRoomId(e.target.value)} className="rounded-lg border-0 px-3 py-2 text-sm ring-1 ring-inset ring-slate-300">
              <option value="">{choices.length ? 'Choose a room…' : 'No ready room of this type'}</option>
              {choices.map((room) => <option key={room.id} value={room.id}>{room.number} · {STATUS_META[room.status].label}</option>)}
            </select>
            {r.status === 'CONFIRMED' && (
              <Button loading={act.isPending && act.variables?.action === 'check_in'} disabled={!roomId && !r.roomId} onClick={() => run('check_in', roomId ? { roomId } : {})}>
                Check in
              </Button>
            )}
            {manage && (
              <Button variant="secondary" disabled={!roomId} loading={act.isPending && act.variables?.action === 'assign_room'} onClick={() => run('assign_room', { roomId })}>
                {r.status === 'CHECKED_IN' ? 'Move guest' : 'Assign room'}
              </Button>
            )}
            {manage && holding && r.roomId && <Button variant="ghost" onClick={() => run('unassign_room')}>Unassign</Button>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {r.status === 'CHECKED_IN' && frontDesk && <Button loading={act.isPending && act.variables?.action === 'check_out'} onClick={() => run('check_out')}>Check out</Button>}
        {['INQUIRY', 'PENDING'].includes(r.status) && manage && <Button loading={act.isPending && act.variables?.action === 'confirm'} onClick={() => run('confirm')}>Confirm</Button>}
        {open && manage && <Button variant="secondary" onClick={() => onEdit(r)}>Edit</Button>}
        {holding && manage && <Button variant="secondary" loading={act.isPending && act.variables?.action === 'no_show'} onClick={() => run('no_show')}>No-show</Button>}
        {open && manage && <Button variant="danger" onClick={() => setCancelling((c) => !c)}>Cancel reservation</Button>}
      </div>

      {cancelling && (
        <div className="space-y-2 rounded-lg bg-red-50 p-3">
          <TextareaField label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelling(false)}>Keep it</Button>
            <Button variant="danger" loading={act.isPending && act.variables?.action === 'cancel'} onClick={() => run('cancel', { reason })}>Cancel reservation</Button>
          </div>
        </div>
      )}
      {r.checkedInAt && <Badge>Checked in {new Date(r.checkedInAt).toLocaleString()}</Badge>}
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{value}</dd>
    </div>
  );
}

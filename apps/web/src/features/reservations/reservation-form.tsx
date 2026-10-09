'use client';

import { RESERVATION_SOURCES, formatMoney, nightsBetween, quoteStay, todayIn, addDays, type GuestView, type ReservationView } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Button, Field, SelectField, TextareaField } from '@/components/ui/ui';
import { useRoomTypes } from '@/features/rooms/queries';
import { api, } from '@/lib/api';
import { useRatePlans, useRefreshReservations } from './queries';
import { SOURCE_LABELS } from './status';

interface Props {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  propertyName: string;
  timezone?: string;
  /** Edit mode when set. Only dates, guests count, rate plan and notes can change. */
  reservation?: ReservationView;
  /** Pre-fill from the calendar. */
  defaults?: { arrivalDate?: string; roomTypeId?: string };
}

export function ReservationFormModal({ open, onClose, propertyId, propertyName, timezone = 'Asia/Manila', reservation, defaults }: Props) {
  const editing = Boolean(reservation);
  const today = todayIn(timezone);
  const refresh = useRefreshReservations();
  const roomTypes = useRoomTypes(propertyId);
  const plans = useRatePlans(propertyId);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [guest, setGuest] = useState<GuestView | null>(null);
  const [search, setSearch] = useState('');
  const [newGuest, setNewGuest] = useState({ firstName: '', lastName: '', email: '', phone: '', country: 'PH' });
  const [f, setF] = useState({ roomTypeId: '', ratePlanId: '', arrivalDate: today, departureDate: addDays(today, 1), adults: 2, children: 0, source: 'PHONE', status: 'CONFIRMED', specialRequests: '', notes: '' });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setGuest(null);
    setSearch('');
    setGuestMode('existing');
    if (reservation) {
      setF({ roomTypeId: reservation.roomTypeId, ratePlanId: reservation.ratePlanId ?? '', arrivalDate: reservation.arrivalDate, departureDate: reservation.departureDate, adults: reservation.adults, children: reservation.children, source: reservation.source, status: reservation.status, specialRequests: reservation.specialRequests ?? '', notes: reservation.notes ?? '' });
    } else {
      const arrival = defaults?.arrivalDate ?? today;
      setF({ roomTypeId: defaults?.roomTypeId ?? '', ratePlanId: '', arrivalDate: arrival, departureDate: addDays(arrival, 1), adults: 2, children: 0, source: 'PHONE', status: 'CONFIRMED', specialRequests: '', notes: '' });
    }
  }, [open, reservation, defaults?.arrivalDate, defaults?.roomTypeId, today]);

  const guestSearch = useQuery({
    queryKey: ['guest-picker', search],
    queryFn: async () => (await api.page<GuestView>(`/guests?pageSize=5&search=${encodeURIComponent(search)}`)).data,
    enabled: open && !editing && guestMode === 'existing' && search.trim().length >= 2,
  });

  const defaultPlan = plans.data?.find((p) => p.isDefault);
  const plan = plans.data?.find((p) => p.id === f.ratePlanId) ?? defaultPlan;
  const rate = plan?.rates.find((r) => r.roomTypeId === f.roomTypeId);
  const nights = nightsBetween(f.arrivalDate, f.departureDate);
  const quote = useMemo(() => (rate && nights > 0 ? quoteStay(f.arrivalDate, f.departureDate, rate) : null), [rate, f.arrivalDate, f.departureDate, nights]);
  const selectedType = roomTypes.data?.find((t) => t.id === f.roomTypeId);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    setError(null);
    if (!editing && guestMode === 'existing' && !guest) return setError('Choose a guest, or switch to "New guest".');
    if (!editing && guestMode === 'new' && (!newGuest.firstName.trim() || !newGuest.lastName.trim())) return setError('Enter the guest’s first and last name.');
    if (!editing && !f.roomTypeId) return setError('Choose a room type.');
    if (nights < 1) return setError('Departure must be after arrival.');
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/reservations/${reservation!.id}`, { arrivalDate: f.arrivalDate, departureDate: f.departureDate, adults: f.adults, children: f.children, ratePlanId: f.ratePlanId || undefined, specialRequests: f.specialRequests, notes: f.notes });
      } else {
        await api.post(`/properties/${propertyId}/reservations`, {
          ...(guestMode === 'existing' ? { guestId: guest!.id } : { newGuest: { ...newGuest, preferences: '', notes: '', isVip: false } }),
          roomTypeId: f.roomTypeId, ratePlanId: f.ratePlanId || undefined, arrivalDate: f.arrivalDate, departureDate: f.departureDate,
          adults: f.adults, children: f.children, source: f.source, status: f.status, specialRequests: f.specialRequests, notes: f.notes,
        });
      }
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the reservation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${reservation!.code}` : `New reservation · ${propertyName}`}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {plans.data?.length === 0 && <Alert tone="warning">This property has no rate plan yet. Create one in Rooms → Rates before taking reservations.</Alert>}

        {!editing && (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3">
            <div className="flex gap-2 text-sm">
              {(['existing', 'new'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setGuestMode(m)} className={`rounded-full px-3 py-1 ${guestMode === m ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}>
                  {m === 'existing' ? 'Existing guest' : 'New guest'}
                </button>
              ))}
            </div>
            {guestMode === 'existing' ? (
              guest ? (
                <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                  <span><strong>{guest.fullName}</strong> <span className="text-slate-500">{guest.email ?? guest.phone ?? ''}</span></span>
                  <Button variant="ghost" onClick={() => setGuest(null)}>Change</Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Field label="Search guest" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone" />
                  {guestSearch.data?.map((g) => (
                    <button key={g.id} type="button" onClick={() => setGuest(g)} className="block w-full rounded-lg bg-white px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:bg-indigo-50">
                      <strong>{g.fullName}</strong> <span className="text-slate-500">{g.email ?? g.phone ?? ''}</span>
                    </button>
                  ))}
                  {guestSearch.data?.length === 0 && <p className="text-xs text-slate-500">No match. Switch to “New guest”.</p>}
                </div>
              )
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" value={newGuest.firstName} onChange={(e) => setNewGuest({ ...newGuest, firstName: e.target.value })} />
                <Field label="Last name" value={newGuest.lastName} onChange={(e) => setNewGuest({ ...newGuest, lastName: e.target.value })} />
                <Field label="Email" type="email" value={newGuest.email} onChange={(e) => setNewGuest({ ...newGuest, email: e.target.value })} />
                <Field label="Phone" value={newGuest.phone} onChange={(e) => setNewGuest({ ...newGuest, phone: e.target.value })} />
              </div>
            )}
          </div>
        )}

        {!editing && (
          <SelectField label="Room type" value={f.roomTypeId} onChange={(e) => set('roomTypeId', e.target.value)}>
            <option value="">Choose a room type…</option>
            {roomTypes.data?.map((t) => <option key={t.id} value={t.id}>{t.name} · sleeps {t.maxOccupancy} · {t.roomCount} rooms</option>)}
          </SelectField>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Arrival" type="date" min={editing ? undefined : today} value={f.arrivalDate} onChange={(e) => { set('arrivalDate', e.target.value); if (e.target.value >= f.departureDate) set('departureDate', addDays(e.target.value, 1)); }} />
          <Field label="Departure" type="date" min={addDays(f.arrivalDate, 1)} value={f.departureDate} onChange={(e) => set('departureDate', e.target.value)} />
          <Field label="Adults" type="number" min={1} max={20} value={f.adults} onChange={(e) => set('adults', Number(e.target.value))} />
          <Field label="Children" type="number" min={0} max={20} value={f.children} onChange={(e) => set('children', Number(e.target.value))} />
        </div>
        {selectedType && f.adults + f.children > selectedType.maxOccupancy && <Alert tone="warning">{selectedType.name} sleeps at most {selectedType.maxOccupancy} guests.</Alert>}

        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Rate plan" value={f.ratePlanId} onChange={(e) => set('ratePlanId', e.target.value)}>
            <option value="">{defaultPlan ? `Default (${defaultPlan.name})` : 'Default'}</option>
            {plans.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          {!editing && (
            <SelectField label="Source" value={f.source} onChange={(e) => set('source', e.target.value)}>
              {RESERVATION_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </SelectField>
          )}
        </div>
        {!editing && (
          <SelectField label="Status" value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="CONFIRMED">Confirmed (holds a room)</option>
            <option value="PENDING">Pending (holds a room)</option>
            <option value="INQUIRY">Inquiry (does not hold a room)</option>
          </SelectField>
        )}
        <TextareaField label="Special requests (optional)" value={f.specialRequests} onChange={(e) => set('specialRequests', e.target.value)} />
        <TextareaField label="Internal notes (optional)" value={f.notes} onChange={(e) => set('notes', e.target.value)} />

        <div className="rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {quote && plan ? (
            <>
              <strong>{quote.nights} {quote.nights === 1 ? 'night' : 'nights'}</strong> · total <strong>{formatMoney(quote.totalMinor, plan.currency)}</strong>
              <span className="block text-xs text-indigo-700">Room charges only. Taxes, extras and payments arrive with folios (Phase 3b).</span>
            </>
          ) : (
            <span>{f.roomTypeId || editing ? 'No rate is set for this room type in the chosen plan.' : 'Choose a room type to see the price.'}</span>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={submit}>{editing ? 'Save changes' : 'Create reservation'}</Button>
        </div>
      </div>
    </Modal>
  );
}

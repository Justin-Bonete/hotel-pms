'use client';

import { formatMoney, type FrontDeskItem, type ReservationView } from '@pms/types';
import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui/ui';
import { ChoosePropertyGate } from '@/features/operations/shared';
import { useFrontDesk } from '@/features/operations/queries';
import { usePropertyDetail } from '@/features/properties/queries';
import { ReservationDetailModal } from '@/features/reservations/reservation-detail';
import { ReservationFormModal } from '@/features/reservations/reservation-form';
import { RESERVATION_META, shortDate } from '@/features/reservations/status';
import { useAccess } from '@/features/access/access-context';

export default function FrontDeskPage() {
  return <ChoosePropertyGate what="The front desk">{(id, name) => <Desk propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Desk({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const desk = useFrontDesk(propertyId);
  const detail = usePropertyDetail(propertyId);
  const { can } = useAccess();
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; reservation?: ReservationView }>({ open: false });
  const d = desk.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Front desk</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}{d ? ` · ${new Date(`${d.today}T00:00:00Z`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}` : ''}</p>
        </div>
        <Button disabled={!can('reservation.manage', propertyId)} onClick={() => setForm({ open: true })}>Walk-in / new reservation</Button>
      </div>

      {desk.isLoading && <Spinner label="Loading today" />}
      {desk.error && <Alert tone="error" action={<Button variant="secondary" onClick={() => desk.refetch()}>Retry</Button>}>We could not load the front desk. {desk.error.message}</Alert>}

      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Arriving today" value={d.counts.arrivals} />
            <Stat label="Leaving today" value={d.counts.departures} />
            <Stat label="In house" value={d.counts.inHouse} sub={`of ${d.counts.rooms} rooms`} />
            <Stat label="Dirty rooms" value={d.counts.dirty} tone={d.counts.dirty > 0 ? 'warn' : undefined} />
            <Stat label="Out of service" value={d.counts.outOfOrder} />
            <Stat label="Payments due" value={d.paymentsDue.length} tone={d.paymentsDue.length > 0 ? 'warn' : undefined} />
          </div>

          {d.overstays.length > 0 && <Alert tone="warning">{d.overstays.length} guest{d.overstays.length === 1 ? ' is' : 's are'} past their departure date. Check them out or extend the stay.</Alert>}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Arrivals today" items={d.arrivals} empty="No arrivals left today." onOpen={setOpenId} />
            <Section title="Departures today" items={d.departures} empty="No one is leaving today." onOpen={setOpenId} showBalance />
            <Section title="Overstays" items={d.overstays} empty="No overstays." onOpen={setOpenId} showBalance />
            <Section title="Payments due" items={d.paymentsDue} empty="Everyone in house is settled." onOpen={setOpenId} showBalance />
            <Section title="VIP guests" items={d.vips} empty="No VIPs arriving or in house." onOpen={setOpenId} />
            <Section title="Expected in the next 3 days" items={d.expected} empty="Nothing expected." onOpen={setOpenId} />
          </div>
          <Section title={`In house (${d.inHouse.length})`} items={d.inHouse} empty="No guests in house." onOpen={setOpenId} showBalance />
        </>
      )}

      <ReservationDetailModal id={openId} onClose={() => setOpenId(null)} onEdit={(r) => { setOpenId(null); setForm({ open: true, reservation: r }); }} />
      <ReservationFormModal open={form.open} onClose={() => setForm({ open: false })} propertyId={propertyId} propertyName={propertyName} timezone={detail.data?.timezone} reservation={form.reservation} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub?: string; tone?: 'warn' }) {
  return (
    <Card className={tone === 'warn' ? 'bg-amber-50/60' : ''}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

function Section({ title, items, empty, onOpen, showBalance }: { title: string; items: FrontDeskItem[]; empty: string; onOpen: (id: string) => void; showBalance?: boolean }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={empty} description="" />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onOpen(r.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50">
                <span>
                  <span className="block text-sm font-medium text-slate-900">{r.guestName} {r.guestIsVip && <Badge tone="warning">VIP</Badge>}</span>
                  <span className="block text-xs text-slate-500">{r.roomNumber ? `Room ${r.roomNumber} · ` : ''}{r.roomTypeName} · {shortDate(r.arrivalDate)} → {shortDate(r.departureDate)}</span>
                </span>
                <span className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESERVATION_META[r.status].badge}`}>{RESERVATION_META[r.status].label}</span>
                  {showBalance && r.balanceDueMinor !== null && r.balanceDueMinor !== 0 && (
                    <span className={`block text-xs ${r.balanceDueMinor > 0 ? 'text-red-700' : 'text-amber-700'}`}>{r.balanceDueMinor > 0 ? 'Owes' : 'Credit'} {formatMoney(Math.abs(r.balanceDueMinor), r.currency)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

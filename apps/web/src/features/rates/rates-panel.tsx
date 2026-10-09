'use client';

import type { RatePlanView, RoomTypeView } from '@pms/types';
import { formatMoney } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useRatePlans, useRefreshReservations } from '@/features/reservations/queries';
import { useRoomTypes } from '@/features/rooms/queries';
import { api } from '@/lib/api';

const pesos = (minor: number | null): string => (minor === null ? '' : String(minor / 100));
/** "3,500.50" -> 350050 centavos. Money is always whole minor units, never floating point. */
const toMinor = (value: string): number | null => {
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
};

export function RatesPanel({ propertyId }: { propertyId: string }) {
  const { can } = useAccess();
  const refresh = useRefreshReservations();
  const plans = useRatePlans(propertyId);
  const types = useRoomTypes(propertyId);
  const [form, setForm] = useState<{ open: boolean; plan?: RatePlanView }>({ open: false });
  const manage = can('rate.manage', propertyId);

  const archive = useMutation({
    mutationFn: (id: string) => api.delete(`/rate-plans/${id}`),
    onSuccess: async () => {
      await plans.refetch();
      await refresh();
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Prices per night for each room type. Friday and Saturday nights use the weekend rate when one is set.</p>
        {manage && <Button disabled={types.data?.length === 0} onClick={() => setForm({ open: true })}>Add rate plan</Button>}
      </div>
      {plans.isLoading && <Spinner />}
      {plans.error && <Alert tone="error">{plans.error.message}</Alert>}
      {archive.error && <Alert tone="error">{archive.error.message}</Alert>}
      {types.data?.length === 0 && <Alert tone="warning">Create room types first, then set their prices here.</Alert>}
      {plans.data?.length === 0 && types.data && types.data.length > 0 && (
        <EmptyState title="No rate plans yet" description="You need a default rate plan before you can take reservations." action={manage ? <Button onClick={() => setForm({ open: true })}>Add rate plan</Button> : undefined} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {plans.data?.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                {p.description && <p className="mt-0.5 text-sm text-slate-500">{p.description}</p>}
              </div>
              {p.isDefault && <Badge tone="success">Default</Badge>}
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-1 font-medium">Room type</th><th className="py-1 text-right font-medium">Per night</th><th className="py-1 text-right font-medium">Fri / Sat</th></tr></thead>
              <tbody>
                {p.rates.map((r) => (
                  <tr key={r.roomTypeId} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{r.roomTypeName}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatMoney(r.nightlyRateMinor, p.currency)}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-500">{r.weekendRateMinor === null ? '—' : formatMoney(r.weekendRateMinor, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {manage && (
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setForm({ open: true, plan: p })}>Edit</Button>
                {!p.isDefault && <Button variant="ghost" loading={archive.isPending && archive.variables === p.id} onClick={() => archive.mutate(p.id)}>Archive</Button>}
              </div>
            )}
          </Card>
        ))}
      </div>

      <RatePlanFormModal open={form.open} propertyId={propertyId} plan={form.plan} roomTypes={types.data ?? []} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function RatePlanFormModal({ open, propertyId, plan, roomTypes, onClose }: { open: boolean; propertyId: string; plan?: RatePlanView; roomTypes: RoomTypeView[]; onClose: () => void }) {
  const refresh = useRefreshReservations();
  const plans = useRatePlans(propertyId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [rows, setRows] = useState<Record<string, { nightly: string; weekend: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const first = (plans.data?.length ?? 0) === 0;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(plan?.name ?? '');
    setDescription(plan?.description ?? '');
    setIsDefault(plan?.isDefault ?? first);
    setRows(Object.fromEntries(roomTypes.map((t) => {
      const r = plan?.rates.find((x) => x.roomTypeId === t.id);
      return [t.id, { nightly: pesos(r?.nightlyRateMinor ?? null), weekend: pesos(r?.weekendRateMinor ?? null) }];
    })));
  }, [open, plan, roomTypes, first]);

  async function save() {
    setError(null);
    const rates: Array<{ roomTypeId: string; nightlyRateMinor: number; weekendRateMinor: number | null }> = [];
    for (const t of roomTypes) {
      const row = rows[t.id];
      if (!row || row.nightly.trim() === '') continue;
      const nightly = toMinor(row.nightly);
      const weekend = toMinor(row.weekend);
      if (nightly === null || Number.isNaN(nightly) || Number.isNaN(weekend)) return setError(`Check the prices for ${t.name}: use plain numbers like 3500 or 3500.50.`);
      rates.push({ roomTypeId: t.id, nightlyRateMinor: nightly, weekendRateMinor: weekend });
    }
    if (name.trim().length < 2) return setError('Enter a name for the plan.');
    if (rates.length === 0) return setError('Set a nightly price for at least one room type.');
    setBusy(true);
    try {
      const body = { name, description, isDefault, rates };
      if (plan) await api.patch(`/rate-plans/${plan.id}`, body);
      else await api.post(`/properties/${propertyId}/rate-plans`, body);
      await plans.refetch();
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the rate plan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={plan ? 'Edit rate plan' : 'Add rate plan'}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Plan name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard rate" />
        <TextareaField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Prices (leave blank for room types not in this plan)</p>
          {roomTypes.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_7rem_7rem] items-end gap-2">
              <span className="pb-2 text-sm text-slate-700">{t.name}</span>
              <Field label="Per night" inputMode="decimal" value={rows[t.id]?.nightly ?? ''} onChange={(e) => setRows((r) => ({ ...r, [t.id]: { nightly: e.target.value, weekend: r[t.id]?.weekend ?? '' } }))} />
              <Field label="Fri / Sat" inputMode="decimal" value={rows[t.id]?.weekend ?? ''} onChange={(e) => setRows((r) => ({ ...r, [t.id]: { nightly: r[t.id]?.nightly ?? '', weekend: e.target.value } }))} />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={isDefault} disabled={plan?.isDefault || first} onChange={(e) => setIsDefault(e.target.checked)} />
          Use as the default plan for new reservations
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>{plan ? 'Save changes' : 'Create plan'}</Button>
        </div>
      </div>
    </Modal>
  );
}

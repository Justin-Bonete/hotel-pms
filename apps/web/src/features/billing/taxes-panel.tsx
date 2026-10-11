'use client';

import { formatRate, type TaxView } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { api } from '@/lib/api';
import { useTaxes } from './queries';

export function TaxesPanel({ propertyId }: { propertyId: string }) {
  const { can } = useAccess();
  const taxes = useTaxes(propertyId);
  const [form, setForm] = useState<{ open: boolean; tax?: TaxView }>({ open: false });
  const manage = can('tax.manage', propertyId);
  const archive = useMutation({ mutationFn: (id: string) => api.delete(`/taxes/${id}`), onSuccess: () => taxes.refetch() });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Taxes and service charges are added automatically to room charges (and to extras you mark taxable). Changes apply to charges posted <strong>after</strong> the change; existing folios are never rewritten. Prices are treated as tax-exclusive.</p>
        {manage && <Button onClick={() => setForm({ open: true })}>Add tax</Button>}
      </div>
      {taxes.isLoading && <Spinner />}
      {taxes.error && <Alert tone="error">{taxes.error.message}</Alert>}
      {archive.error && <Alert tone="error">{archive.error.message}</Alert>}
      {taxes.data?.length === 0 && <EmptyState title="No taxes configured" description="Guests will be billed the room rate only. Add VAT or a service charge if your property charges them." action={manage ? <Button onClick={() => setForm({ open: true })}>Add tax</Button> : undefined} />}
      <div className="grid gap-4 md:grid-cols-2">
        {taxes.data?.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{t.name}</h3>
                <p className="mt-0.5 text-sm text-slate-500">{formatRate(t.rateBps)} on {[t.appliesToRoom && 'room charges', t.appliesToExtras && 'extras'].filter(Boolean).join(' and ') || 'nothing'}</p>
              </div>
              <Badge tone={t.isActive ? 'success' : 'neutral'}>{t.isActive ? 'Active' : 'Off'}</Badge>
            </div>
            {manage && (
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={() => setForm({ open: true, tax: t })}>Edit</Button>
                <Button variant="ghost" loading={archive.isPending && archive.variables === t.id} onClick={() => archive.mutate(t.id)}>Archive</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
      <TaxFormModal open={form.open} propertyId={propertyId} tax={form.tax} onClose={() => setForm({ open: false })} />
    </div>
  );
}

function TaxFormModal({ open, propertyId, tax, onClose }: { open: boolean; propertyId: string; tax?: TaxView; onClose: () => void }) {
  const taxes = useTaxes(propertyId, false);
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [room, setRoom] = useState(true);
  const [extras, setExtras] = useState(true);
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(tax?.name ?? '');
    setPercent(tax ? String(tax.rateBps / 100) : '');
    setRoom(tax?.appliesToRoom ?? true);
    setExtras(tax?.appliesToExtras ?? true);
    setActive(tax?.isActive ?? true);
  }, [open, tax]);

  async function save() {
    setError(null);
    if (!/^\d+(\.\d{1,2})?$/.test(percent.trim()) || Number(percent) > 100) return setError('Enter the rate as a percent between 0 and 100, e.g. 12 or 7.5.');
    const body = { name, rateBps: Math.round(Number(percent) * 100), appliesToRoom: room, appliesToExtras: extras, isActive: active };
    setBusy(true);
    try {
      if (tax) await api.patch(`/taxes/${tax.id}`, body);
      else await api.post(`/properties/${propertyId}/taxes`, body);
      await taxes.refetch();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the tax.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={tax ? 'Edit tax' : 'Add tax'}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VAT or Service charge" />
        <Field label="Rate (%)" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="12" />
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={room} onChange={(e) => setRoom(e.target.checked)} /> Apply to room charges</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={extras} onChange={(e) => setExtras(e.target.checked)} /> Apply to extra charges</label>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active</label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>{tax ? 'Save changes' : 'Add tax'}</Button>
        </div>
      </div>
    </Modal>
  );
}

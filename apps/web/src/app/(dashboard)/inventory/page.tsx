'use client';

import { INVENTORY_CATEGORIES, MANUAL_MOVEMENT_TYPES, formatMoney, type InventoryCategory, type InventoryItemView, type StockStatus } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useInventory, useMovements, useRefreshBusiness } from '@/features/business/queries';
import { ChoosePropertyGate, labelOf } from '@/features/operations/shared';
import { useProperties } from '@/features/properties/property-context';
import { api } from '@/lib/api';
import { minorToPesos, pesosToMinor } from '@/lib/money';

const STATUS: Record<StockStatus, { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' }> = {
  OUT: { label: 'Out of stock', tone: 'warning' }, LOW: { label: 'Low', tone: 'warning' }, OK: { label: 'OK', tone: 'success' }, OVER: { label: 'Over maximum', tone: 'info' },
};
const MOVEMENT_LABEL: Record<string, string> = { OPENING: 'Opening count', USAGE: 'Used', WASTAGE: 'Wasted / damaged', ADJUSTMENT: 'Count adjustment' };

export default function InventoryPage() {
  return <ChoosePropertyGate what="Inventory">{(id, name) => <Stock propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Stock({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { can } = useAccess();
  const read = can('inventory.read', propertyId);
  const manage = can('inventory.manage', propertyId);
  const inventory = useInventory(propertyId, read);
  const [category, setCategory] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention'>('all');
  const [editing, setEditing] = useState<{ item?: InventoryItemView } | null>(null);
  const [moving, setMoving] = useState<InventoryItemView | null>(null);
  const [transferring, setTransferring] = useState<InventoryItemView | null>(null);
  const [history, setHistory] = useState<InventoryItemView | null>(null);

  const items = inventory.data ?? [];
  const attention = items.filter((i) => i.status === 'OUT' || i.status === 'LOW');
  const shown = useMemo(() => items.filter((i) => (!category || i.category === category) && (filter === 'all' || i.status === 'OUT' || i.status === 'LOW')), [items, category, filter]);

  if (!read) return <Alert tone="info">You don’t have access to inventory for this property.</Alert>;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Inventory</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}. Stock is a permanent ledger: every change is recorded and can’t be edited or deleted.</p>
        </div>
        {manage && <Button onClick={() => setEditing({})}>Add item</Button>}
      </div>

      {attention.length > 0 && (
        <Alert tone="warning" action={<Button variant="secondary" onClick={() => setFilter('attention')}>Show them</Button>}>
          {attention.length} item{attention.length === 1 ? ' needs' : 's need'} restocking. Request a purchase in Purchasing.
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-[14rem_14rem]">
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}
        </SelectField>
        <SelectField label="Show" value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'attention')}>
          <option value="all">All items</option>
          <option value="attention">Needs restocking</option>
        </SelectField>
      </div>

      {inventory.isLoading && <Spinner label="Loading stock" />}
      {inventory.error && <Alert tone="error">{inventory.error.message}</Alert>}
      {!inventory.isLoading && items.length === 0 && <EmptyState title="No items yet" description="Add the supplies you stock (towels, toiletries, food...) and record an opening count." action={manage ? <Button onClick={() => setEditing({})}>Add item</Button> : undefined} />}

      {shown.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3 font-medium">Item</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 text-right font-medium">On hand</th><th className="px-4 py-3 text-right font-medium">Min / max</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><span className="block font-medium text-slate-900">{i.name}</span><span className="block text-xs text-slate-500">{i.sku} · {formatMoney(i.unitCostMinor, 'PHP')} per {i.unit}</span></td>
                  <td className="px-4 py-3 text-slate-600">{labelOf(i.category)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{i.onHand} {i.unit}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{i.minStock} / {i.maxStock || '—'}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>{i.suggestedReorder > 0 && <span className="ml-2 text-xs text-slate-500">order ~{i.suggestedReorder}</span>}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => setHistory(i)}>History</Button>
                    {manage && <Button variant="ghost" onClick={() => setMoving(i)}>Record</Button>}
                    {manage && <Button variant="ghost" onClick={() => setTransferring(i)}>Transfer</Button>}
                    {manage && <Button variant="ghost" onClick={() => setEditing({ item: i })}>Edit</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && <ItemModal item={editing.item} onClose={() => setEditing(null)} />}
      {moving && <MovementModal propertyId={propertyId} item={moving} onClose={() => setMoving(null)} />}
      {transferring && <TransferModal propertyId={propertyId} item={transferring} onClose={() => setTransferring(null)} />}
      {history && <HistoryModal propertyId={propertyId} item={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function useSave(onClose: () => void) {
  const refresh = useRefreshBusiness();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try { await fn(); await refresh(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); }
  }
  return { error, setError, busy, run };
}

function ItemModal({ item, onClose }: { item?: InventoryItemView; onClose: () => void }) {
  const { error, setError, busy, run } = useSave(onClose);
  const [f, setF] = useState({ sku: item?.sku ?? '', name: item?.name ?? '', category: (item?.category ?? 'TOILETRIES') as InventoryCategory, unit: item?.unit ?? 'pcs', min: String(item?.minStock ?? 0), max: String(item?.maxStock ?? 0), cost: item ? minorToPesos(item.unitCostMinor) : '0' });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = () => {
    const min = Number(f.min), max = Number(f.max), cost = pesosToMinor(f.cost);
    if (!f.sku.trim() || f.name.trim().length < 2 || !f.unit.trim()) return setError('Enter a code, a name and a unit.');
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) return setError('Minimum and maximum must be whole numbers.');
    if (max !== 0 && max < min) return setError('The maximum must be at least the minimum (or 0 for no maximum).');
    if (cost === null || Number.isNaN(cost) || cost < 0) return setError('Enter the cost like 120 or 120.50.');
    const body = { sku: f.sku, name: f.name, category: f.category, unit: f.unit, minStock: min, maxStock: max, unitCostMinor: cost };
    void run(() => (item ? api.patch(`/inventory/items/${item.id}`, body) : api.post('/inventory/items', body)));
  };
  return (
    <Modal open title={item ? 'Edit item' : 'Add item'} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4"><Field label="Code (SKU)" value={f.sku} onChange={(e) => set('sku', e.target.value)} /><Field label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" value={f.category} onChange={(e) => set('category', e.target.value)}>{INVENTORY_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}</SelectField>
          <Field label="Unit (pcs, kg, L…)" value={f.unit} onChange={(e) => set('unit', e.target.value)} />
          <Field label="Minimum to keep" inputMode="numeric" value={f.min} onChange={(e) => set('min', e.target.value)} />
          <Field label="Maximum (0 = none)" inputMode="numeric" value={f.max} onChange={(e) => set('max', e.target.value)} />
        </div>
        <Field label="Usual cost per unit" inputMode="decimal" value={f.cost} onChange={(e) => set('cost', e.target.value)} />
        <p className="text-xs text-slate-500">Quantities are whole units. Use a smaller unit (grams, millilitres) if you need fractions. The minimum and maximum apply to each property’s own stock.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>{item ? 'Save changes' : 'Add item'}</Button></div>
      </div>
    </Modal>
  );
}

function MovementModal({ propertyId, item, onClose }: { propertyId: string; item: InventoryItemView; onClose: () => void }) {
  const { error, setError, busy, run } = useSave(onClose);
  const [type, setType] = useState<(typeof MANUAL_MOVEMENT_TYPES)[number]>('USAGE');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const save = () => {
    const q = Number(quantity);
    if (!Number.isInteger(q) || q === 0) return setError('Enter a whole number.');
    if (type !== 'ADJUSTMENT' && q < 0) return setError('Enter a positive number.');
    if (type === 'ADJUSTMENT' && note.trim().length < 3) return setError('Say why the count changed.');
    void run(() => api.post(`/properties/${propertyId}/inventory/movements`, { itemId: item.id, type, quantity: q, note }));
  };
  return (
    <Modal open title={`Record: ${item.name}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">On hand now: <strong>{item.onHand} {item.unit}</strong></p>
        <SelectField label="What happened?" value={type} onChange={(e) => setType(e.target.value as typeof type)}>{MANUAL_MOVEMENT_TYPES.map((t) => <option key={t} value={t}>{MOVEMENT_LABEL[t]}</option>)}</SelectField>
        <Field label={type === 'ADJUSTMENT' ? `Change in ${item.unit} (+ found, − missing)` : `Quantity (${item.unit})`} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <TextareaField label={type === 'ADJUSTMENT' ? 'Reason (required)' : 'Note (optional)'} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-xs text-slate-500">Stock can’t go below zero. Entries can’t be edited later; a mistake is corrected with another entry.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Record</Button></div>
      </div>
    </Modal>
  );
}

function TransferModal({ propertyId, item, onClose }: { propertyId: string; item: InventoryItemView; onClose: () => void }) {
  const { properties } = useProperties();
  const { can } = useAccess();
  const { error, setError, busy, run } = useSave(onClose);
  const targets = properties.filter((p) => p.id !== propertyId && can('inventory.manage', p.id));
  const [to, setTo] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const save = () => {
    const q = Number(quantity);
    if (!to) return setError('Choose where to send it.');
    if (!Number.isInteger(q) || q < 1) return setError('Enter a whole number above zero.');
    if (q > item.onHand) return setError(`Only ${item.onHand} ${item.unit} on hand here.`);
    void run(() => api.post('/inventory/transfers', { fromPropertyId: propertyId, toPropertyId: to, itemId: item.id, quantity: q, note }));
  };
  return (
    <Modal open title={`Transfer: ${item.name}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {targets.length === 0 && <Alert tone="info">You need inventory access at another property to transfer stock to it.</Alert>}
        <p className="text-sm text-slate-600">Available here: <strong>{item.onHand} {item.unit}</strong></p>
        <SelectField label="Send to" value={to} onChange={(e) => setTo(e.target.value)}><option value="">Choose a property…</option>{targets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectField>
        <Field label={`Quantity (${item.unit})`} inputMode="numeric" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <TextareaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-xs text-slate-500">Both sides are recorded together: out of this property and into the other, or neither.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={targets.length === 0} onClick={save}>Transfer</Button></div>
      </div>
    </Modal>
  );
}

function HistoryModal({ propertyId, item, onClose }: { propertyId: string; item: InventoryItemView; onClose: () => void }) {
  const movements = useMovements(propertyId, item.id);
  return (
    <Modal open title={`History: ${item.name}`} onClose={onClose}>
      {movements.isLoading && <Spinner />}
      {movements.error && <Alert tone="error">{movements.error.message}</Alert>}
      {movements.data?.length === 0 && <p className="text-sm text-slate-500">No movements yet.</p>}
      <ul className="divide-y divide-slate-100 text-sm">
        {movements.data?.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2">
            <span><span className="font-medium text-slate-800">{labelOf(m.type)}</span><span className="block text-xs text-slate-500">{new Date(m.createdAt).toLocaleString()}{m.createdByName ? ` · ${m.createdByName}` : ''}{m.note ? ` · ${m.note}` : ''}</span></span>
            <span className={`tabular-nums font-semibold ${m.quantity > 0 ? 'text-emerald-700' : 'text-red-700'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity} {item.unit}</span>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

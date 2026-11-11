'use client';

import { formatMoney, remainingToReceive, type PurchaseOrderView, type PurchaseStatus, type SupplierInvoiceView, type SupplierView } from '@pms/types';
import { PAYMENT_METHODS } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useInventory, useInvoices, useOrders, useRefreshBusiness, useSuppliers } from '@/features/business/queries';
import { ChoosePropertyGate, labelOf } from '@/features/operations/shared';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { minorToPesos, pesosToMinor } from '@/lib/money';

const STATUS_TONE: Record<PurchaseStatus, 'neutral' | 'info' | 'success' | 'warning'> = {
  REQUESTED: 'warning', APPROVED: 'info', REJECTED: 'neutral', PARTIALLY_RECEIVED: 'info', RECEIVED: 'success', CANCELLED: 'neutral',
};
const today = () => new Date().toISOString().slice(0, 10);

export default function PurchasingPage() {
  return <ChoosePropertyGate what="Purchasing">{(id, name) => <Purchasing propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Purchasing({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { can } = useAccess();
  const read = can('purchasing.read', propertyId);
  const [tab, setTab] = useState<'orders' | 'invoices' | 'suppliers'>('orders');
  const [requesting, setRequesting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const orders = useOrders(propertyId, read);
  const invoices = useInvoices(propertyId, read);
  const suppliers = useSuppliers(read);
  const open = orders.data?.find((o) => o.id === openId) ?? null;

  if (!read) return <Alert tone="info">You don’t have access to purchasing for this property.</Alert>;
  const unpaid = (invoices.data ?? []).filter((i) => i.status === 'UNPAID');
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Purchasing</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}. Request → approve → receive → invoice → pay.</p>
        </div>
        {can('purchasing.request', propertyId) && <Button onClick={() => setRequesting(true)}>New purchase request</Button>}
      </div>

      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {([['orders', 'Orders'], ['invoices', `Invoices${unpaid.length ? ` (${unpaid.length} unpaid)` : ''}`], ['suppliers', 'Suppliers']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('border-b-2 px-4 py-2 text-sm font-medium', tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          {orders.isLoading && <Spinner />}
          {orders.error && <Alert tone="error">{orders.error.message}</Alert>}
          {orders.data?.length === 0 && <EmptyState title="No purchase requests yet" description="Request supplies from a supplier. A manager approves the request before anything is ordered." />}
          <div className="grid gap-3 md:grid-cols-2">
            {orders.data?.map((o) => (
              <button key={o.id} type="button" onClick={() => setOpenId(o.id)} className="rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-indigo-300">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-semibold text-slate-900">{o.code} · {o.supplierName}</p><p className="text-xs text-slate-500">{o.lines.length} item{o.lines.length === 1 ? '' : 's'} · requested by {o.requestedByName ?? 'unknown'}</p></div>
                  <Badge tone={STATUS_TONE[o.status]}>{labelOf(o.status)}</Badge>
                </div>
                <p className="mt-2 text-sm tabular-nums text-slate-700">{formatMoney(o.totalMinor, o.currency)}{o.invoice && <span className="ml-2 text-xs text-slate-500">· invoiced {o.invoice.status === 'PAID' ? '(paid)' : '(unpaid)'}</span>}</p>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'invoices' && <InvoicesTab propertyId={propertyId} invoices={invoices.data ?? []} loading={invoices.isLoading} />}
      {tab === 'suppliers' && <SuppliersTab suppliers={suppliers.data ?? []} loading={suppliers.isLoading} canManage={can('purchasing.manage', propertyId)} />}

      {requesting && <RequestModal propertyId={propertyId} onClose={() => setRequesting(false)} />}
      {open && <OrderModal order={open} propertyId={propertyId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ new request
function RequestModal({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const suppliers = useSuppliers();
  const items = useInventory(propertyId);
  const refresh = useRefreshBusiness();
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Array<{ itemId: string; quantity: string; cost: string }>>([{ itemId: '', quantity: '', cost: '' }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const setLine = (i: number, patch: Partial<(typeof lines)[number]>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const parsed = lines.map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity), unitCostMinor: pesosToMinor(l.cost) }));
  const total = parsed.reduce((s, l) => s + (Number.isInteger(l.quantity) && l.unitCostMinor !== null && !Number.isNaN(l.unitCostMinor) ? l.quantity * l.unitCostMinor : 0), 0);

  async function save() {
    setError(null);
    if (!supplierId) return setError('Choose a supplier.');
    const filled = parsed.filter((l) => l.itemId);
    if (filled.length === 0) return setError('Add at least one item.');
    if (new Set(filled.map((l) => l.itemId)).size !== filled.length) return setError('Each item can appear only once.');
    for (const l of filled) {
      if (!Number.isInteger(l.quantity) || l.quantity < 1) return setError('Every quantity must be a whole number above zero.');
      if (l.unitCostMinor === null || Number.isNaN(l.unitCostMinor) || l.unitCostMinor < 0) return setError('Check the cost of each item (like 120 or 120.50).');
    }
    setBusy(true);
    try {
      await api.post(`/properties/${propertyId}/purchase-orders`, { supplierId, notes, lines: filled });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title="New purchase request" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {suppliers.data?.length === 0 && <Alert tone="warning">Add a supplier first (Suppliers tab).</Alert>}
        <SelectField label="Supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">Choose…</option>{suppliers.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</SelectField>
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Items</p>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_6rem_2rem] items-end gap-2">
              <SelectField label={i === 0 ? 'Item' : ''} value={l.itemId} onChange={(e) => { const it = items.data?.find((x) => x.id === e.target.value); setLine(i, { itemId: e.target.value, cost: it ? minorToPesos(it.unitCostMinor) : l.cost, quantity: l.quantity || (it && it.suggestedReorder > 0 ? String(it.suggestedReorder) : '') }); }}>
                <option value="">Choose…</option>{items.data?.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.onHand} {it.unit} on hand)</option>)}
              </SelectField>
              <Field label={i === 0 ? 'Qty' : ''} inputMode="numeric" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
              <Field label={i === 0 ? 'Cost each' : ''} inputMode="decimal" value={l.cost} onChange={(e) => setLine(i, { cost: e.target.value })} />
              <button type="button" aria-label="Remove line" className="pb-2 text-slate-400 hover:text-red-600 disabled:opacity-30" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>✕</button>
            </div>
          ))}
          <Button variant="ghost" onClick={() => setLines((ls) => [...ls, { itemId: '', quantity: '', cost: '' }])}>+ Add another item</Button>
        </div>
        <TextareaField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="text-sm text-slate-700">Order total: <strong>{formatMoney(total, 'PHP')}</strong></p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Send request</Button></div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ one order
function OrderModal({ order: o, propertyId, onClose }: { order: PurchaseOrderView; propertyId: string; onClose: () => void }) {
  const { can } = useAccess();
  const refresh = useRefreshBusiness();
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [receive, setReceive] = useState<Record<string, string>>({});
  const [invoicing, setInvoicing] = useState(false);
  const [paying, setPaying] = useState(false);

  const decide = useMutation({ mutationFn: (action: 'approve' | 'reject' | 'cancel') => api.post(`/purchase-orders/${o.id}/decision`, { action, note }), onSuccess: async () => { setRejecting(false); setNote(''); await refresh(); } });
  const receiveMut = useMutation({
    mutationFn: () => api.post(`/purchase-orders/${o.id}/receive`, { lines: Object.entries(receive).filter(([, q]) => Number(q) > 0).map(([lineId, q]) => ({ lineId, quantity: Number(q) })) }),
    onSuccess: async () => { setReceive({}); await refresh(); },
  });
  const err = decide.error ?? receiveMut.error;
  const canReceive = can('purchasing.receive', propertyId) && ['APPROVED', 'PARTIALLY_RECEIVED'].includes(o.status);
  const canInvoice = can('purchasing.pay', propertyId) && ['PARTIALLY_RECEIVED', 'RECEIVED'].includes(o.status) && !o.invoice;
  const receiveInvalid = Object.entries(receive).some(([id, q]) => { const l = o.lines.find((x) => x.id === id); return q !== '' && (!Number.isInteger(Number(q)) || Number(q) < 0 || (l ? Number(q) > remainingToReceive(l) : true)); });

  return (
    <Modal open title={`${o.code} · ${o.supplierName}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="flex items-center justify-between"><Badge tone={STATUS_TONE[o.status]}>{labelOf(o.status)}</Badge><span className="text-slate-500">Requested by {o.requestedByName ?? 'unknown'} · {new Date(o.requestedAt).toLocaleDateString()}</span></div>
        {o.decisionNote && <Alert tone="info">{o.approvedByName ? `${o.approvedByName}: ` : ''}{o.decisionNote}</Alert>}
        {o.notes && <p className="text-slate-600">{o.notes}</p>}
        {err && <Alert tone="error">{err.message}</Alert>}

        <table className="min-w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-slate-400"><tr><th className="py-1 font-medium">Item</th><th className="py-1 text-right font-medium">Ordered</th><th className="py-1 text-right font-medium">Received</th><th className="py-1 text-right font-medium">Cost</th>{canReceive && <th className="py-1 text-right font-medium">Receive now</th>}</tr></thead>
          <tbody>
            {o.lines.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="py-1.5">{l.itemName}<span className="block text-xs text-slate-400">{l.sku}</span></td>
                <td className="py-1.5 text-right tabular-nums">{l.quantity} {l.unit}</td>
                <td className="py-1.5 text-right tabular-nums">{l.receivedQuantity}</td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(l.unitCostMinor, o.currency)}</td>
                {canReceive && <td className="py-1.5 text-right"><input aria-label={`Receive ${l.itemName}`} className="w-20 rounded-md border-0 px-2 py-1 text-right text-sm ring-1 ring-inset ring-slate-300" inputMode="numeric" placeholder={String(remainingToReceive(l))} value={receive[l.id] ?? ''} onChange={(e) => setReceive((r) => ({ ...r, [l.id]: e.target.value }))} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-right font-semibold tabular-nums">Total {formatMoney(o.totalMinor, o.currency)}</p>

        <div className="flex flex-wrap gap-2">
          {o.status === 'REQUESTED' && can('purchasing.approve', propertyId) && (
            <>
              <Button loading={decide.isPending && decide.variables === 'approve'} onClick={() => decide.mutate('approve')}>Approve</Button>
              <Button variant="secondary" onClick={() => setRejecting((r) => !r)}>Reject</Button>
            </>
          )}
          {['REQUESTED', 'APPROVED'].includes(o.status) && <Button variant="ghost" loading={decide.isPending && decide.variables === 'cancel'} onClick={() => decide.mutate('cancel')}>Cancel request</Button>}
          {canReceive && <Button disabled={receiveInvalid || Object.values(receive).every((q) => !q || Number(q) <= 0)} loading={receiveMut.isPending} onClick={() => receiveMut.mutate()}>Receive into stock</Button>}
          {canInvoice && <Button variant="secondary" onClick={() => setInvoicing(true)}>Record supplier invoice</Button>}
        </div>
        {rejecting && (
          <div className="space-y-2 rounded-lg bg-red-50 p-3">
            <TextareaField label="Why is it rejected? (required)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="danger" loading={decide.isPending && decide.variables === 'reject'} onClick={() => decide.mutate('reject')}>Reject request</Button>
          </div>
        )}

        {o.invoice && (
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="font-medium text-slate-800">Invoice {o.invoice.number} · {o.invoice.status === 'PAID' ? 'paid' : 'unpaid'}{o.invoice.overdue && <span className="ml-2 text-red-700">overdue</span>}</p>
            <p className="text-slate-600">{formatMoney(o.invoice.amountMinor, o.currency)} · due {o.invoice.dueOn}</p>
            {o.invoice.varianceMinor !== 0 && <p className="mt-1 text-amber-800">The invoice is {formatMoney(Math.abs(o.invoice.varianceMinor), o.currency)} {o.invoice.varianceMinor > 0 ? 'MORE' : 'LESS'} than the goods received ({formatMoney(o.invoice.receivedValueMinor, o.currency)}). Check with the supplier before paying.</p>}
            {o.invoice.status === 'UNPAID' && can('purchasing.pay', propertyId) && <Button className="mt-3" onClick={() => setPaying(true)}>Pay invoice</Button>}
          </div>
        )}
      </div>
      {invoicing && <InvoiceModal order={o} onClose={() => setInvoicing(false)} />}
      {paying && o.invoice && <PayModal invoice={o.invoice} onClose={() => setPaying(false)} />}
    </Modal>
  );
}

function InvoiceModal({ order, onClose }: { order: PurchaseOrderView; onClose: () => void }) {
  const refresh = useRefreshBusiness();
  const [f, setF] = useState({ number: '', amount: minorToPesos(order.receivedValueMinor), issuedOn: today(), dueOn: today() });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const amount = pesosToMinor(f.amount);
  const variance = amount !== null && !Number.isNaN(amount) ? amount - order.receivedValueMinor : 0;
  async function save() {
    setError(null);
    if (!f.number.trim()) return setError("Enter the supplier's invoice number.");
    if (amount === null || Number.isNaN(amount) || amount < 1) return setError('Enter the invoice amount like 7600 or 7600.50.');
    if (f.dueOn < f.issuedOn) return setError('The due date can’t be before the invoice date.');
    setBusy(true);
    try { await api.post(`/purchase-orders/${order.id}/invoice`, { number: f.number, amountMinor: amount, issuedOn: f.issuedOn, dueOn: f.dueOn }); await refresh(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not record the invoice.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title="Record supplier invoice" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">Value of goods received so far: <strong>{formatMoney(order.receivedValueMinor, order.currency)}</strong></p>
        <Field label="Invoice number" value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
        <Field label="Invoice amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
        {variance !== 0 && <Alert tone="warning">This is {formatMoney(Math.abs(variance), order.currency)} {variance > 0 ? 'more' : 'less'} than the goods received. You can still record it, and it will be flagged.</Alert>}
        <div className="grid grid-cols-2 gap-4"><Field label="Invoice date" type="date" value={f.issuedOn} onChange={(e) => setF({ ...f, issuedOn: e.target.value })} /><Field label="Due date" type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Record invoice</Button></div>
      </div>
    </Modal>
  );
}

function PayModal({ invoice, onClose }: { invoice: SupplierInvoiceView; onClose: () => void }) {
  const refresh = useRefreshBusiness();
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    setError(null);
    try { await api.post(`/supplier-invoices/${invoice.id}/pay`, { method, reference }); await refresh(); onClose(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Could not record the payment.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title={`Pay invoice ${invoice.number}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">{invoice.supplierName} · <strong>{formatMoney(invoice.amountMinor, invoice.currency)}</strong></p>
        {invoice.varianceMinor !== 0 && <Alert tone="warning">This invoice does not match the goods received by {formatMoney(Math.abs(invoice.varianceMinor), invoice.currency)}.</Alert>}
        <SelectField label="Paid by" value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{labelOf(m)}</option>)}</SelectField>
        <Field label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} />
        <p className="text-xs text-slate-500">This marks the invoice paid and records the expense automatically, once.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={pay}>Mark as paid</Button></div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ invoices + suppliers tabs
function InvoicesTab({ propertyId, invoices, loading }: { propertyId: string; invoices: SupplierInvoiceView[]; loading: boolean }) {
  const { can } = useAccess();
  const [paying, setPaying] = useState<SupplierInvoiceView | null>(null);
  if (loading) return <Spinner />;
  if (invoices.length === 0) return <EmptyState title="No supplier invoices" description="Record an invoice from a purchase order once goods have arrived." />;
  return (
    <>
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Invoice</th><th className="px-4 py-3 font-medium">Supplier</th><th className="px-4 py-3 font-medium">Due</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{i.number}<span className="block text-xs text-slate-400">{i.purchaseOrderCode}</span></td>
                <td className="px-4 py-3 text-slate-600">{i.supplierName}</td>
                <td className="px-4 py-3 text-slate-600">{i.dueOn}{i.overdue && <span className="ml-2 text-xs font-medium text-red-700">overdue</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMoney(i.amountMinor, i.currency)}{i.varianceMinor !== 0 && <span className="block text-xs text-amber-700">{i.varianceMinor > 0 ? '+' : '−'}{formatMoney(Math.abs(i.varianceMinor), i.currency)} vs received</span>}</td>
                <td className="px-4 py-3"><Badge tone={i.status === 'PAID' ? 'success' : i.overdue ? 'warning' : 'info'}>{i.status === 'PAID' ? 'Paid' : 'Unpaid'}</Badge></td>
                <td className="px-4 py-3 text-right">{i.status === 'UNPAID' && can('purchasing.pay', propertyId) && <Button variant="secondary" onClick={() => setPaying(i)}>Pay</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {paying && <PayModal invoice={paying} onClose={() => setPaying(null)} />}
    </>
  );
}

function SuppliersTab({ suppliers, loading, canManage }: { suppliers: SupplierView[]; loading: boolean; canManage: boolean }) {
  const refresh = useRefreshBusiness();
  const [form, setForm] = useState<{ supplier?: SupplierView } | null>(null);
  const archive = useMutation({ mutationFn: (id: string) => api.delete(`/suppliers/${id}`), onSuccess: refresh });
  return (
    <div className="space-y-4">
      {canManage && <div className="flex justify-end"><Button onClick={() => setForm({})}>Add supplier</Button></div>}
      {loading && <Spinner />}
      {archive.error && <Alert tone="error">{archive.error.message}</Alert>}
      {!loading && suppliers.length === 0 && <EmptyState title="No suppliers yet" description="Add the companies you buy from." />}
      <div className="grid gap-3 md:grid-cols-2">
        {suppliers.map((s) => (
          <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="font-semibold text-slate-900">{s.name}</p>
            <p className="text-sm text-slate-500">{[s.contactName, s.phone, s.email].filter(Boolean).join(' · ') || 'No contact details'}</p>
            {canManage && <div className="mt-3 flex gap-2"><Button variant="secondary" onClick={() => setForm({ supplier: s })}>Edit</Button><Button variant="ghost" loading={archive.isPending && archive.variables === s.id} onClick={() => archive.mutate(s.id)}>Archive</Button></div>}
          </div>
        ))}
      </div>
      {form && <SupplierModal supplier={form.supplier} onClose={() => setForm(null)} />}
    </div>
  );
}

function SupplierModal({ supplier, onClose }: { supplier?: SupplierView; onClose: () => void }) {
  const refresh = useRefreshBusiness();
  const [f, setF] = useState({ name: supplier?.name ?? '', contactName: supplier?.contactName ?? '', email: supplier?.email ?? '', phone: supplier?.phone ?? '', address: supplier?.address ?? '', notes: supplier?.notes ?? '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setError(null);
    if (f.name.trim().length < 2) return setError('Enter the supplier’s name.');
    setBusy(true);
    try { await (supplier ? api.patch(`/suppliers/${supplier.id}`, f) : api.post('/suppliers', f)); await refresh(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-4"><Field label="Contact person" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /><Field label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="Address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        <TextareaField label="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

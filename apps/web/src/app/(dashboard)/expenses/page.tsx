'use client';

import { EXPENSE_CATEGORIES, PAYMENT_METHODS, addDays, formatMoney, todayIn, type ExpenseView } from '@pms/types';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useExpenses, useRefreshBusiness } from '@/features/business/queries';
import { ChoosePropertyGate, labelOf } from '@/features/operations/shared';
import { usePropertyDetail } from '@/features/properties/queries';
import { api } from '@/lib/api';
import { pesosToMinor } from '@/lib/money';

export default function ExpensesPage() {
  return <ChoosePropertyGate what="Expenses">{(id, name) => <Expenses propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Expenses({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { can } = useAccess();
  const detail = usePropertyDetail(propertyId);
  const timezone = detail.data?.timezone ?? 'Asia/Manila';
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<ExpenseView | null>(null);
  const read = can('expense.read', propertyId);
  const manage = can('expense.manage', propertyId);
  const list = useExpenses(propertyId, { category, from, to, page }, read);
  const data = list.data;
  const pages = Math.max(Math.ceil((data?.meta.total ?? 0) / 25), 1);
  const currency = detail.data?.currency ?? 'PHP';

  if (!read) return <Alert tone="info">You don’t have access to expenses for this property.</Alert>;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}. Entries are never deleted: a wrong one is voided with a reason.</p>
        </div>
        {manage && <Button onClick={() => setAdding(true)}>Record expense</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <SelectField label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">All categories</option>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}</SelectField>
        <Field label="From" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        <Field label="To" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        <div className="flex items-end"><Button variant="ghost" onClick={() => { setCategory(''); setFrom(''); setTo(''); setPage(1); }}>Clear filters</Button></div>
      </div>

      {list.isLoading && <Spinner label="Loading expenses" />}
      {list.error && <Alert tone="error">{list.error.message}</Alert>}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><p className="text-xs uppercase tracking-wide text-slate-500">Total (excluding voided)</p><p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(data.totals.totalMinor, currency)}</p></Card>
            {data.totals.byCategory.slice(0, 3).map((c) => <Card key={c.category}><p className="text-xs uppercase tracking-wide text-slate-500">{labelOf(c.category)}</p><p className="mt-1 text-xl font-semibold text-slate-900">{formatMoney(c.totalMinor, currency)}</p></Card>)}
          </div>

          {data.items.length === 0 ? (
            <EmptyState title="No expenses found" description="Record rent, utilities, payroll and other costs here. Supplier payments appear automatically." action={manage ? <Button onClick={() => setAdding(true)}>Record expense</Button> : undefined} />
          ) : (
            <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Vendor</th><th className="px-4 py-3 font-medium">Paid by</th><th className="px-4 py-3 text-right font-medium">Amount</th><th className="px-4 py-3" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((e) => (
                    <tr key={e.id} className={e.voided ? 'text-slate-400' : ''}>
                      <td className="px-4 py-3">{e.incurredOn}</td>
                      <td className="px-4 py-3">{labelOf(e.category)}{e.source === 'PURCHASING' && <Badge tone="info">Supplier payment</Badge>}</td>
                      <td className="px-4 py-3">{e.vendor ?? '—'}{e.note && <span className="block text-xs text-slate-400">{e.note}</span>}</td>
                      <td className="px-4 py-3">{labelOf(e.paymentMethod)}{e.reference && <span className="block text-xs text-slate-400">{e.reference}</span>}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${e.voided ? 'line-through' : 'font-medium text-slate-900'}`}>{formatMoney(e.amountMinor, e.currency)}</td>
                      <td className="px-4 py-3 text-right">{e.voided ? <span className="text-xs">Voided: {e.voidReason}</span> : manage && e.source === 'MANUAL' && <Button variant="ghost" onClick={() => setVoiding(e)}>Void</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.meta.total > 25 && (
            <div className="flex items-center justify-between text-sm text-slate-600"><span>Page {page} of {pages} · {data.meta.total} expenses</span><div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div></div>
          )}
          <p className="text-xs text-slate-500">Receipt uploads arrive with document storage in a later phase.</p>
        </>
      )}

      {adding && <AddModal propertyId={propertyId} today={todayIn(timezone)} onClose={() => setAdding(false)} />}
      {voiding && <VoidModal expense={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}

function AddModal({ propertyId, today, onClose }: { propertyId: string; today: string; onClose: () => void }) {
  const refresh = useRefreshBusiness();
  const [f, setF] = useState({ category: 'UTILITIES', vendor: '', incurredOn: today, amount: '', paymentMethod: 'BANK_TRANSFER', reference: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function save() {
    setError(null);
    const amountMinor = pesosToMinor(f.amount);
    if (amountMinor === null || Number.isNaN(amountMinor) || amountMinor < 1) return setError('Enter the amount like 1500 or 1500.50.');
    if (f.incurredOn > addDays(today, 1)) return setError('An expense can’t be dated in the future.');
    setBusy(true);
    try { await api.post(`/properties/${propertyId}/expenses`, { category: f.category, vendor: f.vendor, incurredOn: f.incurredOn, amountMinor, paymentMethod: f.paymentMethod, reference: f.reference, note: f.note }); await refresh(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not record the expense.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title="Record expense" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" value={f.category} onChange={(e) => set('category', e.target.value)}>{EXPENSE_CATEGORIES.filter((c) => c !== 'INVENTORY').map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}</SelectField>
          <Field label="Date" type="date" max={addDays(today, 1)} value={f.incurredOn} onChange={(e) => set('incurredOn', e.target.value)} />
        </div>
        <Field label="Vendor / payee" value={f.vendor} onChange={(e) => set('vendor', e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount" inputMode="decimal" value={f.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
          <SelectField label="Paid by" value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{labelOf(m)}</option>)}</SelectField>
        </div>
        <Field label="Reference (optional)" value={f.reference} onChange={(e) => set('reference', e.target.value)} />
        <TextareaField label="Note (optional)" value={f.note} onChange={(e) => set('note', e.target.value)} />
        <p className="text-xs text-slate-500">Inventory purchases are recorded by paying a supplier invoice in Purchasing.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Record</Button></div>
      </div>
    </Modal>
  );
}

function VoidModal({ expense, onClose }: { expense: ExpenseView; onClose: () => void }) {
  const refresh = useRefreshBusiness();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setError(null);
    if (reason.trim().length < 3) return setError('Give a short reason.');
    setBusy(true);
    try { await api.post(`/expenses/${expense.id}/void`, { reason }); await refresh(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not void the expense.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title="Void expense?" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">{labelOf(expense.category)} · {expense.vendor ?? 'no vendor'} · <strong>{formatMoney(expense.amountMinor, expense.currency)}</strong>. It stays on record, marked as voided, and no longer counts in totals.</p>
        <TextareaField label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={busy} onClick={save}>Void expense</Button></div>
      </div>
    </Modal>
  );
}

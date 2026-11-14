'use client';

import { OUTLET_TYPES, PAYMENT_METHODS, formatMoney, posLineTotals, type PosItemView, type PosMenuView, type PosOrderView, type PosOutletView } from '@pms/types';
import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useInventory } from '@/features/business/queries';
import { ChoosePropertyGate, labelOf } from '@/features/operations/shared';
import { useFrontDesk } from '@/features/operations/queries';
import { usePosMenu, usePosOrders, usePosSummary, useRefreshPos } from '@/features/pos/queries';
import { api } from '@/lib/api';
import { minorToPesos, newIdempotencyKey, pesosToMinor } from '@/lib/money';
import { cn } from '@/lib/utils';

type Tab = 'sell' | 'sales' | 'report' | 'menu';

export default function PosPage() {
  return <ChoosePropertyGate what="The POS">{(id, name) => <Pos propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Pos({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { can } = useAccess();
  const read = can('pos.read', propertyId);
  const sell = can('pos.sell', propertyId);
  const manage = can('pos.manage', propertyId);
  const menu = usePosMenu(propertyId, read);
  const [tab, setTab] = useState<Tab>(sell ? 'sell' : 'sales');
  if (!read) return <Alert tone="info">You don’t have access to the POS for this property.</Alert>;

  const tabs: Array<[Tab, string]> = [...(sell ? ([['sell', 'Sell']] as Array<[Tab, string]>) : []), ['sales', 'Sales'], ['report', 'Daily report'], ...(manage ? ([['menu', 'Menu']] as Array<[Tab, string]>) : [])];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Point of sale</h1>
        <p className="mt-1 text-sm text-slate-500">{propertyName}. Prices and taxes always come from the menu, never from the till.</p>
      </div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium', tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>
      {menu.isLoading && <Spinner label="Loading menu" />}
      {menu.error && <Alert tone="error">{menu.error.message}</Alert>}
      {menu.data && tab === 'sell' && sell && <Till propertyId={propertyId} menu={menu.data} />}
      {tab === 'sales' && <SalesTab propertyId={propertyId} />}
      {tab === 'report' && <ReportTab propertyId={propertyId} />}
      {menu.data && tab === 'menu' && manage && <MenuTab propertyId={propertyId} menu={menu.data} />}
    </div>
  );
}

// ================================================================== the till
function Till({ propertyId, menu }: { propertyId: string; menu: PosMenuView }) {
  const refresh = useRefreshPos();
  const frontDesk = useFrontDesk(propertyId);
  const [outletId, setOutletId] = useState(menu.outlets[0]?.id ?? '');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<'PAY_NOW' | 'ROOM_CHARGE'>('PAY_NOW');
  const [method, setMethod] = useState('CASH');
  const [reservationId, setReservationId] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [note, setNote] = useState('');
  const [key, setKey] = useState(newIdempotencyKey());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PosOrderView | null>(null);

  // A different basket is a different sale, so it must never reuse the previous request key.
  useEffect(() => setKey(newIdempotencyKey()), [cart, mode, method, reservationId, outletId, tableLabel, note]);

  const outlet = menu.outlets.find((o) => o.id === outletId) ?? menu.outlets[0];
  const lines = useMemo(() => Object.entries(cart).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ item: outlet?.items.find((i) => i.id === itemId), quantity })).filter((l): l is { item: PosItemView; quantity: number } => Boolean(l.item)), [cart, outlet]);
  const totals = posLineTotals(lines.map((l) => ({ quantity: l.quantity, unitAmountMinor: l.item.priceMinor, taxable: l.item.taxable })), menu.taxes);
  const inHouse = (frontDesk.data?.inHouse ?? []).slice().sort((a, b) => (a.roomNumber ?? '').localeCompare(b.roomNumber ?? '', undefined, { numeric: true }));

  const change = (itemId: string, delta: number) => setCart((c) => ({ ...c, [itemId]: Math.max(0, Math.min(1000, (c[itemId] ?? 0) + delta)) }));
  const switchOutlet = (id: string) => { setOutletId(id); setCart({}); };

  async function submit() {
    setError(null);
    if (!outlet || lines.length === 0) return setError('Add at least one item.');
    if (mode === 'ROOM_CHARGE' && !reservationId) return setError('Choose which guest to charge.');
    setBusy(true);
    try {
      const order = await api.post<PosOrderView>(`/properties/${propertyId}/pos/orders`, {
        outletId: outlet.id,
        lines: lines.map((l) => ({ itemId: l.item.id, quantity: l.quantity })),
        settlement: mode === 'PAY_NOW' ? { type: 'PAY_NOW', method } : { type: 'ROOM_CHARGE', reservationId },
        tableLabel, note,
      }, true, { 'Idempotency-Key': key });
      setReceipt(order);
      setCart({}); setTableLabel(''); setNote(''); setReservationId('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the sale.');
    } finally {
      setBusy(false);
    }
  }

  if (menu.outlets.length === 0) return <EmptyState title="No outlets set up" description="A manager adds outlets (restaurant, bar, café…) and menu items in the Menu tab." />;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {menu.outlets.map((o) => <Button key={o.id} variant={o.id === outlet?.id ? 'primary' : 'secondary'} onClick={() => switchOutlet(o.id)}>{o.name}</Button>)}
        </div>
        {outlet && outlet.items.length === 0 && <EmptyState title="This outlet has no items yet" description="Add items in the Menu tab." />}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {outlet?.items.map((i) => (
            <button key={i.id} type="button" onClick={() => change(i.id, 1)} className="rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-indigo-400 active:scale-[0.98]">
              <span className="block font-medium text-slate-900">{i.name}</span>
              <span className="block text-xs text-slate-500">{i.category ?? ' '}</span>
              <span className="mt-2 block tabular-nums text-sm font-semibold text-indigo-700">{formatMoney(i.priceMinor, menu.currency)}</span>
              {(cart[i.id] ?? 0) > 0 && <span className="mt-1 inline-block rounded-full bg-indigo-600 px-2 text-xs font-semibold text-white">{cart[i.id]} in order</span>}
            </button>
          ))}
        </div>
      </div>

      <Card className="h-fit space-y-4 lg:sticky lg:top-4">
        <h2 className="font-semibold text-slate-900">Current order</h2>
        {lines.length === 0 ? <p className="text-sm text-slate-500">Tap items to add them.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {lines.map((l) => (
              <li key={l.item.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 flex-1 truncate">{l.item.name}</span>
                <span className="flex items-center gap-1">
                  <button type="button" aria-label={`Remove one ${l.item.name}`} className="h-8 w-8 rounded-lg bg-slate-100 font-semibold" onClick={() => change(l.item.id, -1)}>−</button>
                  <span className="w-6 text-center tabular-nums">{l.quantity}</span>
                  <button type="button" aria-label={`Add one ${l.item.name}`} className="h-8 w-8 rounded-lg bg-slate-100 font-semibold" onClick={() => change(l.item.id, 1)}>+</button>
                </span>
                <span className="w-20 text-right tabular-nums">{formatMoney(l.quantity * l.item.priceMinor, menu.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatMoney(totals.subtotalMinor, menu.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular-nums">{formatMoney(totals.taxMinor, menu.currency)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(totals.totalMinor, menu.currency)}</dd></div>
        </dl>

        <div className="grid grid-cols-2 gap-2">
          <Button variant={mode === 'PAY_NOW' ? 'primary' : 'secondary'} onClick={() => setMode('PAY_NOW')}>Pay now</Button>
          <Button variant={mode === 'ROOM_CHARGE' ? 'primary' : 'secondary'} onClick={() => setMode('ROOM_CHARGE')}>Charge to room</Button>
        </div>
        {mode === 'PAY_NOW' ? (
          <SelectField label="Paid by" value={method} onChange={(e) => setMethod(e.target.value)}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{labelOf(m)}</option>)}</SelectField>
        ) : (
          <>
            <SelectField label="Guest (checked in)" value={reservationId} onChange={(e) => setReservationId(e.target.value)}>
              <option value="">Choose a guest…</option>
              {inHouse.map((g) => <option key={g.id} value={g.id}>{g.roomNumber ? `Room ${g.roomNumber} · ` : ''}{g.guestName}</option>)}
            </SelectField>
            {frontDesk.isLoading && <Spinner />}
            {frontDesk.data && inHouse.length === 0 && <Alert tone="info">No guests are checked in right now.</Alert>}
          </>
        )}
        <Field label="Table / label (optional)" value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} />
        <TextareaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <Alert tone="error">{error}</Alert>}
        <Button className="min-h-12 w-full" loading={busy} disabled={lines.length === 0} onClick={submit}>{mode === 'PAY_NOW' ? `Charge ${formatMoney(totals.totalMinor, menu.currency)}` : `Post ${formatMoney(totals.totalMinor, menu.currency)} to room`}</Button>
        <p className="text-xs text-slate-500">Pressing twice or retrying never creates a second sale.</p>
      </Card>

      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function ReceiptModal({ order, onClose }: { order: PosOrderView; onClose: () => void }) {
  return (
    <Modal open title={`Receipt ${order.code}`} onClose={onClose}>
      <style>{`@media print { body * { visibility: hidden !important; } #pos-receipt, #pos-receipt * { visibility: visible !important; } #pos-receipt { position: absolute; left: 0; top: 0; width: 100%; } }`}</style>
      <div id="pos-receipt" className="space-y-3 text-sm">
        <div className="text-center"><p className="font-semibold text-slate-900">{order.outletName}</p><p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleString()}{order.tableLabel ? ` · ${order.tableLabel}` : ''}</p></div>
        <ul className="divide-y divide-slate-100">
          {order.lines.map((l) => <li key={l.id} className="flex justify-between py-1.5"><span>{l.quantity} × {l.description}</span><span className="tabular-nums">{formatMoney(l.amountMinor, order.currency)}</span></li>)}
        </ul>
        <dl className="space-y-1 border-t border-slate-200 pt-2">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotalMinor, order.currency)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd className="tabular-nums">{formatMoney(order.taxMinor, order.currency)}</dd></div>
          <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.totalMinor, order.currency)}</dd></div>
        </dl>
        <p className="text-center text-slate-600">{order.status === 'ROOM_CHARGED' ? `Charged to ${order.guestName ?? 'guest'}${order.roomNumber ? `, room ${order.roomNumber}` : ''}` : `Paid by ${labelOf(order.paymentMethod ?? 'OTHER')}`}</p>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => window.print()}>Print</Button><Button onClick={onClose}>Done</Button></div>
    </Modal>
  );
}

// ================================================================== sales list + void
function SalesTab({ propertyId }: { propertyId: string }) {
  const { can } = useAccess();
  const [date, setDate] = useState('');
  const orders = usePosOrders(propertyId, date);
  const [voiding, setVoiding] = useState<PosOrderView | null>(null);
  const [open, setOpen] = useState<PosOrderView | null>(null);
  return (
    <div className="space-y-4">
      <div className="max-w-xs"><Field label="Day (blank = today)" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      {orders.isLoading && <Spinner />}
      {orders.error && <Alert tone="error">{orders.error.message}</Alert>}
      {orders.data?.length === 0 && <EmptyState title="No sales" description="Nothing has been rung up for this day." />}
      {orders.data && orders.data.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Receipt</th><th className="px-4 py-3 font-medium">Outlet</th><th className="px-4 py-3 font-medium">Settled</th><th className="px-4 py-3 text-right font-medium">Total</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {orders.data.map((o) => (
                <tr key={o.id} className={o.status === 'VOID' ? 'text-slate-400' : ''}>
                  <td className="px-4 py-3"><span className="font-medium">{o.code}</span><span className="block text-xs text-slate-400">{new Date(o.createdAt).toLocaleTimeString()}{o.createdByName ? ` · ${o.createdByName}` : ''}</span></td>
                  <td className="px-4 py-3">{o.outletName}{o.tableLabel ? ` · ${o.tableLabel}` : ''}</td>
                  <td className="px-4 py-3">{o.status === 'VOID' ? <Badge tone="neutral">Voided</Badge> : o.status === 'ROOM_CHARGED' ? <Badge tone="info">Room {o.roomNumber ?? ''} · {o.guestName}</Badge> : <Badge tone="success">{labelOf(o.paymentMethod ?? 'OTHER')}</Badge>}{o.voidReason && <span className="block text-xs">{o.voidReason}</span>}</td>
                  <td className={cn('px-4 py-3 text-right tabular-nums', o.status === 'VOID' && 'line-through')}>{formatMoney(o.totalMinor, o.currency)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right"><Button variant="ghost" onClick={() => setOpen(o)}>View</Button>{o.status !== 'VOID' && can('pos.void', propertyId) && <Button variant="ghost" onClick={() => setVoiding(o)}>Void</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ReceiptModal order={open} onClose={() => setOpen(null)} />}
      {voiding && <VoidModal order={voiding} onClose={() => setVoiding(null)} />}
    </div>
  );
}

function VoidModal({ order, onClose }: { order: PosOrderView; onClose: () => void }) {
  const refresh = useRefreshPos();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setError(null);
    if (reason.trim().length < 3) return setError('Give a short reason.');
    setBusy(true);
    try { await api.post(`/pos/orders/${order.id}/void`, { reason }); await refresh(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not void the sale.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title={`Void ${order.code}?`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">{formatMoney(order.totalMinor, order.currency)} · {order.outletName}.</p>
        <Alert tone="warning">{order.status === 'ROOM_CHARGED' ? 'The charge is reversed on the guest’s bill (if the bill is still open) and any stock used is put back.' : 'The sale is marked void and any stock used is put back. Give the money back to the customer yourself: the POS does not refund cash.'}</Alert>
        <TextareaField label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Keep sale</Button><Button variant="danger" loading={busy} onClick={save}>Void sale</Button></div>
      </div>
    </Modal>
  );
}

// ================================================================== daily report
function ReportTab({ propertyId }: { propertyId: string }) {
  const [date, setDate] = useState('');
  const summary = usePosSummary(propertyId, date);
  const s = summary.data;
  return (
    <div className="space-y-4">
      <div className="max-w-xs"><Field label="Day (blank = today)" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      {summary.isLoading && <Spinner />}
      {summary.error && <Alert tone="error">{summary.error.message}</Alert>}
      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><p className="text-xs uppercase tracking-wide text-slate-500">Sales ({s.date})</p><p className="mt-1 text-2xl font-semibold">{formatMoney(s.salesMinor, s.currency)}</p><p className="text-xs text-slate-500">{s.orders} sale{s.orders === 1 ? '' : 's'}</p></Card>
            <Card><p className="text-xs uppercase tracking-wide text-slate-500">Tax included</p><p className="mt-1 text-2xl font-semibold">{formatMoney(s.taxMinor, s.currency)}</p></Card>
            <Card><p className="text-xs uppercase tracking-wide text-slate-500">Voided</p><p className="mt-1 text-2xl font-semibold">{s.voidedOrders}</p><p className="text-xs text-slate-500">{formatMoney(s.voidedMinor, s.currency)} (not in sales)</p></Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Breakdown title="By outlet" rows={s.byOutlet.map((o) => ({ label: o.outletName, orders: o.orders, total: o.totalMinor }))} currency={s.currency} />
            <Breakdown title="How it was settled" rows={s.bySettlement.map((o) => ({ label: o.settlement === 'ROOM_CHARGE' ? 'Charged to rooms' : labelOf(o.settlement), orders: o.orders, total: o.totalMinor }))} currency={s.currency} />
          </div>
          <p className="text-xs text-slate-500">Cash to hand in = the Cash row. Room charges are collected when the guest checks out.</p>
        </>
      )}
    </div>
  );
}

function Breakdown({ title, rows, currency }: { title: string; rows: Array<{ label: string; orders: number; total: number }>; currency: string }) {
  return (
    <Card>
      <h3 className="mb-2 text-sm font-semibold text-slate-800">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-slate-500">Nothing yet.</p> : (
        <ul className="divide-y divide-slate-100 text-sm">{rows.map((r) => <li key={r.label} className="flex justify-between py-2"><span>{r.label} <span className="text-xs text-slate-400">({r.orders})</span></span><span className="tabular-nums font-medium">{formatMoney(r.total, currency)}</span></li>)}</ul>
      )}
    </Card>
  );
}

// ================================================================== menu management
function MenuTab({ propertyId, menu }: { propertyId: string; menu: PosMenuView }) {
  const refresh = useRefreshPos();
  const [outletForm, setOutletForm] = useState<{ outlet?: PosOutletView } | null>(null);
  const [itemForm, setItemForm] = useState<{ outlet: PosOutletView; item?: PosItemView } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } };
  return (
    <div className="space-y-6">
      <div className="flex justify-end"><Button onClick={() => setOutletForm({})}>Add outlet</Button></div>
      {error && <Alert tone="error">{error}</Alert>}
      {menu.outlets.length === 0 && <EmptyState title="No outlets yet" description="Add an outlet such as a restaurant or bar, then its menu items." />}
      {menu.outlets.map((o) => (
        <Card key={o.id} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-slate-900">{o.name} <span className="text-sm font-normal text-slate-500">· {labelOf(o.type)}</span></h3>
            <div className="flex gap-2"><Button variant="secondary" onClick={() => setItemForm({ outlet: o })}>Add item</Button><Button variant="ghost" onClick={() => setOutletForm({ outlet: o })}>Edit</Button><Button variant="ghost" onClick={() => run(() => api.delete(`/pos/outlets/${o.id}`))}>Archive</Button></div>
          </div>
          {o.items.length === 0 ? <p className="text-sm text-slate-500">No items yet.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">
              {o.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span>{i.name}<span className="block text-xs text-slate-400">{i.category ?? 'No category'}{i.taxable ? ' · taxable' : ' · no tax'}{i.inventoryItemId ? ` · uses ${i.inventoryQuantity} stock` : ''}</span></span>
                  <span className="flex items-center gap-2"><span className="tabular-nums font-medium">{formatMoney(i.priceMinor, menu.currency)}</span><Button variant="ghost" onClick={() => setItemForm({ outlet: o, item: i })}>Edit</Button><Button variant="ghost" onClick={() => run(() => api.delete(`/pos/items/${i.id}`))}>Remove</Button></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ))}
      {outletForm && <OutletModal propertyId={propertyId} outlet={outletForm.outlet} onClose={() => setOutletForm(null)} />}
      {itemForm && <ItemModal propertyId={propertyId} outlet={itemForm.outlet} item={itemForm.item} onClose={() => setItemForm(null)} />}
    </div>
  );
}

function useSaver(onClose: () => void) {
  const refresh = useRefreshPos();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) { setBusy(true); setError(null); try { await fn(); await refresh(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } finally { setBusy(false); } }
  return { error, setError, busy, run };
}

function OutletModal({ propertyId, outlet, onClose }: { propertyId: string; outlet?: PosOutletView; onClose: () => void }) {
  const { error, setError, busy, run } = useSaver(onClose);
  const [name, setName] = useState(outlet?.name ?? '');
  const [type, setType] = useState(outlet?.type ?? 'RESTAURANT');
  const save = () => { if (name.trim().length < 2) return setError('Enter a name.'); void run(() => (outlet ? api.patch(`/pos/outlets/${outlet.id}`, { name, type }) : api.post(`/properties/${propertyId}/pos/outlets`, { name, type }))); };
  return (
    <Modal open title={outlet ? 'Edit outlet' : 'Add outlet'} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>{OUTLET_TYPES.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}</SelectField>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

function ItemModal({ propertyId, outlet, item, onClose }: { propertyId: string; outlet: PosOutletView; item?: PosItemView; onClose: () => void }) {
  const { can } = useAccess();
  const stockItems = useInventory(propertyId, can('inventory.read', propertyId));
  const { error, setError, busy, run } = useSaver(onClose);
  const [f, setF] = useState({ name: item?.name ?? '', category: item?.category ?? '', price: item ? minorToPesos(item.priceMinor) : '', taxable: item?.taxable ?? true, inventoryItemId: item?.inventoryItemId ?? '', inventoryQuantity: String(item?.inventoryQuantity ?? 1) });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = () => {
    const priceMinor = pesosToMinor(f.price);
    const qty = Number(f.inventoryQuantity);
    if (f.name.trim().length < 2) return setError('Enter a name.');
    if (priceMinor === null || Number.isNaN(priceMinor) || priceMinor < 0) return setError('Enter the price like 120 or 120.50.');
    if (f.inventoryItemId && (!Number.isInteger(qty) || qty < 1)) return setError('Stock used must be a whole number above zero.');
    void run(() =>
      item
        ? api.patch(`/pos/items/${item.id}`, { name: f.name, category: f.category, priceMinor, taxable: f.taxable, inventoryItemId: f.inventoryItemId || null, ...(f.inventoryItemId ? { inventoryQuantity: qty } : {}) })
        : api.post('/pos/items', { outletId: outlet.id, name: f.name, category: f.category, priceMinor, taxable: f.taxable, ...(f.inventoryItemId ? { inventoryItemId: f.inventoryItemId } : {}), inventoryQuantity: f.inventoryItemId ? qty : 1 }),
    );
  };

  return (
    <Modal open title={item ? `Edit ${item.name}` : `Add item to ${outlet.name}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name" value={f.name} onChange={(e) => set('name', e.target.value)} />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Category (optional)" value={f.category} onChange={(e) => set('category', e.target.value)} />
          <Field label="Price" inputMode="decimal" value={f.price} onChange={(e) => set('price', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={f.taxable} onChange={(e) => set('taxable', e.target.checked)} /> Taxable</label>
        {stockItems.data && (
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <SelectField label="Uses up stock (optional)" value={f.inventoryItemId} onChange={(e) => set('inventoryItemId', e.target.value)}>
              <option value="">Not tracked</option>
              {stockItems.data.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>)}
            </SelectField>
            <Field label="Per sale" inputMode="numeric" value={f.inventoryQuantity} onChange={(e) => set('inventoryQuantity', e.target.value)} disabled={!f.inventoryItemId} />
          </div>
        )}
        <p className="text-xs text-slate-500">A tracked item can’t be sold when there isn’t enough stock. Changing a price never changes past sales.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

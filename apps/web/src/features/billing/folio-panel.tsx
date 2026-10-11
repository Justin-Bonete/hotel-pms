'use client';

import { formatMoney, shortDateLabel, type FolioItemView, type PaymentView, type ReservationView } from './folio-helpers';
import { useState } from 'react';
import { Alert, Badge, Button, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { cn } from '@/lib/utils';
import { AdjustmentModal, ChargeModal, PaymentModal, RefundModal, VoidModal, methodLabel } from './folio-actions';
import { useFolio } from './queries';

export function FolioPanel({ reservation: r }: { reservation: ReservationView }) {
  const { can } = useAccess();
  const mayRead = can('folio.read', r.propertyId);
  const folio = useFolio(r.id, mayRead);
  const [dialog, setDialog] = useState<null | 'payment' | 'charge' | 'adjust'>(null);
  const [voiding, setVoiding] = useState<FolioItemView | null>(null);
  const [refunding, setRefunding] = useState<PaymentView | null>(null);

  if (!mayRead) return <Alert tone="info">You don’t have access to billing for this property.</Alert>;
  if (folio.isLoading) return <Spinner label="Loading folio" />;
  if (folio.error || !folio.data) return <Alert tone="error">We could not load the folio. {folio.error?.message}</Alert>;

  const f = folio.data;
  const { balanceMinor } = f.totals;
  const inHouse = r.status === 'CHECKED_IN';
  const open = f.status === 'OPEN';
  const mayPay = can('payment.take', r.propertyId) && ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'].includes(r.status);
  const empty = f.items.length === 0 && f.payments.length === 0;

  return (
    <section className="print-area space-y-3 rounded-xl ring-1 ring-slate-200" aria-label="Guest folio">
      <div className="hidden print:block px-4 pt-4">
        <p className="text-lg font-semibold">{f.propertyName}</p>
        <p className="text-sm">Guest folio · {f.reservationCode} · {f.guestName}</p>
        <p className="text-xs text-slate-500">Printed {new Date().toLocaleString()}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 no-print">
        <h3 className="font-semibold text-slate-900">Folio {f.status === 'CLOSED' && <Badge>Closed</Badge>}</h3>
        <div className="flex flex-wrap gap-2">
          {mayPay && <Button variant="secondary" onClick={() => setDialog('payment')}>{inHouse || f.roomChargesPosted ? 'Record payment' : 'Take deposit'}</Button>}
          {inHouse && open && can('folio.charge', r.propertyId) && <Button variant="secondary" onClick={() => setDialog('charge')}>Add charge</Button>}
          {inHouse && open && can('folio.adjust', r.propertyId) && <Button variant="secondary" onClick={() => setDialog('adjust')}>Discount / adjust</Button>}
          {!empty && <Button variant="ghost" onClick={() => window.print()}>Print</Button>}
        </div>
      </div>

      {empty ? (
        <p className="px-4 pb-4 text-sm text-slate-500">
          {['CANCELLED', 'NO_SHOW'].includes(r.status)
            ? 'No payments were recorded for this reservation.'
            : `Nothing billed yet. Room charges and taxes are posted automatically at check-in${mayPay ? '; you can take a deposit now.' : '.'}`}
        </p>
      ) : (
        <div className="space-y-4 px-4 pb-4">
          {f.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-400">
                  <tr><th className="py-1 font-medium">Charge</th><th className="py-1 font-medium">Date</th><th className="py-1 text-right font-medium">Amount</th><th className="no-print w-16" /></tr>
                </thead>
                <tbody>
                  {f.items.map((i) => (
                    <tr key={i.id} className={cn('border-t border-slate-100', (i.voided || i.type === 'REVERSAL') && 'text-slate-400', i.type === 'TAX' && 'text-slate-500')}>
                      <td className={cn('py-1.5', i.type === 'TAX' && 'pl-4', i.voided && 'line-through')}>
                        {i.description}
                        {i.quantity > 1 && <span className="text-slate-400"> × {i.quantity}</span>}
                        {i.reason && <span className="block text-xs text-slate-400">{i.reason}</span>}
                      </td>
                      <td className="py-1.5 text-xs text-slate-500">{i.serviceDate ? shortDateLabel(i.serviceDate) : ''}</td>
                      <td className={cn('py-1.5 text-right tabular-nums', i.voided && 'line-through', i.amountMinor < 0 && 'text-emerald-700')}>{formatMoney(i.amountMinor, f.currency)}</td>
                      <td className="no-print py-1.5 text-right">{i.voidable && can('folio.adjust', r.propertyId) && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setVoiding(i)}>Void</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {f.payments.length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Payments</h4>
              <ul className="divide-y divide-slate-100 text-sm">
                {f.payments.map((p) => (
                  <li key={p.id} className="py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span>{methodLabel(p.method)}{p.reference && <span className="text-slate-500"> · {p.reference}</span>} <span className="text-xs text-slate-400">{new Date(p.createdAt).toLocaleDateString()}</span></span>
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-emerald-700">−{formatMoney(p.amountMinor, f.currency)}</span>
                        {can('payment.refund', r.propertyId) && p.amountMinor - p.refundedMinor > 0 && <button type="button" className="no-print text-xs text-red-600 hover:underline" onClick={() => setRefunding(p)}>Refund</button>}
                      </span>
                    </div>
                    {p.refunds.map((x) => <p key={x.id} className="pl-4 text-xs text-slate-500">Refunded {formatMoney(x.amountMinor, f.currency)} — {x.reason}</p>)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="space-y-1 border-t border-slate-200 pt-3 text-sm">
            <Row label="Charges and taxes" value={formatMoney(f.totals.itemsMinor, f.currency)} />
            <Row label="Paid" value={`−${formatMoney(f.totals.paidMinor, f.currency)}`} />
            {f.totals.refundedMinor > 0 && <Row label="Refunded" value={formatMoney(f.totals.refundedMinor, f.currency)} />}
            <div className="flex items-center justify-between pt-1 text-base font-semibold">
              <dt>{balanceMinor > 0 ? 'Balance due' : balanceMinor < 0 ? 'Guest credit' : 'Settled'}</dt>
              <dd className={cn('tabular-nums', balanceMinor > 0 ? 'text-red-700' : balanceMinor < 0 ? 'text-amber-700' : 'text-emerald-700')}>{formatMoney(Math.abs(balanceMinor), f.currency)}</dd>
            </div>
          </dl>
        </div>
      )}

      <PaymentModal open={dialog === 'payment'} onClose={() => setDialog(null)} reservationId={r.id} currency={f.currency} balanceDueMinor={f.roomChargesPosted ? balanceMinor : 0} />
      <ChargeModal open={dialog === 'charge'} onClose={() => setDialog(null)} reservationId={r.id} currency={f.currency} />
      <AdjustmentModal open={dialog === 'adjust'} onClose={() => setDialog(null)} reservationId={r.id} />
      <VoidModal item={voiding} currency={f.currency} onClose={() => setVoiding(null)} />
      <RefundModal payment={refunding} currency={f.currency} onClose={() => setRefunding(null)} />
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-slate-600"><dt>{label}</dt><dd className="tabular-nums">{value}</dd></div>;
}

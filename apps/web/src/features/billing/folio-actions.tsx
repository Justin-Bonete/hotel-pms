'use client';

import { PAYMENT_METHODS, formatMoney, type FolioItemView, type PaymentMethod, type PaymentView } from '@pms/types';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Button, Field, SelectField, TextareaField } from '@/components/ui/ui';
import { useRefreshReservations } from '@/features/reservations/queries';
import { api } from '@/lib/api';
import { newIdempotencyKey, pesosToMinor } from '@/lib/money';

const METHOD_LABELS: Record<PaymentMethod, string> = { CASH: 'Cash', CARD: 'Card', BANK_TRANSFER: 'Bank transfer', E_WALLET: 'E-wallet', OTHER: 'Other' };
export const methodLabel = (m: PaymentMethod): string => METHOD_LABELS[m];

/** Shared submit logic: one idempotency key per opened form, so a retry or double-click can never post twice. */
function useSubmit(open: boolean, onClose: () => void) {
  const refresh = useRefreshReservations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(newIdempotencyKey());
  useEffect(() => {
    if (open) { setError(null); setKey(newIdempotencyKey()); }
  }, [open]);

  async function submit(path: string, body: unknown, useKey = true) {
    setBusy(true);
    setError(null);
    try {
      await api.post(path, body, true, useKey ? { 'Idempotency-Key': key } : undefined);
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, setError, submit };
}

// ------------------------------------------------------------------ record a payment / deposit
export function PaymentModal({ open, onClose, reservationId, currency, balanceDueMinor }: { open: boolean; onClose: () => void; reservationId: string; currency: string; balanceDueMinor: number }) {
  const { busy, error, setError, submit } = useSubmit(open, onClose);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) { setAmount(balanceDueMinor > 0 ? String(balanceDueMinor / 100) : ''); setMethod('CASH'); setReference(''); setNote(''); }
  }, [open, balanceDueMinor]);

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {balanceDueMinor > 0 && <p className="text-sm text-slate-600">Balance due: <strong>{formatMoney(balanceDueMinor, currency)}</strong></p>}
        <Field label="Amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
        <SelectField label="Method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABELS[m]}</option>)}
        </SelectField>
        <Field label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Card approval code, transfer reference…" />
        <TextareaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <Actions onClose={onClose} busy={busy} label="Record payment" onSubmit={() => {
          const minor = pesosToMinor(amount);
          if (minor === null || Number.isNaN(minor) || minor < 1) return setError('Enter an amount like 1500 or 1500.50.');
          void submit(`/reservations/${reservationId}/folio/payments`, { amountMinor: minor, method, reference, note });
        }} />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ extra charge
export function ChargeModal({ open, onClose, reservationId, currency }: { open: boolean; onClose: () => void; reservationId: string; currency: string }) {
  const { busy, error, setError, submit } = useSubmit(open, onClose);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [taxable, setTaxable] = useState(true);
  useEffect(() => { if (open) { setDescription(''); setQuantity('1'); setUnit(''); setTaxable(true); } }, [open]);
  const unitMinor = pesosToMinor(unit);
  const total = unitMinor !== null && !Number.isNaN(unitMinor) ? unitMinor * (Number(quantity) || 0) : null;

  return (
    <Modal open={open} onClose={onClose} title="Add charge">
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Laundry, Minibar, Airport transfer" />
        <div className="grid grid-cols-2 gap-4">
          <Field label="Quantity" type="number" min={1} max={1000} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <Field label="Price each" inputMode="decimal" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="0.00" />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} /> Add the property’s taxes to this charge</label>
        {total !== null && total > 0 && <p className="text-sm text-slate-600">Charge before tax: <strong>{formatMoney(total, currency)}</strong></p>}
        <Actions onClose={onClose} busy={busy} label="Post charge" onSubmit={() => {
          const q = Number(quantity);
          if (description.trim().length < 2) return setError('Describe the charge.');
          if (!Number.isInteger(q) || q < 1) return setError('Quantity must be a whole number.');
          if (unitMinor === null || Number.isNaN(unitMinor) || unitMinor < 1) return setError('Enter the price like 450 or 450.50.');
          void submit(`/reservations/${reservationId}/folio/charges`, { description, quantity: q, unitAmountMinor: unitMinor, taxable });
        }} />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ discount / adjustment (managers)
export function AdjustmentModal({ open, onClose, reservationId }: { open: boolean; onClose: () => void; reservationId: string }) {
  const { busy, error, setError, submit } = useSubmit(open, onClose);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => { if (open) { setDescription(''); setAmount(''); setReason(''); } }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Discount or adjustment">
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Service recovery discount" />
        <Field label="Amount (use a minus sign for a discount)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="-500.00" />
        <TextareaField label="Reason (required, kept in the audit log)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Actions onClose={onClose} busy={busy} label="Post" onSubmit={() => {
          const minor = pesosToMinor(amount);
          if (description.trim().length < 2) return setError('Describe the adjustment.');
          if (minor === null || Number.isNaN(minor) || minor === 0) return setError('Enter an amount like -500 or 250.50.');
          if (reason.trim().length < 3) return setError('Give a short reason.');
          void submit(`/reservations/${reservationId}/folio/adjustments`, { description, amountMinor: minor, reason }, false);
        }} />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ void a line (reversal)
export function VoidModal({ item, currency, onClose }: { item: FolioItemView | null; currency: string; onClose: () => void }) {
  const { busy, error, setError, submit } = useSubmit(item !== null, onClose);
  const [reason, setReason] = useState('');
  useEffect(() => setReason(''), [item]);
  if (!item) return null;
  return (
    <Modal open title="Void this line?" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600"><strong>{item.description}</strong> · {formatMoney(item.amountMinor, currency)}. Its taxes are voided with it. The original stays on the folio, cancelled by a reversing line, so the history is never lost.</p>
        <TextareaField label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Actions onClose={onClose} busy={busy} danger label="Void line" onSubmit={() => {
          if (reason.trim().length < 3) return setError('Give a short reason.');
          void submit(`/folio-items/${item.id}/void`, { reason }, false);
        }} />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ refund (managers)
export function RefundModal({ payment, currency, onClose }: { payment: PaymentView | null; currency: string; onClose: () => void }) {
  const { busy, error, setError, submit } = useSubmit(payment !== null, onClose);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const refundable = payment ? payment.amountMinor - payment.refundedMinor : 0;
  useEffect(() => { setAmount(refundable > 0 ? String(refundable / 100) : ''); setReason(''); }, [payment, refundable]);
  if (!payment) return null;
  return (
    <Modal open title="Refund payment" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <p className="text-sm text-slate-600">{methodLabel(payment.method)} payment of <strong>{formatMoney(payment.amountMinor, currency)}</strong>. Still refundable: <strong>{formatMoney(refundable, currency)}</strong>. This records the refund; hand the money back by the same method.</p>
        <Field label="Refund amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextareaField label="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <Actions onClose={onClose} busy={busy} danger label="Refund" onSubmit={() => {
          const minor = pesosToMinor(amount);
          if (minor === null || Number.isNaN(minor) || minor < 1) return setError('Enter an amount like 500 or 500.50.');
          if (minor > refundable) return setError(`At most ${formatMoney(refundable, currency)} can be refunded.`);
          if (reason.trim().length < 3) return setError('Give a short reason.');
          void submit(`/payments/${payment.id}/refunds`, { amountMinor: minor, reason });
        }} />
      </div>
    </Modal>
  );
}

function Actions({ onClose, onSubmit, busy, label, danger }: { onClose: () => void; onSubmit: () => void; busy: boolean; label: string; danger?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onSubmit}>{label}</Button>
    </div>
  );
}

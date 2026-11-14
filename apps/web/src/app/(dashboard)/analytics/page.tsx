'use client';

import { ANALYTICS_PRESETS, PRESET_LABELS, presetRange, type AnalyticsOverview, type AnalyticsPreset, type PeriodKpis } from '@pms/types';
import { useState } from 'react';
import { Alert, Button, Card, EmptyState, Field, SelectField, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { BarChart, BarList, LineChart } from '@/features/analytics/charts';
import { delta, money, pct, shortDate } from '@/features/analytics/format';
import { localToday, useAnalytics } from '@/features/analytics/queries';
import { labelOf } from '@/features/operations/shared';
import { ALL_PROPERTIES, useProperties } from '@/features/properties/property-context';
import { cn } from '@/lib/utils';

export default function AnalyticsPage() {
  const { can } = useAccess();
  const { selectedId, selected } = useProperties();
  const propertyId = selectedId && selectedId !== ALL_PROPERTIES ? selectedId : null;
  const [preset, setPreset] = useState<AnalyticsPreset | 'custom'>('last30');
  const today = localToday();
  const initial = presetRange('last30', today);
  const [custom, setCustom] = useState(initial);
  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const allowed = propertyId ? can('analytics.read', propertyId) : can('analytics.read');
  const q = useAnalytics(propertyId, range.from, range.to, allowed);
  const data = q.data;

  if (!allowed) return <Alert tone="info">You don’t have access to analytics{propertyId ? ' for this property' : ''}.</Alert>;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">{selected ? selected.name : 'All properties'} · {shortDate(range.from)} to {shortDate(range.to)}{data ? ` (${data.range.days} days)` : ''}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <SelectField label="Period" value={preset} onChange={(e) => setPreset(e.target.value as AnalyticsPreset | 'custom')}>
              {ANALYTICS_PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}
              <option value="custom">Custom range…</option>
            </SelectField>
          </div>
          {preset === 'custom' && (
            <>
              <Field label="From" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              <Field label="To" type="date" max={today} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
            </>
          )}
        </div>
      </div>

      {q.isLoading && <Spinner label="Crunching the numbers" />}
      {q.error && <Alert tone="error" action={<Button variant="secondary" onClick={() => q.refetch()}>Retry</Button>}>{q.error.message}</Alert>}
      {data && <Body data={data} />}
    </div>
  );
}

function Body({ data }: { data: AnalyticsOverview }) {
  if (data.properties.length === 0) return <EmptyState title="No properties to report on" description="Analytics appear once you have a property you can access." />;
  const { current: c, previous: p, currency } = data;
  return (
    <>
      {data.mixedCurrencies && <Alert tone="warning">These properties use different currencies, so their money can’t be added together. See each property below.</Alert>}
      {data.truncated && <Alert tone="warning">This range has more records than a single report can safely read, so some figures may be incomplete. Choose a shorter range.</Alert>}

      {c && p && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Kpi label="Total revenue" value={money(c.totalRevenueMinor, currency)} d={delta(c.totalRevenueMinor, p.totalRevenueMinor)} hint="Rooms + extras + POS, before tax" />
            <Kpi label="Room revenue" value={money(c.roomRevenueMinor, currency)} d={delta(c.roomRevenueMinor, p.roomRevenueMinor)} />
            <Kpi label="Occupancy" value={pct(c.occupancyPct)} d={delta(c.occupancyPct, p.occupancyPct)} hint={`${c.soldRoomNights} of ${c.availableRoomNights} room nights`} />
            <Kpi label="ADR" value={money(c.adrMinor, currency)} d={delta(c.adrMinor, p.adrMinor)} hint="Room revenue ÷ nights sold" />
            <Kpi label="RevPAR" value={money(c.revparMinor, currency)} d={delta(c.revparMinor, p.revparMinor)} hint="Room revenue ÷ nights available" />
            <Kpi label="Expenses" value={money(c.expensesMinor, currency)} d={delta(c.expensesMinor, p.expensesMinor, true)} hint="Voided entries excluded" />
            <Kpi label="Revenue − expenses" value={money(c.netMinor, currency)} d={delta(c.netMinor, p.netMinor)} hint="Operating view, not accounting profit" />
            <Kpi label="Bookings made" value={String(c.bookingsMade)} d={delta(c.bookingsMade, p.bookingsMade)} hint={c.cancellationRatePct === null ? undefined : `${c.cancellationRatePct}% later cancelled`} />
          </div>
          <KpiNotes c={c} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-2"><h2 className="text-sm font-semibold text-slate-800">Revenue per day</h2>
              <BarChart label="Total revenue per day" labels={(data.daily ?? []).map((d) => shortDate(d.date))} values={(data.daily ?? []).map((d) => d.totalRevenueMinor)} format={(v) => money(v, currency)} />
            </Card>
            <Card className="space-y-2"><h2 className="text-sm font-semibold text-slate-800">Occupancy per day</h2>
              <LineChart label="Occupancy percent per day" labels={(data.daily ?? []).map((d) => shortDate(d.date))} values={(data.daily ?? []).map((d) => d.occupancyPct)} />
            </Card>
            <Card className="space-y-3"><h2 className="text-sm font-semibold text-slate-800">Revenue by source</h2>
              <BarList format={(v) => money(v, currency)} rows={[{ label: 'Rooms', value: c.roomRevenueMinor }, { label: 'POS (restaurant, bar…)', value: c.posRevenueMinor }, { label: 'Front-desk extras', value: c.extrasRevenueMinor }].sort((a, b) => b.value - a.value)} />
            </Card>
            <Card className="space-y-3"><h2 className="text-sm font-semibold text-slate-800">Expenses by category</h2>
              <BarList format={(v) => money(v, currency)} rows={data.expensesByCategory.map((e) => ({ label: labelOf(e.category), value: e.totalMinor }))} />
            </Card>
            <Card className="space-y-3"><h2 className="text-sm font-semibold text-slate-800">POS sales by outlet</h2>
              <BarList format={(v) => money(v, currency)} rows={data.posByOutlet.map((o) => ({ label: `${o.outletName} (${o.orders})`, value: o.totalMinor }))} />
            </Card>
            <Card className="space-y-3"><h2 className="text-sm font-semibold text-slate-800">Where bookings came from</h2>
              <BarList format={(v) => String(v)} rows={data.bookingSources.map((s) => ({ label: labelOf(s.source), value: s.bookings }))} />
            </Card>
          </div>
        </>
      )}

      <section aria-label="Property comparison" className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Property comparison</h2>
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 text-right font-medium">Revenue</th><th className="px-4 py-3 text-right font-medium">vs previous</th><th className="px-4 py-3 text-right font-medium">Occupancy</th><th className="px-4 py-3 text-right font-medium">ADR</th><th className="px-4 py-3 text-right font-medium">RevPAR</th><th className="px-4 py-3 text-right font-medium">Expenses</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.properties.map((x) => {
                const d = delta(x.current.totalRevenueMinor, x.previous.totalRevenueMinor);
                return (
                  <tr key={x.propertyId}>
                    <td className="px-4 py-3 font-medium text-slate-900">{x.propertyName}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(x.current.totalRevenueMinor, x.currency)}</td>
                    <td className={cn('px-4 py-3 text-right text-xs', d.tone === 'good' && 'text-emerald-700', d.tone === 'bad' && 'text-red-700')}>{d.text.replace(' vs previous', '')}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{pct(x.current.occupancyPct)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(x.current.adrMinor, x.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(x.current.revparMinor, x.currency)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(x.current.expensesMinor, x.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function KpiNotes({ c }: { c: PeriodKpis }) {
  const notes: string[] = [];
  if (c.forecastNights > 0) notes.push(`${c.forecastNights} of the sold nights are today or later (confirmed or in-house, not yet happened).`);
  notes.push('Room revenue comes from each stay’s nightly rates, before tax. A confirmed booking whose past night never became a check-in is not counted.');
  notes.push('Available nights use today’s room count (a room’s past out-of-service days are not tracked yet).');
  notes.push('Discounts and adjustments on guest bills are not deducted from revenue yet.');
  return <ul className="space-y-1 text-xs text-slate-500">{notes.map((n) => <li key={n}>• {n}</li>)}</ul>;
}

function Kpi({ label, value, d, hint }: { label: string; value: string; d: { text: string; tone: 'good' | 'bad' | 'flat' | 'none' }; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      <p className={cn('mt-1 text-xs', d.tone === 'good' && 'text-emerald-700', d.tone === 'bad' && 'text-red-700', (d.tone === 'flat' || d.tone === 'none') && 'text-slate-500')}>{d.text}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  );
}

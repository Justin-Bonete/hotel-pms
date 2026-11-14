'use client';

import { ANALYTICS_PRESETS, PRESET_LABELS, presetRange, percentChange, type AnalyticsOverview, type AnalyticsPreset } from '@pms/types';
import { toCsv } from '@pms/utils';
import { useMemo, useState } from 'react';
import { Alert, Button, EmptyState, Field, SelectField, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { money, pct, pesos, shortDate } from '@/features/analytics/format';
import { localToday, useAnalytics } from '@/features/analytics/queries';
import { labelOf } from '@/features/operations/shared';
import { ALL_PROPERTIES, useProperties } from '@/features/properties/property-context';

type ReportId = 'daily' | 'properties' | 'revenue-sources' | 'expenses' | 'bookings';
const REPORTS: Array<[ReportId, string]> = [
  ['daily', 'Daily performance'], ['properties', 'Property comparison'], ['revenue-sources', 'Revenue by source'], ['expenses', 'Expenses by category'], ['bookings', 'Booking sources'],
];

/** A cell has the text people read and the value a spreadsheet should receive (money as plain numbers, not "₱1,200.00"). */
interface Cell { text: string; value: string | number | null; right?: boolean }
interface Table { headers: string[]; rows: Cell[][] }
const text = (s: string): Cell => ({ text: s, value: s });
const num = (n: number | null, shown: string): Cell => ({ text: shown, value: n, right: true });

function buildTable(report: ReportId, d: AnalyticsOverview): Table {
  const cur = d.currency;
  switch (report) {
    case 'daily':
      return {
        headers: ['Date', 'Room revenue', 'Extras', 'POS', 'Total revenue', 'Rooms sold', 'Rooms available', 'Occupancy %', 'ADR'],
        rows: (d.daily ?? []).map((x) => [text(x.date), num(pesos(x.roomRevenueMinor), money(x.roomRevenueMinor, cur)), num(pesos(x.extrasRevenueMinor), money(x.extrasRevenueMinor, cur)), num(pesos(x.posRevenueMinor), money(x.posRevenueMinor, cur)), num(pesos(x.totalRevenueMinor), money(x.totalRevenueMinor, cur)), num(x.soldRoomNights, String(x.soldRoomNights)), num(x.availableRoomNights, String(x.availableRoomNights)), num(x.occupancyPct, pct(x.occupancyPct)), num(pesos(x.adrMinor), money(x.adrMinor, cur))]),
      };
    case 'properties':
      return {
        headers: ['Property', 'Currency', 'Revenue', 'Previous period revenue', 'Change %', 'Occupancy %', 'ADR', 'RevPAR', 'Expenses', 'Revenue minus expenses'],
        rows: d.properties.map((x) => { const ch = percentChange(x.current.totalRevenueMinor, x.previous.totalRevenueMinor); return [text(x.propertyName), text(x.currency), num(pesos(x.current.totalRevenueMinor), money(x.current.totalRevenueMinor, x.currency)), num(pesos(x.previous.totalRevenueMinor), money(x.previous.totalRevenueMinor, x.currency)), num(ch, ch === null ? '—' : `${ch}%`), num(x.current.occupancyPct, pct(x.current.occupancyPct)), num(pesos(x.current.adrMinor), money(x.current.adrMinor, x.currency)), num(pesos(x.current.revparMinor), money(x.current.revparMinor, x.currency)), num(pesos(x.current.expensesMinor), money(x.current.expensesMinor, x.currency)), num(pesos(x.current.netMinor), money(x.current.netMinor, x.currency))]; }),
      };
    case 'revenue-sources': {
      const c = d.current;
      const rows: Array<[string, number]> = c ? [['Rooms', c.roomRevenueMinor], ['POS (restaurant, bar…)', c.posRevenueMinor], ['Front-desk extras', c.extrasRevenueMinor]] : [];
      const total = c?.totalRevenueMinor ?? 0;
      return { headers: ['Source', 'Revenue', 'Share %'], rows: rows.map(([label, v]) => [text(label), num(pesos(v), money(v, cur)), num(total > 0 ? Math.round((v / total) * 1000) / 10 : null, total > 0 ? `${Math.round((v / total) * 1000) / 10}%` : '—')]) };
    }
    case 'expenses': {
      const total = d.expensesByCategory.reduce((s, e) => s + e.totalMinor, 0);
      return { headers: ['Category', 'Amount', 'Share %'], rows: d.expensesByCategory.map((e) => [text(labelOf(e.category)), num(pesos(e.totalMinor), money(e.totalMinor, cur)), num(total > 0 ? Math.round((e.totalMinor / total) * 1000) / 10 : null, total > 0 ? `${Math.round((e.totalMinor / total) * 1000) / 10}%` : '—')]) };
    }
    case 'bookings': {
      const total = d.bookingSources.reduce((s, b) => s + b.bookings, 0);
      return { headers: ['Source', 'Bookings made', 'Share %'], rows: d.bookingSources.map((b) => [text(labelOf(b.source)), num(b.bookings, String(b.bookings)), num(total > 0 ? Math.round((b.bookings / total) * 1000) / 10 : null, total > 0 ? `${Math.round((b.bookings / total) * 1000) / 10}%` : '—')]) };
    }
  }
}

function download(filename: string, content: string) {
  // The BOM makes Excel read accents and peso signs as UTF-8.
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { can } = useAccess();
  const { selectedId, selected } = useProperties();
  const propertyId = selectedId && selectedId !== ALL_PROPERTIES ? selectedId : null;
  const allowed = propertyId ? can('analytics.read', propertyId) : can('analytics.read');
  const [report, setReport] = useState<ReportId>('daily');
  const [preset, setPreset] = useState<AnalyticsPreset | 'custom'>('last30');
  const today = localToday();
  const [custom, setCustom] = useState(presetRange('last30', today));
  const range = preset === 'custom' ? custom : presetRange(preset, today);
  const q = useAnalytics(propertyId, range.from, range.to, allowed);
  const table = useMemo(() => (q.data ? buildTable(report, q.data) : null), [q.data, report]);

  if (!allowed) return <Alert tone="info">You don’t have access to reports{propertyId ? ' for this property' : ''}.</Alert>;

  function exportCsv() {
    if (!table) return;
    const scope = (selected?.name ?? 'all-properties').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    download(`${report}_${scope}_${range.from}_to_${range.to}.csv`, toCsv([table.headers, ...table.rows.map((r) => r.map((c) => c.value))]));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">{selected ? selected.name : 'All properties'} · {shortDate(range.from)} to {shortDate(range.to)}. Exports open in Excel or Google Sheets.</p>
        </div>
        <Button disabled={!table || table.rows.length === 0} onClick={exportCsv}>Export CSV</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56"><SelectField label="Report" value={report} onChange={(e) => setReport(e.target.value as ReportId)}>{REPORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</SelectField></div>
        <div className="w-44"><SelectField label="Period" value={preset} onChange={(e) => setPreset(e.target.value as AnalyticsPreset | 'custom')}>{ANALYTICS_PRESETS.map((p) => <option key={p} value={p}>{PRESET_LABELS[p]}</option>)}<option value="custom">Custom range…</option></SelectField></div>
        {preset === 'custom' && (<><Field label="From" type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} /><Field label="To" type="date" max={today} value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} /></>)}
      </div>

      {q.isLoading && <Spinner label="Building the report" />}
      {q.error && <Alert tone="error">{q.error.message}</Alert>}
      {q.data?.mixedCurrencies && report !== 'properties' && <Alert tone="warning">These properties use different currencies, so combined money reports are unavailable. Pick one property, or use the Property comparison report.</Alert>}
      {q.data?.truncated && <Alert tone="warning">This range has more records than one report can safely read, so some figures may be incomplete. Choose a shorter range.</Alert>}

      {table && table.rows.length === 0 && !q.isLoading && <EmptyState title="Nothing to report" description="There is no data for this report in the chosen period." />}
      {table && table.rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{table.headers.map((h, i) => <th key={h} className={`px-4 py-3 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((row, r) => <tr key={r}>{row.map((c, i) => <td key={i} className={`whitespace-nowrap px-4 py-2.5 ${c.right ? 'text-right tabular-nums' : 'text-left font-medium text-slate-900'}`}>{c.text}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

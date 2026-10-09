'use client';

import { addDays } from '@pms/types';
import { Alert, Spinner } from '@/components/ui/ui';
import { useAvailability } from '@/features/reservations/queries';
import { cn } from '@/lib/utils';

export function AvailabilityTable({ propertyId, from, days }: { propertyId: string; from: string; days: number }) {
  const query = useAvailability(propertyId, from, days);
  if (query.isLoading) return <Spinner label="Loading availability" />;
  if (query.error) return <Alert tone="error">{query.error.message}</Alert>;
  const rows = query.data?.roomTypes ?? [];
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="avail" className="space-y-2">
      <h2 id="avail" className="text-sm font-semibold uppercase tracking-wide text-slate-500">Availability by room type</h2>
      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-center text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-medium">Room type</th>
              {Array.from({ length: days }, (_, i) => addDays(from, i)).map((d) => <th key={d} className="px-1 py-2 font-medium">{Number(d.slice(8, 10))}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.roomTypeId} className="border-t border-slate-100">
                <th className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-slate-800">{t.roomTypeName} <span className="font-normal text-slate-400">({t.totalRooms})</span></th>
                {t.nights.map((n) => (
                  <td key={n.date} className={cn('px-1 py-2 tabular-nums', n.available === 0 ? 'bg-red-50 font-semibold text-red-700' : n.available <= 1 ? 'bg-amber-50 text-amber-800' : 'text-slate-600')}>
                    {n.available}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Rooms still free each night. Red = sold out.</p>
    </section>
  );
}

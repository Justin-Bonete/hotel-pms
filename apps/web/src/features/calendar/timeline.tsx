'use client';

import type { CalendarView } from '@pms/types';
import { addDays, nightsBetween } from '@pms/types';
import { cn } from '@/lib/utils';
import { RESERVATION_META } from '@/features/reservations/status';

const LABEL_COL = '150px';
const DAY_MIN = 44;

const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
const dayNum = (iso: string) => Number(iso.slice(8, 10));
const isWeekend = (iso: string) => [0, 6].includes(new Date(`${iso}T00:00:00Z`).getUTCDay());

interface Props {
  view: CalendarView;
  canCreate: boolean;
  onOpen: (reservationId: string) => void;
  onCreate: (roomTypeId: string, date: string) => void;
}

/** Rooms down the side, days across the top, reservations as bars. Pure CSS grid, no drag-and-drop yet. */
export function Timeline({ view, canCreate, onOpen, onCreate }: Props) {
  const { from, days, today, rooms, reservations } = view;
  const to = addDays(from, days);
  const dayList = Array.from({ length: days }, (_, i) => addDays(from, i));
  const template = `${LABEL_COL} repeat(${days}, minmax(${DAY_MIN}px, 1fr))`;
  const byRoom = new Map<string, typeof reservations>();
  for (const r of reservations) if (r.roomId) byRoom.set(r.roomId, [...(byRoom.get(r.roomId) ?? []), r]);
  const unassigned = reservations.filter((r) => !r.roomId && r.status !== 'CHECKED_OUT');

  return (
    <div className="space-y-4">
      {unassigned.length > 0 && (
        <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
          <p className="text-sm font-medium text-amber-900">Needs a room ({unassigned.length})</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unassigned.map((r) => (
              <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="rounded-full bg-white px-3 py-1 text-xs text-slate-800 ring-1 ring-amber-300 hover:bg-amber-100">
                {r.guestName} · {r.roomTypeName} · {r.arrivalDate.slice(5)} → {r.departureDate.slice(5)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
        <div style={{ minWidth: `calc(${LABEL_COL} + ${days * DAY_MIN}px)` }}>
          <div className="grid border-b border-slate-200 bg-slate-50 text-center text-xs" style={{ gridTemplateColumns: template }}>
            <div className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-left font-medium text-slate-500">Room</div>
            {dayList.map((d) => (
              <div key={d} className={cn('py-1.5', d === today && 'bg-indigo-100 font-semibold text-indigo-800', isWeekend(d) && d !== today && 'bg-slate-100')}>
                <div className="text-[10px] text-slate-400">{weekday(d)}</div>
                {dayNum(d)}
              </div>
            ))}
          </div>

          {rooms.length === 0 && <p className="p-6 text-center text-sm text-slate-500">This property has no rooms yet.</p>}

          {rooms.map((room) => (
            <div key={room.id} className="grid border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-10 flex flex-col justify-center bg-white px-3 py-2" style={{ gridColumn: 1, gridRow: 1 }}>
                <span className="text-sm font-medium text-slate-900">{room.number}</span>
                <span className="truncate text-[11px] text-slate-500">{room.roomTypeName}</span>
              </div>
              {dayList.map((d, i) => {
                const style = { gridColumn: i + 2, gridRow: 1 };
                const cls = cn('h-11 border-l border-slate-100', d === today && 'bg-indigo-50/60', isWeekend(d) && d !== today && 'bg-slate-50');
                return canCreate && d >= today ? (
                  <button key={d} type="button" aria-label={`New reservation, room ${room.number}, ${d}`} style={style} className={cn(cls, 'hover:bg-indigo-100')} onClick={() => onCreate(room.roomTypeId, d)} />
                ) : (
                  <div key={d} style={style} className={cls} />
                );
              })}
              {(byRoom.get(room.id) ?? []).map((r) => {
                const start = nightsBetween(from, r.arrivalDate < from ? from : r.arrivalDate);
                const end = nightsBetween(from, r.departureDate > to ? to : r.departureDate);
                if (end <= start) return null;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onOpen(r.id)}
                    title={`${r.guestName} · ${r.code} · ${RESERVATION_META[r.status].label}`}
                    style={{ gridColumn: `${start + 2} / ${end + 2}`, gridRow: 1 }}
                    className={cn('z-[1] m-1 truncate rounded-md px-2 text-left text-xs font-medium shadow-sm', RESERVATION_META[r.status].bar)}
                  >
                    {r.guestName}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded', RESERVATION_META[s].bar.split(' ')[0])} />{RESERVATION_META[s].label}</span>
        ))}
        <span className="text-slate-400">Click an empty day to start a reservation. Drag-and-drop arrives later.</span>
      </div>
    </div>
  );
}

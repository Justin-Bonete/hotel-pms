'use client';

import { DERIVED_ROOM_STATUSES, RESTRICTED_ROOM_STATUSES, ROOM_STATUSES, ROOM_STATUS_TRANSITIONS, type RoomStatus, type RoomView } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Button, EmptyState, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useRefreshRooms, useRooms } from './queries';
import { STATUS_META, compareRoomNumbers } from './status';

export function RoomBoard({ propertyId }: { propertyId: string }) {
  const rooms = useRooms(propertyId);
  const [active, setActive] = useState<RoomView | null>(null);

  const { counts, floors } = useMemo(() => {
    const counts = Object.fromEntries(ROOM_STATUSES.map((s) => [s, 0])) as Record<RoomStatus, number>;
    const byFloor = new Map<string, { level: number; label: string; rooms: RoomView[] }>();
    for (const r of rooms.data ?? []) {
      counts[r.status] += 1;
      const key = r.floorId ?? 'none';
      const group = byFloor.get(key) ?? { level: r.floorLevel ?? 9999, label: r.floorLabel ?? 'No floor assigned', rooms: [] };
      group.rooms.push(r);
      byFloor.set(key, group);
    }
    const floors = [...byFloor.values()].sort((a, b) => a.level - b.level);
    floors.forEach((f) => f.rooms.sort((a, b) => compareRoomNumbers(a.number, b.number)));
    return { counts, floors };
  }, [rooms.data]);

  if (rooms.isLoading) return <Spinner label="Loading rooms" />;
  if (rooms.error) return <Alert tone="error">We could not load the rooms. {rooms.error.message}</Alert>;
  if (!rooms.data?.length) {
    return <EmptyState title="No rooms yet" description="Create a room type, then add rooms in the Rooms tab. They will appear here as a live status board." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" aria-label="Room status summary">
        {ROOM_STATUSES.map((s) => (
          <span key={s} className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset', STATUS_META[s].tile)}>
            <span className={cn('h-2 w-2 rounded-full', STATUS_META[s].dot)} aria-hidden />
            {STATUS_META[s].label} · {counts[s]}
          </span>
        ))}
      </div>

      {floors.map((floor) => (
        <section key={floor.label} aria-label={floor.label}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">{floor.label}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {floor.rooms.map((r) => (
              <button key={r.id} type="button" onClick={() => setActive(r)} className={cn('rounded-xl p-3 text-left ring-1 ring-inset transition hover:shadow-md', STATUS_META[r.status].tile)}>
                <span className="block text-lg font-semibold">{r.number}</span>
                <span className="block truncate text-xs opacity-80">{r.roomTypeName}</span>
                <span className="mt-1 block text-xs font-medium">{STATUS_META[r.status].label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-500">
        Refreshes every 15 seconds; instant live updates arrive in Phase 4. {DERIVED_ROOM_STATUSES.length} more statuses (Occupied, Reserved, Due out) appear once reservations exist (Phase 3).
      </p>

      <StatusModal room={active} propertyId={propertyId} onClose={() => setActive(null)} />
    </div>
  );
}

function StatusModal({ room, propertyId, onClose }: { room: RoomView | null; propertyId: string; onClose: () => void }) {
  const { can } = useAccess();
  const refresh = useRefreshRooms(propertyId);
  const [note, setNote] = useState('');
  const change = useMutation({
    mutationFn: (status: RoomStatus) => api.post(`/rooms/${room?.id}/status`, { status, note }),
    onSuccess: async () => {
      await refresh();
      setNote('');
      onClose();
    },
  });

  if (!room) return null;
  const mayChange = can('room.update_status', propertyId);
  const manager = can('room.manage', propertyId);
  const options = ROOM_STATUS_TRANSITIONS[room.status].filter((to) => {
    const restricted = RESTRICTED_ROOM_STATUSES.includes(room.status) || RESTRICTED_ROOM_STATUSES.includes(to);
    return !restricted || manager;
  });

  return (
    <Modal open title={`Room ${room.number}`} onClose={onClose}>
      <p className="text-sm text-slate-600">{room.roomTypeName}{room.floorLabel ? ` · ${room.floorLabel}` : ''}</p>
      <p className="mt-2 text-sm">
        Now: <strong>{STATUS_META[room.status].label}</strong>
        {room.statusNote && <span className="text-slate-500"> — {room.statusNote}</span>}
      </p>

      {!mayChange ? (
        <div className="mt-4"><Alert tone="info">You can view this room but not change its status.</Alert></div>
      ) : (
        <>
          <div className="mt-4"><TextareaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Aircon not cooling" maxLength={300} /></div>
          <p className="mt-4 text-sm font-medium text-slate-700">Move to</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {options.map((to) => (
              <Button key={to} variant="secondary" loading={change.isPending && change.variables === to} onClick={() => change.mutate(to)}>
                {STATUS_META[to].label}
              </Button>
            ))}
          </div>
          {change.error && <div className="mt-4"><Alert tone="error">{change.error.message}</Alert></div>}
        </>
      )}
    </Modal>
  );
}

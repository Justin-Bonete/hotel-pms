'use client';

import { HOUSEKEEPING_TASK_TYPES, TASK_PRIORITIES, type HousekeepingAction, type HousekeepingTaskView, type TaskPriority } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { ChoosePropertyGate, PriorityBadge, labelOf } from '@/features/operations/shared';
import { useHousekeepingStaff, useRefreshOps, useTasks } from '@/features/operations/queries';
import { useRooms } from '@/features/rooms/queries';
import { STATUS_META } from '@/features/rooms/status';
import { useAuth } from '@/features/auth/auth-context';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function HousekeepingPage() {
  return <ChoosePropertyGate what="Housekeeping">{(id, name) => <Board propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Board({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { can } = useAccess();
  const manage = can('housekeeping.manage', propertyId);
  const work = can('housekeeping.work', propertyId);
  const [tab, setTab] = useState<'mine' | 'all'>(manage || !work ? 'all' : 'mine');
  const tasks = useTasks(propertyId, tab === 'mine', can('housekeeping.read', propertyId));
  const allTasks = useTasks(propertyId, false, manage && tab === 'all');
  const rooms = useRooms(propertyId);
  const staff = useHousekeepingStaff(propertyId, manage);
  const refresh = useRefreshOps();
  const [creating, setCreating] = useState<{ roomId?: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const stayovers = useMutation({
    mutationFn: () => api.post<{ created: number }>(`/properties/${propertyId}/housekeeping/generate-stayovers`),
    onSuccess: async (r) => { setNote(r.created > 0 ? `Created ${r.created} stayover task${r.created === 1 ? '' : 's'}.` : 'Every in-house room already has a stayover task today.'); await refresh(); },
  });

  // Dirty rooms nobody has been asked to clean yet.
  const untasked = useMemo(() => {
    const withTask = new Set((allTasks.data ?? []).filter((t) => t.type === 'CHECKOUT_CLEAN').map((t) => t.roomId));
    return (rooms.data ?? []).filter((r) => r.status === 'DIRTY' && !withTask.has(r.id));
  }, [rooms.data, allTasks.data]);

  if (!can('housekeeping.read', propertyId)) return <Alert tone="info">You don’t have access to housekeeping for this property.</Alert>;
  const list = tasks.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Housekeeping</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}</p>
        </div>
        {manage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" loading={stayovers.isPending} onClick={() => stayovers.mutate()}>Generate stayover tasks</Button>
            <Button onClick={() => setCreating({})}>New task</Button>
          </div>
        )}
      </div>

      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {work && <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>My tasks</TabButton>}
        <TabButton active={tab === 'all'} onClick={() => setTab('all')}>All open tasks</TabButton>
      </div>

      {note && <Alert tone="success">{note}</Alert>}
      {stayovers.error && <Alert tone="error">{stayovers.error.message}</Alert>}

      {manage && tab === 'all' && untasked.length > 0 && (
        <Alert tone="warning">
          {untasked.length} dirty room{untasked.length === 1 ? ' has' : 's have'} no cleaning task:{' '}
          {untasked.slice(0, 8).map((r) => (
            <button key={r.id} type="button" className="mr-2 font-semibold underline" onClick={() => setCreating({ roomId: r.id })}>{r.number}</button>
          ))}
        </Alert>
      )}

      {tasks.isLoading && <Spinner label="Loading tasks" />}
      {tasks.error && <Alert tone="error">{tasks.error.message}</Alert>}
      {!tasks.isLoading && list.length === 0 && (
        <EmptyState title={tab === 'mine' ? 'Nothing assigned to you' : 'No open tasks'} description={tab === 'mine' ? 'When a supervisor assigns you a room it appears here.' : 'Rooms appear here automatically when guests check out.'} />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {list.map((t) => <TaskCard key={t.id} task={t} manage={manage} staff={staff.data ?? []} />)}
      </div>

      {creating && <NewTaskModal propertyId={propertyId} initialRoomId={creating.roomId} staff={staff.data ?? []} onClose={() => setCreating(null)} />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button role="tab" aria-selected={active} onClick={onClick} className={cn('border-b-2 px-4 py-2 text-sm font-medium', active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{children}</button>;
}

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = { OPEN: 'warning', ASSIGNED: 'info', IN_PROGRESS: 'info', CLEANED: 'success' };

function TaskCard({ task: t, manage, staff }: { task: HousekeepingTaskView; manage: boolean; staff: Array<{ id: string; name: string }> }) {
  const { user } = useAuth();
  const refresh = useRefreshOps();
  const [assignee, setAssignee] = useState('');
  const [failing, setFailing] = useState(false);
  const [note, setNote] = useState('');
  const mine = t.assignedToId === user?.id;

  const act = useMutation({
    mutationFn: (v: { action: HousekeepingAction; assignedToId?: string; note?: string }) => api.post(`/housekeeping/tasks/${t.id}/action`, v),
    onSuccess: async () => { setFailing(false); setNote(''); setAssignee(''); await refresh(); },
  });
  const run = (action: HousekeepingAction, extra: { assignedToId?: string; note?: string } = {}) => act.mutate({ action, ...extra });
  const busy = (a: HousekeepingAction) => act.isPending && act.variables?.action === a;

  return (
    <Card className={cn(t.priority === 'URGENT' && 'ring-2 ring-red-300', t.priority === 'HIGH' && 'ring-amber-300')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold text-slate-900">{t.roomNumber}</p>
          <p className="text-sm text-slate-500">{t.roomTypeName}{t.floorLabel ? ` · ${t.floorLabel}` : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>{labelOf(t.status)}</Badge>
          <PriorityBadge priority={t.priority} />
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-600">{labelOf(t.type)}{t.estimatedMinutes ? ` · ~${t.estimatedMinutes} min` : ''} · room is <strong>{STATUS_META[t.roomStatus].label.toLowerCase()}</strong></p>
      <p className="text-sm text-slate-500">{t.assignedToName ? `Assigned to ${t.assignedToName}${mine ? ' (you)' : ''}` : 'Not assigned'}</p>
      {t.notes && <p className="mt-2 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-xs text-slate-600">{t.notes}</p>}
      {act.error && <div className="mt-3"><Alert tone="error">{act.error.message}</Alert></div>}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {t.status === 'ASSIGNED' && (mine || manage) && <Button className="min-h-11 flex-1" loading={busy('start')} onClick={() => run('start')}>Start cleaning</Button>}
          {t.status === 'IN_PROGRESS' && (mine || manage) && <Button className="min-h-11 flex-1" loading={busy('finish')} onClick={() => run('finish')}>{t.type === 'STAYOVER' ? 'Mark done' : 'Mark clean'}</Button>}
          {t.status === 'CLEANED' && manage && (
            <>
              <Button className="min-h-11 flex-1" loading={busy('inspect_pass')} onClick={() => run('inspect_pass')}>Pass — release room</Button>
              <Button className="min-h-11" variant="secondary" onClick={() => setFailing((f) => !f)}>Failed inspection</Button>
            </>
          )}
          {t.status === 'CLEANED' && !manage && <p className="text-sm text-slate-500">Waiting for a supervisor to inspect.</p>}
        </div>

        {failing && (
          <div className="space-y-2 rounded-lg bg-red-50 p-3">
            <TextareaField label="What needs another pass?" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="danger" loading={busy('inspect_fail')} onClick={() => run('inspect_fail', { note })}>Send back for re-cleaning</Button>
          </div>
        )}

        {manage && ['OPEN', 'ASSIGNED'].includes(t.status) && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SelectField label={t.status === 'OPEN' ? 'Assign to' : 'Reassign to'} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Choose…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
            </div>
            <Button variant="secondary" disabled={!assignee} loading={busy('assign')} onClick={() => run('assign', { assignedToId: assignee })}>Assign</Button>
          </div>
        )}
        {manage && !['DONE', 'CANCELLED'].includes(t.status) && <Button variant="ghost" loading={busy('cancel')} onClick={() => run('cancel')}>Cancel task</Button>}
      </div>
    </Card>
  );
}

function NewTaskModal({ propertyId, initialRoomId, staff, onClose }: { propertyId: string; initialRoomId?: string; staff: Array<{ id: string; name: string }>; onClose: () => void }) {
  const rooms = useRooms(propertyId);
  const refresh = useRefreshOps();
  const [f, setF] = useState({ roomId: initialRoomId ?? '', type: 'DEEP_CLEAN', priority: 'NORMAL', minutes: '', notes: '', assignedToId: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setError(null);
    if (!f.roomId) return setError('Choose a room.');
    const minutes = f.minutes.trim() === '' ? undefined : Number(f.minutes);
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1)) return setError('Minutes must be a whole number.');
    setBusy(true);
    try {
      await api.post(`/properties/${propertyId}/housekeeping/tasks`, { roomId: f.roomId, type: f.type, priority: f.priority, estimatedMinutes: minutes, notes: f.notes, assignedToId: f.assignedToId || undefined });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the task.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="New housekeeping task" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <SelectField label="Room" value={f.roomId} onChange={(e) => set('roomId', e.target.value)}>
          <option value="">Choose a room…</option>
          {(rooms.data ?? []).slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((r) => <option key={r.id} value={r.id}>{r.number} · {r.roomTypeName} · {STATUS_META[r.status].label}</option>)}
        </SelectField>
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Type" value={f.type} onChange={(e) => set('type', e.target.value)}>
            {HOUSEKEEPING_TASK_TYPES.map((t) => <option key={t} value={t}>{labelOf(t)}</option>)}
          </SelectField>
          <SelectField label="Priority" value={f.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>
            {TASK_PRIORITIES.map((p) => <option key={p} value={p}>{labelOf(p)}</option>)}
          </SelectField>
          <Field label="Estimated minutes (optional)" inputMode="numeric" value={f.minutes} onChange={(e) => set('minutes', e.target.value)} />
          <SelectField label="Assign to (optional)" value={f.assignedToId} onChange={(e) => set('assignedToId', e.target.value)}>
            <option value="">Nobody yet</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </SelectField>
        </div>
        <TextareaField label="Notes (optional)" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={save}>Create task</Button>
        </div>
      </div>
    </Modal>
  );
}

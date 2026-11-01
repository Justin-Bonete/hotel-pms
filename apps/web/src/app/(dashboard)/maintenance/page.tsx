'use client';

import { MAINTENANCE_CATEGORIES, TASK_PRIORITIES, formatMoney, type MaintenanceAction, type MaintenanceTicketView, type TaskPriority } from '@pms/types';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, SelectField, Spinner, TextareaField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { ChoosePropertyGate, PriorityBadge, labelOf } from '@/features/operations/shared';
import { useMaintenanceStaff, useRefreshOps, useTickets } from '@/features/operations/queries';
import { useAuth } from '@/features/auth/auth-context';
import { useRooms } from '@/features/rooms/queries';
import { api } from '@/lib/api';
import { minorToPesos, pesosToMinor } from '@/lib/money';

export default function MaintenancePage() {
  return <ChoosePropertyGate what="Maintenance">{(id, name) => <Tickets propertyId={id} propertyName={name} />}</ChoosePropertyGate>;
}

function Tickets({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const { can } = useAccess();
  const [openOnly, setOpenOnly] = useState(true);
  const read = can('maintenance.read', propertyId);
  const manage = can('maintenance.manage', propertyId);
  const tickets = useTickets(propertyId, openOnly, read);
  const staff = useMaintenanceStaff(propertyId, manage);
  const [reporting, setReporting] = useState(false);
  const [logging, setLogging] = useState<MaintenanceTicketView | null>(null);

  if (!read && !can('maintenance.report', propertyId)) return <Alert tone="info">You don’t have access to maintenance for this property.</Alert>;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-500">{propertyName}</p>
        </div>
        <div className="flex gap-2">
          {read && <Button variant="secondary" onClick={() => setOpenOnly((o) => !o)}>{openOnly ? 'Show all tickets' : 'Show open only'}</Button>}
          {can('maintenance.report', propertyId) && <Button onClick={() => setReporting(true)}>Report a problem</Button>}
        </div>
      </div>

      {tickets.isLoading && <Spinner label="Loading tickets" />}
      {tickets.error && <Alert tone="error">{tickets.error.message}</Alert>}
      {read && !tickets.isLoading && tickets.data?.length === 0 && <EmptyState title="No maintenance requests" description="Report a problem to start tracking repairs." action={can('maintenance.report', propertyId) ? <Button onClick={() => setReporting(true)}>Report a problem</Button> : undefined} />}
      {!read && <Alert tone="info">You can report problems. Only maintenance staff and managers see the ticket list.</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {tickets.data?.map((t) => <TicketCard key={t.id} ticket={t} propertyId={propertyId} staff={staff.data ?? []} onLog={() => setLogging(t)} />)}
      </div>

      {reporting && <ReportModal propertyId={propertyId} onClose={() => setReporting(false)} />}
      {logging && <WorkModal ticket={logging} onClose={() => setLogging(null)} />}
    </div>
  );
}

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = { REPORTED: 'warning', ASSIGNED: 'info', IN_PROGRESS: 'info', WAITING_PARTS: 'warning', RESOLVED: 'success', CLOSED: 'neutral' };

function TicketCard({ ticket: t, propertyId, staff, onLog }: { ticket: MaintenanceTicketView; propertyId: string; staff: Array<{ id: string; name: string }>; onLog: () => void }) {
  const { can } = useAccess();
  const { user } = useAuth();
  const refresh = useRefreshOps();
  const manage = can('maintenance.manage', propertyId);
  const worker = can('maintenance.work', propertyId);
  const mine = worker && t.assignedToId === user?.id;
  const [assignee, setAssignee] = useState('');
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');

  const act = useMutation({
    mutationFn: (v: { action: MaintenanceAction; assignedToId?: string; note?: string }) => api.post(`/maintenance/tickets/${t.id}/action`, v),
    onSuccess: async () => { setResolving(false); setNote(''); setAssignee(''); await refresh(); },
  });
  const run = (action: MaintenanceAction, extra: { assignedToId?: string; note?: string } = {}) => act.mutate({ action, ...extra });
  const busy = (a: MaintenanceAction) => act.isPending && act.variables?.action === a;
  const canWork = manage || mine;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{t.title}</h3>
          <p className="text-sm text-slate-500">{labelOf(t.category)}{t.roomNumber ? ` · Room ${t.roomNumber}` : ''}{t.blocksRoom ? ' · room out of service' : ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1"><Badge tone={STATUS_TONE[t.status] ?? 'neutral'}>{labelOf(t.status)}</Badge><PriorityBadge priority={t.priority} /></div>
      </div>
      {t.description && <p className="mt-2 text-sm text-slate-600">{t.description}</p>}
      <p className="mt-2 text-xs text-slate-500">Reported by {t.reportedByName ?? 'unknown'} · {t.assignedToName ? `assigned to ${t.assignedToName}` : 'not assigned'}</p>
      {(t.costMinor > 0 || t.minutesSpent > 0 || t.partsUsed) && <p className="mt-1 text-xs text-slate-500">{t.minutesSpent} min · {formatMoney(t.costMinor, 'PHP')}{t.partsUsed ? ` · parts: ${t.partsUsed}` : ''}</p>}
      {t.resolutionNote && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">Fix: {t.resolutionNote}</p>}
      {act.error && <div className="mt-3"><Alert tone="error">{act.error.message}</Alert></div>}

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {['REPORTED', 'ASSIGNED'].includes(t.status) && (manage || (worker && (t.assignedToId === null || mine))) && <Button loading={busy('start')} onClick={() => run('start')}>{t.assignedToId ? 'Start work' : 'Take it'}</Button>}
          {t.status === 'IN_PROGRESS' && canWork && <Button variant="secondary" loading={busy('wait_parts')} onClick={() => run('wait_parts')}>Waiting for parts</Button>}
          {t.status === 'WAITING_PARTS' && canWork && <Button variant="secondary" loading={busy('resume')} onClick={() => run('resume')}>Parts arrived</Button>}
          {['IN_PROGRESS', 'WAITING_PARTS'].includes(t.status) && canWork && <Button onClick={() => setResolving((r) => !r)}>Mark resolved</Button>}
          {t.status === 'RESOLVED' && manage && <Button loading={busy('close')} onClick={() => run('close')}>Close ticket</Button>}
          {['RESOLVED', 'CLOSED'].includes(t.status) && manage && <Button variant="ghost" loading={busy('reopen')} onClick={() => run('reopen')}>Reopen</Button>}
          {t.status !== 'CLOSED' && canWork && <Button variant="ghost" onClick={onLog}>Log time / cost</Button>}
        </div>
        {resolving && (
          <div className="space-y-2 rounded-lg bg-emerald-50 p-3">
            <TextareaField label="What was done to fix it? (required)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button loading={busy('resolve')} onClick={() => run('resolve', { note })}>Resolve{t.blocksRoom ? ' and release room' : ''}</Button>
          </div>
        )}
        {manage && ['REPORTED', 'ASSIGNED'].includes(t.status) && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SelectField label="Assign to" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Choose…</option>
                {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
            </div>
            <Button variant="secondary" disabled={!assignee} loading={busy('assign')} onClick={() => run('assign', { assignedToId: assignee })}>Assign</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function ReportModal({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const rooms = useRooms(propertyId);
  const refresh = useRefreshOps();
  const [f, setF] = useState({ title: '', description: '', category: 'OTHER', priority: 'NORMAL', roomId: '', blocksRoom: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setError(null);
    if (f.title.trim().length < 3) return setError('Describe the problem briefly.');
    if (f.blocksRoom && !f.roomId) return setError('Choose the room to take out of service.');
    setBusy(true);
    try {
      await api.post(`/properties/${propertyId}/maintenance/tickets`, { title: f.title, description: f.description, category: f.category, priority: f.priority, roomId: f.roomId || undefined, blocksRoom: f.blocksRoom });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not report the problem.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Report a problem" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="What is wrong?" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Aircon not cooling" />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" value={f.category} onChange={(e) => set('category', e.target.value)}>{MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{labelOf(c)}</option>)}</SelectField>
          <SelectField label="Priority" value={f.priority} onChange={(e) => set('priority', e.target.value as TaskPriority)}>{TASK_PRIORITIES.map((p) => <option key={p} value={p}>{labelOf(p)}</option>)}</SelectField>
        </div>
        <SelectField label="Room (optional)" value={f.roomId} onChange={(e) => set('roomId', e.target.value)}>
          <option value="">Not a specific room</option>
          {(rooms.data ?? []).slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((r) => <option key={r.id} value={r.id}>{r.number} · {r.roomTypeName}</option>)}
        </SelectField>
        {f.roomId && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={f.blocksRoom} onChange={(e) => set('blocksRoom', e.target.checked)} /> Take this room out of service until it is fixed
          </label>
        )}
        <TextareaField label="Details (optional)" value={f.description} onChange={(e) => set('description', e.target.value)} />
        <p className="text-xs text-slate-500">Photo attachments arrive with document storage in a later phase.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Report</Button></div>
      </div>
    </Modal>
  );
}

function WorkModal({ ticket, onClose }: { ticket: MaintenanceTicketView; onClose: () => void }) {
  const refresh = useRefreshOps();
  const [minutes, setMinutes] = useState(String(ticket.minutesSpent));
  const [cost, setCost] = useState(minorToPesos(ticket.costMinor));
  const [parts, setParts] = useState(ticket.partsUsed ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null);
    const costMinor = pesosToMinor(cost);
    const minutesSpent = Number(minutes);
    if (costMinor === null || Number.isNaN(costMinor) || costMinor < 0) return setError('Enter the cost like 1500 or 1500.50.');
    if (!Number.isInteger(minutesSpent) || minutesSpent < 0) return setError('Minutes must be a whole number.');
    setBusy(true);
    try {
      await api.patch(`/maintenance/tickets/${ticket.id}`, { costMinor, minutesSpent, partsUsed: parts });
      await refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title={`Log work: ${ticket.title}`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Time spent (minutes)" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          <Field label="Cost (parts + labour)" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
        </div>
        <Field label="Parts used" value={parts} onChange={(e) => setParts(e.target.value)} placeholder="e.g. Capacitor, 1 m copper pipe" />
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Save</Button></div>
      </div>
    </Modal>
  );
}

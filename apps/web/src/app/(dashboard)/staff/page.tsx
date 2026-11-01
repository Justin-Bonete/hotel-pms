'use client';

import type { StaffView } from '@pms/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, EmptyState, Field, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { ScopePicker, type ScopeValue } from '@/features/staff/scope-picker';
import { api } from '@/lib/api';
import { useDebouncedValue } from '@/lib/hooks';

const EMPTY_SCOPE: ScopeValue = { roleId: '', scopeType: 'PROPERTY', scopeId: '' };
const STATUS_TONE = { ACTIVE: 'success', INVITED: 'info', DISABLED: 'neutral' } as const;

export default function StaffPage() {
  const { can } = useAccess();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [inviting, setInviting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const debounced = useDebouncedValue(search, 300);
  const qs = new URLSearchParams({ page: String(page), pageSize: '25', ...(debounced.trim() ? { search: debounced.trim() } : {}) });
  const list = useQuery({ queryKey: ['staff', qs.toString()], queryFn: () => api.page<StaffView>(`/staff?${qs}`), enabled: can('staff.read') });
  const rows = list.data?.data ?? [];
  const total = list.data?.meta?.total ?? 0;
  const pages = Math.max(Math.ceil(total / 25), 1);
  const selected = rows.find((r) => r.id === openId) ?? null;

  if (!can('staff.read')) return <Alert tone="info">You don’t have access to staff accounts.</Alert>;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
          <p className="mt-1 text-sm text-slate-500">People who can sign in, and what each of them can do. You can only give access you hold yourself.</p>
        </div>
        {can('staff.manage') && <Button onClick={() => setInviting(true)}>Invite staff</Button>}
      </div>

      <Field label="Search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name or email" />
      {list.isLoading && <Spinner label="Loading staff" />}
      {list.error && <Alert tone="error">{list.error.message}</Alert>}
      {!list.isLoading && rows.length === 0 && <EmptyState title="No staff found" description="Invite your team so each person has their own login." />}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Person</th><th className="px-4 py-3 font-medium">Roles</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Last sign-in</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((s) => (
                <tr key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setOpenId(s.id)}>
                  <td className="px-4 py-3"><span className="block font-medium text-slate-900">{s.fullName}</span><span className="block text-xs text-slate-500">{s.email}</span></td>
                  <td className="px-4 py-3 text-slate-600">{s.assignments.length === 0 ? '—' : s.assignments.map((a) => `${a.roleName} (${a.scopeLabel})`).join(', ')}</td>
                  <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.status]}>{s.status.toLowerCase()}</Badge></td>
                  <td className="px-4 py-3 text-slate-500">{s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > 25 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>Page {page} of {pages}</span>
          <div className="flex gap-2"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button><Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button></div>
        </div>
      )}

      {inviting && <InviteModal onClose={() => setInviting(false)} />}
      {selected && <StaffModal staff={selected} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '' });
  const [scope, setScope] = useState<ScopeValue>(EMPTY_SCOPE);
  const [error, setError] = useState<string | null>(null);
  const invite = useMutation({
    mutationFn: () => api.post('/staff', { ...f, assignment: scope }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['staff'] }); onClose(); },
    onError: (e: Error) => setError(e.message),
  });
  const submit = () => {
    setError(null);
    if (!f.firstName.trim() || !f.lastName.trim()) return setError('Enter their first and last name.');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError('Enter a valid email address.');
    if (!scope.roleId || !scope.scopeId) return setError('Choose a role and where it applies.');
    invite.mutate();
  };
  return (
    <Modal open title="Invite staff" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          <Field label="Last name" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
        </div>
        <Field label="Email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <ScopePicker value={scope} onChange={setScope} />
        <p className="text-xs text-slate-500">They get an email link to choose their own password. In development the link prints in the API console.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={invite.isPending} onClick={submit}>Send invitation</Button></div>
      </div>
    </Modal>
  );
}

function StaffModal({ staff, onClose }: { staff: StaffView; onClose: () => void }) {
  const { can } = useAccess();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [scope, setScope] = useState<ScopeValue>(EMPTY_SCOPE);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['staff'] });
  const opts = { onSuccess: async () => { setAdding(false); setScope(EMPTY_SCOPE); await refresh(); } };

  const add = useMutation({ mutationFn: () => api.post(`/staff/${staff.id}/assignments`, scope), ...opts });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/staff/${staff.id}/assignments/${id}`), ...opts });
  const toggle = useMutation({ mutationFn: () => api.post(`/staff/${staff.id}/${staff.status === 'DISABLED' ? 'enable' : 'disable'}`), ...opts });
  const resend = useMutation({ mutationFn: () => api.post<{ message: string }>(`/staff/${staff.id}/resend-invite`), onSuccess: (r) => setMessage(r.message) });
  const err = add.error ?? remove.error ?? toggle.error ?? resend.error;
  const manage = staff.manageable;

  return (
    <Modal open title={staff.fullName} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">{staff.email} · <Badge tone={STATUS_TONE[staff.status]}>{staff.status.toLowerCase()}</Badge></p>
        {!manage && <Alert tone="info">You can view this person but not change their access, because they hold more access than you do (or this is you).</Alert>}
        {err && <Alert tone="error">{err.message}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}

        <div>
          <h3 className="mb-2 font-semibold text-slate-800">Roles</h3>
          {staff.assignments.length === 0 ? <p className="text-slate-500">No roles.</p> : (
            <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
              {staff.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span><span className="font-medium text-slate-800">{a.roleName}</span> <span className="text-slate-500">· {a.scopeLabel}</span></span>
                  {manage && can('role.assign') && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => remove.mutate(a.id)}>Remove</button>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {manage && can('role.assign') && (adding ? (
          <div className="space-y-3 rounded-lg bg-slate-50 p-3">
            <ScopePicker value={scope} onChange={setScope} />
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button disabled={!scope.roleId || !scope.scopeId} loading={add.isPending} onClick={() => add.mutate()}>Add role</Button></div>
          </div>
        ) : <Button variant="secondary" onClick={() => setAdding(true)}>Add a role</Button>)}

        {manage && can('staff.manage') && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {staff.status === 'INVITED' && <Button variant="secondary" loading={resend.isPending} onClick={() => resend.mutate()}>Resend invitation</Button>}
            <Button variant={staff.status === 'DISABLED' ? 'secondary' : 'danger'} loading={toggle.isPending} onClick={() => toggle.mutate()}>{staff.status === 'DISABLED' ? 'Enable account' : 'Disable account'}</Button>
          </div>
        )}
        {staff.status !== 'DISABLED' && manage && <p className="text-xs text-slate-500">Disabling signs the person out of every device immediately.</p>}
      </div>
    </Modal>
  );
}

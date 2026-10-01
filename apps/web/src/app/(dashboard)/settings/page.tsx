'use client';

import type { DeviceSession } from '@pms/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Card, Spinner } from '@/components/ui/ui';
import { api } from '@/lib/api';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['sessions'], queryFn: () => api.get<DeviceSession[]>('/auth/sessions') });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Security and account options.</p>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Signed-in devices</h2>
        <p className="mt-1 text-sm text-slate-500">Sign out any device you do not recognize.</p>

        <div className="mt-4 divide-y divide-slate-100">
          {sessions.isLoading && <Spinner />}
          {sessions.error && <Alert tone="error">{sessions.error.message}</Alert>}
          {revoke.error && <Alert tone="error">{revoke.error.message}</Alert>}
          {sessions.data?.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {s.device ?? 'Unknown device'} {s.current && <Badge tone="success">This device</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {s.ip ?? 'Unknown IP'} · last active {new Date(s.lastActiveAt).toLocaleString()}
                </p>
              </div>
              {!s.current && (
                <Button variant="secondary" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                  Sign out
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card className="bg-slate-50/60">
        <h2 className="text-base font-semibold text-slate-900">Two-factor authentication</h2>
        <p className="mt-1 text-sm text-slate-500">Extra protection for your sign-in.</p>
        <div className="mt-3">
          <Badge tone="info">Coming soon</Badge>
        </div>
      </Card>
    </div>
  );
}

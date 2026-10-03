'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, EmptyState, Spinner } from '@/components/ui/ui';
import { useAuth } from '@/features/auth/auth-context';
import { ALL_PROPERTIES, useProperties } from '@/features/properties/property-context';
import { api } from '@/lib/api';

const FUTURE_KPIS = [
  { label: 'Revenue', phase: 'Phase 3' },
  { label: 'Occupancy', phase: 'Phase 3' },
  { label: 'ADR', phase: 'Phase 3' },
  { label: 'RevPAR', phase: 'Phase 3' },
  { label: 'Arrivals today', phase: 'Phase 3' },
  { label: 'Departures today', phase: 'Phase 3' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { properties, selected, selectedId, isLoading, error, refetch } = useProperties();
  const visible = selectedId === ALL_PROPERTIES ? properties : properties.filter((p) => p.id === selectedId);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {user?.firstName}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {user?.organization.name} · {selected ? selected.name : 'All properties'}
        </p>
      </div>

      {user && !user.emailVerified && <VerifyBanner />}

      <section aria-labelledby="props">
        <h2 id="props" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Properties
        </h2>
        {isLoading && <Spinner label="Loading properties" />}
        {error && (
          <Alert tone="error" action={<Button variant="secondary" onClick={refetch}>Retry</Button>}>
            We could not load your properties. {error.message}
          </Alert>
        )}
        {!isLoading && !error && visible.length === 0 && (
          <EmptyState
            title="No properties yet"
            description="Add your first property to start managing rooms, guests and reservations."
            action={<Button disabled title="Property creation arrives in step 6">Add property (coming soon)</Button>}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900">{p.name}</h3>
                  <p className="mt-0.5 text-sm text-slate-500">{[p.city, p.region].filter(Boolean).join(', ') || 'No address yet'}</p>
                </div>
                <Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status.toLowerCase()}</Badge>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span className="rounded bg-slate-100 px-2 py-0.5">{p.type.replace('_', ' ').toLowerCase()}</span>
                {p.groupName && <span className="rounded bg-slate-100 px-2 py-0.5">{p.groupName}</span>}
                <span className="rounded bg-slate-100 px-2 py-0.5">{p.roomCount} {p.roomCount === 1 ? 'room' : 'rooms'}</span>
              </div>
            </Card>
          ))}
        </div>
        {visible.length > 0 && (
          <Link href="/properties" className="mt-3 inline-block text-sm font-medium text-indigo-600 hover:underline">
            View all properties →
          </Link>
        )}
      </section>

      <section aria-labelledby="kpis">
        <h2 id="kpis" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Performance
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {FUTURE_KPIS.map((k) => (
            <Card key={k.label} className="bg-slate-50/60">
              <p className="text-sm text-slate-500">{k.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-300">—</p>
              <div className="mt-2">
                <Badge tone="info">Coming soon · {k.phase}</Badge>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">These numbers need reservations and payments, which are built in Phase 3. Nothing here is sample data.</p>
      </section>
    </div>
  );
}

function VerifyBanner() {
  const [msg, setMsg] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    try {
      const res = await api.post<{ message: string }>('/auth/resend-verification');
      setMsg({ tone: 'success', text: `${res.message} (In development the link prints in the API console.)` });
    } catch (e) {
      setMsg({ tone: 'error', text: e instanceof Error ? e.message : 'Could not send the email.' });
    } finally {
      setBusy(false);
    }
  }

  if (msg) return <Alert tone={msg.tone}>{msg.text}</Alert>;
  return (
    <Alert tone="warning" action={<Button variant="secondary" loading={busy} onClick={resend}>Resend link</Button>}>
      Please verify your email address. Check your inbox for the confirmation link.
    </Alert>
  );
}

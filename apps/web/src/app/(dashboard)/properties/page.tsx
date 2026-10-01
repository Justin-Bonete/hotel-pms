'use client';

import { Alert, Badge, Button, EmptyState, Spinner } from '@/components/ui/ui';
import { useProperties } from '@/features/properties/property-context';

export default function PropertiesPage() {
  const { properties, isLoading, error, refetch } = useProperties();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Properties</h1>
          <p className="mt-1 text-sm text-slate-500">Every hotel, resort or unit in your organization.</p>
        </div>
        <Button disabled title="Property creation arrives in step 6">Add property (coming soon)</Button>
      </div>

      {isLoading && <Spinner label="Loading properties" />}
      {error && (
        <Alert tone="error" action={<Button variant="secondary" onClick={refetch}>Retry</Button>}>
          We could not load your properties. {error.message}
        </Alert>
      )}
      {!isLoading && !error && properties.length === 0 && (
        <EmptyState title="No properties yet" description="Add your first property to get started." />
      )}

      {properties.length > 0 && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Property</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {properties.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{p.type.replace('_', ' ').toLowerCase()}</td>
                  <td className="px-4 py-3 text-slate-600">{[p.city, p.region].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{p.groupName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={p.status === 'ACTIVE' ? 'success' : 'neutral'}>{p.status.toLowerCase()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

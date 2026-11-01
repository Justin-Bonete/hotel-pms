import type { TaskPriority } from '@pms/types';
import { Badge, Button, EmptyState } from '@/components/ui/ui';
import { useProperties } from '@/features/properties/property-context';

export const PRIORITY_TONE: Record<TaskPriority, 'neutral' | 'info' | 'warning'> = { LOW: 'neutral', NORMAL: 'info', HIGH: 'warning', URGENT: 'warning' };
export const PRIORITY_LABEL: Record<TaskPriority, string> = { LOW: 'Low', NORMAL: 'Normal', HIGH: 'High', URGENT: 'Urgent' };
export const labelOf = (v: string): string => v.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONE[priority]}>{PRIORITY_LABEL[priority]}</Badge>;
}

/** Pages that work on one property at a time ask for it first. */
export function ChoosePropertyGate({ what, children }: { what: string; children: (propertyId: string, propertyName: string) => React.ReactNode }) {
  const { selected, properties, select } = useProperties();
  if (!selected) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          title="Choose a property"
          description={`${what} belongs to one property. Pick one here, or use the property selector at the top.`}
          action={<div className="flex flex-wrap justify-center gap-2">{properties.map((p) => <Button key={p.id} variant="secondary" onClick={() => select(p.id)}>{p.name}</Button>)}</div>}
        />
      </div>
    );
  }
  return <>{children(selected.id, selected.name)}</>;
}

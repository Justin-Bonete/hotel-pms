'use client';

import type { PropertyGroupView } from '@pms/types';
import { useQuery } from '@tanstack/react-query';
import { SelectField } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useAuth } from '@/features/auth/auth-context';
import { useProperties } from '@/features/properties/property-context';
import { api } from '@/lib/api';

export interface RoleOption {
  id: string;
  key: string;
  name: string;
  description: string | null;
}
export interface ScopeValue {
  roleId: string;
  scopeType: 'ORGANIZATION' | 'GROUP' | 'PROPERTY';
  scopeId: string;
}

/** Role + where it applies. The server still refuses anything beyond the caller's own access. */
export function ScopePicker({ value, onChange }: { value: ScopeValue; onChange: (v: ScopeValue) => void }) {
  const { user } = useAuth();
  const { can } = useAccess();
  const { properties } = useProperties();
  const roles = useQuery({ queryKey: ['rbac', 'roles'], queryFn: () => api.get<RoleOption[]>('/rbac/roles'), enabled: can('role.read') });
  const groups = useQuery({ queryKey: ['property-groups'], queryFn: () => api.get<PropertyGroupView[]>('/property-groups'), enabled: can('property_group.read') });

  const setType = (scopeType: ScopeValue['scopeType']) =>
    onChange({ ...value, scopeType, scopeId: scopeType === 'ORGANIZATION' ? (user?.organization.id ?? '') : '' });

  return (
    <div className="space-y-4">
      <SelectField label="Role" value={value.roleId} onChange={(e) => onChange({ ...value, roleId: e.target.value })}>
        <option value="">Choose a role…</option>
        {roles.data?.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </SelectField>
      <div className="grid grid-cols-2 gap-4">
        <SelectField label="Applies to" value={value.scopeType} onChange={(e) => setType(e.target.value as ScopeValue['scopeType'])}>
          <option value="PROPERTY">One property</option>
          {(groups.data?.length ?? 0) > 0 && <option value="GROUP">A property group</option>}
          <option value="ORGANIZATION">Whole organization</option>
        </SelectField>
        {value.scopeType === 'PROPERTY' && (
          <SelectField label="Property" value={value.scopeId} onChange={(e) => onChange({ ...value, scopeId: e.target.value })}>
            <option value="">Choose…</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
        )}
        {value.scopeType === 'GROUP' && (
          <SelectField label="Group" value={value.scopeId} onChange={(e) => onChange({ ...value, scopeId: e.target.value })}>
            <option value="">Choose…</option>
            {groups.data?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </SelectField>
        )}
      </div>
      {roles.error && <p className="text-xs text-red-600">{roles.error.message}</p>}
    </div>
  );
}

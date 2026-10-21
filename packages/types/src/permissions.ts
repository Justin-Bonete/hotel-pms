/**
 * Permission catalog + system role templates. ONE source of truth used by the API (guards),
 * the seed (database), the web app (hiding buttons) and the tests.
 *
 * level:
 *  - ORGANIZATION: only counts when the role is assigned at ORGANIZATION scope
 *                  (company-wide settings, creating properties, managing roles).
 *  - PROPERTY:     counts at ORGANIZATION scope (everywhere), GROUP scope (properties in that group)
 *                  or PROPERTY scope (that property only).
 */
export type PermissionLevel = 'ORGANIZATION' | 'PROPERTY';

export const PERMISSION_CATALOG = [
  { key: 'organization.read', module: 'organization', level: 'ORGANIZATION', description: 'View organization profile' },
  { key: 'organization.update', module: 'organization', level: 'ORGANIZATION', description: 'Edit organization profile' },
  { key: 'property_group.read', module: 'property', level: 'ORGANIZATION', description: 'View property groups' },
  { key: 'property_group.manage', module: 'property', level: 'ORGANIZATION', description: 'Create, edit, delete property groups' },
  { key: 'property.read', module: 'property', level: 'PROPERTY', description: 'View properties' },
  { key: 'property.create', module: 'property', level: 'ORGANIZATION', description: 'Create properties' },
  { key: 'property.update', module: 'property', level: 'PROPERTY', description: 'Edit properties' },
  { key: 'property.delete', module: 'property', level: 'ORGANIZATION', description: 'Archive properties' },
  { key: 'room.read', module: 'room', level: 'PROPERTY', description: 'View rooms and room types' },
  { key: 'room.manage', module: 'room', level: 'PROPERTY', description: 'Create, edit, archive rooms; set out-of-order' },
  { key: 'room.update_status', module: 'room', level: 'PROPERTY', description: 'Change room status (cleaning flow)' },
  { key: 'room_type.manage', module: 'room', level: 'PROPERTY', description: 'Create and edit room types' },
  { key: 'guest.read', module: 'guest', level: 'PROPERTY', description: 'View guest profiles' },
  { key: 'guest.manage', module: 'guest', level: 'PROPERTY', description: 'Create and edit guest profiles' },
  { key: 'reservation.read', module: 'reservation', level: 'PROPERTY', description: 'View reservations and the calendar' },
  { key: 'reservation.manage', module: 'reservation', level: 'PROPERTY', description: 'Create, edit, confirm, cancel reservations; assign rooms' },
  { key: 'reservation.check_in', module: 'reservation', level: 'PROPERTY', description: 'Check guests in and out' },
  { key: 'rate.read', module: 'rate', level: 'PROPERTY', description: 'View rate plans' },
  { key: 'rate.manage', module: 'rate', level: 'PROPERTY', description: 'Create and edit rate plans' },
  { key: 'folio.read', module: 'billing', level: 'PROPERTY', description: 'View guest folios, charges and payments' },
  { key: 'folio.charge', module: 'billing', level: 'PROPERTY', description: 'Post extra charges to an in-house guest folio' },
  { key: 'folio.adjust', module: 'billing', level: 'PROPERTY', description: 'Post discounts and adjustments; void charges' },
  { key: 'folio.override_checkout', module: 'billing', level: 'PROPERTY', description: 'Check a guest out with a balance due or credit' },
  { key: 'payment.take', module: 'billing', level: 'PROPERTY', description: 'Record payments and deposits' },
  { key: 'payment.refund', module: 'billing', level: 'PROPERTY', description: 'Refund payments' },
  { key: 'tax.manage', module: 'billing', level: 'PROPERTY', description: 'Configure property taxes and service charges' },
  { key: 'staff.read', module: 'staff', level: 'PROPERTY', description: 'View staff accounts' },
  { key: 'staff.manage', module: 'staff', level: 'PROPERTY', description: 'Create, edit, disable staff accounts' },
  { key: 'role.read', module: 'rbac', level: 'ORGANIZATION', description: 'View roles and permissions' },
  { key: 'role.manage', module: 'rbac', level: 'ORGANIZATION', description: 'Create and edit custom roles' },
  { key: 'role.assign', module: 'rbac', level: 'PROPERTY', description: 'Assign roles to staff (within own scope)' },
  { key: 'audit.read', module: 'audit', level: 'PROPERTY', description: 'View audit logs' },
] as const;

export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];

export const PERMISSION_LEVEL = Object.fromEntries(
  PERMISSION_CATALOG.map((p) => [p.key, p.level]),
) as Record<PermissionKey, PermissionLevel>;

export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);

export interface SystemRoleTemplate {
  key: string;
  name: string;
  description: string;
  permissions: readonly PermissionKey[];
}

/** Roles whose members work a desk or a task, never administer the company. */
export const OPERATIONAL_ROLE_KEYS = [
  'FRONT_DESK',
  'RECEPTIONIST',
  'HOUSEKEEPING_SUPERVISOR',
  'HOUSEKEEPER',
  'MAINTENANCE',
  'CASHIER',
  'ACCOUNTANT',
  'INVENTORY_MANAGER',
] as const;

const operational = (
  key: string,
  name: string,
  permissions: readonly PermissionKey[] = ['property.read'],
): SystemRoleTemplate => ({
  key,
  name,
  description: `${name} (more permissions arrive with their modules)`,
  permissions,
});

const ROOM_ADMIN: readonly PermissionKey[] = ['room.read', 'room.manage', 'room.update_status', 'room_type.manage'];
const RESERVATION_ADMIN: readonly PermissionKey[] = [
  'guest.read', 'guest.manage', 'reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read', 'rate.manage',
];
const BILLING_ADMIN: readonly PermissionKey[] = [
  'folio.read', 'folio.charge', 'folio.adjust', 'folio.override_checkout', 'payment.take', 'payment.refund', 'tax.manage',
];
const FRONT_DESK_PERMISSIONS: readonly PermissionKey[] = [
  'property.read', 'room.read', 'guest.read', 'guest.manage', 'reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read',
  'folio.read', 'folio.charge', 'payment.take',
];

// Operational roles only receive real permissions in the phase that introduces their module.
export const SYSTEM_ROLE_TEMPLATES: readonly SystemRoleTemplate[] = [
  { key: 'OWNER', name: 'Owner', description: 'Full access to the organization', permissions: ALL_PERMISSION_KEYS },
  { key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full administrative access', permissions: ALL_PERMISSION_KEYS },
  {
    key: 'GENERAL_MANAGER',
    name: 'General Manager',
    description: 'Manages properties and staff',
    permissions: [
      'organization.read', 'property_group.read', 'property.read', 'property.update',
      'staff.read', 'staff.manage', 'role.read', 'role.assign', 'audit.read', ...ROOM_ADMIN, ...RESERVATION_ADMIN, ...BILLING_ADMIN,
    ],
  },
  {
    key: 'PROPERTY_MANAGER',
    name: 'Branch Manager',
    description: 'Manages an assigned property, including staff, rates, adjustments, and refunds',
    permissions: ['property.read', 'property.update', 'staff.read', 'staff.manage', 'role.assign', ...ROOM_ADMIN, ...RESERVATION_ADMIN, ...BILLING_ADMIN],
  },
  operational('FRONT_DESK', 'Front Desk', FRONT_DESK_PERMISSIONS),
  operational('RECEPTIONIST', 'Receptionist', FRONT_DESK_PERMISSIONS),
  operational(
    'HOUSEKEEPING_SUPERVISOR',
    'Housekeeping Supervisor',
    ['property.read'],
  ),
  {
    key: 'HOUSEKEEPER',
    name: 'Housekeeper',
    description: 'Room-level assignments are not available yet; room access is withheld until they are.',
    permissions: ['property.read'],
  },
  {
    key: 'MAINTENANCE',
    name: 'Maintenance',
    description: 'Repair requests are not available yet.',
    permissions: ['property.read'],
  },
  operational('CASHIER', 'Cashier', ['property.read', 'reservation.read', 'folio.read', 'payment.take']),
  operational('ACCOUNTANT', 'Accountant', ['property.read', 'folio.read']),
  operational('INVENTORY_MANAGER', 'Inventory Manager'),
];

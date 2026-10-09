"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_ROLE_TEMPLATES = exports.OPERATIONAL_ROLE_KEYS = exports.ALL_PERMISSION_KEYS = exports.PERMISSION_LEVEL = exports.PERMISSION_CATALOG = void 0;
exports.PERMISSION_CATALOG = [
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
    { key: 'staff.read', module: 'staff', level: 'PROPERTY', description: 'View staff accounts' },
    { key: 'staff.manage', module: 'staff', level: 'PROPERTY', description: 'Create, edit, disable staff accounts' },
    { key: 'role.read', module: 'rbac', level: 'ORGANIZATION', description: 'View roles and permissions' },
    { key: 'role.manage', module: 'rbac', level: 'ORGANIZATION', description: 'Create and edit custom roles' },
    { key: 'role.assign', module: 'rbac', level: 'PROPERTY', description: 'Assign roles to staff (within own scope)' },
    { key: 'audit.read', module: 'audit', level: 'PROPERTY', description: 'View audit logs' },
];
exports.PERMISSION_LEVEL = Object.fromEntries(exports.PERMISSION_CATALOG.map((p) => [p.key, p.level]));
exports.ALL_PERMISSION_KEYS = exports.PERMISSION_CATALOG.map((p) => p.key);
/** Roles whose members work a desk or a task, never administer the company. */
exports.OPERATIONAL_ROLE_KEYS = [
    'FRONT_DESK',
    'RECEPTIONIST',
    'HOUSEKEEPING_SUPERVISOR',
    'HOUSEKEEPER',
    'MAINTENANCE',
    'CASHIER',
    'ACCOUNTANT',
    'INVENTORY_MANAGER',
];
const operational = (key, name, permissions = ['property.read']) => ({
    key,
    name,
    description: `${name} (more permissions arrive with their modules)`,
    permissions,
});
const ROOM_OPERATIONS = ['property.read', 'room.read', 'room.update_status'];
const ROOM_ADMIN = ['room.read', 'room.manage', 'room.update_status', 'room_type.manage'];
const RESERVATION_ADMIN = [
    'guest.read', 'guest.manage', 'reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read', 'rate.manage',
];
const FRONT_DESK_PERMISSIONS = [
    ...ROOM_OPERATIONS, 'guest.read', 'guest.manage', 'reservation.read', 'reservation.manage', 'reservation.check_in', 'rate.read',
];
// Operational roles only receive real permissions in the phase that introduces their module.
exports.SYSTEM_ROLE_TEMPLATES = [
    { key: 'OWNER', name: 'Owner', description: 'Full access to the organization', permissions: exports.ALL_PERMISSION_KEYS },
    { key: 'SUPER_ADMIN', name: 'Super Admin', description: 'Full administrative access', permissions: exports.ALL_PERMISSION_KEYS },
    {
        key: 'GENERAL_MANAGER',
        name: 'General Manager',
        description: 'Manages properties and staff',
        permissions: [
            'organization.read', 'property_group.read', 'property.read', 'property.update',
            'staff.read', 'staff.manage', 'role.read', 'role.assign', 'audit.read', ...ROOM_ADMIN, ...RESERVATION_ADMIN,
        ],
    },
    {
        key: 'PROPERTY_MANAGER',
        name: 'Property Manager',
        description: 'Manages assigned properties',
        permissions: ['property.read', 'property.update', 'staff.read', 'role.read', ...ROOM_ADMIN, ...RESERVATION_ADMIN],
    },
    operational('FRONT_DESK', 'Front Desk', FRONT_DESK_PERMISSIONS),
    operational('RECEPTIONIST', 'Receptionist', FRONT_DESK_PERMISSIONS),
    operational('HOUSEKEEPING_SUPERVISOR', 'Housekeeping Supervisor', ROOM_OPERATIONS),
    operational('HOUSEKEEPER', 'Housekeeper', ROOM_OPERATIONS),
    operational('MAINTENANCE', 'Maintenance', ROOM_OPERATIONS),
    operational('CASHIER', 'Cashier'),
    operational('ACCOUNTANT', 'Accountant', ['property.read', 'reservation.read', 'guest.read', 'rate.read']),
    operational('INVENTORY_MANAGER', 'Inventory Manager'),
];

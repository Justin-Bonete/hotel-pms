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
export declare const PERMISSION_CATALOG: readonly [{
    readonly key: "organization.read";
    readonly module: "organization";
    readonly level: "ORGANIZATION";
    readonly description: "View organization profile";
}, {
    readonly key: "organization.update";
    readonly module: "organization";
    readonly level: "ORGANIZATION";
    readonly description: "Edit organization profile";
}, {
    readonly key: "property_group.read";
    readonly module: "property";
    readonly level: "ORGANIZATION";
    readonly description: "View property groups";
}, {
    readonly key: "property_group.manage";
    readonly module: "property";
    readonly level: "ORGANIZATION";
    readonly description: "Create, edit, delete property groups";
}, {
    readonly key: "property.read";
    readonly module: "property";
    readonly level: "PROPERTY";
    readonly description: "View properties";
}, {
    readonly key: "property.create";
    readonly module: "property";
    readonly level: "ORGANIZATION";
    readonly description: "Create properties";
}, {
    readonly key: "property.update";
    readonly module: "property";
    readonly level: "PROPERTY";
    readonly description: "Edit properties";
}, {
    readonly key: "property.delete";
    readonly module: "property";
    readonly level: "ORGANIZATION";
    readonly description: "Archive properties";
}, {
    readonly key: "room.read";
    readonly module: "room";
    readonly level: "PROPERTY";
    readonly description: "View rooms and room types";
}, {
    readonly key: "room.manage";
    readonly module: "room";
    readonly level: "PROPERTY";
    readonly description: "Create, edit, archive rooms; set out-of-order";
}, {
    readonly key: "room.update_status";
    readonly module: "room";
    readonly level: "PROPERTY";
    readonly description: "Change room status (cleaning flow)";
}, {
    readonly key: "room_type.manage";
    readonly module: "room";
    readonly level: "PROPERTY";
    readonly description: "Create and edit room types";
}, {
    readonly key: "guest.read";
    readonly module: "guest";
    readonly level: "PROPERTY";
    readonly description: "View guest profiles";
}, {
    readonly key: "guest.manage";
    readonly module: "guest";
    readonly level: "PROPERTY";
    readonly description: "Create and edit guest profiles";
}, {
    readonly key: "reservation.read";
    readonly module: "reservation";
    readonly level: "PROPERTY";
    readonly description: "View reservations and the calendar";
}, {
    readonly key: "reservation.manage";
    readonly module: "reservation";
    readonly level: "PROPERTY";
    readonly description: "Create, edit, confirm, cancel reservations; assign rooms";
}, {
    readonly key: "reservation.check_in";
    readonly module: "reservation";
    readonly level: "PROPERTY";
    readonly description: "Check guests in and out";
}, {
    readonly key: "rate.read";
    readonly module: "rate";
    readonly level: "PROPERTY";
    readonly description: "View rate plans";
}, {
    readonly key: "rate.manage";
    readonly module: "rate";
    readonly level: "PROPERTY";
    readonly description: "Create and edit rate plans";
}, {
    readonly key: "folio.read";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "View guest folios, charges and payments";
}, {
    readonly key: "folio.charge";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "Post extra charges to an in-house guest folio";
}, {
    readonly key: "folio.adjust";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "Post discounts and adjustments; void charges";
}, {
    readonly key: "folio.override_checkout";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "Check a guest out with a balance due or credit";
}, {
    readonly key: "payment.take";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "Record payments and deposits";
}, {
    readonly key: "payment.refund";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "Refund payments";
}, {
    readonly key: "tax.manage";
    readonly module: "billing";
    readonly level: "PROPERTY";
    readonly description: "Configure property taxes and service charges";
}, {
    readonly key: "housekeeping.read";
    readonly module: "housekeeping";
    readonly level: "PROPERTY";
    readonly description: "View housekeeping tasks";
}, {
    readonly key: "housekeeping.work";
    readonly module: "housekeeping";
    readonly level: "PROPERTY";
    readonly description: "Receive and complete assigned cleaning tasks";
}, {
    readonly key: "housekeeping.manage";
    readonly module: "housekeeping";
    readonly level: "PROPERTY";
    readonly description: "Create, assign and inspect housekeeping tasks";
}, {
    readonly key: "maintenance.read";
    readonly module: "maintenance";
    readonly level: "PROPERTY";
    readonly description: "View maintenance tickets";
}, {
    readonly key: "maintenance.report";
    readonly module: "maintenance";
    readonly level: "PROPERTY";
    readonly description: "Report maintenance problems";
}, {
    readonly key: "maintenance.work";
    readonly module: "maintenance";
    readonly level: "PROPERTY";
    readonly description: "Work assigned maintenance tickets";
}, {
    readonly key: "maintenance.manage";
    readonly module: "maintenance";
    readonly level: "PROPERTY";
    readonly description: "Assign, close and reopen maintenance tickets";
}, {
    readonly key: "inventory.read";
    readonly module: "inventory";
    readonly level: "PROPERTY";
    readonly description: "View stock levels and movements";
}, {
    readonly key: "inventory.manage";
    readonly module: "inventory";
    readonly level: "PROPERTY";
    readonly description: "Manage items; record usage, wastage, adjustments; transfer stock";
}, {
    readonly key: "purchasing.read";
    readonly module: "purchasing";
    readonly level: "PROPERTY";
    readonly description: "View suppliers, purchase orders and supplier invoices";
}, {
    readonly key: "purchasing.manage";
    readonly module: "purchasing";
    readonly level: "PROPERTY";
    readonly description: "Manage suppliers";
}, {
    readonly key: "purchasing.request";
    readonly module: "purchasing";
    readonly level: "PROPERTY";
    readonly description: "Request purchases";
}, {
    readonly key: "purchasing.approve";
    readonly module: "purchasing";
    readonly level: "PROPERTY";
    readonly description: "Approve, reject or cancel purchase requests";
}, {
    readonly key: "purchasing.receive";
    readonly module: "purchasing";
    readonly level: "PROPERTY";
    readonly description: "Receive delivered goods into stock";
}, {
    readonly key: "purchasing.pay";
    readonly module: "purchasing";
    readonly level: "PROPERTY";
    readonly description: "Record supplier invoices and pay them";
}, {
    readonly key: "expense.read";
    readonly module: "expense";
    readonly level: "PROPERTY";
    readonly description: "View expenses";
}, {
    readonly key: "expense.manage";
    readonly module: "expense";
    readonly level: "PROPERTY";
    readonly description: "Record and void expenses";
}, {
    readonly key: "pos.read";
    readonly module: "pos";
    readonly level: "PROPERTY";
    readonly description: "View POS menus, orders and sales summaries";
}, {
    readonly key: "pos.sell";
    readonly module: "pos";
    readonly level: "PROPERTY";
    readonly description: "Ring up sales and charge them to a guest room";
}, {
    readonly key: "pos.void";
    readonly module: "pos";
    readonly level: "PROPERTY";
    readonly description: "Void a POS sale";
}, {
    readonly key: "pos.manage";
    readonly module: "pos";
    readonly level: "PROPERTY";
    readonly description: "Manage outlets and menu items";
}, {
    readonly key: "analytics.read";
    readonly module: "analytics";
    readonly level: "PROPERTY";
    readonly description: "View analytics and reports";
}, {
    readonly key: "staff.read";
    readonly module: "staff";
    readonly level: "PROPERTY";
    readonly description: "View staff accounts";
}, {
    readonly key: "staff.manage";
    readonly module: "staff";
    readonly level: "PROPERTY";
    readonly description: "Create, edit, disable staff accounts";
}, {
    readonly key: "role.read";
    readonly module: "rbac";
    readonly level: "ORGANIZATION";
    readonly description: "View roles and permissions";
}, {
    readonly key: "role.manage";
    readonly module: "rbac";
    readonly level: "ORGANIZATION";
    readonly description: "Create and edit custom roles";
}, {
    readonly key: "role.assign";
    readonly module: "rbac";
    readonly level: "PROPERTY";
    readonly description: "Assign roles to staff (within own scope)";
}, {
    readonly key: "audit.read";
    readonly module: "audit";
    readonly level: "PROPERTY";
    readonly description: "View audit logs";
}];
export type PermissionKey = (typeof PERMISSION_CATALOG)[number]['key'];
export declare const PERMISSION_LEVEL: Record<PermissionKey, PermissionLevel>;
export declare const ALL_PERMISSION_KEYS: readonly PermissionKey[];
export interface SystemRoleTemplate {
    key: string;
    name: string;
    description: string;
    permissions: readonly PermissionKey[];
}
/** Roles whose members work a desk or a task, never administer the company. */
export declare const OPERATIONAL_ROLE_KEYS: readonly ["FRONT_DESK", "RECEPTIONIST", "HOUSEKEEPING_SUPERVISOR", "HOUSEKEEPER", "MAINTENANCE", "CASHIER", "ACCOUNTANT", "INVENTORY_MANAGER"];
export declare const SYSTEM_ROLE_TEMPLATES: readonly SystemRoleTemplate[];

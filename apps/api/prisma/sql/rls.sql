-- Row-Level Security + least-privilege grants. Idempotent: safe to re-run after every migration.
-- Run as the OWNER role:  pnpm db:rls
--
-- How it works
--   The API connects as pms_app (NOT the table owner, NOBYPASSRLS). For each request it runs
--   SET LOCAL app.org_id = '<uuid>' inside the transaction. Rows of other organizations are
--   invisible and cannot be written, even if application code forgets a WHERE clause.
--   Auth flows that must run before a tenant is known (login, refresh, register) use
--   SET LOCAL app.bypass_rls = 'on' via ONE audited helper (PrismaService.withoutTenant).
--
-- PHASE RULE: every migration that adds a tenant table must also (1) add it to the array below
-- and (2) grant privileges. Default privileges are intentionally NOT used, so a forgotten table
-- is inaccessible to the API instead of silently unprotected.

CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.org_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION app_bypass_rls() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.bypass_rls', true), '') = 'on' $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'property_groups','properties','departments','buildings','floors',
    'users','user_sessions','auth_tokens','user_role_assignments','audit_logs',
    'room_types','rooms','guests','rate_plans','rate_plan_rates','reservations',
    'taxes','folios','folio_items','payments','refunds','housekeeping_tasks','maintenance_tickets',
    'suppliers','inventory_items','stock_movements','purchase_orders','purchase_order_lines','supplier_invoices','expenses'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (organization_id = app_org_id() OR app_bypass_rls())
         WITH CHECK (organization_id = app_org_id() OR app_bypass_rls())', t);
  END LOOP;
END $$;

-- organizations: the row itself is the tenant.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON organizations;
CREATE POLICY tenant_isolation ON organizations
  USING (id = app_org_id() OR app_bypass_rls())
  WITH CHECK (id = app_org_id() OR app_bypass_rls());

-- roles: system roles (organization_id IS NULL) are readable by all, writable by none.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON roles;
CREATE POLICY tenant_isolation ON roles
  USING (organization_id IS NULL OR organization_id = app_org_id() OR app_bypass_rls())
  WITH CHECK (organization_id = app_org_id() OR app_bypass_rls());

-- System role keys must be unique (a plain UNIQUE treats NULLs as distinct).
CREATE UNIQUE INDEX IF NOT EXISTS roles_system_key_unique ON roles (key) WHERE organization_id IS NULL;

-- Uniqueness among non-archived rows (a plain UNIQUE would block reusing an archived room number).
CREATE UNIQUE INDEX IF NOT EXISTS rooms_property_number_unique ON rooms (property_id, number) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS room_types_property_name_unique ON room_types (property_id, lower(name)) WHERE deleted_at IS NULL;

-- At most one open task of a kind per room (prevents duplicate cleaning tasks, even under concurrent check-outs).
CREATE UNIQUE INDEX IF NOT EXISTS housekeeping_one_open_task_per_room
  ON housekeeping_tasks (room_id, type) WHERE status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED');

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_org_name_unique ON suppliers (organization_id, lower(name)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_org_sku_unique ON inventory_items (organization_id, lower(sku)) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS guests_org_email_unique ON guests (organization_id, lower(email)) WHERE email IS NOT NULL AND deleted_at IS NULL;

-- ---- Reservations: the database itself refuses double-booking, whatever the application does.
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_no_room_overlap') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_no_room_overlap
      EXCLUDE USING gist (room_id WITH =, daterange(arrival_date, departure_date, '[)') WITH &&)
      WHERE (room_id IS NOT NULL AND status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_dates_check') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_dates_check CHECK (departure_date > arrival_date);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservations_guests_check') THEN
    ALTER TABLE reservations ADD CONSTRAINT reservations_guests_check CHECK (adults >= 1 AND children >= 0 AND total_minor >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stock_movements_quantity_check') THEN
    ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_quantity_check CHECK (quantity <> 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_thresholds_check') THEN
    ALTER TABLE inventory_items ADD CONSTRAINT inventory_items_thresholds_check CHECK (min_stock >= 0 AND max_stock >= 0 AND unit_cost_minor >= 0 AND (max_stock = 0 OR max_stock >= min_stock));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_lines_check') THEN
    ALTER TABLE purchase_order_lines ADD CONSTRAINT purchase_lines_check CHECK (quantity > 0 AND unit_cost_minor >= 0 AND received_quantity >= 0 AND received_quantity <= quantity);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_total_check') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_total_check CHECK (total_minor >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_invoices_amount_check') THEN
    ALTER TABLE supplier_invoices ADD CONSTRAINT supplier_invoices_amount_check CHECK (amount_minor > 0 AND received_value_minor >= 0 AND due_on >= issued_on);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_amount_check') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK (amount_minor > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_nonnegative_check') THEN
    ALTER TABLE maintenance_tickets ADD CONSTRAINT maintenance_nonnegative_check CHECK (cost_minor >= 0 AND minutes_spent >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'housekeeping_estimate_check') THEN
    ALTER TABLE housekeeping_tasks ADD CONSTRAINT housekeeping_estimate_check CHECK (estimated_minutes IS NULL OR estimated_minutes > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'folio_items_amount_check') THEN
    ALTER TABLE folio_items ADD CONSTRAINT folio_items_amount_check CHECK (quantity >= 1 AND amount_minor = quantity * unit_amount_minor);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_check') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount_minor > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'refunds_amount_check') THEN
    ALTER TABLE refunds ADD CONSTRAINT refunds_amount_check CHECK (amount_minor > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'taxes_rate_check') THEN
    ALTER TABLE taxes ADD CONSTRAINT taxes_rate_check CHECK (rate_bps BETWEEN 0 AND 10000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'rate_plan_rates_nonnegative_check') THEN
    ALTER TABLE rate_plan_rates ADD CONSTRAINT rate_plan_rates_nonnegative_check CHECK (nightly_rate_minor >= 0 AND (weekend_rate_minor IS NULL OR weekend_rate_minor >= 0));
  END IF;
END $$;

-- ------------------------------------------------------------ grants (least privilege)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, property_groups, properties, departments, buildings, floors,
  users, user_sessions, auth_tokens, roles, role_permissions, user_role_assignments,
  room_types, rooms, guests, rate_plans, rate_plan_rates, reservations, taxes
TO pms_app;

-- Folios may be opened and closed (UPDATE) but never deleted. Tasks and tickets are never deleted either.
GRANT SELECT, INSERT, UPDATE ON folios, housekeeping_tasks, maintenance_tickets,
  suppliers, inventory_items, purchase_orders, purchase_order_lines, supplier_invoices, expenses TO pms_app;

-- The STOCK LEDGER is append-only, like the money ledger: movements are never changed or removed.
GRANT SELECT, INSERT ON stock_movements TO pms_app;
REVOKE UPDATE, DELETE, TRUNCATE ON stock_movements FROM pms_app;

-- The money ledger is APPEND-ONLY for the application: insert and read, never change or remove.
GRANT SELECT, INSERT ON folio_items, payments, refunds TO pms_app;
REVOKE UPDATE, DELETE, TRUNCATE ON folio_items, payments, refunds FROM pms_app;

-- Permissions are code-defined and seeded by the owner role only.
GRANT SELECT ON permissions TO pms_app;

-- Audit log is APPEND-ONLY for the application.
GRANT SELECT, INSERT ON audit_logs TO pms_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM pms_app;

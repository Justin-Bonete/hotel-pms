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
    'room_types','rooms'
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

-- ------------------------------------------------------------ grants (least privilege)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, property_groups, properties, departments, buildings, floors,
  users, user_sessions, auth_tokens, roles, role_permissions, user_role_assignments,
  room_types, rooms
TO pms_app;

-- Permissions are code-defined and seeded by the owner role only.
GRANT SELECT ON permissions TO pms_app;

-- Audit log is APPEND-ONLY for the application.
GRANT SELECT, INSERT ON audit_logs TO pms_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM pms_app;

-- CreateEnum
CREATE TYPE "organization_status" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('INVITED', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "property_type" AS ENUM ('HOTEL', 'RESORT', 'BOUTIQUE', 'INN', 'HOSTEL', 'SERVICED_APARTMENT', 'VACATION_RENTAL');

-- CreateEnum
CREATE TYPE "property_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "scope_type" AS ENUM ('ORGANIZATION', 'GROUP', 'PROPERTY');

-- CreateEnum
CREATE TYPE "auth_token_type" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "organization_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_groups" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "property_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "group_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "property_type" NOT NULL DEFAULT 'HOTEL',
    "status" "property_status" NOT NULL DEFAULT 'ACTIVE',
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" CHAR(2) NOT NULL DEFAULT 'PH',
    "postal_code" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "check_in_time" VARCHAR(5) NOT NULL DEFAULT '14:00',
    "check_out_time" VARCHAR(5) NOT NULL DEFAULT '12:00',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "status" "user_status" NOT NULL DEFAULT 'INVITED',
    "email_verified_at" TIMESTAMPTZ,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_label" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "auth_token_type" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "scope_type" "scope_type" NOT NULL,
    "scope_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "property_groups_organization_id_idx" ON "property_groups"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "property_groups_organization_id_name_key" ON "property_groups"("organization_id", "name");

-- CreateIndex
CREATE INDEX "properties_organization_id_group_id_idx" ON "properties"("organization_id", "group_id");

-- CreateIndex
CREATE INDEX "properties_organization_id_status_idx" ON "properties"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "properties_organization_id_slug_key" ON "properties"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_property_id_name_key" ON "departments"("property_id", "name");

-- CreateIndex
CREATE INDEX "buildings_organization_id_idx" ON "buildings"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_property_id_name_key" ON "buildings"("property_id", "name");

-- CreateIndex
CREATE INDEX "floors_organization_id_idx" ON "floors"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_level_key" ON "floors"("building_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_status_idx" ON "users"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_refresh_token_hash_key" ON "user_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_organization_id_idx" ON "user_sessions"("organization_id");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_revoked_at_idx" ON "user_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "user_sessions_family_id_idx" ON "user_sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_tokens_organization_id_idx" ON "auth_tokens"("organization_id");

-- CreateIndex
CREATE INDEX "auth_tokens_user_id_type_idx" ON "auth_tokens"("user_id", "type");

-- CreateIndex
CREATE INDEX "roles_organization_id_idx" ON "roles"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_organization_id_key_key" ON "roles"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_role_assignments_organization_id_idx" ON "user_role_assignments"("organization_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_user_id_idx" ON "user_role_assignments"("user_id");

-- CreateIndex
CREATE INDEX "user_role_assignments_scope_type_scope_id_idx" ON "user_role_assignments"("scope_type", "scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_role_id_scope_type_scope_id_key" ON "user_role_assignments"("user_id", "role_id", "scope_type", "scope_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_created_at_idx" ON "audit_logs"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_entity_entity_id_idx" ON "audit_logs"("organization_id", "entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_property_id_created_at_idx" ON "audit_logs"("organization_id", "property_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "property_groups" ADD CONSTRAINT "property_groups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "property_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

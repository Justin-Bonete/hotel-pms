-- CreateEnum
CREATE TYPE "housekeeping_task_type" AS ENUM ('CHECKOUT_CLEAN', 'STAYOVER', 'DEEP_CLEAN');

-- CreateEnum
CREATE TYPE "task_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "housekeeping_status" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'CLEANED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "maintenance_category" AS ENUM ('AIRCON', 'PLUMBING', 'ELECTRICAL', 'FURNITURE', 'INTERNET', 'APPLIANCE', 'STRUCTURAL', 'OTHER');

-- CreateEnum
CREATE TYPE "maintenance_status" AS ENUM ('REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CLOSED');

-- AlterEnum
ALTER TYPE "room_status" ADD VALUE 'CLEAN';

-- CreateTable
CREATE TABLE "housekeeping_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_id" UUID NOT NULL,
    "type" "housekeeping_task_type" NOT NULL,
    "status" "housekeeping_status" NOT NULL DEFAULT 'OPEN',
    "priority" "task_priority" NOT NULL DEFAULT 'NORMAL',
    "assigned_to_id" UUID,
    "assigned_at" TIMESTAMPTZ,
    "estimated_minutes" INTEGER,
    "notes" TEXT,
    "started_at" TIMESTAMPTZ,
    "cleaned_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "housekeeping_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_tickets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "room_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "maintenance_category" NOT NULL,
    "priority" "task_priority" NOT NULL DEFAULT 'NORMAL',
    "status" "maintenance_status" NOT NULL DEFAULT 'REPORTED',
    "blocks_room" BOOLEAN NOT NULL DEFAULT false,
    "assigned_to_id" UUID,
    "reported_by_id" UUID,
    "cost_minor" INTEGER NOT NULL DEFAULT 0,
    "minutes_spent" INTEGER NOT NULL DEFAULT 0,
    "parts_used" TEXT,
    "resolution_note" TEXT,
    "assigned_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "maintenance_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "housekeeping_tasks_organization_id_property_id_status_idx" ON "housekeeping_tasks"("organization_id", "property_id", "status");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_room_id_idx" ON "housekeeping_tasks"("room_id");

-- CreateIndex
CREATE INDEX "housekeeping_tasks_assigned_to_id_idx" ON "housekeeping_tasks"("assigned_to_id");

-- CreateIndex
CREATE INDEX "maintenance_tickets_organization_id_property_id_status_idx" ON "maintenance_tickets"("organization_id", "property_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_tickets_room_id_idx" ON "maintenance_tickets"("room_id");

-- CreateIndex
CREATE INDEX "maintenance_tickets_assigned_to_id_idx" ON "maintenance_tickets"("assigned_to_id");

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

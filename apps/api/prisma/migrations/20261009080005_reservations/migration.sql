-- CreateEnum
CREATE TYPE "reservation_status" AS ENUM ('INQUIRY', 'PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "reservation_source" AS ENUM ('WALK_IN', 'PHONE', 'WEBSITE', 'OTA', 'GROUP', 'CORPORATE', 'TRAVEL_AGENT', 'OTHER');

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "country" CHAR(2),
    "preferences" TEXT,
    "notes" TEXT,
    "is_vip" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plans" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_plan_rates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "rate_plan_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "nightly_rate_minor" INTEGER NOT NULL,
    "weekend_rate_minor" INTEGER,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rate_plan_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "guest_id" UUID NOT NULL,
    "room_type_id" UUID NOT NULL,
    "room_id" UUID,
    "rate_plan_id" UUID,
    "status" "reservation_status" NOT NULL DEFAULT 'CONFIRMED',
    "source" "reservation_source" NOT NULL DEFAULT 'PHONE',
    "arrival_date" DATE NOT NULL,
    "departure_date" DATE NOT NULL,
    "adults" INTEGER NOT NULL DEFAULT 1,
    "children" INTEGER NOT NULL DEFAULT 0,
    "nights" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "special_requests" TEXT,
    "notes" TEXT,
    "cancel_reason" TEXT,
    "cancelled_at" TIMESTAMPTZ,
    "checked_in_at" TIMESTAMPTZ,
    "checked_out_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guests_organization_id_last_name_idx" ON "guests"("organization_id", "last_name");

-- CreateIndex
CREATE INDEX "guests_organization_id_email_idx" ON "guests"("organization_id", "email");

-- CreateIndex
CREATE INDEX "rate_plans_organization_id_idx" ON "rate_plans"("organization_id");

-- CreateIndex
CREATE INDEX "rate_plans_property_id_idx" ON "rate_plans"("property_id");

-- CreateIndex
CREATE INDEX "rate_plan_rates_organization_id_idx" ON "rate_plan_rates"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_plan_rates_rate_plan_id_room_type_id_key" ON "rate_plan_rates"("rate_plan_id", "room_type_id");

-- CreateIndex
CREATE INDEX "reservations_organization_id_property_id_arrival_date_idx" ON "reservations"("organization_id", "property_id", "arrival_date");

-- CreateIndex
CREATE INDEX "reservations_property_id_status_idx" ON "reservations"("property_id", "status");

-- CreateIndex
CREATE INDEX "reservations_guest_id_idx" ON "reservations"("guest_id");

-- CreateIndex
CREATE INDEX "reservations_room_id_idx" ON "reservations"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_organization_id_code_key" ON "reservations"("organization_id", "code");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_rates" ADD CONSTRAINT "rate_plan_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_rates" ADD CONSTRAINT "rate_plan_rates_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_plan_rates" ADD CONSTRAINT "rate_plan_rates_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "rate_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "folio_status" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "folio_item_type" AS ENUM ('ROOM_CHARGE', 'EXTRA_CHARGE', 'TAX', 'DISCOUNT', 'ADJUSTMENT', 'REVERSAL');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'E_WALLET', 'OTHER');

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "nightly_rates" JSONB;

-- CreateTable
CREATE TABLE "taxes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate_bps" INTEGER NOT NULL,
    "applies_to_room" BOOLEAN NOT NULL DEFAULT true,
    "applies_to_extras" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "taxes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folios" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "status" "folio_status" NOT NULL DEFAULT 'OPEN',
    "currency" CHAR(3) NOT NULL,
    "room_charges_posted_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "folios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folio_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folio_id" UUID NOT NULL,
    "type" "folio_item_type" NOT NULL,
    "description" TEXT NOT NULL,
    "service_date" DATE,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount_minor" INTEGER NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "parent_item_id" UUID,
    "tax_id" UUID,
    "reverses_item_id" UUID,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'FRONT_DESK',
    "idempotency_key" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "folio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "folio_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "method" "payment_method" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "idempotency_key" TEXT,
    "received_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "idempotency_key" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "taxes_organization_id_idx" ON "taxes"("organization_id");

-- CreateIndex
CREATE INDEX "taxes_property_id_idx" ON "taxes"("property_id");

-- CreateIndex
CREATE UNIQUE INDEX "folios_reservation_id_key" ON "folios"("reservation_id");

-- CreateIndex
CREATE INDEX "folios_organization_id_property_id_idx" ON "folios"("organization_id", "property_id");

-- CreateIndex
CREATE UNIQUE INDEX "folio_items_reverses_item_id_key" ON "folio_items"("reverses_item_id");

-- CreateIndex
CREATE INDEX "folio_items_folio_id_idx" ON "folio_items"("folio_id");

-- CreateIndex
CREATE INDEX "folio_items_organization_id_idx" ON "folio_items"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "folio_items_organization_id_idempotency_key_key" ON "folio_items"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payments_folio_id_idx" ON "payments"("folio_id");

-- CreateIndex
CREATE INDEX "payments_organization_id_idx" ON "payments"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organization_id_idempotency_key_key" ON "payments"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "refunds_payment_id_idx" ON "refunds"("payment_id");

-- CreateIndex
CREATE INDEX "refunds_organization_id_idx" ON "refunds"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_organization_id_idempotency_key_key" ON "refunds"("organization_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxes" ADD CONSTRAINT "taxes_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folios" ADD CONSTRAINT "folios_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_parent_item_id_fkey" FOREIGN KEY ("parent_item_id") REFERENCES "folio_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folio_items" ADD CONSTRAINT "folio_items_reverses_item_id_fkey" FOREIGN KEY ("reverses_item_id") REFERENCES "folio_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_folio_id_fkey" FOREIGN KEY ("folio_id") REFERENCES "folios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

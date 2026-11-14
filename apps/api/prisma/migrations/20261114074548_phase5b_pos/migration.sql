-- CreateEnum
CREATE TYPE "outlet_type" AS ENUM ('RESTAURANT', 'BAR', 'CAFE', 'ROOM_SERVICE', 'MINIBAR', 'SPA', 'LAUNDRY', 'OTHER');

-- CreateEnum
CREATE TYPE "pos_order_status" AS ENUM ('PAID', 'ROOM_CHARGED', 'VOID');

-- CreateTable
CREATE TABLE "pos_outlets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "outlet_type" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pos_outlets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "price_minor" INTEGER NOT NULL,
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "inventory_item_id" UUID,
    "inventory_quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "pos_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "property_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "status" "pos_order_status" NOT NULL,
    "table_label" TEXT,
    "note" TEXT,
    "reservation_id" UUID,
    "payment_method" "payment_method",
    "subtotal_minor" INTEGER NOT NULL,
    "tax_minor" INTEGER NOT NULL,
    "total_minor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "idempotency_key" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMPTZ,
    "voided_by_id" UUID,
    "void_reason" TEXT,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "pos_item_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_amount_minor" INTEGER NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "taxable" BOOLEAN NOT NULL,
    "tax_minor" INTEGER NOT NULL,
    "inventory_item_id" UUID,
    "inventory_quantity" INTEGER NOT NULL DEFAULT 0,
    "folio_item_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pos_outlets_organization_id_property_id_idx" ON "pos_outlets"("organization_id", "property_id");

-- CreateIndex
CREATE INDEX "pos_items_organization_id_outlet_id_idx" ON "pos_items"("organization_id", "outlet_id");

-- CreateIndex
CREATE INDEX "pos_orders_organization_id_property_id_created_at_idx" ON "pos_orders"("organization_id", "property_id", "created_at");

-- CreateIndex
CREATE INDEX "pos_orders_reservation_id_idx" ON "pos_orders"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_organization_id_code_key" ON "pos_orders"("organization_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "pos_orders_organization_id_idempotency_key_key" ON "pos_orders"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "pos_order_lines_organization_id_idx" ON "pos_order_lines"("organization_id");

-- CreateIndex
CREATE INDEX "pos_order_lines_order_id_idx" ON "pos_order_lines"("order_id");

-- AddForeignKey
ALTER TABLE "pos_outlets" ADD CONSTRAINT "pos_outlets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_outlets" ADD CONSTRAINT "pos_outlets_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_items" ADD CONSTRAINT "pos_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_items" ADD CONSTRAINT "pos_items_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_items" ADD CONSTRAINT "pos_items_inventory_item_id_fkey" FOREIGN KEY ("inventory_item_id") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_outlet_id_fkey" FOREIGN KEY ("outlet_id") REFERENCES "pos_outlets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "pos_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

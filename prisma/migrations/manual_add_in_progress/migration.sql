-- Add IN_PROGRESS to ProductionStatus enum
ALTER TYPE "ProductionStatus" ADD VALUE 'IN_PROGRESS';

-- Add new columns to production_orders
ALTER TABLE "production_orders"
  ADD COLUMN "actual_quantity" DECIMAL(14,3),
  ADD COLUMN "estimated_unit_cost" DECIMAL(14,4),
  ADD COLUMN "estimated_total_cost" DECIMAL(14,2),
  ADD COLUMN "started_at" TIMESTAMPTZ,
  ADD COLUMN "started_by" UUID REFERENCES "users"("id");

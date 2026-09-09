ALTER TABLE "businesses"
ADD COLUMN "number_format" TEXT NOT NULL DEFAULT 'US',
ADD COLUMN "money_decimals" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN "cost_decimals" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN "quantity_decimals" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "businesses"
ADD CONSTRAINT "businesses_number_format_check" CHECK ("number_format" IN ('US', 'EU')),
ADD CONSTRAINT "businesses_money_decimals_check" CHECK ("money_decimals" BETWEEN 0 AND 6),
ADD CONSTRAINT "businesses_cost_decimals_check" CHECK ("cost_decimals" BETWEEN 0 AND 6),
ADD CONSTRAINT "businesses_quantity_decimals_check" CHECK ("quantity_decimals" BETWEEN 0 AND 6);

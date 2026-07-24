-- Migration: Add unitPrice to PurchaseItem
ALTER TABLE purchase_items ADD COLUMN IF NOT EXISTS unit_price DECIMAL(14, 2) NOT NULL DEFAULT 0;

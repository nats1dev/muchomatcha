-- Vistas analíticas de solo lectura para Power BI
-- Se aplican también desde prisma/seed o migración manual.

CREATE OR REPLACE VIEW bi_sales_detail AS
SELECT
  s.id AS sale_id,
  s.business_id,
  s.sale_number,
  s.sold_at,
  s.status,
  s.payment_method,
  p.id AS product_id,
  p.name AS product_name,
  pc.name AS category_name,
  si.quantity,
  si.unit_price,
  si.discount,
  si.tax,
  si.line_total,
  si.unit_cost_snapshot,
  (si.unit_price * si.quantity - si.discount) AS net_revenue,
  (si.unit_cost_snapshot * si.quantity) AS line_cost,
  ((si.unit_price * si.quantity - si.discount) - (si.unit_cost_snapshot * si.quantity)) AS line_profit
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON p.id = si.product_id
LEFT JOIN product_categories pc ON pc.id = p.category_id;

CREATE OR REPLACE VIEW bi_daily_sales AS
SELECT
  business_id,
  (sold_at AT TIME ZONE 'America/Guatemala')::date AS sale_date,
  COUNT(*) FILTER (WHERE status = 'CONFIRMED') AS tickets,
  COALESCE(SUM(subtotal - discount_total) FILTER (WHERE status = 'CONFIRMED'), 0) AS sales_net,
  COALESCE(SUM(tax_total) FILTER (WHERE status = 'CONFIRMED'), 0) AS tax_total,
  COALESCE(SUM(total) FILTER (WHERE status = 'CONFIRMED'), 0) AS sales_gross
FROM sales
GROUP BY business_id, (sold_at AT TIME ZONE 'America/Guatemala')::date;

CREATE OR REPLACE VIEW bi_product_profitability AS
SELECT
  s.business_id,
  p.id AS product_id,
  p.name AS product_name,
  pc.name AS category_name,
  SUM(si.quantity) FILTER (WHERE s.status = 'CONFIRMED') AS quantity_sold,
  SUM(si.unit_price * si.quantity - si.discount) FILTER (WHERE s.status = 'CONFIRMED') AS revenue,
  SUM(si.unit_cost_snapshot * si.quantity) FILTER (WHERE s.status = 'CONFIRMED') AS cost,
  SUM((si.unit_price * si.quantity - si.discount) - (si.unit_cost_snapshot * si.quantity))
    FILTER (WHERE s.status = 'CONFIRMED') AS profit
FROM sales s
JOIN sale_items si ON si.sale_id = s.id
JOIN products p ON p.id = si.product_id
LEFT JOIN product_categories pc ON pc.id = p.category_id
GROUP BY s.business_id, p.id, p.name, pc.name;

CREATE OR REPLACE VIEW bi_purchase_detail AS
SELECT
  pu.id AS purchase_id,
  pu.business_id,
  pu.purchased_at,
  su.name AS supplier_name,
  pu.document_number,
  i.id AS ingredient_id,
  i.name AS ingredient_name,
  pi.purchase_quantity,
  pi.base_quantity,
  pi.unit_cost,
  pi.line_total,
  pu.total AS purchase_total
FROM purchases pu
JOIN purchase_items pi ON pi.purchase_id = pu.id
JOIN ingredients i ON i.id = pi.ingredient_id
JOIN suppliers su ON su.id = pu.supplier_id;

CREATE OR REPLACE VIEW bi_inventory_current AS
SELECT
  i.business_id,
  i.id AS ingredient_id,
  i.sku,
  i.name,
  u.code AS base_unit,
  COALESCE(SUM(m.quantity_delta), 0) AS quantity,
  i.minimum_stock,
  i.current_average_cost,
  COALESCE(SUM(m.quantity_delta), 0) * i.current_average_cost AS inventory_value,
  CASE
    WHEN COALESCE(SUM(m.quantity_delta), 0) < i.minimum_stock THEN true
    ELSE false
  END AS below_minimum
FROM ingredients i
JOIN units u ON u.id = i.base_unit_id
LEFT JOIN inventory_movements m ON m.ingredient_id = i.id
WHERE i.active = true
GROUP BY i.business_id, i.id, i.sku, i.name, u.code, i.minimum_stock, i.current_average_cost;

CREATE OR REPLACE VIEW bi_inventory_movements AS
SELECT
  m.id,
  m.business_id,
  m.occurred_at,
  i.name AS ingredient_name,
  m.movement_type,
  m.quantity_delta,
  m.unit_cost,
  m.reference_type,
  m.reference_id,
  m.reason
FROM inventory_movements m
JOIN ingredients i ON i.id = m.ingredient_id;

CREATE OR REPLACE VIEW bi_expenses AS
SELECT
  e.id,
  e.business_id,
  e.expense_date,
  e.category,
  e.description,
  e.subtotal,
  e.tax_total,
  e.total,
  e.payment_method,
  e.payment_status,
  s.name AS supplier_name
FROM expenses e
LEFT JOIN suppliers s ON s.id = e.supplier_id;

CREATE OR REPLACE VIEW bi_cash_closures AS
SELECT
  cs.id,
  cs.business_id,
  cs.opened_at,
  cs.closed_at,
  cs.status,
  cs.opening_amount,
  cs.expected_amount,
  cs.counted_amount,
  cs.difference_amount,
  cs.sale_cash_total,
  cs.close_notes
FROM cash_sessions cs;

CREATE OR REPLACE VIEW bi_profit_and_loss_monthly AS
WITH sales_m AS (
  SELECT
    business_id,
    date_trunc('month', sold_at AT TIME ZONE 'America/Guatemala') AS month,
    SUM(subtotal - discount_total) FILTER (WHERE status = 'CONFIRMED') AS sales_net,
    SUM(
      (SELECT COALESCE(SUM(si.unit_cost_snapshot * si.quantity), 0)
       FROM sale_items si WHERE si.sale_id = s.id)
    ) FILTER (WHERE status = 'CONFIRMED') AS cogs
  FROM sales s
  GROUP BY business_id, date_trunc('month', sold_at AT TIME ZONE 'America/Guatemala')
),
exp_m AS (
  SELECT
    business_id,
    date_trunc('month', expense_date::timestamp) AS month,
    SUM(total) AS expenses
  FROM expenses
  GROUP BY business_id, date_trunc('month', expense_date::timestamp)
)
SELECT
  COALESCE(sm.business_id, em.business_id) AS business_id,
  COALESCE(sm.month, em.month) AS month,
  COALESCE(sm.sales_net, 0) AS sales_net,
  COALESCE(sm.cogs, 0) AS cost_of_sales,
  COALESCE(sm.sales_net, 0) - COALESCE(sm.cogs, 0) AS gross_profit,
  COALESCE(em.expenses, 0) AS operating_expenses,
  (COALESCE(sm.sales_net, 0) - COALESCE(sm.cogs, 0) - COALESCE(em.expenses, 0)) AS operating_result
FROM sales_m sm
FULL OUTER JOIN exp_m em
  ON sm.business_id = em.business_id AND sm.month = em.month;

-- Ejecutar como superusuario de la base en la nube.
-- Crea un rol de solo lectura limitado a vistas bi_*.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bi_readonly') THEN
    CREATE ROLE bi_readonly LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE CURRENT_DATABASE TO bi_readonly;
GRANT USAGE ON SCHEMA public TO bi_readonly;
GRANT SELECT ON
  bi_sales_detail,
  bi_daily_sales,
  bi_product_profitability,
  bi_purchase_detail,
  bi_inventory_current,
  bi_inventory_movements,
  bi_expenses,
  bi_cash_closures,
  bi_profit_and_loss_monthly,
  bi_production_variance
TO bi_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO bi_readonly;

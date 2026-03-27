-- Migration: add performance indexes across all major tables
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_client_type ON transactions(client_id, type);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_affiliate_id ON clients(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_client_id ON ad_accounts(client_id);
CREATE INDEX IF NOT EXISTS idx_ad_accounts_status ON ad_accounts(status);
CREATE INDEX IF NOT EXISTS idx_topup_requests_status ON topup_requests(status);
CREATE INDEX IF NOT EXISTS idx_topup_requests_client_id ON topup_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_lookup ON affiliate_commissions(affiliate_id, period_year, period_month, status);
CREATE INDEX IF NOT EXISTS idx_supplier_platform_fees_lookup ON supplier_platform_fees(supplier_sub_account_id, platform);

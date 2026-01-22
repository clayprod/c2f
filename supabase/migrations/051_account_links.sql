-- Table to link Pluggy accounts with internal accounts
CREATE TABLE IF NOT EXISTS account_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pluggy_account_id UUID NOT NULL REFERENCES pluggy_accounts(id) ON DELETE CASCADE,
  internal_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, pluggy_account_id),
  UNIQUE (user_id, internal_account_id)
);

-- Enable RLS
ALTER TABLE account_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own account links"
  ON account_links FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own account links"
  ON account_links FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own account links"
  ON account_links FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own account links"
  ON account_links FOR DELETE
  USING (user_id = auth.uid());

-- Add imported flag to pluggy_transactions to track which transactions have been imported
ALTER TABLE pluggy_transactions
ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS imported_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL;

-- Index for finding non-imported transactions
CREATE INDEX IF NOT EXISTS idx_pluggy_transactions_not_imported 
  ON pluggy_transactions(user_id, account_id) 
  WHERE imported_at IS NULL;

-- Index for account links
CREATE INDEX IF NOT EXISTS idx_account_links_user ON account_links(user_id);
CREATE INDEX IF NOT EXISTS idx_account_links_pluggy ON account_links(pluggy_account_id);
CREATE INDEX IF NOT EXISTS idx_account_links_internal ON account_links(internal_account_id);

COMMENT ON TABLE account_links IS 'Links between Pluggy external accounts and internal c2f accounts';
COMMENT ON COLUMN pluggy_transactions.imported_at IS 'Timestamp when this transaction was imported to main transactions table';
COMMENT ON COLUMN pluggy_transactions.imported_transaction_id IS 'Reference to the created transaction in main table';

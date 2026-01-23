-- Migration: Add Investment Category Cascade Delete
-- Description: Add category_id foreign key to investments and cleanup orphan categories

-- 1. Add category_id column to investments if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'investments'
    AND column_name = 'category_id'
  ) THEN
    ALTER TABLE public.investments
    ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'investments'
    AND constraint_name = 'investments_category_id_fkey'
  ) THEN
    ALTER TABLE public.investments
    ADD CONSTRAINT investments_category_id_fkey
    FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Create function to cleanup orphan investment categories
CREATE OR REPLACE FUNCTION cleanup_orphan_investment_categories()
RETURNS TRIGGER AS $$
DECLARE
  v_category_id UUID;
BEGIN
  -- Get the category_id from the deleted investment
  v_category_id := OLD.category_id;
  
  -- If there's a category_id, check if it should be deleted
  IF v_category_id IS NOT NULL THEN
    -- Delete the category only if:
    -- 1. It's not used by any other investment
    -- 2. It's not used by any transaction
    -- 3. It's not used by any budget
    -- 4. It's not used by any goal, debt, receivable, or asset
    -- 5. It was created for an investment (source_type = 'investment' OR has investment icon/color pattern)
    DELETE FROM public.categories
    WHERE id = v_category_id
      AND NOT EXISTS (
        SELECT 1 FROM public.investments i WHERE i.category_id = v_category_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.transactions t WHERE t.category_id = v_category_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.budgets b WHERE b.category_id = v_category_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.goals g WHERE g.category_id = v_category_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.debts d WHERE d.category_id = v_category_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.receivables r WHERE r.category_id = v_category_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.assets a WHERE a.category_id = v_category_id
      )
      AND (
        source_type = 'investment'
        OR (
          icon = '📊'
          AND color = '#00CED1'
          AND type = 'expense'
        )
      );
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create trigger to cleanup orphan categories when investment is deleted
DROP TRIGGER IF EXISTS cleanup_investment_categories_trigger ON public.investments;
CREATE TRIGGER cleanup_investment_categories_trigger
  AFTER DELETE ON public.investments
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphan_investment_categories();

-- 5. Create index on category_id for performance
CREATE INDEX IF NOT EXISTS idx_investments_category_id ON public.investments(category_id)
WHERE category_id IS NOT NULL;

-- 6. Comments
COMMENT ON FUNCTION cleanup_orphan_investment_categories() IS 'Deletes orphan categories when an investment is deleted, only if the category is not used elsewhere';
COMMENT ON COLUMN public.investments.category_id IS 'Category associated with this investment (created automatically when investment is created)';
